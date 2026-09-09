import fs from 'node:fs';
const blueprint=JSON.parse(fs.readFileSync('firebase-blueprint.json','utf8'));
const cms=fs.readFileSync('src/lib/cms.ts','utf8');
const entities=blueprint.entities||{};
const required=['User','Post','Comment'];
const missing=required.filter(x=>!entities[x]);
if(missing.length){console.error('SCHEMA CHECK FAILED:',missing.join(', '));process.exit(1);}
if(!cms.includes('function normalizeArticleRecord')){console.error('SCHEMA CHECK FAILED: article content normalization layer is missing.');process.exit(1);}
for(const [name,entity] of Object.entries(entities)){
  if(entity.type!=='object' || !entity.properties || !Array.isArray(entity.required)){
    console.error(`SCHEMA CHECK FAILED: ${name} is not a valid object schema.`); process.exit(1);
  }
}
console.log(`SCHEMA CHECK OK — ${Object.keys(entities).length} Firebase blueprint entities validated.`);
