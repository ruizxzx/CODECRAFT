import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';

function b64url(input: string|Buffer){return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function accessToken(){
  const email=process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL; const key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY; if(!email||!key)throw new Error('Service account credentials are not configured.');
  const now=Math.floor(Date.now()/1000); const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'})); const payload=b64url(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})); const input=`${header}.${payload}`; const signer=crypto.createSign('RSA-SHA256'); signer.update(input); const signature=b64url(signer.sign(key.replace(/\\n/g,'\n'))); const jwt=`${input}.${signature}`;
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})}); if(!r.ok)throw new Error(`OAuth failed: ${r.status}`); const j:any=await r.json(); return String(j.access_token||'');
}
async function firestoreQuery(token:string){
  const project=process.env.GOOGLE_CLOUD_PROJECT||process.env.VITE_FIREBASE_PROJECT_ID;
  if(!project)throw new Error('GOOGLE_CLOUD_PROJECT or VITE_FIREBASE_PROJECT_ID is required.');
  const url=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`;
  const states=['scheduled','published'];
  const out:any[]=[];
  for(const state of states){
    const body={structuredQuery:{from:[{collectionId:'articles'}],where:{fieldFilter:{field:{fieldPath:'publicationWorkflowState'},op:'EQUAL',value:{stringValue:state}}},limit:300}};
    const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok)throw new Error(`Firestore query failed: ${r.status}`);
    out.push(...(await r.json() as any[]));
  }
  const seen=new Set<string>();
  return out.filter(row=>row.document&&!seen.has(row.document.name)&&seen.add(row.document.name));
}
async function patchDoc(token:string,project:string,name:string,fields:any){const url=`https://firestore.googleapis.com/v1/${name}?currentDocument.exists=true&updateMask.fieldPaths=isPublished&updateMask.fieldPaths=mainPublicationStatus&updateMask.fieldPaths=publicationWorkflowState&updateMask.fieldPaths=publishedAt&updateMask.fieldPaths=scheduledAt&updateMask.fieldPaths=scheduledUnpublishAt&updateMask.fieldPaths=updatedAt`;const body={fields};const r=await fetch(url,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`Firestore update failed: ${r.status}`);}
export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const expected=process.env.CRON_SECRET;
  if(!expected)return res.status(503).json({error:'CRON_SECRET is not configured.'});
  const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!supplied)return res.status(401).json({error:'Unauthorized'});
  const suppliedBuf=Buffer.from(supplied);
  const expectedBuf=Buffer.from(expected);
  if(suppliedBuf.length!==expectedBuf.length||!crypto.timingSafeEqual(suppliedBuf,expectedBuf))return res.status(401).json({error:'Unauthorized'});
  try{
    const token=await accessToken();
    const project=process.env.GOOGLE_CLOUD_PROJECT||process.env.VITE_FIREBASE_PROJECT_ID||'';
    const rows=await firestoreQuery(token);
    const now=Date.now();
    let published=0,unpublished=0,skipped=0,errors=0;
    for(const row of rows){
      if(!row.document)continue;
      const d=row.document; const fields=d.fields||{};
      const state=fields.publicationWorkflowState?.stringValue||'';
      const publishAt=fields.scheduledAt?.timestampValue?Date.parse(fields.scheduledAt.timestampValue):NaN;
      const unpublishAt=fields.scheduledUnpublishAt?.timestampValue?Date.parse(fields.scheduledUnpublishAt.timestampValue):NaN;
      try{
        if(Number.isFinite(unpublishAt)&&unpublishAt<=now&&(state==='published'||state==='scheduled')){
          await patchDoc(token,project,d.name,{isPublished:{booleanValue:false},mainPublicationStatus:{stringValue:'unpublished'},publicationWorkflowState:{stringValue:'unpublished'},publishedAt:fields.publishedAt||{timestampValue:new Date().toISOString()},scheduledAt:{nullValue:'NULL'},scheduledUnpublishAt:{nullValue:'NULL'},updatedAt:{timestampValue:new Date().toISOString()}});
          unpublished++;
        }else if(state==='scheduled'&&Number.isFinite(publishAt)&&publishAt<=now){
          await patchDoc(token,project,d.name,{isPublished:{booleanValue:true},mainPublicationStatus:{stringValue:'published'},publicationWorkflowState:{stringValue:'published'},publishedAt:{timestampValue:new Date().toISOString()},scheduledAt:{nullValue:'NULL'},scheduledUnpublishAt:Number.isFinite(unpublishAt)?{timestampValue:new Date(unpublishAt).toISOString()}:{nullValue:'NULL'},updatedAt:{timestampValue:new Date().toISOString()}});
          published++;
        }else skipped++;
      }catch{
        errors++;
        try{await patchDoc(token,project,d.name,{publicationWorkflowState:{stringValue:'failed'},updatedAt:{timestampValue:new Date().toISOString()}})}catch{}
      }
    }
    return res.status(200).json({ok:true,published,unpublished,skipped,errors,processed:rows.length,at:new Date().toISOString()});
  }catch(e){return res.status(500).json({ok:false,error:e instanceof Error?e.message:'Schedule processor failed'});}
}
