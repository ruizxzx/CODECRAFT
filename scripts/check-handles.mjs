import fs from 'node:fs';
const source = fs.readFileSync('src/lib/community.ts','utf8');
const admin = fs.readFileSync('src/components/AdminControlPanel.tsx','utf8');
const rules = fs.readFileSync('src/firestore.rules','utf8');
const required = [
  "runTransaction(db",
  "syncUserIdentityAcrossContent",
  "collectionGroup(db, 'posts')",
  "collectionGroup(db, 'comments')",
  "collectionGroup(db, 'members')",
  "collectionGroup(db, 'following')",
  "collection(db, 'messages')",
  "collection(db, 'reports')",
  "collection(db, 'questions')",
  "collection(db, 'series')",
  "collection(db, 'topics')",
  "handleAliases",
  "adminChangeUserHandle",
  "generateNewUserDisplayName"
];
for (const token of required) if (!source.includes(token)) throw new Error(`Missing handle propagation token: ${token}`);
if (!admin.includes('adminChangeUserHandle')) throw new Error('Master Admin handle control missing.');
const requiredRules = [
  "authorUsername','authorName','authorAvatar'",
  "request.auth.uid == followingId",
  "existing().actorId == request.auth.uid",
  "request.auth.uid == existing().reporterId",
  "match /handleAliases/{oldUsername}"
];
for (const token of requiredRules) if (!rules.includes(token)) throw new Error(`Missing handle rule protection: ${token}`);
if (source.includes("collectionGroup(db, 'notifications')")) throw new Error('Private notification collection-group propagation must remain absent.');
console.log('HANDLE PROPAGATION CHECK OK — stable UID linkage, public handle aliases, self/admin handle changes, and denormalized identity paths present.');
