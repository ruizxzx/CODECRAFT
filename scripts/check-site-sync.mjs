import fs from 'node:fs';
const app=fs.readFileSync('src/App.tsx','utf8');
const article=fs.readFileSync('src/components/ArticleView.tsx','utf8');
const comments=fs.readFileSync('src/components/CommentsSection.tsx','utf8');
const identity=fs.readFileSync('src/components/UserIdentity.tsx','utf8');
const checks=[
 ['site config realtime subscription', app.includes('subscribeSiteConfig'), 1],
 ['article realtime subscription', app.includes('subscribeArticles'), 1],
 ['article comments realtime subscription', comments.includes('subscribeArticleComments'), 1],
 ['article comments profile navigation', article.includes('onOpenProfile={onOpenAuthorProfile}'), 1],
 ['comment public profile enrichment', comments.includes('getProfileByUsername'), 1],
 ['internal UID not rendered by UserIdentity', !identity.includes('`ID ${uid}`'), 1],
];
const failed=checks.filter(([,ok])=>!ok); if(failed.length){console.error('SITE SYNC CHECK FAILED'); for(const [n] of failed) console.error('-',n); process.exit(1);} console.log(`SITE SYNC CHECK OK — ${checks.length} requirements satisfied.`);
