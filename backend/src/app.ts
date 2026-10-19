import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { findBudgetApis, DEFAULT_BUDGET_INPUT } from '../../src/lib/budget.js';
import { billingKind, estimateApi, type Usage } from '../../src/lib/cost.js';
import { paginate, searchApis } from '../../src/lib/search.js';
import { cleanName } from '../../src/lib/collections.js';
import {
  CATEGORIES,
  CURRENCIES,
  PRICING_MODELS,
  type ApiEntry,
} from '../../src/types/catalog.js';
import { loadCatalog } from './catalog.js';
import { ApiVerseDatabase } from './database.js';
import { randomUUID } from 'node:crypto';

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const httpUrl = z.string().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Must be an HTTP(S) URL without credentials.');

const usageSchema = {
  monthlyRequests: z.number().finite().min(0).max(1_000_000_000).optional(),
  monthlyUsers: z.number().finite().min(0).max(1_000_000_000).optional(),
  monthlyDataGb: z.number().finite().min(0).max(1_000_000_000).optional(),
  monthlyInputTokens: z.number().finite().min(0).max(1_000_000_000_000).optional(),
  monthlyOutputTokens: z.number().finite().min(0).max(1_000_000_000_000).optional(),
};

const listQuerySchema = z.object({
  q: z.string().max(200).default(''),
  category: z.enum(CATEGORIES).optional(),
  auth: z.enum(['any', 'none', 'required']).default('any'),
  https: z.enum(['1', 'true']).optional(),
  pricing: z.enum(PRICING_MODELS).optional(),
  free: z.enum(['1', 'true']).optional(),
  verified: z.enum(['1', 'true']).optional(),
  sort: z.enum(['relevance', 'name', 'verified']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  apiIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(200),
}).strict();

const submissionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  documentationUrl: httpUrl,
  websiteUrl: httpUrl,
  category: z.enum(CATEGORIES),
  description: z.string().trim().min(20).max(1000),
  pricingUrl: httpUrl.nullable().optional(),
  termsUrl: httpUrl.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

const reportSchema = z.object({
  apiId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  details: z.string().trim().min(10).max(2000),
  sourceUrl: httpUrl.nullable().optional(),
}).strict();

const budgetSchema = z.object({
  category: z.union([z.enum(CATEGORIES), z.literal('')]).default(DEFAULT_BUDGET_INPUT.category),
  keywords: z.string().max(200).default(''),
  authPreference: z.enum(['any', 'none', 'simple']).default(DEFAULT_BUDGET_INPUT.authPreference),
  monthlyRequests: z.number().finite().min(0).max(1_000_000_000).nullable().default(null),
  maxBudget: z.number().finite().min(0).max(1_000_000_000).nullable().default(null),
  currency: z.enum(CURRENCIES).default(DEFAULT_BUDGET_INPUT.currency),
  allowPaid: z.boolean().default(DEFAULT_BUDGET_INPUT.allowPaid),
  allowTrial: z.boolean().default(DEFAULT_BUDGET_INPUT.allowTrial),
  allowSelfHosted: z.boolean().default(DEFAULT_BUDGET_INPUT.allowSelfHosted),
}).strict();

const compareSchema = z.object({
  apiIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(2).max(4),
  ...usageSchema,
}).strict();

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; ');
    throw new HttpError(400, 'invalid_request', detail);
  }
  return result.data;
}

function publicCache(reply: { header(name: string, value: string): unknown }): void {
  reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
}

function byId(apis: ApiEntry[], id: string): ApiEntry {
  const api = apis.find((item) => item.id === id);
  if (!api) throw new HttpError(404, 'api_not_found', 'The requested API was not found.');
  return api;
}

export interface AppOptions {
  databasePath?: string;
  corsOrigins?: string[];
  logger?: boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const apis = loadCatalog();
  const apiIds = new Set(apis.map((api) => api.id));
  const database = new ApiVerseDatabase(options.databasePath);
  const origins = options.corsOrigins ?? (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const app = Fastify({
    bodyLimit: 1_000_000,
    logger: options.logger ?? true
      ? { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] }
      : false,
    genReqId: () => randomUUID(),
  });

