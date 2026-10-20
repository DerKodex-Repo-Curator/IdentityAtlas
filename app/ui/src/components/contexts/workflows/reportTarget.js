// Which context the "Download entitlement report" card runs the Entitlement
// Pivot on — always the context itself, when the report can read it:
//
//   - an application, or a unit held as resources: the report lists its
//     resources;
//   - a unit of accounts: the report lists the resources its members hold,
//     counted among those members (the API does that, see
//     app/api/src/reports/heldEntitlements.js);
//   - a unit of people: nothing yet. A person reaches a resource only through
//     their accounts, so the report waits for that expansion. The page points
//     at the accounts view of the same unit instead, when there is one.

export const ENTITLEMENT_PIVOT_REPORT = 'application-access-review';

const REPORTABLE_KINDS = new Set(['Resource', 'Principal']);

/** The context id the report runs on, or null when the report cannot read this kind of unit. */
export function reportTarget(attrs) {
  if (attrs.contextCategory === 'LogicalApplication' || REPORTABLE_KINDS.has(attrs.targetType)) return attrs.id;
  return null;
}

/**
 * For a unit of people: the same unit held as accounts (its SameUnitAs link),
 * where the report is available — or null when there is none, or when this
 * unit is not a unit of people.
 */
export function accountsViewForReport(attrs, variants = []) {
  if (attrs.targetType !== 'Identity') return null;
  return variants.find(v => !v.self && v.targetType === 'Principal') || null;
}
