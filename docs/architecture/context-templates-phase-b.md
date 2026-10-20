# Context templates — phase B (working spec)

> Status: in progress on `feature/context-templates` (stacked on `feature/core-ontology`, PR #1369).
> This page is the build spec for the branch; it becomes the design record when the PR merges.
> Decisions by Wim, 2026-10-20. Proposal and impact analysis: *Identity_Atlas_Voorstel_type-templates.md* (Teams).

Phase A (ontology 2.0.0) declared four context templates. Phase B makes them real in the data,
the plugins and the UI, and gives an organizational unit and a logical application the people who
answer for them. It is one pull request, with no behaviour change to `assignmentType` anywhere.

## 1. Decisions

| Decision | Outcome |
|---|---|
| `Location` | Segment (a slice) |
| `CostCenter` | OrganizationalUnit |
| Projects, programs | OrganizationalUnit, named in its description; no built-in source emits them yet |
| Roles on a context | Two kinds: **Accountable** (at most one) and **Responsible** (many). Optional, never required: "don't restrict what we can read" |
| Who a role points at | An account (`principalId`) **or** a person (`identityId`), exactly one, as `ResourceAssignments` does |
| Which templates carry roles | OrganizationalUnit and LogicalApplication. Segment and Tag carry none |
| `Contexts.ownerUserId` | Stays what it is: the app user who created a manual context. **Not** a role; a creator is not a responsible |
| Root context types | Removed: a root is a context without a parent. The tag root is `Tag` with `extendedAttributes.tagRoot = true` |
| Scope hierarchy nodes | `Scope`, with the resource's own type in `extendedAttributes.resourceType`; no more borrowed resource types |
| `ContextRecipe` | Not a kind of thing but a provenance. The recipe stores a template chosen at save time (default LogicalApplication); auto-detection and confirmation in the assistant is a follow-on |
| Resource-bound org unit | Valid: "the resources dedicated to Inkoop" is an OrganizationalUnit of resources, linked to the one of persons by a context-to-context relationship `DedicatedTo`. Declared and stored now; the assistant proposing it is a follow-on |
| Owner survey, best-guess owners | Later. Roles get a stable id so a claim (POC step 2) can attach a status to one |

## 2. Data

Migration `092_context_templates.sql`:

- `Contexts.contextCategory TEXT NULL CHECK IN ('OrganizationalUnit','LogicalApplication','Tag','Segment')`,
  backfilled from `contextType` for every known value; unknown values stay NULL (the UI shows them under "Other").
- `ContextRoles` (`id` uuid, `contextId` → Contexts cascade, `principalId` → Principals cascade | `identityId` → Identities cascade (exactly one), `role` CHECK IN ('Accountable','Responsible'), `addedBy` CHECK IN ('sync','algorithm','analyst'), `createdAt`, `updatedAt`); unique per (context, holder, role); partial unique index on `contextId` where `role = 'Accountable'`.
- `ContextRelationships` (`id`, `contextId`, `relatedContextId`, `relationshipType` CHECK IN ('DedicatedTo'), `addedBy`, `createdAt`); unique per triple; `contextId <> relatedContextId`.
- Backfill `Accountable` (`addedBy = 'algorithm'`) on every manager-hierarchy node whose `externalId` is an existing principal id.
- Root rows: `PrincipalTypeRoot → PrincipalType`, `ResourceTypeRoot → ResourceType`, `EntraGroupRoot → EntraGroupCategory`, `SystemMembershipRoot → SystemMembership`, `ScopeHierarchy → Scope`, `TagGroup → Tag + tagRoot`. Scope-hierarchy children: type into `extendedAttributes.resourceType`, `contextType = 'Scope'`.
- `GraphTags` view recreated to leave the tag root out (`GraphTagAssignments` needs no change: the root has no members).

Ingest (`validation.js`): `CONTEXT_CATEGORIES`, `CONTEXT_ROLE_TYPES`, `CONTEXT_RELATIONSHIP_TYPES`; `contexts.contextCategory` optional enum field.
`managerExternalId` on a synced context still lands in `extendedAttributes` (known gap 2 of the ontology); resolving it to an `Accountable` role at ingest is the follow-on, so Omada and midPoint managers arrive the same way the manager plugin's do.

## 3. Plugins and runner

- A plugin declares `contextCategory` (one of the four); a node may override it (`node.contextCategory`, used by the recipe). The runner writes `node.contextCategory ?? plugin.contextCategory` on insert and update.
- A plugin may return `roles: [{ contextExternalId, principalId | identityId, role }]`; the runner replaces the `addedBy = 'algorithm'` roles of the produced contexts, as it does for members. Analyst and sync roles survive re-runs.
- manager-hierarchy: `Accountable` = the manager principal on every manager node. `externalId` keeps the manager id (the member-move route reads it) — the role is the stated fact, the externalId the key.
- principal-type-tree, resource-type-tree, entra-group-category-tree, system-membership-*, scope-hierarchy: the root takes the child type; scope-hierarchy writes `Scope` + `extendedAttributes.resourceType`, and drops `contextTypesFromResourceType`.
- context-recipe: `node.contextCategory` from `recipe.template` (default `LogicalApplication`); `validateRecipe` accepts the field.

## 4. API

Existing (changed): `GET /api/contexts` and `/api/contexts/:id` return `contextCategory`; list accepts `?contextCategory=` and `?sourceAlgorithm=<name>`; `POST`/`PATCH /api/contexts` accept `contextCategory` (default: the parent's, else null). Member move (`/contexts/:id/members/:memberId/move`) and `/api/org-chart` key on `sourceAlgorithmName = 'manager-hierarchy'`, not on the type. Tags routes and bootstrap use `contextType = 'Tag'` plus the `tagRoot` marker.

New:
- `GET /api/contexts/:id/roles` → `[{ id, role, principalId, identityId, displayName, addedBy }]`
- `PUT /api/contexts/:id/roles` body `{ role, principalId | identityId }` → upserts (`addedBy = 'analyst'`); an `Accountable` replaces the existing one. Refused (400) on a Segment or Tag context.
- `DELETE /api/contexts/:id/roles/:roleId`
- `GET /api/contexts/:id/relationships` → `[{ id, relationshipType, relatedContextId, relatedDisplayName, direction }]` (both directions)
- `POST /api/contexts/:id/relationships` body `{ relatedContextId, relationshipType }`; `DELETE /api/contexts/:id/relationships/:relId`
- Permission `data.write.contexts` for writes, as for members. OpenAPI entries for all of the above (`openapi.drift.test.js`).

## 5. UI

- `contextStyles.js`: `CATEGORY_META` (label, badge, short description) for the four templates plus "Other" for null.
- Tree selector: grouped by template (Organisation · Applications · Tags · Segments · Other); within a group, the tree's source (plugin display name or the synced system) as caption instead of the raw `contextType (targetType)`.
- Member move enabled when `selectedRoot.sourceAlgorithmName === 'manager-hierarchy'`; the matrix "By Manager Hierarchy" sort lists roots via `?sourceAlgorithm=manager-hierarchy`.
- Context detail: template badge; for OrganizationalUnit and LogicalApplication a **People** block showing Accountable and Responsible, with add (search `/api/users?search=`) and remove; parent and child units are already shown by the tree.
- New-context wizard and manual editor: a template select (default from the parent).

## 6. Ontology (2.1.0)

- `ia:ContextCategory` value list with four members, each `ia:denotesClass` its template; `ia:contextCategory` column on `ia:Context`. Check: the list equals the templates under `ia:Context`.
- `ia:ContextRole` edge (Context → Principal | Identity) with `ia:ContextRoleType` (Accountable, Responsible); `ia:ContextRelationship` edge (Context → Context) with relationship type `ia:dedicatedTo`. Both in the Structure layer; neither reaches a resource, so the holding rule holds.
- Six root classes removed; `ScopeContext` described; `CostCenterContext` moved under OrganizationalUnit.
- Plugin check: a plugin's `contextCategory` names a template under `ia:Context`, and every type in its `contextTypes` sits under that template.
