import { GoogleGenAI } from '@google/genai';

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyC1_eau-5rsMTreEzCNMtns2FGcSa448ug';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
const buckets = new Map<string,{day:string,count:number}>();
const DAILY_LIMIT=Math.max(1,Number(process.env.GEMINI_DAILY_REQUEST_LIMIT||60));
const MAX_CONTEXT=Math.max(4000,Number(process.env.GEMINI_MAX_CONTEXT_CHARS||30000));
const CACHE_TTL=Math.max(300,Number(process.env.GEMINI_CACHE_TTL_SECONDS||86400))*1000;
const DEFAULT_MODEL=process.env.GEMINI_MODEL||'gemini-2.5-flash';
const FAST_MODEL=process.env.GEMINI_MODEL_FAST||DEFAULT_MODEL;
const BALANCED_MODEL=process.env.GEMINI_MODEL_BALANCED||DEFAULT_MODEL;
const DEEP_MODEL=process.env.GEMINI_MODEL_DEEP||DEFAULT_MODEL;
function modelFor(task:string){if(['tags','related','semantic'].includes(task))return FAST_MODEL;if(['learning','synthesize','compare','analyze'].includes(task))return DEEP_MODEL;return BALANCED_MODEL;}
const cache = new Map<string,{expiresAt:number,value:any}>();
const text=(v:unknown,max:number)=>String(v??'').slice(0,max);
const safeArray=(v:any,max=12,maxLen=500)=>Array.isArray(v)?v.map(x=>text(x,maxLen)).filter(Boolean).slice(0,max):[];

