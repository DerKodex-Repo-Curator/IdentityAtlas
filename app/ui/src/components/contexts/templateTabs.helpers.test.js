import { describe, it, expect } from 'vitest';
import { tabOf, templateTabs, kindOptions, effectiveTab, effectiveKind, rootsForTab } from './templateTabs.helpers';

const r = (id, contextCategory, targetType = 'Identity') => ({ id, contextCategory, targetType });
const ROOTS = [
  r('ou-ppl-1', 'OrganizationalUnit', 'Identity'),
  r('ou-ppl-2', 'OrganizationalUnit', 'Identity'),
  r('ou-acc', 'OrganizationalUnit', 'Principal'),
  r('app-1', 'LogicalApplication', 'Resource'),
  r('tag-1', 'Tag', 'Resource'),
];

describe('tabOf', () => {
  it('is the template, or Other for none or an unknown one', () => {
    expect(tabOf(r('a', 'Segment'))).toBe('Segment');
    expect(tabOf(r('a', null))).toBe('Other');
    expect(tabOf(r('a', 'Gadget'))).toBe('Other');
    expect(tabOf(undefined)).toBe('Other');
  });
});

describe('templateTabs', () => {
  it('lists the four templates in order with their counts, without Other when nothing is uncategorised', () => {
    expect(templateTabs(ROOTS)).toEqual([
      { key: 'OrganizationalUnit', label: 'Organisation', count: 3 },
      { key: 'LogicalApplication', label: 'Applications', count: 1 },
      { key: 'Tag', label: 'Tags', count: 1 },
      { key: 'Segment', label: 'Segments', count: 0 },
    ]);
  });

  it('adds Other, last, once a root has no template', () => {
    const tabs = templateTabs([...ROOTS, r('x', null), r('y', 'Gadget')]);
    expect(tabs.at(-1)).toEqual({ key: 'Other', label: 'Other', count: 2 });
    expect(tabs).toHaveLength(5);
  });

  it('copes with no roots at all', () => {
    expect(templateTabs(undefined).map(t => t.count)).toEqual([0, 0, 0, 0]);
  });
});

describe('kindOptions', () => {
  it('counts organisation trees per kind, ignoring other templates of the same kind', () => {
    expect(kindOptions(ROOTS)).toEqual([
      { key: 'Identity', label: 'People 2', count: 2 },
      { key: 'Principal', label: 'Accounts 1', count: 1 },
      { key: 'Resource', label: 'Resources 0', count: 0 },
    ]);
  });
});

describe('effectiveTab / effectiveKind', () => {
  const tabs = templateTabs([r('t', 'Tag'), r('s', 'Segment')]);

  it('keeps a chosen tab that exists, even an empty one', () => {
    expect(effectiveTab(tabs, 'OrganizationalUnit')).toBe('OrganizationalUnit');
  });

  it('falls back to the first tab with trees when nothing (or a vanished tab) is chosen', () => {
    expect(effectiveTab(tabs, null)).toBe('Tag');
    expect(effectiveTab(tabs, 'Other')).toBe('Tag');
  });

  it('falls back to Organisation when every tab is empty', () => {
    expect(effectiveTab(templateTabs([]), null)).toBe('OrganizationalUnit');
  });

  it('keeps a chosen kind, else the first kind with trees, else People', () => {
    const opts = kindOptions([r('a', 'OrganizationalUnit', 'Resource')]);
    expect(effectiveKind(opts, 'Principal')).toBe('Principal');
    expect(effectiveKind(opts, null)).toBe('Resource');
    expect(effectiveKind(kindOptions([]), null)).toBe('Identity');
  });
});

describe('rootsForTab', () => {
  it('filters Organisation by kind', () => {
    expect(rootsForTab(ROOTS, 'OrganizationalUnit', 'Identity').map(x => x.id)).toEqual(['ou-ppl-1', 'ou-ppl-2']);
    expect(rootsForTab(ROOTS, 'OrganizationalUnit', 'Principal').map(x => x.id)).toEqual(['ou-acc']);
  });

  it('ignores the kind on every other tab', () => {
    expect(rootsForTab(ROOTS, 'Tag', 'Identity').map(x => x.id)).toEqual(['tag-1']);
    expect(rootsForTab(ROOTS, 'LogicalApplication', 'Principal').map(x => x.id)).toEqual(['app-1']);
  });

  it('copes with no roots', () => {
    expect(rootsForTab(undefined, 'Tag', 'Identity')).toEqual([]);
  });
});
