import fs from 'node:fs';
import path from 'node:path';
import ts from '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js';
const files=[]; function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx)$/.test(e.name))files.push(f)}} walk('src');
const errors=[];
for(const file of files){const text=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,text,ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);for(const d of sf.parseDiagnostics) errors.push(ts.flattenDiagnosticMessageText(d.messageText,' ')+` — ${file}:${d.start}`)}
if(errors.length){console.error(errors.join('\n'));process.exit(1)} console.log(`SYNTAX CHECK OK — ${files.length} TS/TSX files parsed.`);
