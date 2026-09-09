import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const root = path.resolve('src');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
  }
}
walk(root);
const failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const specs = [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["'`]([^"'`]+)["'`]/g)].map(m => m[1]).filter(Boolean);
  for (const spec of specs) {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    let base = spec.startsWith('@/') ? path.resolve('src', spec.slice(2)) : path.resolve(path.dirname(file), spec);
    if (spec.startsWith('@/') && !base.startsWith(root)) failures.push(`${file}: alias escapes src: ${spec}`);
    if (!path.extname(base)) {
      const hit = extensions.map(ext => base + ext).find(fs.existsSync) || ['index.ts','index.tsx','index.js','index.jsx'].map(ext => path.join(base,ext)).find(fs.existsSync);
      if (!hit) failures.push(`${path.relative('.',file)} -> missing ${spec}`);
    } else if (!fs.existsSync(base)) failures.push(`${path.relative('.',file)} -> missing ${spec}`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`IMPORT CHECK OK — ${files.length} source files scanned.`);
