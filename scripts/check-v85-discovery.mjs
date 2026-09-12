import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/lib/discovery.ts',
  'src/lib/unifiedSearch.ts',
  'src/lib/recommendationEngine.ts',
  'src/components/SearchModal.tsx',
  'VERSION.md',
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing V85 artifact: ${rel}`);
}
const discovery = fs.readFileSync(path.join(root, 'src/lib/discovery.ts'), 'utf8');
for (const token of ['parseDiscoveryQuery', 'freshnessScore', 'engagementScore', 'trendScore', 'diversifyDiscovery']) {
  if (!discovery.includes(`function ${token}`)) throw new Error(`Missing Discovery Core primitive: ${token}`);
}
const search = fs.readFileSync(path.join(root, 'src/lib/unifiedSearch.ts'), 'utf8');
for (const token of ['filterAuthorizedContent', 'parseDiscoveryQuery', 'freshnessScore', 'engagementScore']) {
  if (!search.includes(token)) throw new Error(`Unified search missing required integration: ${token}`);
}
const rec = fs.readFileSync(path.join(root, 'src/lib/recommendationEngine.ts'), 'utf8');
if (!rec.includes("from './discovery'")) throw new Error('Recommendation engine is not connected to Discovery Core');
const version = fs.readFileSync(path.join(root, 'VERSION.md'), 'utf8');
if (!/^OFFSCRPT_VERSION=(?:85\.|86\.)/m.test(version)) throw new Error('VERSION.md is not a compatible V85/V86 release.');
console.log('V85 DISCOVERY CHECK PASS');
