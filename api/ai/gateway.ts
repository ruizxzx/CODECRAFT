import { generateOpenRouter, openRouterKey, openRouterModel } from './openrouter-provider.js';
import { retrieveOffscrpt } from '../lib/offscript-retrieval.js';

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyC1_eau-5rsMTreEzCNMtns2FGcSa448ug';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
const buckets = new Map<string,{day:string,count:number}>();
const DAILY_LIMIT=Math.max(1,Number(process.env.OPENROUTER_DAILY_REQUEST_LIMIT||60));
const MAX_CONTEXT=Math.max(4000,Number(process.env.OPENROUTER_MAX_CONTEXT_CHARS||30000));
const CACHE_TTL=Math.max(300,Number(process.env.OPENROUTER_CACHE_TTL_SECONDS||86400))*1000;
const cache = new Map<string,{expiresAt:number,value:any}>();
const text=(v:unknown,max:number)=>String(v??'').slice(0,max);

function modelFor(task:string){
  if(['tags','related','semantic'].includes(task))return 'fast';
  if(['learning','synthesize','compare','analyze'].includes(task))return 'deep';
  return 'balanced';
}
function schemaFor(task:string){
  const base={overview:'string',keyPoints:'string[]'};
  const schemas:any={
    summary:{...base,whyItMatters:'string',conclusion:'string'},
    explain:{whatItMeans:'string',whyItExists:'string',example:'string',whenToUse:'string',commonMistake:'string'},
    ask:{answer:'string',evidence:'string[]',sources:'object[]',uncertainty:'string'},
    analyze:{mainIdea:'string',overview:'string',keyPoints:'string[]',arguments:'string[]',agreements:'string[]',disagreements:'string[]',useful:'string[]',unresolved:'string[]',claims:'string[]',examples:'string[]',terminology:'string[]',entities:'string[]',topics:'string[]',difficulty:'string',prerequisites:'string[]',conclusion:'string',openQuestions:'string[]',relatedConcepts:'string[]'},
    concepts:{concepts:'object[]'}, semantic:{topics:'string[]',concepts:'string[]',skills:'string[]',entities:'string[]',prerequisites:'string[]',difficulty:'string',intent:'string',contentType:'string',domain:'string',claims:'object[]'},
    tags:{tags:'string[]'}, related:{queries:'string[]'}, compare:{commonGround:'string[]',differences:'string[]',strengthsA:'string[]',strengthsB:'string[]',weaknessesA:'string[]',weaknessesB:'string[]',whenToUseA:'string',whenToUseB:'string'},
    learning:{objectives:'string[]',concepts:'string[]',examples:'string[]',exercises:'string[]',questions:'object[]',quiz:'object[]',recap:'string'}, quiz:{questions:'object[]'}, flashcards:{cards:'object[]'}, prerequisites:{prerequisites:'object[]'},
    recap:{topics:'string[]',repeatedConcepts:'string[]',recommendedNext:'object[]',summary:'string'}, quality:{clearArgument:'boolean',missingContext:'string[]',unsupportedClaims:'string[]',confusingSections:'string[]',suggestions:'string[]'},
    synthesize:{combinedUnderstanding:'string',conflictingClaims:'string[]',commonIdeas:'string[]',newInsights:'string[]',uncertainty:'string'}, creator:{generatedText:'string',improvedTitle:'string',titles:'string[]',excerpt:'string',tags:'string[]',outline:'string[]',clarityNotes:'string[]',repetitions:'string[]',examples:'string[]',faq:'object[]',counterarguments:'string[]',claimWarnings:'string[]',readability:'object',summary:'string',repurpose:'object'}
  };
  return schemas[task]||schemas.summary;
}
function promptFor(task:string,input:any,options:any){
 const instruction:any={summary:'Summarize only the supplied source.',explain:'Explain only the selected/source concept using the supplied content.',ask:'Answer only from supplied content; say not found when unsupported. When the supplied content includes SERVER-VERIFIED OFFSCRPT RETRIEVAL, treat those records as authoritative OFFSCRPT sources. Cite only exact TYPE/ID/TITLE triples present in the supplied sources. Never invent source IDs, private records, or permissions. Prefer saying not found over unsupported inference.',analyze:'Analyze the supplied content comprehensively without inventing facts.',concepts:'Extract important concepts and relationships from the content.',semantic:'Extract structured semantic metadata from the content.',tags:'Suggest precise OFFSCRPT tags.',related:'Generate semantic search phrases/queries that represent this content.',compare:'Compare source A and source B only.',learning:'Turn the content into a learning module.',quiz:'Generate grounded questions from the content.',flashcards:'Generate grounded flashcards from the content.',prerequisites:'Infer learning prerequisites from the supplied content.',recap:'Create a recap from the supplied learning history.',quality:'Act as an authoring aid; flag uncertainty instead of asserting unsupported facts.',synthesize:'Synthesize only the supplied sources and explicitly preserve conflicts.',creator:'Provide editable creator-assistant suggestions; do not rewrite silently.'}[task] || '';
 const history = Array.isArray(options?.conversation) ? options.conversation.slice(-12) : [];
 const creatorAction = String(options?.creatorAction || '');
 const extraInstruction = task === 'ask' && history.length ? `\nCONVERSATION HISTORY (use only to maintain continuity; the source remains authoritative):\n${JSON.stringify(history).slice(0,10000)}` : '';
 const creatorHint = task === 'creator' ? `\nCREATOR ACTION: ${creatorAction || 'provide the most useful editable suggestions.'}\nUSER PROMPT: ${String(options?.userPrompt||'').slice(0,5000)}\nTONE: ${String(options?.tone||'default')}\nAUDIENCE: ${String(options?.audience||'general')}\nTARGET LANGUAGE: ${String(options?.targetLanguage||'English')}\nSELECTED TEXT: ${String(options?.selectedText||'').slice(0,8000)}\nReturn practical editable suggestions. For write/continue/rewrite/improve/expand/shorten/simplify/technical/casual/tone/grammar/spelling/structure/example/conclusion/introduction/hook/translate/section/summary/repurpose actions, put the ready-to-use text in generatedText. For title, put up to 8 alternatives in titles. For tags, put only normalized tags in tags. For faq, return question/answer objects. For claims, return warnings in claimWarnings. For readability, return a concise readability object and suggestions in clarityNotes. Never silently mutate the draft.` : '';
 return `${instruction}\nReturn ONLY valid JSON matching this schema exactly: ${JSON.stringify(schemaFor(task))}. Never invent facts, sources, quotes, positions or claims. Preserve uncertainty.\nTASK: ${task}\nOPTIONS: ${JSON.stringify(options||{})}${creatorHint}${extraInstruction}\nSOURCE JSON:\n${JSON.stringify(input).slice(0,MAX_CONTEXT)}`;
}
function normalize(task:string,p:any,model:string){
 const o:any={}; for(const [k,v] of Object.entries(p||{})){ if(Array.isArray(v))o[k]=v.slice(0,20).map((x:any)=>typeof x==='string'?text(x,700):x); else if(v&&typeof v==='object')o[k]=v; else if(typeof v==='boolean'||typeof v==='number'||typeof v==='string')o[k]=v; }
 if(!o.uncertainty)o.uncertainty='Grounded only in the supplied content.'; o.meta={task,provider:'OpenRouter',generatedAt:new Date().toISOString(),model,promptVersion:'v80.0-offscrpt-intelligence'}; return o;
}
async function verify(token:string){
  const r=await fetch(FIREBASE_LOOKUP_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
  if(!r.ok)throw new Error('INVALID_FIREBASE_TOKEN'); const d=await r.json() as any; const u=d.users?.[0]; if(!u?.localId)throw new Error('INVALID_FIREBASE_TOKEN'); if(u.disabled)throw new Error('ACCOUNT_DISABLED'); return String(u.localId);
}
function cacheKey(task:string,input:any,options:any){const raw=JSON.stringify({provider:'openrouter',task,id:input?.contentId||'',title:input?.title||'',content:String(input?.content||'').slice(0,12000),revision:input?.sourceRevision||'',options});let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return `${task}:${(h>>>0).toString(36)}`;}
function consume(uid:string){ const day=new Date().toISOString().slice(0,10); const current=buckets.get(uid); const next=current?.day===day?current:{day,count:0}; if(next.count>=DAILY_LIMIT)return false; next.count+=1; buckets.set(uid,next); return true; }
function parseAIJson(raw:string){ const clean=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,''); try{return JSON.parse(clean);}catch{} const first=clean.indexOf('{'); const last=clean.lastIndexOf('}'); if(first>=0&&last>first)return JSON.parse(clean.slice(first,last+1)); throw Object.assign(new Error('AI_INVALID_JSON'),{status:502}); }

