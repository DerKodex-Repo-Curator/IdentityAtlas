// Unit tests for routes/contexts/relationships.js — context-to-context links
// (DedicatedTo). DB mocked; the auth gate is a passthrough.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { mountRouter } from '../../../test-utils/routeTestKit.js';

process.env.USE_SQL = 'true';

vi.mock('../../db/connection.js');   // picks up src/db/__mocks__/connection.js
import { query, queryOne } from '../../db/connection.js';
vi.mock('../../middleware/auth.js', () => ({
  requirePermission: () => (_req, _res, next) => next(),
}));

const { default: router, parseRelationshipBody } = await import('./relationships.js');
const app = mountRouter(router);

const CTX = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const REL = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
});

describe('parseRelationshipBody', () => {
  it('accepts a DedicatedTo link to another context, lower-casing the id', () => {
    expect(parseRelationshipBody({ relatedContextId: OTHER.toUpperCase(), relationshipType: 'DedicatedTo' }, CTX))
      .toEqual({ relatedContextId: OTHER, relationshipType: 'DedicatedTo' });
  });

  it.each([
    ['an unknown type', { relatedContextId: OTHER, relationshipType: 'Contains' }, /relationshipType must be one of DedicatedTo/],
    ['a missing related id', { relationshipType: 'DedicatedTo' }, /relatedContextId \(uuid\) is required/],
    ['a self-link', { relatedContextId: CTX.toUpperCase(), relationshipType: 'DedicatedTo' }, /cannot relate to itself/],
  ])('rejects %s', (_label, body, message) => {
    expect(parseRelationshipBody(body, CTX)).toMatchObject({ status: 400, message });
  });
});

describe('GET /contexts/:id/relationships', () => {
  it('400 on a malformed id', async () => {
    expect((await request(app).get('/api/contexts/nope/relationships')).status).toBe(400);
  });

  it('404 when the context is missing', async () => {
    queryOne.mockResolvedValueOnce(null);
    expect((await request(app).get(`/api/contexts/${CTX}/relationships`)).status).toBe(404);
  });

  it('lists both directions with the other end resolved', async () => {
    queryOne.mockResolvedValueOnce({ id: CTX });
    const rows = [
      { id: REL, relationshipType: 'DedicatedTo', direction: 'out', relatedContextId: OTHER, relatedDisplayName: 'Inkoop', addedBy: 'analyst' },
      { id: OTHER, relationshipType: 'DedicatedTo', direction: 'in', relatedContextId: REL, relatedDisplayName: 'Inkoop resources', addedBy: 'analyst' },
    ];
    query.mockResolvedValueOnce({ rows });
    const res = await request(app).get(`/api/contexts/${CTX}/relationships`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain(`CASE WHEN r."contextId" = $1 THEN 'out' ELSE 'in' END AS direction`);
    expect(sql).toContain('WHERE r."contextId" = $1 OR r."relatedContextId" = $1');
    expect(sql).toContain('o."displayName" AS "relatedDisplayName"');
    expect(params).toEqual([CTX]);
  });

  it('500 when the query rejects', async () => {
    queryOne.mockRejectedValueOnce(new Error('boom'));
    expect((await request(app).get(`/api/contexts/${CTX}/relationships`)).status).toBe(500);
  });
});

describe('POST /contexts/:id/relationships', () => {
  const post = (body) => request(app).post(`/api/contexts/${CTX}/relationships`).send(body);
  const valid = { relatedContextId: OTHER, relationshipType: 'DedicatedTo' };

  it('400 on a malformed context id', async () => {
    expect((await request(app).post('/api/contexts/nope/relationships').send(valid)).status).toBe(400);
  });

  it('400 on a self-link before any lookup', async () => {
    const res = await post({ ...valid, relatedContextId: CTX });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('404 unless both contexts exist', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: CTX }] });
    const res = await post(valid);
    expect(res.status).toBe(404);
    expect(query.mock.calls[0][1]).toEqual([[CTX, OTHER]]);
  });

  it('400 when the pair already has this relationship in either direction', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: CTX }, { id: OTHER }] });
    queryOne.mockResolvedValueOnce({ id: REL });
    const res = await post(valid);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already have this relationship/);
    const [sql, params] = queryOne.mock.calls[0];
    expect(sql).toContain('("contextId" = $1 AND "relatedContextId" = $2) OR ("contextId" = $2 AND "relatedContextId" = $1)');
    expect(params).toEqual([CTX, OTHER, 'DedicatedTo']);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('201 stores the link as the analyst\'s', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: CTX }, { id: OTHER }] });
    queryOne.mockResolvedValueOnce(null);
    const row = { id: REL, contextId: CTX, relatedContextId: OTHER, relationshipType: 'DedicatedTo', addedBy: 'analyst' };
    query.mockResolvedValueOnce({ rows: [row] });
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(row);
    const [sql, params] = query.mock.calls[1];
    expect(sql).toContain('INSERT INTO "ContextRelationships"');
    expect(sql).toContain(`VALUES ($1, $2, $3, 'analyst')`);
    expect(params).toEqual([CTX, OTHER, 'DedicatedTo']);
  });

  it('500 when the write rejects', async () => {
    query.mockRejectedValueOnce(new Error('boom'));
    expect((await post(valid)).status).toBe(500);
  });
});

describe('DELETE /contexts/:id/relationships/:relId', () => {
  it('400 on a malformed id', async () => {
    expect((await request(app).delete(`/api/contexts/${CTX}/relationships/nope`)).status).toBe(400);
    expect((await request(app).delete(`/api/contexts/nope/relationships/${REL}`)).status).toBe(400);
  });

  it('204 from either end of the link', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete(`/api/contexts/${CTX}/relationships/${REL}`);
    expect(res.status).toBe(204);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE id = $1 AND ("contextId" = $2 OR "relatedContextId" = $2)');
    expect(params).toEqual([REL, CTX]);
  });

  it('404 when this context has no such relationship', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 });
    expect((await request(app).delete(`/api/contexts/${CTX}/relationships/${REL}`)).status).toBe(404);
  });

  it('500 when the delete rejects', async () => {
    query.mockRejectedValueOnce(new Error('boom'));
    expect((await request(app).delete(`/api/contexts/${CTX}/relationships/${REL}`)).status).toBe(500);
  });
});
