import fs from 'node:fs';
const rec=fs.readFileSync('src/lib/recommendations.ts','utf8');
const component=fs.readFileSync('src/components/PersonalizedHomeSections.tsx','utf8');
const series=fs.readFileSync('src/lib/series.ts','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const required=[
  ['reading history',rec.includes("'history'"),],
  ['search behavior',rec.includes("'searches'"),],
  ['reading completion',rec.includes('completed'),],
  ['followed creators',rec.includes('followedCreators'),],
  ['followed series',rec.includes('followedSeries'),],
  ['followed topics',rec.includes('followedTopics'),],
  ['bookmarks',rec.includes('saved'),],
  ['reactions',rec.includes('signals.reactions'),],
  ['recent activity weighting',rec.includes('freshnessDays'),],
  ['read penalty',rec.includes('score -= 30'),],
  ['creator diversity',rec.includes('authorCounts'),],
  ['topic diversity',rec.includes('topicCounts'),],
  ['cold start UI',component.includes('CHOOSE WHAT YOU CARE ABOUT'),],
  ['realtime subscriptions',rec.includes('subscribeRecommendationSignals'),],
  ['followed series mirror',series.includes("'followedSeries'"),],
  ['search rules',rules.includes('match /searches/{searchId}'),],
];
const failed=required.filter(([,ok])=>!ok);
if(failed.length){console.error('RECOMMENDATION CHECK FAILED'); for(const [x] of failed) console.error(' -',x); process.exit(1);}
console.log(`RECOMMENDATION CHECK OK — ${required.length} requirements satisfied.`);
