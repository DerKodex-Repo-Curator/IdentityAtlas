import { describe, it, expect } from 'vitest';
import { TYPE_DIAGRAMS, typeDiagram } from './typeDiagrams.js';
import { originText, typeOrigin } from './typeOrigins.js';
import { renderReference } from './referenceDoc.js';
import { CONTEXT_TTL, modelOf } from './__tests__/miniOntology.js';

const TTL = `${CONTEXT_TTL}
ia:emittedBy a owl:AnnotationProperty . ia:passthroughFrom a owl:AnnotationProperty .
ia:User ia:emittedBy "hr", "idp" .
ia:Group ia:emittedBy "hr" .
ia:ManagerHierarchyContext ia:emittedBy "hr" .
ia:Resource ia:passthroughFrom "hr" .
ia:Principal ia:passthroughFrom "hr" .
ia:Robot a owl:Class ; rdfs:subClassOf ia:Principal ; ia:typeValue "Robot" ; rdfs:label "Robot" ; rdfs:comment "Accepted." ; rdfs:isDefinedBy <https://identityatlas.io/ontology> .
`;
const model = modelOf(TTL);
const cls = (name) => model.classes.get(name);
const code = (s) => `\`${s}\``;

describe('typeOrigin / originText', () => {
  it('groups a type by plugin first, then crawler, then application code or nothing', () => {
    expect(typeOrigin(model, cls('ManagerHierarchyContext'))).toEqual({ group: 'plugin', plugins: ['manager-hierarchy'], crawlers: ['hr'] });
    expect(typeOrigin(model, cls('User')).group).toBe('crawler');
    expect(typeOrigin(model, cls('TagContext')).group).toBe('code');
    expect(typeOrigin(model, cls('Robot')).group).toBe('accepted');
  });

  it('describes the origin for a table cell', () => {
    expect(originText(model, cls('ManagerHierarchyContext'), code)).toBe('plugin `manager-hierarchy`; crawler `hr`');
    expect(originText(model, cls('User'), code)).toBe('crawlers `hr`, `idp`');
    expect(originText(model, cls('TagContext'), code)).toBe('application code');
    expect(originText(model, cls('Robot'), code)).toBe('no built-in source');
  });
});

describe('typeDiagram', () => {
  it('draws a closed list grouped by origin, in rows, without an "any other value" node', () => {
    expect(typeDiagram(model, 'Principal')).toBe([
      'flowchart LR',
      '    root["Principal<br/><small>principalType</small>"]:::Principal',
      '    subgraph g_crawler["Written by a crawler"]',
      '      direction LR',
      '      t_User["User<br/><small>hr, idp</small>"]:::Principal',
      '    end',
      '    subgraph g_accepted["Accepted, no built-in source"]',
      '      direction LR',
      '      t_Robot["Robot"]:::Principal',
      '    end',
      '    root --> g_crawler',
      '    root --> g_accepted',
      '    classDef Principal fill:#2563eb,stroke:#1e40af,color:#fff',
    ].join('\n'));
  });

  it('adds the crawlers that pass values through to an open list', () => {
    const out = typeDiagram(model, 'Resource');
    expect(out).toContain('    other["any other value<br/><small>from hr</small>"]');
    expect(out).toContain('    root -.-> other');
  });

  it('says only "any other value" for an open list nobody passes through, and links rows of four', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map(v => `ia:${v}Context a owl:Class ; rdfs:subClassOf ia:Context ; ia:typeValue "${v}" ; ia:allowedTargetType ia:EntityKind_Principal .`).join('\n');
    const out = typeDiagram(modelOf(`${TTL}\n${many}`), 'Context');
    expect(out).toContain('    other["any other value"]');
    expect(out).toContain('      t_A ~~~ t_B ~~~ t_C ~~~ t_D');
    expect(out).toContain('      t_E ~~~ t_Tag');
    expect(out).toContain('    subgraph g_code["Created by the application"]');
  });

  it('leaves a root without a known colour unstyled', () => {
    const ttl = `${TTL}\nia:Thing a owl:Class ; rdfs:subClassOf ia:Node ; rdfs:label "Thing" ; ia:discriminator "kind" .`;
    expect(typeDiagram(modelOf(ttl), 'Thing')).not.toContain('classDef');
  });

  it('registers one generator per kind of node', () => {
    expect(Object.keys(TYPE_DIAGRAMS).sort()).toEqual(['types-context', 'types-principal', 'types-resource']);
    expect(TYPE_DIAGRAMS['types-principal'](model)).toBe(typeDiagram(model, 'Principal'));
  });
});

describe('renderReference — origins', () => {
  const md = renderReference(model);

  it('adds a Made by column where crawlers write the types', () => {
    expect(md).toContain('| Value | Class | Made by | Meaning |');
    expect(md).toContain('| `User` | `ia:User` | crawlers `hr`, `idp` | A person account. |');
  });

  it('says which crawlers pass values through to an open list, and which map onto a closed one', () => {
    expect(md).toContain('Other values arrive from the source data or configuration of: `hr`.');
    expect(md).toContain('Mapped onto this list from the source data or configuration by: `hr`.');
  });
});
