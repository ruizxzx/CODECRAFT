import fs from 'node:fs';
const required=[
  'src/lib/digitalProducts.ts',
  'src/components/DigitalProductEnginePanel.tsx',
  'api/digital-products.ts',
  'server/digital-products-server.ts',
  'firestore.rules',
  'V88.0.0_DIGITAL_PRODUCT_ENGINE.md',
];
const missing=required.filter(p=>!fs.existsSync(p));
if(missing.length){console.error(`V88 CHECK FAILED: missing ${missing.join(', ')}`);process.exit(1);}
const rules=fs.readFileSync('firestore.rules','utf8');
if(!rules.includes('match /digitalProductVersions/{versionId}')||!rules.includes('match /digitalProductFiles/{fileId}')){
  console.error('V88 CHECK FAILED: digital product Firestore rules missing');process.exit(1);
}
const client=fs.readFileSync('src/lib/digitalProducts.ts','utf8');
if(!client.includes('/api/digital-products')||client.includes('VITE_R2')||client.includes('R2_SECRET_ACCESS_KEY')){
  console.error('V88 CHECK FAILED: client storage/security contract invalid');process.exit(1);
}
const api=fs.readFileSync('api/digital-products.ts','utf8');
for(const s of ['createProduct','updateProduct','requestUpload','completeUpload','createVersion','publishProduct','publishVersion','archiveProduct']) if(!api.includes(`case '${s}'`)){console.error(`V88 CHECK FAILED: missing action ${s}`);process.exit(1);}
const server=fs.readFileSync('server/digital-products-server.ts','utf8');
for(const key of ['R2_PRODUCT_BUCKET_NAME','R2_PRODUCT_ACCOUNT_ID','R2_PRODUCT_ACCESS_KEY_ID','R2_PRODUCT_SECRET_ACCESS_KEY','R2_PRODUCT_S3_ENDPOINT']) { if(!server.includes(key)){console.error(`V88 CHECK FAILED: missing ${key} in product storage config`);process.exit(1);} }
for(const publicKey of ['R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY']) { if(api.includes(publicKey) || server.includes(`process.env.${publicKey}`)) { console.error(`V88 CHECK FAILED: digital product API must not use public media credential ${publicKey}`); process.exit(1); } }
console.log('V88 DIGITAL PRODUCT CHECK OK — product engine, version/file APIs, security rules, and server-only storage contract detected.');
