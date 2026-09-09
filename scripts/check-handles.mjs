import fs from 'node:fs';
const source = fs.readFileSync('src/lib/community.ts','utf8');
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
  "collection(db, 'topics')"
];
for (const token of required) if (!source.includes(token)) throw new Error(`Missing handle propagation token: ${token}`);
const requiredRules = [
  "authorUsername','authorName','authorAvatar'",
  "request.auth.uid == followingId",
  "existing().actorId == request.auth.uid",
  "request.auth.uid == existing().reporterId"
];
for (const token of requiredRules) if (!rules.includes(token)) throw new Error(`Missing handle rule protection: ${token}`);
console.log('HANDLE PROPAGATION CHECK OK — canonical UID linkage and denormalized identity paths present.');
