import fs from 'node:fs';
import path from 'node:path';
import ts from '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js';

const root = path.resolve('src');
const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const f=path.join(dir,e.name); if(e.isDirectory()) walk(f); else if(/\.(ts|tsx)$/.test(e.name)) files.push(f); } }
walk(root);
const options={target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowJs:false,skipLibCheck:true,noEmit:true,noResolve:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']};
const host=ts.createCompilerHost(options);
const program=ts.createProgram(files,options,host);
const diagnostics=ts.getPreEmitDiagnostics(program).filter(d=>d.code===2304 || d.code===2552);
if(diagnostics.length){
  const format=ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:f=>f,getNewLine:()=>ts.sys.newLine});
  console.error(format); process.exit(1);
}
console.log(`IDENTIFIER CHECK OK — ${files.length} TS/TSX files parsed.`);
