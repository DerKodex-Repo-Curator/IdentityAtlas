// One generated diagram per kind of node, showing its types grouped by where
// they come from (./typeOrigins.js): types-principal, types-resource,
// types-context. Under each type: the plugins and crawlers that write it. An
// open vocabulary also gets an "any other value" node naming the crawlers that
// pass values through, so the picture says which list is closed and which is not.

import { typedSubclasses } from './model.js';
import { NODE_STYLE } from './mermaid.js';
import { ORIGIN_LABELS, typeOrigin } from './typeOrigins.js';

const PER_ROW = 4;
const byValue = (a, b) => (a.typeValue < b.typeValue ? -1 : a.typeValue > b.typeValue ? 1 : 0);
const id = (prefix, s) => `${prefix}_${String(s).replace(/[^A-Za-z0-9]/g, '_')}`;

function sources(origin) {
  return [...origin.plugins, ...origin.crawlers].join(', ');
}

// A group of types as a subgraph, laid out PER_ROW to a row with invisible links.
function groupLines(root, group, members) {
  const lines = [`    subgraph ${id('g', group)}["${ORIGIN_LABELS[group]}"]`, '      direction LR'];
  for (const { cls, origin } of members) {
    const under = sources(origin);
    lines.push(`      ${id('t', cls.typeValue)}["${cls.typeValue}${under ? `<br/><small>${under}</small>` : ''}"]:::${root}`);
  }
  for (let i = 0; i < members.length; i += PER_ROW) {
    const row = members.slice(i, i + PER_ROW).map(m => id('t', m.cls.typeValue));
    if (row.length > 1) lines.push(`      ${row.join(' ~~~ ')}`);
  }
  lines.push('    end');
  return lines;
}

/** flowchart of the types of one root class (Principal, Resource, Context). */
export function typeDiagram(model, root) {
  const cls = model.classes.get(root);
  const members = typedSubclasses(model, root).sort(byValue).map(c => ({ cls: c, origin: typeOrigin(model, c) }));
  const groups = Object.keys(ORIGIN_LABELS).filter(g => members.some(m => m.origin.group === g));
  const lines = ['flowchart LR', `    root["${cls.label}<br/><small>${cls.discriminator}</small>"]:::${root}`];
  for (const g of groups) lines.push(...groupLines(root, g, members.filter(m => m.origin.group === g)));
  for (const g of groups) lines.push(`    root --> ${id('g', g)}`);
  if (cls.openVocabulary) {
    const from = cls.passthroughFrom.length ? `<br/><small>from ${cls.passthroughFrom.join(', ')}</small>` : '';
    lines.push(`    other["any other value${from}"]`, '    root -.-> other');
  }
  if (NODE_STYLE[root]) lines.push(`    classDef ${root} ${NODE_STYLE[root]}`);
  return lines.join('\n');
}

export const TYPE_DIAGRAMS = {
  'types-principal': (model) => typeDiagram(model, 'Principal'),
  'types-resource': (model) => typeDiagram(model, 'Resource'),
  'types-context': (model) => typeDiagram(model, 'Context'),
};
