import { describe, it, expect } from 'vitest';
import { reportTarget, ENTITLEMENT_PIVOT_REPORT } from './reportTarget';
import { workflowCardsFor } from './registry';
import DownloadReportCard from './DownloadReportCard';

const variants = [
  { id: 'ppl', displayName: 'Contoso', targetType: 'Identity', self: true },
  { id: 'acc', displayName: 'Contoso accounts', targetType: 'Principal', self: false },
  { id: 'res', displayName: 'Contoso shares', targetType: 'Resource', self: false },
];

describe('reportTarget', () => {
  it('runs on the context itself for an application, whatever its variants', () => {
    expect(reportTarget({ id: 'app', displayName: 'SAP', contextCategory: 'LogicalApplication', targetType: 'Resource' }, variants))
      .toEqual({ id: 'app', displayName: 'SAP', self: true });
  });

  it('runs on a resource unit itself', () => {
    expect(reportTarget({ id: 'u', displayName: 'Shares', contextCategory: 'OrganizationalUnit', targetType: 'Resource' }))
      .toEqual({ id: 'u', displayName: 'Shares', self: true });
  });

  it('runs a people or accounts unit on its resources variant', () => {
    for (const targetType of ['Identity', 'Principal']) {
      expect(reportTarget({ id: 'ppl', contextCategory: 'OrganizationalUnit', targetType }, variants))
        .toEqual({ id: 'res', displayName: 'Contoso shares', self: false });
    }
  });

  it('has no target for a people unit without a resources variant', () => {
    expect(reportTarget({ id: 'ppl', contextCategory: 'OrganizationalUnit', targetType: 'Identity' }, variants.slice(0, 2))).toBeNull();
    expect(reportTarget({ id: 'ppl', contextCategory: 'OrganizationalUnit', targetType: 'Identity' })).toBeNull();
  });

  it('names the Entitlement Pivot by its unchanged slug', () => {
    expect(ENTITLEMENT_PIVOT_REPORT).toBe('application-access-review');
  });
});

describe('workflow registry', () => {
  it('gives units and applications the download card, and other templates nothing', () => {
    expect(workflowCardsFor('OrganizationalUnit')).toEqual([{ key: 'download-report', Card: DownloadReportCard }]);
    expect(workflowCardsFor('LogicalApplication').map(c => c.Card)).toEqual([DownloadReportCard]);
    for (const c of ['Tag', 'Segment', null]) expect(workflowCardsFor(c)).toEqual([]);
  });
});
