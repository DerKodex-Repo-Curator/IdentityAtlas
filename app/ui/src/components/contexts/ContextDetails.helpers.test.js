import { describe, it, expect } from 'vitest';
import { hiddenDetailKeys, detailEntries } from './ContextDetails.helpers';

const keys = (entries) => entries.map(([k]) => k);

describe('detailEntries — every attribute once', () => {
  it('leaves out what the header and description show, keeps the rest in order', () => {
    const attrs = {
      id: 'c1', displayName: 'Contoso', description: 'd', variant: 'synced', targetType: 'Identity',
      contextType: 'Department', contextCategory: 'OrganizationalUnit', scopeSystemName: 'HR', scopeSystemId: 's1',
      parentContextId: 'p', parentDisplayName: 'Root', ownerUserId: 'u', ownerPrincipalId: 'p1', ownerDisplayName: 'Ann',
      sourceAlgorithmName: 'x', sourceRunId: 'r', ValidFrom: '2026', externalId: 'OU=Contoso', lastSyncedAt: '2026-10-01',
    };
    expect(keys(detailEntries(attrs))).toEqual(['externalId', 'lastSyncedAt']);
  });

  it('drops empty values and expands extendedAttributes after the core attributes, marked as extended', () => {
    const entries = detailEntries({ externalId: '', note: null, region: 'EU', extendedAttributes: { costCenter: 'CC-1', blank: '' } });
    expect(entries).toEqual([['region', 'EU'], ['costCenter', 'CC-1', { extended: true }]]);
  });

  it('ignores an extendedAttributes value that is not an object', () => {
    expect(keys(detailEntries({ extendedAttributes: 'raw', region: 'EU' }))).toEqual(['region']);
  });

  it('returns nothing for no context', () => {
    expect(detailEntries(null)).toEqual([]);
  });
});

describe('hiddenDetailKeys — what this page shows elsewhere', () => {
  it('hides the access counts only once the header prints them', () => {
    const counted = { resourceCount: 3, directAssignmentCount: 1, holderCount: 2 };
    expect(hiddenDetailKeys(counted).has('resourceCount')).toBe(true);
    expect(hiddenDetailKeys(counted).has('holderCount')).toBe(true);
    expect(hiddenDetailKeys({ directAssignmentCount: 1 }).has('directAssignmentCount')).toBe(false);
  });

  it('hides the member count the profile prints: the total when known, else the direct one', () => {
    const both = hiddenDetailKeys({ totalMemberCount: 12, directMemberCount: 4 }, { hasProfile: true });
    expect([both.has('totalMemberCount'), both.has('directMemberCount')]).toEqual([true, false]);
    const direct = hiddenDetailKeys({ directMemberCount: 4 }, { hasProfile: true });
    expect([direct.has('totalMemberCount'), direct.has('directMemberCount')]).toEqual([false, true]);
    const none = hiddenDetailKeys({ totalMemberCount: 12, directMemberCount: 4 });
    expect([none.has('totalMemberCount'), none.has('directMemberCount')]).toEqual([false, false]);
  });

  it('hides the creator only where the provenance line names it (manual contexts)', () => {
    expect(hiddenDetailKeys({ variant: 'manual' }).has('createdByUser')).toBe(true);
    expect(hiddenDetailKeys({ variant: 'generated' }).has('createdByUser')).toBe(false);
  });
});
