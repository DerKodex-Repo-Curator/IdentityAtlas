import { describe, it, expect } from 'vitest';
import { reportTarget, accountsViewForReport, ENTITLEMENT_PIVOT_REPORT } from './reportTarget';
import { actionCardsFor } from './registry';
import MatrixCard from './MatrixCard';
import DownloadReportCard from './DownloadReportCard';

const variants = [
  { id: 'ppl', displayName: 'Contoso', targetType: 'Identity', self: true },
  { id: 'acc', displayName: 'Contoso accounts', targetType: 'Principal', self: false },
  { id: 'res', displayName: 'Contoso shares', targetType: 'Resource', self: false },
];

const APP = { id: 'app', contextCategory: 'LogicalApplication', targetType: 'Resource' };
const RES_UNIT = { id: 'res', contextCategory: 'OrganizationalUnit', targetType: 'Resource' };
const ACC_UNIT = { id: 'acc', contextCategory: 'OrganizationalUnit', targetType: 'Principal' };
const PPL_UNIT = { id: 'ppl', contextCategory: 'OrganizationalUnit', targetType: 'Identity' };

describe('reportTarget', () => {
  it('runs on the context itself for applications, resource units and accounts units', () => {
    expect(reportTarget(APP)).toBe('app');
    expect(reportTarget(RES_UNIT)).toBe('res');
    expect(reportTarget(ACC_UNIT)).toBe('acc');
    // An application is reportable on its template, whatever it holds.
    expect(reportTarget({ ...APP, targetType: undefined })).toBe('app');
  });

  it('has no target for a unit of people — not even its resources or accounts view', () => {
    expect(reportTarget(PPL_UNIT)).toBeNull();
    expect(reportTarget({ id: 's', contextCategory: 'OrganizationalUnit', targetType: 'System' })).toBeNull();
  });

  it('names the Entitlement Pivot by its unchanged slug', () => {
    expect(ENTITLEMENT_PIVOT_REPORT).toBe('application-access-review');
  });
});

describe('accountsViewForReport', () => {
  it('points a unit of people at the same unit held as accounts', () => {
    expect(accountsViewForReport(PPL_UNIT, variants)).toEqual(variants[1]);
  });

  it('says nothing when a people unit has no accounts view, or when the unit has its own report', () => {
    expect(accountsViewForReport(PPL_UNIT, [variants[0], variants[2]])).toBeNull();
    expect(accountsViewForReport(PPL_UNIT)).toBeNull();
    expect(accountsViewForReport(RES_UNIT, variants)).toBeNull();
    // The accounts unit itself is not pointed at itself.
    expect(accountsViewForReport(ACC_UNIT, [{ ...variants[1], self: true }])).toBeNull();
  });
});

describe('action registry', () => {
  const cardsOf = attrs => actionCardsFor(attrs).map(c => c.Card);

  it('gives applications, resource units and accounts units both cards, matrix first', () => {
    for (const attrs of [APP, RES_UNIT, ACC_UNIT]) expect(cardsOf(attrs), attrs.id).toEqual([MatrixCard, DownloadReportCard]);
  });

  it('gives a unit of people the matrix only', () => {
    expect(cardsOf(PPL_UNIT)).toEqual([MatrixCard]);
  });

  it('gives other templates no actions', () => {
    for (const contextCategory of ['Tag', 'Segment', null]) expect(actionCardsFor({ ...ACC_UNIT, contextCategory })).toEqual([]);
  });
});
