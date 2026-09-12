import fs from 'node:fs';
const server=fs.readFileSync('server/digital-products-server.ts','utf8');
const api=fs.readFileSync('api/digital-products.ts','utf8');
for(const token of [
  'const sortAws =',
  '.sort(sortAws)',
  'const finalQuery = `${canonicalQuery}&X-Amz-Signature=',
  'response-content-disposition'
]){
  if(!server.includes(token) && !api.includes(token)){
    console.error(`V88.0.7 CHECK FAILED: missing ${token}`);
    process.exit(1);
  }
}
if(server.includes('.sort(([a],[b])=>a.localeCompare(b))')){
  console.error('V88.0.7 CHECK FAILED: localeCompare-based SigV4 query sorting remains');
  process.exit(1);
}
if(api.includes("filename*=UTF-8''${encodeURIComponent(filename)}")){
  console.error('V88.0.7 CHECK FAILED: filename is pre-encoded before canonicalization');
  process.exit(1);
}
console.log('V88.0.7 R2 SIGNING CHECK OK');