async function verify(token:string){const r=await fetch(FIREBASE_LOOKUP_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});if(!r.ok)throw new Error('INVALID_FIREBASE_TOKEN');const d=await r.json() as any;const u=d.users?.[0];if(!u?.localId)throw new Error('INVALID_FIREBASE_TOKEN');if(u.disabled)throw new Error('ACCOUNT_DISABLED');return String(u.localId);}
function schemaFor(task:string){
  const base={overview:'string',keyPoints:'string[]'};
  const schemas:any={
    summary:{...base,whyItMatters:'string',conclusion:'string'},
    explain:{whatItMeans:'string',whyItExists:'string',example:'string',whenToUse:'string',commonMistake:'string'},
    ask:{answer:'string',evidence:'string[]',uncertainty:'string'},
    analyze:{mainIdea:'string',overview:'string',keyPoints:'string[]',arguments:'string[]',agreements:'string[]',disagreements:'string[]',useful:'string[]',unresolved:'string[]',claims:'string[]',examples:'string[]',terminology:'string[]',entities:'string[]',topics:'string[]',difficulty:'string',prerequisites:'string[]',conclusion:'string',openQuestions:'string[]',relatedConcepts:'string[]'},
    concepts:{concepts:'object[]'},
    semantic:{topics:'string[]',concepts:'string[]',skills:'string[]',entities:'string[]',prerequisites:'string[]',difficulty:'string',intent:'string',contentType:'string',domain:'string',claims:'object[]'},
    tags:{tags:'string[]'},
    related:{queries:'string[]'},
    compare:{commonGround:'string[]',differences:'string[]',strengthsA:'string[]',strengthsB:'string[]',weaknessesA:'string[]',weaknessesB:'string[]',whenToUseA:'string',whenToUseB:'string'},
    learning:{objectives:'string[]',concepts:'string[]',examples:'string[]',exercises:'string[]',questions:'string[]',quiz:'object[]',recap:'string'},
    quiz:{questions:'object[]'},
    flashcards:{cards:'object[]'},
    prerequisites:{prerequisites:'object[]'},
    recap:{topics:'string[]',repeatedConcepts:'string[]',recommendedNext:'object[]',summary:'string'},
    quality:{clearArgument:'boolean',missingContext:'string[]',unsupportedClaims:'string[]',confusingSections:'string[]',suggestions:'string[]'},
    synthesize:{combinedUnderstanding:'string',conflictingClaims:'string[]',commonIdeas:'string[]',newInsights:'string[]',uncertainty:'string'},
    creator:{improvements:'object'}
  }; return schemas[task]||schemas.summary;
}
function promptFor(task:string,input:any,options:any){
 const instruction={summary:'Summarize only the supplied source.',explain:'Explain only the selected/source concept using the supplied content.',ask:'Answer only from supplied content; say not found when unsupported.',analyze:'Analyze the supplied content comprehensively without inventing facts.',concepts:'Extract important concepts and relationships from the content.',semantic:'Extract structured semantic metadata from the content.',tags:'Suggest precise OFFSCRPT tags.',related:'Generate semantic search phrases/queries that represent this content.',compare:'Compare source A and source B only.',learning:'Turn the content into a learning module.',quiz:'Generate grounded questions from the content.',flashcards:'Generate grounded flashcards from the content.',prerequisites:'Infer learning prerequisites from the supplied content.',recap:'Create a recap from the supplied learning history.',quality:'Act as an authoring aid; flag uncertainty instead of asserting unsupported facts.',synthesize:'Synthesize only the supplied sources and explicitly preserve conflicts.',creator:'Provide editable creator-assistant suggestions; do not rewrite silently.'}[task] || '';
 return `${instruction}\nReturn strict JSON matching the requested schema. Never invent facts, sources, quotes, positions or claims. Preserve uncertainty.\nTASK: ${task}\nOPTIONS: ${JSON.stringify(options||{})}\nSOURCE JSON:\n${JSON.stringify(input).slice(0,MAX_CONTEXT)}`;
}
function normalize(task:string,p:any){
 const o:any={}; for(const [k,v] of Object.entries(p||{})){ if(Array.isArray(v))o[k]=v.slice(0,20).map((x:any)=>typeof x==='string'?text(x,700):x); else if(v&&typeof v==='object')o[k]=v; else if(typeof v==='boolean'||typeof v==='number'||typeof v==='string')o[k]=v; }
 if(!o.uncertainty)o.uncertainty='Grounded only in the supplied content.'; o.meta={task,generatedAt:new Date().toISOString(),model:modelFor(task),promptVersion:'v79.0'}; return o;
}
export default async function handler(req:any,res:any){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_GEMINI_API_KEY;if(!key)return res.status(503).json({error:'OFFSCRPT AI is not configured.'});
 try{
  const authHeader=String(req.headers.authorization||'');const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():'';if(!token)return res.status(401).json({error:'Authentication required.'});
  const uid=await verify(token); const body=req.body||{}; const task=text(body.task,40); const input=body.input||{}; const title=text(input.title,500); const content=text(input.content,MAX_CONTEXT); if(!task||!title||!content)return res.status(400).json({error:'AI task, title and content are required.'});
  const today=new Date().toISOString().slice(0,10);const b=buckets.get(uid);const current=b&&b.day===today?b:{day:today,count:0};if(current.count>=DAILY_LIMIT)return res.status(429).json({error:'Daily AI limit reached. Try again tomorrow.'});current.count++;buckets.set(uid,current);
  const options=body.options||{}; const fingerprint=JSON.stringify({uid,task,title,content:content.slice(0,6000),options,model:modelFor(task)});let h=2166136261;for(let i=0;i<fingerprint.length;i++){h^=fingerprint.charCodeAt(i);h=Math.imul(h,16777619);}const ck=(h>>>0).toString(36);const cached=cache.get(ck);if(cached&&cached.expiresAt>Date.now())return res.status(200).json(cached.value);
  const ai=new GoogleGenAI({apiKey:key});const schema=schemaFor(task);const prompt=`${promptFor(task,{contentType:input.contentType,contentId:input.contentId,title,content,metadata:input.metadata||{},sourceRevision:input.sourceRevision||''},options)}\nSCHEMA: ${JSON.stringify(schema)}`;
  const response:any=await ai.models.generateContent({model:modelFor(task),contents:prompt,config:{responseMimeType:'application/json',temperature:0.2}});const raw=text(response?.text,30000).replace(/^```json\s*/i,'').replace(/\s*```$/,'');const parsed=normalize(task,JSON.parse(raw));cache.set(ck,{expiresAt:Date.now()+CACHE_TTL,value:parsed});return res.status(200).json(parsed);
 }catch(e:any){console.error('ai gateway failed',e);const msg=String(e?.message||e);if(msg==='INVALID_FIREBASE_TOKEN')return res.status(401).json({error:'Authentication expired. Please sign in again.'});if(msg==='ACCOUNT_DISABLED')return res.status(403).json({error:'Account disabled.'});return res.status(500).json({error:'AI is temporarily unavailable. Core OFFSCRPT content remains available.'});}
}
