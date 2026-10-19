import catalog from '../src/data/catalog.json';
import { CATEGORIES } from '../src/types/catalog.js';

interface D1Result {
  success: boolean;
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1Statement;
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
}

interface ScheduledController {
  cron: string;
}

const apiIds = new Set(catalog.apis.map((api) => api.id));
const categorySet = new Set<string>(CATEGORIES);
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function error(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 1_000_000) return null;
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 1_000_000) return null;
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function allowMutation(env: Env, request: Request, route: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  const clientAddress = request.headers.get('CF-Connecting-IP') ?? 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientAddress));
  const clientHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`INSERT INTO request_limits (client_hash, route, window_start, request_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (client_hash, route) DO UPDATE SET
      request_count = CASE WHEN request_limits.window_start <= ? THEN 1 ELSE request_limits.request_count + 1 END,
      window_start = CASE WHEN request_limits.window_start <= ? THEN excluded.window_start ELSE request_limits.window_start END
    RETURNING request_count`)
    .bind(clientHash, route, now, now - windowSeconds, now - windowSeconds)
    .first<{ request_count: number }>();
  return row !== null && row.request_count <= maxRequests;
}

function validUrl(value: unknown, nullable = false): value is string | null | undefined {
  if (value === undefined) return true;
  if (nullable && value === null) return true;
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method === 'GET' && path === '/health') return json({ status: 'ok' });
  if (request.method === 'GET' && path === '/ready') {
    try {
      await env.DB.prepare('SELECT 1').first();
      return json({ status: 'ready' });
    } catch {
      return error('database_unavailable', 'The database is not ready.', 503);
    }
  }

  if (request.method === 'POST' && path === '/api/v1/collections') {
    const body = await readObject(request);
    if (!body || Object.keys(body).some((key) => !['name', 'apiIds'].includes(key))) {
      return error('invalid_request', 'Provide a collection name and API id list.', 400);
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const ids = body.apiIds;
    if (!name || name.length > 80 || !Array.isArray(ids) || ids.length > 200 || !ids.every((id) => typeof id === 'string' && idPattern.test(id))) {
      return error('invalid_request', 'The collection name or API id list is invalid.', 400);
    }
    if (new Set(ids).size !== ids.length) return error('duplicate_api_ids', 'Collection API ids must be unique.', 400);
    if (ids.some((id) => !apiIds.has(id))) return error('unknown_api_id', 'Every API id must exist in the public catalog.', 400);
    if (!await allowMutation(env, request, 'collection', 10, 60)) return error('rate_limited', 'Too many collection shares. Try again in a minute.', 429);
    const collection = { shareId: crypto.randomUUID(), name, apiIds: ids, createdAt: new Date().toISOString() };
    await env.DB.prepare('INSERT INTO collections (share_id, name, api_ids, created_at) VALUES (?, ?, ?, ?)')
      .bind(collection.shareId, collection.name, JSON.stringify(collection.apiIds), collection.createdAt).run();
    return json({ data: collection }, 201);
  }

  const sharedCollection = path.match(/^\/api\/v1\/collections\/([^/]+)$/);
  if (request.method === 'GET' && sharedCollection) {
    const shareId = decodeURIComponent(sharedCollection[1] ?? '');
    if (!uuidPattern.test(shareId)) return error('collection_not_found', 'The shared collection was not found.', 404);
    const row = await env.DB.prepare('SELECT share_id, name, api_ids, created_at FROM collections WHERE share_id = ?')
      .bind(shareId).first<{ share_id: string; name: string; api_ids: string; created_at: string }>();
    if (!row) return error('collection_not_found', 'The shared collection was not found.', 404);
    return json({ data: { shareId: row.share_id, name: row.name, apiIds: JSON.parse(row.api_ids), createdAt: row.created_at } });
  }

  if (request.method === 'POST' && path === '/api/v1/submissions') {
    const body = await readObject(request);
    if (!body) return error('invalid_request', 'A valid JSON object is required.', 400);
    const allowed = ['name', 'documentationUrl', 'websiteUrl', 'category', 'description', 'pricingUrl', 'termsUrl', 'tags', 'notes'];
    if (Object.keys(body).some((key) => !allowed.includes(key))) return error('invalid_request', 'Unexpected submission fields were provided.', 400);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const docs = body.documentationUrl;
    const website = body.websiteUrl;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = body.category;
    const tags = body.tags ?? [];
    const notes = body.notes;
    if (name.length < 2 || name.length > 120 || !validUrl(docs) || typeof docs !== 'string' || !validUrl(website) || typeof website !== 'string'
      || !categorySet.has(String(category)) || description.length < 20 || description.length > 1000
      || !validUrl(body.pricingUrl, true) || !validUrl(body.termsUrl, true)
      || !Array.isArray(tags) || tags.length > 10 || !tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0 && tag.trim().length <= 40)
      || (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.trim().length > 2000))) {
      return error('invalid_request', 'One or more submission fields are invalid.', 400);
    }
    if (!await allowMutation(env, request, 'submission', 3, 3600)) return error('rate_limited', 'Too many submissions. Try again later.', 429);
    const duplicate = await env.DB.prepare("SELECT 1 AS found FROM submissions WHERE documentation_url = ? AND status = 'pending' LIMIT 1")
      .bind(docs).first();
    if (duplicate) return error('duplicate_submission', 'A pending submission already exists for this documentation URL.', 409);
    const submission = { id: crypto.randomUUID(), status: 'pending' as const, createdAt: new Date().toISOString() };
    await env.DB.prepare(`INSERT INTO submissions
      (id, name, documentation_url, website_url, category, description, pricing_url, terms_url, tags_json, notes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(submission.id, name, docs, website, category, description, body.pricingUrl ?? null, body.termsUrl ?? null,
        JSON.stringify(tags.map((tag) => (tag as string).trim())), typeof notes === 'string' ? notes.trim() || null : null,
        submission.status, submission.createdAt).run();
    return json({ data: submission }, 202);
  }

  const submissionStatus = path.match(/^\/api\/v1\/submissions\/([^/]+)\/status$/);
  if (request.method === 'GET' && submissionStatus) {
    const id = decodeURIComponent(submissionStatus[1] ?? '');
    if (!uuidPattern.test(id)) return error('submission_not_found', 'The submission was not found.', 404);
    const row = await env.DB.prepare('SELECT id, status, created_at FROM submissions WHERE id = ?')
      .bind(id).first<{ id: string; status: string; created_at: string }>();
    if (!row) return error('submission_not_found', 'The submission was not found.', 404);
    return json({ data: { id: row.id, status: row.status, createdAt: row.created_at } });
  }

  if (request.method === 'POST' && path === '/api/v1/reports') {
    const body = await readObject(request);
    if (!body || Object.keys(body).some((key) => !['apiId', 'details', 'sourceUrl'].includes(key))) {
      return error('invalid_request', 'Provide a valid API id, report details, and optional source URL.', 400);
    }
    const apiId = body.apiId;
    const details = typeof body.details === 'string' ? body.details.trim() : '';
    if (typeof apiId !== 'string' || !idPattern.test(apiId) || details.length < 10 || details.length > 2000 || !validUrl(body.sourceUrl, true)) {
      return error('invalid_request', 'One or more report fields are invalid.', 400);
    }
    if (!apiIds.has(apiId)) return error('api_not_found', 'The requested API was not found.', 404);
    if (!await allowMutation(env, request, 'report', 5, 3600)) return error('rate_limited', 'Too many reports. Try again later.', 429);
    const report = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await env.DB.prepare('INSERT INTO reports (id, api_id, details, source_url, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(report.id, apiId, details, body.sourceUrl ?? null, report.createdAt).run();
    return json({ data: report }, 202);
  }

  return error('not_found', 'The requested API route was not found.', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/ready' || url.pathname.startsWith('/api/v1/')) {
      try {
        return await handleApi(request, env);
      } catch {
        return error('internal_error', 'An unexpected error occurred.', 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86_400;
    await env.DB.prepare('DELETE FROM request_limits WHERE window_start < ?').bind(oneDayAgo).run();
  },
};
