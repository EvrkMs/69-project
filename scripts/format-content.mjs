// npm run format:content: rewrites every JSON file under content/ in the project style
// (step tuples and small arrays/objects on one line, everything else indented). Safe to run any time.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STEP_KINDS = new Set(['h', 'n', 'fact', 'clip', 'action', 'task']);
const prim = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const flat = (v) => prim(v) || (v && !Array.isArray(v) && typeof v === 'object' && Object.values(v).every(prim));

export function formatJson(v, ind = '') {
  const pad = ind + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const inline = `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
    const flatRow = (x) => flat(x) || (Array.isArray(x) && x.every(prim));
    if (STEP_KINDS.has(v[0]) || (v.every(flatRow) && inline.length <= 100)) return inline;
    return `[\n${v.map((x) => pad + formatJson(x, pad)).join(',\n')}\n${ind}]`;
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    const inline = `{ ${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(v[k])}`).join(', ')} }`;
    if (Object.values(v).every(prim) && inline.length <= 100) return inline;
    return `{\n${keys.map((k) => `${pad}${JSON.stringify(k)}: ${formatJson(v[k], pad)}`).join(',\n')}\n${ind}}`;
  }
  return JSON.stringify(v);
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : []));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
  for (const file of walk(root)) writeFileSync(file, formatJson(JSON.parse(readFileSync(file, 'utf8'))) + '\n');
  console.log('formatted content/*.json');
}
