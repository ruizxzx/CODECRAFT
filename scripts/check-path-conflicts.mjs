import fs from 'node:fs';
import path from 'node:path';

const roots=['api','src','components','lib','scripts'];
const seen=new Map();
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(entry.name.startsWith('.')) continue;
    const ext=path.extname(entry.name).toLowerCase();
    if(!['.js','.mjs','.cjs','.ts','.tsx','.jsx'].includes(ext)) continue;
    const stem=entry.name.slice(0,-ext.length);
    const key=path.join(path.dirname(full),stem).replaceAll('\\','/');
    const list=seen.get(key)||[]; list.push(full.replaceAll('\\','/')); seen.set(key,list);
  }
}
for(const root of roots) walk(root);
const conflicts=[...seen.values()].filter(v=>v.length>1);
if(conflicts.length){
  console.error('PATH/NAME CONFLICTS FOUND');
  for(const group of conflicts) console.error(group.join(' <-> '));
  process.exit(1);
}
console.log('PATH/NAME CONFLICT CHECK OK');