  await app.register(helmet);
  await app.register(cors, { origin: origins, credentials: false, methods: ['GET', 'POST', 'OPTIONS'] });
  await app.register(rateLimit, { max: 120, timeWindow: 60_000 });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'APIverse API',
        description: 'Catalog, pricing, recommendations, public collections, and community contribution API.',
        version: '1.0.0',
      },
      servers: [{ url: '/' }],
      tags: [
        { name: 'health' },
        { name: 'discovery' },
        { name: 'pricing' },
        { name: 'collections' },
        { name: 'community' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onClose', async () => database.close());
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof Error && 'validation' in error) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'Request validation failed.', requestId: request.id },
      });
    }
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, requestId: request.id },
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'Request validation failed.', requestId: request.id },
      });
    }
    request.log.error({ err: error }, 'Unhandled request error');
    return reply.status(500).send({
      error: { code: 'internal_error', message: 'An unexpected error occurred.', requestId: request.id },
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: { code: 'not_found', message: 'The requested route was not found.', requestId: request.id },
    }),
  );

  app.get('/health', {
    schema: { tags: ['health'], summary: 'Check that the API process is running' },
  }, async () => ({ status: 'ok' }));
  app.get('/ready', {
    schema: { tags: ['health'], summary: 'Check that the API and database are ready' },
  }, async (_request, reply) => {
    database.connection.prepare('SELECT 1').get();
    return reply.send({ status: 'ready' });
  });
  app.get('/openapi.json', {
    schema: { hide: true },
  }, async () => app.swagger());

  app.get('/api/v1/categories', {
    schema: { tags: ['discovery'], summary: 'List API catalog categories' },
  }, async (_request, reply) => {
    publicCache(reply);
    return { data: CATEGORIES };
  });
  app.get('/api/v1/apis/featured', {
    schema: { tags: ['discovery'], summary: 'List featured APIs' },
  }, async (_request, reply) => {
    publicCache(reply);
    return { data: apis.filter((api) => api.featured) };
  });
  app.get('/api/v1/apis', {
    schema: {
      tags: ['discovery'],
      summary: 'Search and filter the API catalog',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', maxLength: 200 },
          category: { type: 'string', enum: CATEGORIES },
          auth: { type: 'string', enum: ['any', 'none', 'required'] },
          https: { type: 'string', enum: ['1', 'true'] },
          pricing: { type: 'string', enum: PRICING_MODELS },
          free: { type: 'string', enum: ['1', 'true'] },
          verified: { type: 'string', enum: ['1', 'true'] },
          sort: { type: 'string', enum: ['relevance', 'name', 'verified'] },
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const query = parse(listQuerySchema, request.query);
    const filtered = searchApis(apis, {
      q: query.q,
      category: query.category ?? '',
      auth: query.auth,
      httpsOnly: Boolean(query.https),
      pricing: query.pricing ?? '',
      freeTier: Boolean(query.free),
      verifiedOnly: Boolean(query.verified),
      sort: query.sort,
      page: query.page,
    });
    const result = paginate(filtered, query.page, query.limit);
    publicCache(reply);
    return { data: result.items, pagination: { page: result.page, limit: query.limit, pages: result.pages, total: result.total } };
  });
  app.get<{ Params: { id: string } }>('/api/v1/apis/:id', {
    schema: { tags: ['discovery'], summary: 'Get an API by catalog id', params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  }, async (request, reply) => {
    publicCache(reply);
    return { data: byId(apis, request.params.id) };
  });
  app.get<{ Params: { id: string } }>('/api/v1/apis/:id/related', {
    schema: { tags: ['discovery'], summary: 'Find related APIs by category and tags', params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  }, async (request, reply) => {
    const api = byId(apis, request.params.id);
    const related = apis
      .filter((item) => item.id !== api.id)
      .map((item) => ({ item, score: item.tags.filter((tag) => api.tags.includes(tag)).length + Number(item.category === api.category) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.item.featured) - Number(a.item.featured) || a.item.name.localeCompare(b.item.name))
      .slice(0, 6)
      .map((entry) => entry.item);
    publicCache(reply);
    return { data: related };
  });

  app.get('/api/v1/pricing/filters', {
    schema: { tags: ['pricing'], summary: 'List pricing filter options' },
  }, async (_request, reply) => {
    publicCache(reply);
    return { data: { models: PRICING_MODELS, currencies: CURRENCIES, verificationStatuses: ['verified', 'needs-review', 'reported-outdated', 'deprecated'] } };
  });
  app.get('/api/v1/pricing/estimate', {
    schema: {
      tags: ['pricing'],
      summary: 'Estimate recorded plans for an API',
      querystring: {
        type: 'object',
        required: ['apiId'],
        properties: {
          apiId: { type: 'string' },
          monthlyRequests: { type: 'number', minimum: 0 },
          monthlyUsers: { type: 'number', minimum: 0 },
          monthlyDataGb: { type: 'number', minimum: 0 },
          monthlyInputTokens: { type: 'number', minimum: 0 },
          monthlyOutputTokens: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request) => {
    const query = parse(z.object({
      apiId: z.string().min(1),
      monthlyRequests: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
      monthlyUsers: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
      monthlyDataGb: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
      monthlyInputTokens: z.coerce.number().finite().min(0).max(1_000_000_000_000).optional(),
      monthlyOutputTokens: z.coerce.number().finite().min(0).max(1_000_000_000_000).optional(),
    }), request.query);
    const api = byId(apis, query.apiId);
    const usage: Usage = {
      monthlyRequests: query.monthlyRequests,
      monthlyUsers: query.monthlyUsers,
      monthlyDataGb: query.monthlyDataGb,
      monthlyInputTokens: query.monthlyInputTokens,
      monthlyOutputTokens: query.monthlyOutputTokens,
    };
    const estimates = estimateApi(api, usage);
    return { data: { apiId: api.id, estimates, reason: estimates.length ? null : 'No plan pricing is recorded for this API.' } };
  });
  app.post('/api/v1/pricing/compare', {
    schema: {
      tags: ['pricing'],
      summary: 'Compare estimates for two to four APIs',
      body: {
        type: 'object',
        required: ['apiIds'],
        properties: {
          apiIds: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
          monthlyRequests: { type: 'number', minimum: 0 },
          monthlyUsers: { type: 'number', minimum: 0 },
          monthlyDataGb: { type: 'number', minimum: 0 },
          monthlyInputTokens: { type: 'number', minimum: 0 },
          monthlyOutputTokens: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request) => {
    const input = parse(compareSchema, request.body);
    const { apiIds: ids, ...usage } = input;
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length) throw new HttpError(400, 'duplicate_api_ids', 'API ids must be unique.');
    return {
      data: uniqueIds.map((id) => {
        const api = byId(apis, id);
        return { apiId: id, billingKind: billingKind(api), estimates: estimateApi(api, usage) };
      }),
    };
  });
  app.post('/api/v1/recommendations', {
    schema: {
      tags: ['pricing'],
      summary: 'Rank catalog APIs for a project and budget',
      body: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['', ...CATEGORIES] },
          keywords: { type: 'string', maxLength: 200 },
          authPreference: { type: 'string', enum: ['any', 'none', 'simple'] },
          monthlyRequests: { type: 'number', nullable: true, minimum: 0 },
          maxBudget: { type: 'number', nullable: true, minimum: 0 },
          currency: { type: 'string', enum: CURRENCIES },
          allowPaid: { type: 'boolean' },
          allowTrial: { type: 'boolean' },
          allowSelfHosted: { type: 'boolean' },
          commercialProject: { type: 'boolean' },
        },
      },
    },
  }, async (request) => {
    const input = parse(budgetSchema, request.body);
    return { data: findBudgetApis(apis, input) };
  });

  app.post('/api/v1/collections', {
    schema: {
      tags: ['collections'],
      summary: 'Publish a read-only collection for sharing',
      body: {
        type: 'object',
        required: ['name', 'apiIds'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          apiIds: { type: 'array', maxItems: 200, items: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' } },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: 60_000 } },
  }, async (request, reply) => {
    const input = parse(createCollectionSchema, request.body);
    if (new Set(input.apiIds).size !== input.apiIds.length) {
      throw new HttpError(400, 'duplicate_api_ids', 'Collection API ids must be unique.');
    }
    if (input.apiIds.some((id) => !apiIds.has(id))) {
      throw new HttpError(400, 'unknown_api_id', 'Every API id must exist in the public catalog.');
    }
    const collection = database.createCollection(input.name, input.apiIds);
    return reply.status(201).send({ data: collection });
  });
  app.get<{ Params: { shareId: string } }>('/api/v1/collections/:shareId', {
    schema: { tags: ['collections'], summary: 'Read a public shared collection', params: { type: 'object', properties: { shareId: { type: 'string', format: 'uuid' } }, required: ['shareId'] } },
  }, async (request) => {
    const collection = database.getCollection(request.params.shareId);
    if (!collection) throw new HttpError(404, 'collection_not_found', 'The shared collection was not found.');
    return { data: collection };
  });
  app.post('/api/v1/collections/import/validate', {
    schema: { tags: ['collections'], summary: 'Validate an exported collection without saving it' },
  }, async (request) => {
    const input = parse(z.object({
      format: z.literal('apiverse-collection'),
      version: z.literal(1),
      name: z.string().max(500),
      apiIds: z.array(z.unknown()).max(200),
    }).strict(), request.body);
    const name = cleanName(input.name);
    if (!name) throw new HttpError(400, 'invalid_collection', 'Collection name is required.');
    const validIds = [...new Set(input.apiIds.filter((id): id is string => typeof id === 'string' && apiIds.has(id)))];
    const skipped = input.apiIds
      .filter((id) => typeof id !== 'string' || !apiIds.has(id))
      .map((id) => typeof id === 'string' ? id.slice(0, 40) : '<invalid>');
    return { data: { name, apiIds: validIds, skipped } };
  });

  app.post('/api/v1/submissions', {
    schema: {
      tags: ['community'],
      summary: 'Submit an API for human review',
      body: {
        type: 'object',
        required: ['name', 'documentationUrl', 'websiteUrl', 'category', 'description'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          documentationUrl: { type: 'string', format: 'uri' },
          websiteUrl: { type: 'string', format: 'uri' },
          category: { type: 'string', enum: CATEGORIES },
          description: { type: 'string', minLength: 20, maxLength: 1000 },
          pricingUrl: { type: 'string', nullable: true, format: 'uri' },
          termsUrl: { type: 'string', nullable: true, format: 'uri' },
          tags: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 40 } },
          notes: { type: 'string', nullable: true, maxLength: 2000 },
        },
      },
    },
    config: { rateLimit: { max: 3, timeWindow: 3_600_000 } },
  }, async (request, reply) => {
    const input = parse(submissionSchema, request.body);
    if (database.hasPendingSubmission(input.documentationUrl)) {
      throw new HttpError(409, 'duplicate_submission', 'A pending submission already exists for this documentation URL.');
    }
    const submission = database.createSubmission({
      ...input,
      pricingUrl: input.pricingUrl ?? null,
      termsUrl: input.termsUrl ?? null,
      notes: input.notes ?? null,
    });
    return reply.status(202).send({ data: submission });
  });
  app.get<{ Params: { id: string } }>('/api/v1/submissions/:id/status', {
    schema: { tags: ['community'], summary: 'Check a submission moderation status', params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] } },
  }, async (request) => {
    const status = database.getSubmissionStatus(request.params.id);
    if (!status) throw new HttpError(404, 'submission_not_found', 'The submission was not found.');
    return { data: status };
  });
  app.post('/api/v1/reports', {
    schema: {
      tags: ['community'],
      summary: 'Report outdated or incorrect catalog information',
      body: {
        type: 'object',
        required: ['apiId', 'details'],
        additionalProperties: false,
        properties: {
          apiId: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
          details: { type: 'string', minLength: 10, maxLength: 2000 },
          sourceUrl: { type: 'string', nullable: true, format: 'uri' },
        },
      },
    },
    config: { rateLimit: { max: 5, timeWindow: 3_600_000 } },
  }, async (request, reply) => {
    const input = parse(reportSchema, request.body);
    if (!apiIds.has(input.apiId)) throw new HttpError(404, 'api_not_found', 'The requested API was not found.');
    const report = database.createReport({
      apiId: input.apiId,
      details: input.details,
      sourceUrl: input.sourceUrl ?? null,
    });
    return reply.status(202).send({ data: report });
  });

  return app;
}
