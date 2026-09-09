import fs from 'node:fs';
const community=fs.readFileSync('src/lib/community.ts','utf8');
const rules=fs.readFileSync('src/firestore.rules','utf8');
const prefs=fs.readFileSync('src/components/PreferencesView.tsx','utf8');
const profile=fs.readFileSync('src/components/CommunityProfileView.tsx','utf8');
const failures=[];
if(!community.includes("runTransaction(db")) failures.push('profile handle update is not transactional');
if(!community.includes('syncUserIdentityAcrossContent')) failures.push('identity propagation helper missing');
if(!rules.includes('function validProfileUpdate(next, prev)')) failures.push('legacy full-user validation guard not replaced');
if(!rules.includes("match /{path=**}/members/{memberId}")) failures.push('member identity group rule missing');
if(!rules.includes("match /{path=**}/following/{followingId}")) failures.push('following identity group rule missing');
if(!prefs.includes('updateCommunityProfile(user.uid')) failures.push('preferences profile save missing');
if(!profile.includes('updateCommunityProfile(userAuth.uid')) failures.push('public profile editor save missing');
if(community.includes("query(collectionGroup(db, 'notifications'), where('actorId', '==', userId))")) failures.push('private notification collection-group propagation still present');
if(failures.length){ console.error('IDENTITY SYNC CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('IDENTITY SYNC CHECK OK');
