// Pure helpers for the Contexts page's sub-tabs: one tab per template
// (Organisation · Applications · Tags · Segments, plus Other only when some
// root has no template), and in Organisation one tree kind at a time.

import { categoryMeta, CATEGORY_ORDER, MEMBER_KINDS, memberKindLabel } from '@ui/utils/contextStyles';

// The tab a root belongs to: its template, or Other for none / an unknown one.
export function tabOf(root) {
  return CATEGORY_ORDER.includes(root?.contextCategory) ? root.contextCategory : 'Other';
}

// [{ key, label, count }] in CATEGORY_ORDER. The four templates always show
// (an empty tab is still a place to create one); Other only when it has roots.
export function templateTabs(roots) {
  const counts = new Map();
  for (const r of roots || []) counts.set(tabOf(r), (counts.get(tabOf(r)) || 0) + 1);
  return CATEGORY_ORDER
    .filter(k => k !== 'Other' || counts.has('Other'))
    .map(k => ({ key: k, label: categoryMeta(k).groupLabel, count: counts.get(k) || 0 }));
}

// The Organisation kind switch: People · Accounts · Resources, with how many
// organisation trees of each kind there are.
export function kindOptions(roots) {
  return MEMBER_KINDS.map(kind => {
    const count = (roots || []).filter(r => tabOf(r) === 'OrganizationalUnit' && r.targetType === kind).length;
    return { key: kind, label: `${memberKindLabel(kind)} ${count}`, count };
  });
}

// The tab to show: the chosen one while it still exists, else the first tab
// with any roots, else Organisation.
export function effectiveTab(tabs, chosen) {
  if (chosen && tabs.some(t => t.key === chosen)) return chosen;
  return tabs.find(t => t.count > 0)?.key || 'OrganizationalUnit';
}

// The kind to show in Organisation: the chosen one, else the first kind that
// has trees, else People.
export function effectiveKind(options, chosen) {
  if (chosen) return chosen;
  return options.find(o => o.count > 0)?.key || MEMBER_KINDS[0];
}

// The roots the left pane lists for the active tab (and, in Organisation, kind).
export function rootsForTab(roots, tab, kind) {
  return (roots || []).filter(r => tabOf(r) === tab && (tab !== 'OrganizationalUnit' || r.targetType === kind));
}
