import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

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