export default async function handler(req:any,res:any){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 const key=openRouterKey(); if(!key)return res.status(503).json({error:'OFFSCRPT AI is not configured. Add OPENROUTER_API_KEY to Vercel.',code:'AI_NOT_CONFIGURED'});
 try{
   const authorization=String(req.headers.authorization||'');
   const token=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
   if(!token)return res.status(401).json({error:'Authentication required.',code:'AI_AUTH'});
   const uid=await verify(token);
   const body=req.body||{};
   const task=String(body.task||'summary');
   let input=body.input||{};
   const options=body.options||{};
   let retrieval:any = null;
   if (task === 'ask' && options?.offscrptRetrieval?.enabled !== false) {
     retrieval = await retrieveOffscrpt(token, {
       query: String(options?.question || input?.title || '').slice(0, 600),
       uid,
       scope: ['site','saved','page'].includes(String(options?.offscrptRetrieval?.scope)) ? options.offscrptRetrieval.scope : 'site',
       current: options?.offscrptRetrieval?.current,
       savedIds: Array.isArray(options?.offscrptRetrieval?.savedIds) ? options.offscrptRetrieval.savedIds.slice(0,100) : [],
       limit: Number(options?.offscrptRetrieval?.limit || 8),
     });
     input = { ...input, content: `${String(input.content || '').slice(0, 6000)}\n\nSERVER-VERIFIED OFFSCRPT RETRIEVAL\n${retrieval.context}` };
     options.sources = retrieval.sources;
   }
   const k=cacheKey(task,input,options);
   const existing=cache.get(k);
   if(existing&&existing.expiresAt>Date.now())return res.status(200).json(existing.value);
   if(!consume(uid))return res.status(429).json({error:'Daily AI limit reached. Try again tomorrow.',code:'AI_DAILY_LIMIT'});
   const result=await generateOpenRouter({task,prompt:promptFor(task,input,options)});
   let parsed:any;
   try{parsed=parseAIJson(result.text);}catch{throw Object.assign(new Error('AI_INVALID_JSON'),{status:502});}
   const output=normalize(task,parsed,result.model);
   if (retrieval) output.sources = retrieval.sources;
   output.meta = { ...(output.meta || {}), retrieval: retrieval ? { count: retrieval.count, retrievedAt: retrieval.retrievedAt } : null };
   cache.set(k,{expiresAt:Date.now()+CACHE_TTL,value:output});
   return res.status(200).json(output);
 }catch(error:any){
   console.error('ai gateway failed',error);
   const status=Number(error?.status||0);
   const msg=String(error?.message||'');
   if(msg==='INVALID_FIREBASE_TOKEN')return res.status(401).json({error:'Authentication expired. Please sign in again.',code:'AI_AUTH'});
   if(msg==='ACCOUNT_DISABLED')return res.status(403).json({error:'Account disabled.',code:'AI_AUTH'});
   if(msg==='OPENROUTER_NOT_CONFIGURED')return res.status(503).json({error:'OFFSCRPT AI is not configured. Add OPENROUTER_API_KEY to Vercel.',code:'AI_NOT_CONFIGURED'});
   if(status===401||status===403)return res.status(502).json({error:'OpenRouter rejected the API key or request permissions.',code:'AI_PROVIDER_AUTH'});
   if(status===429)return res.status(429).json({error:'OpenRouter rate or free-model limit reached. Try again shortly.',code:'AI_PROVIDER_RATE_LIMIT'});
   if(msg==='AI_INVALID_JSON')return res.status(502).json({error:'AI returned an invalid structured response. Please retry.',code:'AI_RESPONSE'});
   if(status===408||status===409||status>=500&&status<=599||/OPENROUTER_HTTP_5\d\d/.test(msg)) { res.setHeader('Retry-After','3'); return res.status(503).json({error:'AI provider is temporarily busy. OpenRouter retried available routing paths; please retry in a moment.',code:'AI_BUSY'}); }
   return res.status(502).json({error:'AI request failed. Please retry.',code:'AI_GATEWAY'});
 }
}
