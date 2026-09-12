import fs from 'node:fs';
const must = [
  ['src/components/KnowledgeView.tsx','Knowledge workspace'],
  ['src/lib/knowledgeEngine.ts','knowledge engine'],
  ['api/ai/offscript-retrieve.ts','secure retrieval endpoint'],
  ['server/offscript-retrieval.ts','server retrieval'],
];
const errors=[];
for (const [file,label] of must) if(!fs.existsSync(file)) errors.push(`${label}: missing ${file}`);
const app=fs.readFileSync('src/App.tsx','utf8');
for (const route of ["'knowledge'","'vault'","'research'"]) if(!app.includes(route)) errors.push(`App route missing: ${route}`);
const header=fs.readFileSync('src/components/Header.tsx','utf8');
for (const route of ["'knowledge'","'vault'","'research'"]) if(!header.includes(route)) errors.push(`Header route missing: ${route}`);
const cmd=fs.readFileSync('src/components/CommandPalette.tsx','utf8');
for (const label of ['Ask OFFSCRPT','My Vault','OFFSCRPT Research']) if(!cmd.includes(label)) errors.push(`Command entry missing: ${label}`);
const cold=fs.readFileSync('src/components/PersonalizedHomeSections.tsx','utf8');
for (const term of ['TRAVEL','MOVIES','MUSIC','SPORTS','FOOD','BOOKS']) if(!cold.includes(term)) errors.push(`Universal cold-start topic missing: ${term}`);
const ai=fs.readFileSync('src/lib/ai.ts','utf8');
if(!ai.includes('retrieveOFFSCRPTSources')) errors.push('AI retrieval client helper missing');
if(!fs.readFileSync('api/ai/offscript-retrieve.ts','utf8').includes('verifiedUid')) errors.push('Standalone retrieval UID verification missing');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('V81 UNIVERSAL KNOWLEDGE CHECK OK — routes, knowledge workspace, retrieval helper, secure UID binding and universal cold-start topics present.');
