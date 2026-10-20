// Which context the "Download report" card runs the Entitlement Pivot on.
//
// The report reads a context of resources. An application, or a unit held as
// resources, is one itself. A people or accounts unit is not: it runs on that
// unit's resources variant (SameUnitAs) when it has one, and on nothing when
// it does not — the card then says so instead of running an empty report.

export const ENTITLEMENT_PIVOT_REPORT = 'application-access-review';

export function reportTarget(attrs, variants = []) {
  if (attrs.contextCategory === 'LogicalApplication' || attrs.targetType === 'Resource') {
    return { id: attrs.id, displayName: attrs.displayName, self: true };
  }
  const v = variants.find(x => !x.self && x.targetType === 'Resource');
  return v ? { id: v.id, displayName: v.displayName, self: false } : null;
}
