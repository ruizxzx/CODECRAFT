import { generateOpenRouter, openRouterKey } from './openrouter-provider.js';

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyC1_eau-5rsMTreEzCNMtns2FGcSa448ug';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
const text=(v:unknown,max:number)=>String(v??'').slice(0,max);

async function verifyFirebaseIdToken(token:string){const r=await fetch(FIREBASE_LOOKUP_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});if(!r.ok)throw new Error('INVALID_FIREBASE_TOKEN');const d=await r.json() as any;const u=d.users?.[0];if(!u?.localId)throw new Error('INVALID_FIREBASE_TOKEN');if(u.disabled)throw new Error('ACCOUNT_DISABLED');return String(u.localId);}

export default async function handler(req:any,res:any){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 if(!openRouterKey())return res.status(503).json({error:'Discussion AI is not configured. Add OPENROUTER_API_KEY to Vercel.',code:'AI_NOT_CONFIGURED'});
 try{
   const authorization=String(req.headers.authorization||'');const token=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';if(!token)return res.status(401).json({error:'Authentication required.'});await verifyFirebaseIdToken(token);
   const body=req.body||{};const title=text(body.title,500);const content=text(body.content,12000);const replies=Array.isArray(body.replies)?body.replies.slice(0,120).map((r:any)=>({id:text(r.id,80),author:text(r.author,80),content:text(r.content,5000),likes:Number(r.likes||0),authorResponse:Boolean(r.authorResponse)})):[];
   if(!title||replies.length<5)return res.status(400).json({error:'A discussion title and at least five replies are required.'});
   const prompt=['You are OFFSCRPT Discussion Intelligence. Analyze ONLY the supplied discussion content and replies.','Never invent facts, sources, positions, or conclusions not supported by the supplied material.','Return ONLY valid JSON with keys: overview (string), arguments (string[]), agreements (string[]), disagreements (string[]), unresolved (string[]), useful (string[]).','Keep each array concise, concrete, and grounded. Useful replies should identify actual reply IDs when possible.',`DISCUSSION TITLE:\n${title}\n\nDISCUSSION BODY:\n${content}\n\nREPLIES JSON:\n${JSON.stringify(replies)}`].join('\n');
   const result=await generateOpenRouter({task:'analyze',prompt});const parsed=JSON.parse(result.text.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
   return res.status(200).json({overview:text(parsed.overview,1800),arguments:Array.isArray(parsed.arguments)?parsed.arguments.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],agreements:Array.isArray(parsed.agreements)?parsed.agreements.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],disagreements:Array.isArray(parsed.disagreements)?parsed.disagreements.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],unresolved:Array.isArray(parsed.unresolved)?parsed.unresolved.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],useful:Array.isArray(parsed.useful)?parsed.useful.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],meta:{model:result.model,generatedAt:new Date().toISOString()}});
 }catch(error:any){
   console.error('discussion-summary failed',error);const status=Number(error?.status||0);const msg=String(error?.message||'');
   if(msg==='INVALID_FIREBASE_TOKEN')return res.status(401).json({error:'Authentication expired. Please sign in again.',code:'AI_AUTH'});
   if(msg==='ACCOUNT_DISABLED')return res.status(403).json({error:'Account disabled.',code:'AI_AUTH'});
   if(status===401||status===403)return res.status(502).json({error:'OpenRouter rejected the API key or request permissions.',code:'AI_PROVIDER_AUTH'});
   if(status===429)return res.status(429).json({error:'OpenRouter rate or free-model limit reached. Try again shortly.',code:'AI_PROVIDER_RATE_LIMIT'});
   if(status>=500||status===408||status===409){res.setHeader('Retry-After','3');return res.status(503).json({error:'AI provider is temporarily busy. OpenRouter retried available routing paths; please retry in a moment.',code:'AI_BUSY'});}return res.status(502).json({error:'Discussion AI request failed. Please retry.',code:'AI_GATEWAY'});
 }
}
