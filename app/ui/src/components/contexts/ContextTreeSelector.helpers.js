// Pure helpers for ContextTreeSelector — kept out of the component file (the
// react-refresh fast-refresh rule) so they can be unit-tested directly.

// Where a tree came from: the plugin for a generated tree, the source system
// for a synced one. A manual tree has no source but the analyst, which the
// variant colour already says.
export function rootCaption(n) {
  if (n.variant === 'generated') return n.sourceAlgorithmDisplayName || n.sourceAlgorithmName || null;
  if (n.variant === 'synced') return n.scopeSystemName || null;
  return null;
}

// The caption over the tree: every distinct source of the listed roots, in
// first-seen order ("Manager Hierarchy · Active Directory"), or null.
export function rootSources(roots) {
  const seen = [...new Set((roots || []).map(rootCaption).filter(Boolean))];
  return seen.length ? seen.join(' · ') : null;
}

// The systems the roots are scoped to, as [id, name] pairs sorted by name —
// the options of the system filter.
export function scopeSystems(roots) {
  const seen = new Map();
  for (const r of roots || []) {
    if (r.scopeSystemId && r.scopeSystemName && !seen.has(r.scopeSystemId)) seen.set(r.scopeSystemId, r.scopeSystemName);
  }
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

// The roots passing the pane's filters; an empty filter lets everything through.
export function filterRoots(roots, { target, variant, system }) {
  return (roots || []).filter(r =>
    (!target  || r.targetType === target) &&
    (!variant || r.variant    === variant) &&
    (!system  || String(r.scopeSystemId) === system));
}
