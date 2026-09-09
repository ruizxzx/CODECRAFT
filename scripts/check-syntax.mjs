import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve('src');
const files=[];
function walk(p){const st=fs.statSync(p); if(st.isFile()){if(/\.(ts|tsx)$/.test(p)) files.push(p); return;} for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='dist') continue; walk(path.join(p,e.name));}}
walk(root);
const errors=[];
for(const file of files){const text=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,text,ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);for(const d of sf.parseDiagnostics)errors.push(`${path.relative(root,file)}:${d.start ?? 0}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`)}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`SYNTAX CHECK OK — ${files.length} active TS/TSX files parsed.`);
