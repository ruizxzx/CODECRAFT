import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('src'); const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx)$/.test(e.name))files.push(f)}} walk(root);
const findings=[];
for(const file of files){const text=fs.readFileSync(file,'utf8');
  if(/catch\s*\{\s*\}/.test(text)) findings.push(`${path.relative('.',file)}: empty catch block`);
  if(/setInterval\s*\([^,]+,\s*[0-9]{1,3}\s*\)/.test(text) && !file.endsWith('HomeView.tsx')) findings.push(`${path.relative('.',file)}: suspicious high-frequency setInterval`);
}
if(findings.length){console.error('RUNTIME PATTERN AUDIT:');console.error(findings.join('\n'));process.exit(1);}
console.log(`RUNTIME PATTERN CHECK OK — ${files.length} source files scanned.`);
