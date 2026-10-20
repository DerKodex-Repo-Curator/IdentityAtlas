// Detail profiles per template: which facts a context's page shows first, and
// in which words. Organisational units and logical applications get one; a
// Tag, a Segment or a context without a template keeps the generic detail
// page (profileFor returns null).
//
//   title            heading of the facts card
//   accountableLabel what the Accountable role is called here (an
//                    application's Accountable is its Owner)
//   membersLabel     the label of the member-count fact
//   membersWithKind  say what the members are ("12 People") — a unit can be
//                    any kind; an application's members are always resources
//   showSubUnits     show the number of sub-units
//   variantsAlways   show "Variants of this unit" even when there are none
//                    (for an application only when it has any — rare)

export const PROFILES = {
  OrganizationalUnit: {
    title: 'About this unit',
    accountableLabel: 'Accountable',
    membersLabel: 'Members',
    membersWithKind: true,
    showSubUnits: true,
    variantsAlways: true,
  },
  LogicalApplication: {
    title: 'About this application',
    accountableLabel: 'Owner',
    membersLabel: 'Resources',
    membersWithKind: false,
    showSubUnits: false,
    variantsAlways: false,
  },
};

export function profileFor(contextCategory) {
  return PROFILES[contextCategory] || null;
}
