import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../db/connection.js');
vi.mock('../../middleware/auth.js', () => ({
  requirePermission: (perm) => (req, res, next) => (req.headers['x-deny'] === perm ? res.status(403).json({ denied: perm }) : next()),
}));
vi.mock('../../config/authConfig.js', () => ({ isAuthEnabled: () => true }));
vi.mock('../knowledge/store.js', () => ({ getTranscript: vi.fn() }));
vi.mock('../knowledge/read.js', () => ({
  listMentions: vi.fn(async () => [{ id: 'm' }]), listClaims: vi.fn(async () => [{ id: 'c' }]), listFindings: vi.fn(async () => [{ id: 'f' }]),
  exportPackage: vi.fn(async () => ({ schemaVersion: '0.1' })), statementsAbout: vi.fn(async () => [{ id: 's' }]),
}));
vi.mock('../knowledge/resolve.js', () => ({ resolveMentions: vi.fn(async () => new Map([['q', { status: 'candidates', candidates: [{ label: 'Rob Visser' }] }]])) }));
vi.mock('../knowledge/review.js', async () => {
  const actual = await vi.importActual('../knowledge/review.js');
  return { ...actual, reviewMatch: vi.fn(), reviewClaim: vi.fn(), reviewFinding: vi.fn() };
});
vi.mock('../model/linkedTo.js', () => ({ targetsOf: vi.fn(async (t, id) => [{ targetType: t, id }, { targetType: 'Principal', id: 'acc' }]) }));

import { mountRouterAs } from '../../../test-utils/routeTestKit.js';
import router from './knowledgeReview.js';
import { getTranscript } from '../knowledge/store.js';
import { listClaims, statementsAbout } from '../knowledge/read.js';
import { resolveMentions } from '../knowledge/resolve.js';
import { reviewMatch, reviewClaim, KnowledgeReviewError } from '../knowledge/review.js';

const SRC = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const app = mountRouterAs(router, () => ({ preferred_username: 'wim', permissions: new Set(['data.read']) }));

beforeEach(() => {
  process.env.FEATURE_ORG_TRUTH = 'true';
  process.env.FEATURE_KNOWLEDGE_EXTRACTION = 'true';
  vi.clearAllMocks();
  getTranscript.mockResolvedValue({ id: SRC, metadata: {} });
});

describe('reading', () => {
  it.each(['mentions', 'claims', 'findings'])('GET /sources/:id/%s returns the list', async (what) => {
    const res = await request(app).get(`/api/org-truth/knowledge/sources/${SRC}/${what}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('claims can be filtered by status; an unknown status is a 400', async () => {
    await request(app).get(`/api/org-truth/knowledge/sources/${SRC}/claims?status=accepted`);
    expect(listClaims).toHaveBeenCalledWith(SRC, { status: 'accepted' });
    expect((await request(app).get(`/api/org-truth/knowledge/sources/${SRC}/claims?status=maybe`)).status).toBe(400);
  });

  it('a restricted transcript of someone else is not found', async () => {
    getTranscript.mockResolvedValue({ id: SRC, uploadedBy: 'gregor', metadata: { classification: 'restricted' } });
    expect((await request(app).get(`/api/org-truth/knowledge/sources/${SRC}/claims`)).status).toBe(404);
    expect((await request(app).get(`/api/org-truth/knowledge/sources/${SRC}/export`)).status).toBe(404);
  });

  it('export is a JSON attachment', async () => {
    const res = await request(app).get(`/api/org-truth/knowledge/sources/${SRC}/export`);
    expect(res.headers['content-disposition']).toContain(`knowledge-${SRC}.json`);
    expect(res.body).toEqual({ schemaVersion: '0.1' });
  });

  it('search resolves one label of one mention type', async () => {
    const res = await request(app).get('/api/org-truth/knowledge/search?type=person&q=Rob');
    expect(res.body.candidates[0].label).toBe('Rob Visser');
    expect(resolveMentions).toHaveBeenCalledWith([{ key: 'q', type: 'person', label: 'Rob' }]);
    expect((await request(app).get('/api/org-truth/knowledge/search?type=planet&q=Rob')).status).toBe(400);
    expect((await request(app).get('/api/org-truth/knowledge/search?type=person&q=R')).status).toBe(400);
  });

  it('statements about an identity also look at its accounts; an org entity only at itself', async () => {
    await request(app).get(`/api/org-truth/knowledge/statements?targetType=Identity&targetId=${ID}`);
    expect(statementsAbout).toHaveBeenLastCalledWith([{ targetType: 'Identity', id: ID }, { targetType: 'Principal', id: 'acc' }]);
    await request(app).get(`/api/org-truth/knowledge/statements?targetType=OrgEntity&targetId=${ID}`);
    expect(statementsAbout).toHaveBeenLastCalledWith([{ targetType: 'OrgEntity', id: ID }]);
    expect((await request(app).get('/api/org-truth/knowledge/statements?targetType=Planet&targetId=x')).status).toBe(400);
  });
});

describe('deciding', () => {
  it.each([
    ['put', `/api/org-truth/knowledge/matches/${ID}`],
    ['put', `/api/org-truth/knowledge/claims/${ID}`],
    ['put', `/api/org-truth/knowledge/findings/${ID}`],
  ])('%s %s needs data.write.contexts', async (method, path) => {
    expect((await request(app)[method](path).set('x-deny', 'data.write.contexts').send({})).status).toBe(403);
  });

  it('passes the decision and the actor through, and maps review errors to their status', async () => {
    reviewMatch.mockResolvedValue({ link: { id: ID, status: 'accepted' } });
    const ok = await request(app).put(`/api/org-truth/knowledge/matches/${ID}`).send({ action: 'confirm' });
    expect(ok.body).toEqual({ link: { id: ID, status: 'accepted' } });
    expect(reviewMatch).toHaveBeenCalledWith(ID, { action: 'confirm' }, 'wim');
    reviewClaim.mockRejectedValue(new KnowledgeReviewError(409, 'already decided'));
    const conflict = await request(app).put(`/api/org-truth/knowledge/claims/${ID}`).send({ status: 'accepted', expectedStatus: 'proposed' });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: 'already decided' });
  });

  it('an unexpected error is a JSON 500, not a crash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reviewClaim.mockRejectedValue(new Error('db down'));
    const res = await request(app).put(`/api/org-truth/knowledge/claims/${ID}`).send({ status: 'accepted' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to review the statement.');
  });
});
