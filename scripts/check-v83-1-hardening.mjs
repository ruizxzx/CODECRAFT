import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('src/index.css');
const marquee=read('src/components/MarqueeTicker.tsx');
const q=read('src/components/QuestionView.tsx');
const media=read('src/components/MediaUploadButton.tsx');
const api=read('api/media/upload-url.ts');
const notif=read('src/components/NotificationsView.tsx');
const checks=[
 ['version 83.1.0', read('VERSION.md').includes('OFFSCRPT_VERSION=83.1.0')],
 ['marquee has two groups', (marquee.match(/renderGroup\(/g)||[]).length>=2],
 ['marquee loop is 50%', /translate3d\(-50%/.test(css)],
 ['mobile grid override is scoped', !/\[class~="grid-cols-2"\][\s\S]{0,220}grid-template-columns: minmax\(0, 1fr\) !important/.test(css)],
 ['code blocks preserve pre whitespace', /pre\s*\{[\s\S]*white-space:\s*pre;/.test(css)],
 ['question edit passes uid', /updateAnswer\(question\.id,\s*editing,\s*userProfile\.uid,\s*draft/.test(q)],
 ['question report passes user', /reportContent\(userProfile,'question',question\.id/.test(q)],
 ['discussion-replies folder supported', /discussion-replies/.test(media)&&/discussion-replies/.test(api)],
 ['upload false-success guarded', /allSucceeded/.test(media)],
 ['question notification routes directly', /onNavigate\('question', n\.targetId\)/.test(notif)],
 ['single marquee animation system', (css.match(/@keyframes marquee\b/g)||[]).length===1],
];
let failed=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'}: ${n}`); if(!ok) failed++;}
if(failed) process.exit(1);
console.log(`V83.1 hardening checks passed: ${checks.length}`);
