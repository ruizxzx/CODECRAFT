import fs from 'node:fs';
const files=['src/lib/community.ts','src/components/CommunityProfileView.tsx','src/App.tsx','src/firestore.rules'];
for (const f of files) if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
const src=fs.readFileSync('src/lib/community.ts','utf8');
if(!src.includes("publicProfiles")) throw new Error('publicProfiles integration missing');
if(!src.includes('upsertPublicProfile')) throw new Error('public profile sync missing');
console.log('PUBLIC PROFILE CHECK OK');
