import fs from 'node:fs';
const master=fs.readFileSync('src/lib/masterControl.ts','utf8');
const panel=fs.readFileSync('src/components/AdminControlPanel.tsx','utf8');
const rules=fs.readFileSync('src/firestore.rules','utf8');
const checks=[
  [master.includes('changeUserHandleAsMaster'), 'master handle-change helper missing'],
  [master.includes('runTransaction(db'), 'master handle change is not transactional'],
  [panel.includes('changeUserHandleAsMaster'), 'Master Control does not call handle-change helper'],
  [panel.includes('userPatch.username'), 'Master user editor has no handle field'],
  [rules.includes("allow update: if isAdmin()") && rules.includes("incoming().get('username','')"), 'Firestore admin handle update rule missing'],
  [rules.includes('match /usernames/{username}'), 'username reservation rules missing'],
];
const failures=checks.filter(([ok])=>!ok).map(([,msg])=>msg);
if(failures.length){ console.error('ADMIN HANDLE CHECK FAILED'); failures.forEach(x=>console.error(' - '+x)); process.exit(1); }
console.log('ADMIN HANDLE CHECK OK');
