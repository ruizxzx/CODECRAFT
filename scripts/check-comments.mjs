import fs from 'node:fs';
const comments=fs.readFileSync('src/components/CommentsSection.tsx','utf8');
const article=fs.readFileSync('src/components/ArticleView.tsx','utf8');
const checks=[
  ['UserIdentity imported',comments.includes("from './UserIdentity'"),1],
  ['profile resolver used',comments.includes('getProfileByUsername') || comments.includes('getPublicProfilesByUsernames'),1],
  ['avatar passed from resolved identity',comments.includes('identityAvatars'),1],
  ['profile click callback',comments.includes('onOpenProfile'),1],
  ['ArticleView wires profile callback',article.includes('onOpenProfile={onOpenAuthorProfile}'),1],
  ['TOP sort',comments.includes("setSort('top')"),1],
  ['OLDEST sort',comments.includes("setSort('oldest')"),1],
  ['MOST DISCUSSED sort',comments.includes("setSort('discussed')"),1],
];
const failed=checks.filter(([,ok])=>!ok); if(failed.length){console.error('COMMENTS CHECK FAILED'); for(const [n] of failed) console.error('-',n); process.exit(1);} console.log(`COMMENTS CHECK OK — ${checks.length} requirements satisfied.`);
