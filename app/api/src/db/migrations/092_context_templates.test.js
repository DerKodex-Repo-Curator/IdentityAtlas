import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CONTEXT_CATEGORIES, CONTEXT_ROLE_TYPES, CONTEXT_RELATIONSHIP_TYPES, CONTEXT_MEMBER_ADDED_BY } from '../../ingest/validation.js';
import { REGISTERED_PLUGINS } from '../../contexts/plugins/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '092_context_templates.sql'), 'utf8');
const statements = sql.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
const inList = (re) => statements.match(re)[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
// The backfill CASE only, so the GraphTags view's own CASE does not count.
const backfill = statements.slice(statements.indexOf('SET "contextCategory" = CASE'), statements.indexOf('ix_Contexts_contextCategory'));

describe('migration 092 — context templates', () => {
  it('adds the nullable template column with exactly the four templates the ingest knows', () => {
    expect(statements).toMatch(/ADD COLUMN "contextCategory" TEXT\s+CHECK/);
    expect(statements).not.toMatch(/"contextCategory" TEXT NOT NULL/);
    expect(inList(/"contextCategory" IN \(([^)]+)\)/)).toEqual(CONTEXT_CATEGORIES);
  });

  it('creates the two edge tables with the lists the ingest enforces', () => {
    expect(statements.match(/CREATE TABLE "(\w+)"/g)).toEqual(['CREATE TABLE "ContextRoles"', 'CREATE TABLE "ContextRelationships"']);
    expect(inList(/"role" IN \(([^)]+)\)/)).toEqual(CONTEXT_ROLE_TYPES);
    expect(inList(/"relationshipType" IN \(([^)]+)\)/)).toEqual(CONTEXT_RELATIONSHIP_TYPES);
    for (const list of [...statements.matchAll(/"addedBy" IN \(([^)]+)\)/g)]) {
      expect(list[1].split(',').map(s => s.trim().replace(/'/g, ''))).toEqual(CONTEXT_MEMBER_ADDED_BY);
    }
  });

  it('allows one Accountable per context and one holder per row, and never two holders', () => {
    expect(statements).toMatch(/CREATE UNIQUE INDEX "ux_ContextRoles_accountable" ON "ContextRoles" \("contextId"\) WHERE "role" = 'Accountable'/);
    expect(statements).toMatch(/CHECK \(\("principalId" IS NULL\) <> \("identityId" IS NULL\)\)/);
    expect(statements).toMatch(/CHECK \("contextId" <> "relatedContextId"\)/);
  });

  it('retires every root type a plugin used to write, and only those', () => {
    const retired = [...statements.matchAll(/WHERE "contextType" = '(\w+)';/g)].map(m => m[1]).sort();
    expect(retired).toEqual(['EntraGroupRoot', 'PrincipalTypeRoot', 'ResourceTypeRoot', 'ScopeHierarchy', 'SystemMembershipRoot', 'TagGroup']);
    // No registered plugin still declares one of them.
    const declared = new Set(REGISTERED_PLUGINS.flatMap(p => p.contextTypes));
    expect(retired.filter(t => declared.has(t))).toEqual([]);
    expect(statements).toMatch(/'\{"tagRoot": true\}'::jsonb\s+WHERE "contextType" = 'TagGroup'/);
  });

  it('backfills a template for every type a registered plugin writes', () => {
    const mapped = new Set([...backfill.matchAll(/WHEN '(\w+)'\s+THEN '(\w+)'/g)].map(m => m[1]));
    const written = REGISTERED_PLUGINS.flatMap(p => p.contextTypes);
    expect(written.filter(t => !mapped.has(t))).toEqual([]);
    // …and only onto the four templates.
    const targets = new Set([...backfill.matchAll(/THEN '(\w+)'/g)].map(m => m[1]));
    expect([...targets].filter(t => !CONTEXT_CATEGORIES.includes(t))).toEqual([]);
  });

  it('states the manager of every manager-hierarchy node as its Accountable, matched by principal id', () => {
    expect(statements).toMatch(/INSERT INTO "ContextRoles" \("contextId", "principalId", "role", "addedBy"\)\s+SELECT c\.id, p\.id, 'Accountable', 'algorithm'/);
    expect(statements).toMatch(/JOIN "Principals" p ON p\.id::text = c\."externalId"/);
    expect(statements).toMatch(/WHERE name = 'manager-hierarchy'/);
  });

  it('keeps the tag root out of the GraphTags view', () => {
    expect(statements).toMatch(/CREATE OR REPLACE VIEW "GraphTags"/);
    expect(statements).toMatch(/AND COALESCE\(c\."extendedAttributes"->>'tagRoot', 'false'\) <> 'true'/);
    expect(statements).not.toMatch(/GraphTagAssignments/);
  });

  it('drops nothing and never touches assignments', () => {
    expect(statements).not.toMatch(/DROP |DELETE FROM|ResourceAssignments|assignmentType/);
  });
});

describe('migration 092 — the backfill is the one mapping the ingest derives from', () => {
  it('maps every known contextType to the same template as lib/contextCategories.js', async () => {
    const { CONTEXT_TYPE_CATEGORY } = await import('../../lib/contextCategories.js');
    const sqlMap = Object.fromEntries([...backfill.matchAll(/WHEN '(\w+)'\s+THEN '(\w+)'/g)].map(m => [m[1], m[2]]));
    expect(sqlMap).toEqual(CONTEXT_TYPE_CATEGORY);
  });
});
