import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
  'src/components/CommerceProductView.tsx',
  'src/lib/commerce.ts',
  'src/components/CreatorView.tsx',
  'src/components/CommerceFoundationPanel.tsx',
  'api/commerce/index.ts',
];
for(const file of required) if(!fs.existsSync(path.join(root,file))) throw new Error(`Missing required storefront file: ${file}`);
const commerce=fs.readFileSync(path.join(root,'src/lib/commerce.ts'),'utf8');
const api=fs.readFileSync(path.join(root,'api/commerce/index.ts'),'utf8');
const creator=fs.readFileSync(path.join(root,'src/components/CreatorView.tsx'),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'src/components/CommerceFoundationPanel.tsx'),'utf8');
const assertions=[
  ['public product API',api.includes("action==='listPublicProducts')")],
  ['public price API',api.includes("action==='listPublicPrices')")],
  ['creator Store tab',creator.includes("'store'") && creator.includes('listPublicCreatorCommerceProducts')],
  ['product route',app.includes("hash.startsWith('product/')") && app.includes("currentPage === 'product'")],
  ['product navigation',app.includes("page === 'product' && param")],
  ['visibility control',dashboard.includes('setCommerceProductVisibility') && dashboard.includes('STORE VISIBILITY')],
  ['resource-scoped access',commerce.includes("String(x.resourceType||'')!==resourceType") && commerce.includes("String(x.resourceId||'')!==resourceId")],
];
const failed=assertions.filter(([,ok])=>!ok);
if(failed.length) throw new Error(failed.map(([n])=>`FAILED: ${n}`).join('\n'));
console.log(`V87 STOREFRONT CHECK OK — ${assertions.length} requirements satisfied.`);
