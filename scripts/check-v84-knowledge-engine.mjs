import fs from 'fs';
import path from 'path';
const root = process.cwd();
const must = [
  ['src/lib/semanticRetrieval.ts', ['EmbeddingProvider','VectorIndexProvider','chunkContentV84','mergeHybridCandidates']],
  ['src/lib/knowledgeEngine.ts', ['KnowledgeIndexManifest','buildKnowledgeIndexManifest']],
  ['server/knowledge-engine.js', ['getKnowledgeProviderConfig','embedTexts','queryVector','upsertVectors','deleteVectors']],
  ['api/knowledge/health.ts', ['providerHealth','MASTER_ADMIN_REQUIRED']],
  ['api/knowledge/index.ts', ['authorizedWorker','upsertVectors','embedTexts','deleteVectors']],
];
const errors=[];
for(const [file, needles] of must){const p=path.join(root,file); if(!fs.existsSync(p)){errors.push(`${file}: missing`);continue;} const s=fs.readFileSync(p,'utf8'); for(const n of needles) if(!s.includes(n)) errors.push(`${file}: missing ${n}`);}
const allSource=fs.readFileSync(path.join(root,'src/lib/semanticRetrieval.ts'),'utf8') + fs.readFileSync(path.join(root,'src/components/AdminControlPanel.tsx'),'utf8');
if (allSource.includes('OFFSCRPT_VECTOR_API_KEY') || allSource.includes('OFFSCRPT_EMBEDDING_API_KEY')) errors.push('client source must not contain provider secret environment names');
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
if(!rules.includes('siteConfig/global')) errors.push('firestore.rules: expected siteConfig/global patterns');
if(errors.length){console.error('V84 knowledge checks FAILED');errors.forEach(e=>console.error(`- ${e}`));process.exit(1)}
console.log('V84 knowledge checks: PASS');
