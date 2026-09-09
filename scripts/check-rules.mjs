import fs from 'node:fs';
const rules=fs.readFileSync('firestore.rules','utf8');
const required=['rules_version = \'2\';','service cloud.firestore','function isSignedIn()','function isAdmin()','function isPlatformModerator()','match /{document=**}'];
const missing=required.filter(x=>!rules.includes(x));
if(missing.length){console.error('RULES CHECK FAILED:',missing.join(', '));process.exit(1);}
const firstMatch=rules.indexOf('match /{document=**}');
const defaultDeny=rules.slice(firstMatch, firstMatch+160).includes('allow read, write: if false');
if(!defaultDeny){console.error('RULES CHECK FAILED: default deny is missing.');process.exit(1);}
console.log('RULES CHECK OK — v2 rules, staff helpers, and default deny present.');
