import fs from 'node:fs';
const detail=fs.readFileSync('src/components/CommunityPostView.tsx','utf8');
const extras=fs.readFileSync('src/components/CommunityPostExtras.tsx','utf8');
const explore=fs.readFileSync('src/components/ExploreView.tsx','utf8');
const community=fs.readFileSync('src/lib/community.ts','utf8');
const cms=fs.readFileSync('src/lib/cms.ts','utf8');
const errors=[];
if (detail.match(/<PostMediaPreview/g) || detail.match(/<PollBlock/g)) errors.push('detail page directly owns media/poll rendering; single render owner expected');
if (!detail.includes('showAllMedia')) errors.push('detail page does not request full media gallery through CommunityPostExtras');
if (!extras.includes('showAllMedia?: boolean')) errors.push('CommunityPostExtras missing showAllMedia control');
if (!explore.includes('openRecommendationMenu(item.key)') || !explore.includes('NOT INTERESTED / HIDE')) errors.push('Explore recommendation menu missing');
if (/onClick=\{\(\)=>hideItem\(item\.key\)\}.*title=\"Not interested\"/.test(explore)) errors.push('Explore still contains a bare instant-hide control');
if (!community.includes('const writePaths = new Set<string>()')) errors.push('identity sync lacks duplicate-write protection');
if (!community.includes("startsWith('communities/')")) errors.push('identity sync does not filter community post collection-group results');
if (!cms.includes("publicProfiles', username")) errors.push('admin identity sync does not refresh public profile projection');
if (errors.length) { console.error('V78 HARDENING CHECK FAILED'); errors.forEach(x=>console.error(' -',x)); process.exit(1); }
console.log('V78 HARDENING CHECK OK');
