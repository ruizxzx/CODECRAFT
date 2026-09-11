import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
 'src/lib/intelligence/types.ts','src/lib/content.ts','src/lib/activity.ts','src/lib/permissions.ts','src/lib/contentGraph.ts','src/lib/unifiedSearch.ts','src/lib/recommendationEngine.ts','src/lib/featureFlags.ts','src/lib/readingIntelligence.ts','src/lib/indexSync.ts','api/lib/offscript-retrieval.ts','api/ai/offscript-retrieve.ts','V80.0.0_INTELLIGENCE_CORE.md'
];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
if(missing.length){console.error('V80 missing:',missing.join(', '));process.exit(1);}
const rules=fs.readFileSync(path.join(root,'src/firestore.rules'),'utf8');
for(const marker of ['activityEvents','indexSyncQueue','contentRelationships','intelligenceConfig']) if(!rules.includes(marker)){console.error('V80 Firestore rule marker missing:',marker);process.exit(1);}
const gateway=fs.readFileSync(path.join(root,'api/ai/gateway.ts'),'utf8');
if(!gateway.includes('retrieveOffscrpt') || !gateway.includes('SERVER-VERIFIED OFFSCRPT RETRIEVAL')){console.error('V80 AI retrieval gateway integration missing');process.exit(1);}
console.log('V80 intelligence core checks passed.');
