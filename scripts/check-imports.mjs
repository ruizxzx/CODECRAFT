import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve('src'); const exts=['.ts','.tsx','.js','.jsx']; const files=[];
function walk(p){const st=fs.statSync(p);if(st.isFile()){if(/\.(ts|tsx|js|jsx)$/.test(p))files.push(p);return;}for(const e of fs.readdirSync(p,{withFileTypes:true})){if(['node_modules','dist'].includes(e.name))continue;walk(path.join(p,e.name));}}
walk(root);
const failures=[];
for(const file of files){const text=fs.readFileSync(file,'utf8');const specs=[...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["'`]([^"'`]+)["'`]/g)].map(m=>m[1]);for(const spec of specs){if(!spec.startsWith('.'))continue;let base=path.resolve(path.dirname(file),spec);if(path.extname(base)){if(!fs.existsSync(base))failures.push(`${path.relative(root,file)} -> missing ${spec}`);continue;}const hit=exts.map(ext=>base+ext).find(fs.existsSync)||['index.ts','index.tsx','index.js','index.jsx'].map(e=>path.join(base,e)).find(fs.existsSync);if(!hit)failures.push(`${path.relative(root,file)} -> missing ${spec}`)}}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`IMPORT CHECK OK — ${files.length} active source files scanned.`);
