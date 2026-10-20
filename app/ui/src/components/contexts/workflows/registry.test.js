import { describe, it, expect } from 'vitest';
import { actionCardsFor } from './registry';
import MatrixCard from './MatrixCard';
import DownloadReportCard from './DownloadReportCard';

const APP = { id: 'app', contextCategory: 'LogicalApplication', targetType: 'Resource' };
const unit = targetType => ({ id: targetType, contextCategory: 'OrganizationalUnit', targetType });

describe('action registry', () => {
  const cardsOf = attrs => actionCardsFor(attrs).map(c => c.Card);

  it('gives an application the matrix and the entitlement report, matrix first', () => {
    expect(cardsOf(APP)).toEqual([MatrixCard, DownloadReportCard]);
    // On its template, whatever it holds.
    expect(cardsOf({ ...APP, targetType: undefined })).toEqual([MatrixCard, DownloadReportCard]);
  });

  it('gives every organisational unit — of people, accounts or resources — the matrix only', () => {
    for (const t of ['Identity', 'Principal', 'Resource', 'System']) expect(cardsOf(unit(t)), t).toEqual([MatrixCard]);
  });

  it('gives other templates no actions', () => {
    for (const contextCategory of ['Tag', 'Segment', 'Other', null]) expect(actionCardsFor({ ...APP, contextCategory })).toEqual([]);
  });
});
