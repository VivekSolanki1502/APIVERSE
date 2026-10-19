import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { buildApp } from '../src/app';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

async function testApp() {
  const app = await buildApp({ databasePath: ':memory:', logger: false });
  apps.push(app);
  return app;
}

after(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('APIverse HTTP API integration', () => {
  it('serves health, readiness, and OpenAPI docs', async () => {
    const app = await testApp();
    assert.deepEqual((await app.inject('/health')).json(), { status: 'ok' });
    assert.deepEqual((await app.inject('/ready')).json(), { status: 'ready' });
    assert.match((await app.inject('/openapi.json')).json().openapi, /^3\./);
  });

  it('searches the catalog with bounded pagination', async () => {
    const app = await testApp();
    const response = await app.inject('/api/v1/apis?q=weather&page=1&limit=2');
    const payload = response.json();
    assert.equal(response.statusCode, 200);
    assert.equal(payload.data.length, 2);
    assert.equal(payload.pagination.page, 1);
    assert.equal(payload.pagination.limit, 2);
    assert.ok(payload.pagination.total > 0);
    assert.match(response.headers['cache-control'] ?? '', /max-age=300/);
  });

  it('rejects invalid filters and returns consistent not-found errors', async () => {
    const app = await testApp();
    const invalid = await app.inject('/api/v1/apis?limit=101');
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'invalid_request');
    assert.equal(typeof invalid.json().error.requestId, 'string');

    const missing = await app.inject('/api/v1/apis/not-a-real-api');
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, 'api_not_found');
  });

  it('persists only validated public collections and shares them by id', async () => {
    const app = await testApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/collections',
      payload: { name: 'Weather tools', apiIds: ['open-meteo'] },
    });
    assert.equal(created.statusCode, 201);
    const collection = created.json().data as { shareId: string; name: string; apiIds: string[] };
    assert.deepEqual({ name: collection.name, apiIds: collection.apiIds }, { name: 'Weather tools', apiIds: ['open-meteo'] });

    const shared = await app.inject(`/api/v1/collections/${collection.shareId}`);
    assert.equal(shared.statusCode, 200);
    assert.deepEqual(shared.json().data, collection);

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/collections',
      payload: { name: 'Bad ids', apiIds: ['not-in-catalog'] },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'unknown_api_id');
  });

  it('stores community submissions as pending and rejects duplicates', async () => {
    const app = await testApp();
    const submission = {
      name: 'Example Weather Service',
      documentationUrl: 'https://weather.example.com/docs',
      websiteUrl: 'https://weather.example.com',
      category: 'Weather',
      description: 'A weather service submitted for review by the APIverse community.',
      tags: ['weather'],
    };
    const response = await app.inject({ method: 'POST', url: '/api/v1/submissions', payload: submission });
    assert.equal(response.statusCode, 202);
    const saved = response.json().data as { id: string; status: string };
    assert.equal(saved.status, 'pending');
    assert.equal((await app.inject(`/api/v1/submissions/${saved.id}/status`)).json().data.status, 'pending');

    const duplicate = await app.inject({ method: 'POST', url: '/api/v1/submissions', payload: submission });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().error.code, 'duplicate_submission');
  });

  it('rejects credentials embedded in submitted URLs', async () => {
    const app = await testApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/submissions',
      payload: {
        name: 'Example Weather Service',
        documentationUrl: 'https://user:password@weather.example.com/docs',
        websiteUrl: 'https://weather.example.com',
        category: 'Weather',
        description: 'A weather service submitted for review by the APIverse community.',
      },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'invalid_request');
  });

  it('serves pricing and recommendation endpoints and validates imported collections', async () => {
    const app = await testApp();
    const filters = await app.inject('/api/v1/pricing/filters');
    assert.equal(filters.statusCode, 200);
    assert.ok(filters.json().data.models.includes('free'));

    const estimate = await app.inject('/api/v1/pricing/estimate?apiId=open-meteo&monthlyRequests=1000');
    assert.equal(estimate.statusCode, 200);
    assert.equal(estimate.json().data.apiId, 'open-meteo');

    const comparison = await app.inject({
      method: 'POST',
      url: '/api/v1/pricing/compare',
      payload: { apiIds: ['open-meteo', 'pokeapi'], monthlyRequests: 1000 },
    });
    assert.equal(comparison.statusCode, 200);
    assert.equal(comparison.json().data.length, 2);

    const recommendations = await app.inject({
      method: 'POST',
      url: '/api/v1/recommendations',
      payload: { category: 'Weather' },
    });
    assert.equal(recommendations.statusCode, 200);
    assert.ok(Array.isArray(recommendations.json().data.recommended));

    const imported = await app.inject({
      method: 'POST',
      url: '/api/v1/collections/import/validate',
      payload: { format: 'apiverse-collection', version: 1, name: 'Imported', apiIds: ['open-meteo', 'missing-api', null] },
    });
    assert.equal(imported.statusCode, 200);
    assert.deepEqual(imported.json().data, { name: 'Imported', apiIds: ['open-meteo'], skipped: ['missing-api', '<invalid>'] });

    const report = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: { apiId: 'open-meteo', details: 'The listed pricing source appears to have changed recently.' },
    });
    assert.equal(report.statusCode, 202);
  });
});
