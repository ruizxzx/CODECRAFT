import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const header = fs.readFileSync(path.join(root, 'src/components/Header.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const article = fs.readFileSync(path.join(root, 'src/components/ArticleView.tsx'), 'utf8');
const version = fs.readFileSync(path.join(root, 'VERSION.md'), 'utf8');

const checks = [
  ['version is V83.0.0', /OFFSCRPT_VERSION=83\.0\.0/.test(version)],
  ['mobile dock has five actions', (() => { const start = header.indexOf('Mobile floating navigation dock'); const end = header.indexOf('Sidebar Overlay'); const block = header.slice(start, end); return (block.match(/<button/g) || []).length === 5; })()],
  ['mobile dock uses flexible sizing', /\.mobile-nav-action\s*\{[\s\S]*?flex:\s*1 1 0/.test(css)],
  ['mobile overflow containment exists', /html, body, #root\s*\{[\s\S]*?overflow-x:\s*hidden/.test(css)],
  ['mobile grid stacking exists', /grid-cols-2/.test(css) && /grid-template-columns:\s*minmax\(0, 1fr\) !important/.test(css)],
  ['article utility bar is mobile-safe', /article-utility-bar/.test(article) && /article-utility-actions/.test(article)],
  ['wide tables retain local scrolling', /\.overflow-x-auto > table/.test(css)],
];
let failed = 0;
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`), failed += ok ? 0 : 1;
if (failed) process.exit(1);
console.log(`V83 mobile checks passed: ${checks.length}`);
