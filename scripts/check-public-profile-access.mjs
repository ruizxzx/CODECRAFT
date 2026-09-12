import fs from 'node:fs';
const rules = fs.readFileSync('firestore.rules','utf8');
const start = rules.indexOf('match /publicProfiles/{username}');
if (start < 0) throw new Error('publicProfiles rule missing');
const block = rules.slice(start, rules.indexOf('\n    }', start));
if (!block.includes('allow read: if true;')) throw new Error('public profile reads must be public for anonymous profile routes');
if (!rules.includes('match /handleAliases/{oldUsername}')) throw new Error('handle alias routing rule missing');
console.log('PUBLIC PROFILE ACCESS CHECK OK');
