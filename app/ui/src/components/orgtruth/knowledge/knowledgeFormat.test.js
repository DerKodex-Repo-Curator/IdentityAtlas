import { describe, it, expect } from 'vitest';
import {
  PREDICATES, predicateLabel, modalityColor, supportColor, isRunActive, progressCount, elapsedSeconds, runResult,
  passageFor, splitHighlight, groupByTopic, resolutionText, matchReasons, transcriptRequest,
} from './knowledgeFormat';

const P1 = { id: 'p1', seq: 1, startChar: 0, endChar: 10, text: 'Anna leads' };
const P2 = { id: 'p2', seq: 2, startChar: 11, endChar: 30, text: 'She works for Bob.' };

describe('knowledgeFormat', () => {
  it('labels every API predicate and falls back to the raw value', () => {
    expect(PREDICATES).toEqual(['memberOf', 'formerMemberOf', 'partOf', 'leads', 'responsibleFor', 'worksForCustomer', 'usesApplication', 'hasProperty', 'other']);
    expect(predicateLabel('worksForCustomer')).toBe('works for customer');
    expect(predicateLabel('somethingNew')).toBe('somethingNew');
    expect(predicateLabel(undefined)).toBe('');
  });

  it('colours modality and support, gray for unknown values', () => {
    expect(modalityColor('stated')).toBe('green');
    expect(modalityColor('correction')).toBe('red');
    expect(modalityColor('x')).toBe('gray');
    expect(supportColor('unsupported')).toBe('red');
    expect(supportColor('unclear')).toBe('amber');
    expect(supportColor(null)).toBe('gray');
  });

  it('treats only queued and running as active', () => {
    expect(isRunActive({ status: 'queued' })).toBe(true);
    expect(isRunActive({ status: 'running' })).toBe(true);
    expect(isRunActive({ status: 'cancelled' })).toBe(false);
    expect(isRunActive(null)).toBe(false);
  });

  it('formats progress done/total only when there is a total', () => {
    expect(progressCount({ details: { progress: { done: 3, total: 8 } } })).toBe('3/8');
    expect(progressCount({ details: { progress: { total: 8 } } })).toBe('0/8');
    expect(progressCount({ details: { progress: { done: 0, total: 0 } } })).toBe('');
    expect(progressCount({})).toBe('');
  });

  it('measures elapsed seconds to finishedAt, or to now', () => {
    expect(elapsedSeconds({ createdAt: '2026-10-11T10:00:00Z', finishedAt: '2026-10-11T10:01:05Z' })).toBe(65);
    expect(elapsedSeconds({ createdAt: '2026-10-11T10:00:00Z' }, Date.parse('2026-10-11T10:00:30Z'))).toBe(30);
    expect(elapsedSeconds({ createdAt: '2026-10-11T10:00:30Z' }, Date.parse('2026-10-11T10:00:00Z'))).toBe(0);
    expect(elapsedSeconds({})).toBeNull();
  });

  it('summarises what a run wrote, its error first', () => {
    expect(runResult({ stats: { written: { claims: 3, mentions: 2 } } })).toBe('3 statements · 2 mentions · 0 findings');
    expect(runResult({ error: 'model timed out', stats: { written: { claims: 3 } } })).toBe('model timed out');
    expect(runResult({ stats: {} })).toBe('');
    expect(runResult(null)).toBe('');
  });

  it('finds the passage of a quote by seq, else by the span that holds it', () => {
    expect(passageFor([P1, P2], { seq: 2, startChar: 0, endChar: 1 })).toBe(P2);
    expect(passageFor([P1, P2], { startChar: 14, endChar: 19 })).toBe(P2);
    expect(passageFor([P1, P2], { seq: 9, startChar: 2, endChar: 5 })).toBe(P1);
    expect(passageFor([P1], { startChar: 5, endChar: 20 })).toBeNull();
    expect(passageFor(null, { startChar: 0, endChar: 1 })).toBeNull();
  });

  it('splits passage text around absolute offsets', () => {
    expect(splitHighlight(P2, 15, 24)).toEqual({ before: 'She ', mark: 'works for', after: ' Bob.' });
    expect(splitHighlight(P2, 11, 29)).toEqual({ before: '', mark: 'She works for Bob.', after: '' });
    expect(splitHighlight(P2, 10, 14)).toBeNull();
    expect(splitHighlight(P2, 20, 20)).toBeNull();
    expect(splitHighlight(P2, 20, 30)).toBeNull();
    expect(splitHighlight(null, 0, 1)).toBeNull();
  });

  it('groups by topic in first-seen order, missing topic as other', () => {
    const g = groupByTopic([{ id: 1, topic: 'membership' }, { id: 2 }, { id: 3, topic: 'membership' }]);
    expect(g).toEqual([
      { topic: 'membership', claims: [{ id: 1, topic: 'membership' }, { id: 3, topic: 'membership' }] },
      { topic: 'other', claims: [{ id: 2 }] },
    ]);
    expect(groupByTopic(undefined)).toEqual([]);
  });

  it('describes a resolution and the reasons of a match', () => {
    expect(resolutionText('unmatched')).toBe('no match found');
    expect(resolutionText('ambiguous')).toMatch(/^ambiguous/);
    expect(resolutionText('weird')).toBe('weird');
    expect(matchReasons({ reasons: ['name', '', 'email'], matchedValue: 'Anna' })).toBe('name · email · matched “Anna”');
    expect(matchReasons({ reasons: [] })).toBe('');
    expect(matchReasons(undefined)).toBe('');
  });

  it('builds a JSON body for pasted text, dropping empty fields', () => {
    const req = transcriptRequest({ text: 'hello', displayName: 'Intake', observedAt: '', speaker: 'Anna', sourceType: 'interview' }, null);
    expect(req).toEqual({ kind: 'json', data: { displayName: 'Intake', speaker: 'Anna', sourceType: 'interview', text: 'hello' } });
    expect(transcriptRequest({}, null)).toEqual({ kind: 'json', data: { text: '' } });
  });

  it('builds multipart form data for a file, leaving the pasted text out', () => {
    const file = new File(['x'], 'a.vtt', { type: 'text/vtt' });
    const req = transcriptRequest({ text: 'ignored', displayName: 'Call', language: 'nl' }, file);
    expect(req.kind).toBe('form');
    expect(req.data.get('file').name).toBe('a.vtt');
    expect(req.data.get('displayName')).toBe('Call');
    expect(req.data.get('language')).toBe('nl');
    expect(req.data.get('text')).toBeNull();
  });
});
