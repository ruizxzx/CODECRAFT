import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

const staleApiLib = path.join(root, 'api', 'lib');
if (fs.existsSync(staleApiLib)) {
  console.error('DEPLOYMENT CONFIG FAILED: stale api/lib exists. Delete api/lib/*; shared server helpers must live under server/.');
  process.exit(1);
}
const apiRoutes = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) apiRoutes.push(full);
  }
}
const apiRoot = path.join(root, 'api');
if (fs.existsSync(apiRoot)) walk(apiRoot);
if (apiRoutes.length > 12) {
  console.error(`DEPLOYMENT CONFIG FAILED: ${apiRoutes.length} API route files would exceed Vercel Hobby's 12-function limit.`);
  process.exit(1);
}

if (vercel.outputDirectory !== 'dist') {
  console.error(`DEPLOYMENT CONFIG FAILED: Vercel outputDirectory is ${vercel.outputDirectory}, expected dist.`);
  process.exit(1);
}
if (!vite.includes('outDir: path.resolve(__dirname, \'dist\')')) {
  console.error('DEPLOYMENT CONFIG FAILED: Vite must emit to repository-root dist/.');
  process.exit(1);
}
if (!vite.includes('emptyOutDir: true')) {
  console.error('DEPLOYMENT CONFIG FAILED: emptyOutDir safeguard is missing.');
  process.exit(1);
}
console.log('DEPLOYMENT CONFIG OK — Vite output and Vercel outputDirectory both target repository-root dist/.');
