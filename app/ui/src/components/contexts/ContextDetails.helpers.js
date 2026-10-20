// Pure helpers for ContextDetails.jsx, kept out of the component file so React
// Fast Refresh can hot-swap it (react-refresh/only-export-components).
//
// The context page shows every attribute once. The header carries the name,
// template, type, target, variant, system, owner, parent, provenance and the
// access counts; the description has its own card; a templated context's
// profile carries the member count. What is left — and only that — goes into
// the "More details" list this builds.

import { buildAttributeEntries } from '@ui/utils/attributeEntries';
import { accessCountParts } from './ContextAccessCounts.helpers';

// Shown elsewhere on the page, or internal (temporal columns, ids that only
// point at something already shown by name).
const SHOWN_ELSEWHERE = [
  'SysStartTime', 'SysEndTime', 'ValidFrom', 'ValidTo',
  'id', 'variant', 'targetType', 'contextType', 'contextCategory', 'displayName', 'description',
  'parentContextId', 'parentDisplayName', 'scopeSystemId', 'scopeSystemName',
  'sourceAlgorithmId', 'sourceAlgorithmName', 'sourceAlgorithmDisplayName', 'sourceRunId',
  'ownerUserId', 'ownerPrincipalId', 'ownerDisplayName',
  'extendedAttributes',
];

const ACCESS_COUNT_KEYS = ['resourceCount', 'directAssignmentCount', 'indirectAssignmentCount', 'eligibleAssignmentCount', 'holderCount'];

/**
 * The keys the details list leaves out for this context: the fixed set above,
 * plus what this particular page happens to show elsewhere — the access
 * counts once the header prints them, the member count the profile prints,
 * and the creator a manual context's provenance line already names.
 */
export function hiddenDetailKeys(attrs, { hasProfile = false } = {}) {
  const hidden = new Set(SHOWN_ELSEWHERE);
  if (accessCountParts(attrs).length > 0) ACCESS_COUNT_KEYS.forEach(k => hidden.add(k));
  if (hasProfile) hidden.add(typeof attrs?.totalMemberCount === 'number' ? 'totalMemberCount' : 'directMemberCount');
  if (attrs?.variant === 'manual') hidden.add('createdByUser');
  return hidden;
}

/** [key, value, meta?] rows for the details list — core attributes, then extendedAttributes. */
export function detailEntries(attrs, opts) {
  if (!attrs) return [];
  const ext = attrs.extendedAttributes && typeof attrs.extendedAttributes === 'object' ? attrs.extendedAttributes : null;
  return buildAttributeEntries(attrs, ext, hiddenDetailKeys(attrs, opts));
}
