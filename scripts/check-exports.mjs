import fs from 'node:fs';
import path from 'node:path';
import ts from '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js';
const root=path.resolve('src'); const files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx)$/.test(e.name))files.push(f)}} walk(root);
const byPath=new Map(files.map(f=>[path.resolve(f),f]));
function resolve(spec,from){let base=spec.startsWith('@/')?path.resolve(root,spec.slice(2)):path.resolve(path.dirname(from),spec); for(const ext of ['.ts','.tsx','.js','.jsx']) if(byPath.has(path.resolve(base+ext))) return path.resolve(base+ext); for(const ext of ['.ts','.tsx']) if(byPath.has(path.resolve(base,'index'+ext))) return path.resolve(base,'index'+ext); return null;}
function exportsOf(file){
  const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const out=new Set();
  const visit=(n)=>{
    if(n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
      if(n.name?.text) out.add(n.name.text);
      if(ts.isVariableStatement(n)) for(const d of n.declarationList.declarations) if(ts.isIdentifier(d.name)) out.add(d.name.text);
      if(ts.isExportDeclaration(n) && n.exportClause?.elements) for(const e of n.exportClause.elements) out.add((e.propertyName||e.name).text);
      if(ts.isExportAssignment(n)) out.add('default');
    }
    ts.forEachChild(n,visit);
  };
  visit(sf); return out;
}
const cache=new Map();const failures=[];
for(const file of files){const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS); for(const n of sf.statements){if(!ts.isImportDeclaration(n)||!ts.isStringLiteral(n.moduleSpecifier)) continue; const spec=n.moduleSpecifier.text;if(!spec.startsWith('.')&&!spec.startsWith('@/')) continue; const target=resolve(spec,file); if(!target) continue; if(!cache.has(target)) cache.set(target,exportsOf(target)); const ex=cache.get(target); const clause=n.importClause; if(!clause) continue; if(clause.name&&!ex.has('default')) failures.push(`${path.relative('.',file)} imports default from ${spec}, but target has no default export`); const named=clause.namedBindings; if(named&&ts.isNamedImports(named)) for(const el of named.elements){const imported=(el.propertyName||el.name).text;if(!ex.has(imported)) failures.push(`${path.relative('.',file)} imports ${imported} from ${spec}, but target does not export it`);}}
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)} console.log(`EXPORT CHECK OK — ${files.length} source files and local named imports scanned.`);
