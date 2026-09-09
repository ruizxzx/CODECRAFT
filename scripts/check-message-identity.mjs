import fs from 'node:fs';
const social=fs.readFileSync('src/lib/social.ts','utf8');
const hub=fs.readFileSync('src/components/SocialHubView.tsx','utf8');
const checks=[
  ['legacy blank identities filtered', /if \(!username && !displayName && !photoURL\) return;/],
  ['message merge prefers richer identity', /nextScore <= existingScore/],
  ['public identity loaded first', /publicPeople\.forEach/],
  ['message identity cannot overwrite richer public profile', /if\(nextScore>existingScore\) merged\.set/],
];
let failed=0; for(const [name,re] of checks){if(!re.test(name==='public identity loaded first'?hub:name==='message identity cannot overwrite richer public profile'?hub:social)){console.error('FAIL',name);failed++;}else console.log('PASS',name);}
if(failed) process.exit(1);
console.log('MESSAGE IDENTITY CHECK OK');
