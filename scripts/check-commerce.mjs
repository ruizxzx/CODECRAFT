import fs from 'node:fs';
const required = ['src/lib/commerce.ts','src/components/CommerceFoundationPanel.tsx','api/commerce/index.ts'];
const missing = required.filter((p)=>!fs.existsSync(p));
if (missing.length) { console.error(`COMMERCE CHECK FAILED: missing ${missing.join(', ')}`); process.exit(1); }
const source = fs.readFileSync('src/lib/commerce.ts','utf8') + fs.readFileSync('api/commerce/index.ts','utf8');
const bad = ['isPremium = true','paymentSuccess = true','localStorage.*entitlement'];
for (const needle of bad) if (source.includes(needle)) { console.error(`COMMERCE CHECK FAILED: unsafe pattern ${needle}`); process.exit(1); }
const rules = fs.readFileSync('firestore.rules','utf8');
for (const path of ['match /commerceProducts/{productId}','match /commerceOrders/{orderId}','match /entitlements/{entitlementId}','match /creatorRevenue/{ledgerEntryId}','match /users/{userId}/upvotes/{postId}','match /users/{userId}/reposts/{postId}']) if(!rules.includes(path)){console.error(`COMMERCE CHECK FAILED: missing ${path}`);process.exit(1);}
if (rules.includes('\\s')) { console.error('COMMERCE CHECK FAILED: unsupported \\s regex escape remains in Firestore rules'); process.exit(1); }
const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json','utf8'));
for (const c of ['commerceProducts','commerceOrders','entitlements']) if(!indexes.indexes.some(x=>x.collectionGroup===c)){console.error(`COMMERCE CHECK FAILED: missing index for ${c}`);process.exit(1);}
if (fs.readdirSync('src').includes('firestore.rules')) { console.error('COMMERCE CHECK FAILED: duplicate src/firestore.rules'); process.exit(1); }
console.log('COMMERCE CHECK OK — foundation, rules, indexes, and duplicate-rule guard present.');
