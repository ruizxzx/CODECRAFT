const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyC1_eau-5rsMTreEzCNMtns2FGcSa448ug';
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const buckets = new Map<string,{day:string,count:number}>();
const DAILY_LIMIT=Math.max(1,Number(process.env.GEMINI_DAILY_REQUEST_LIMIT||60));
const MAX_CONTEXT=Math.max(4000,Number(process.env.GEMINI_MAX_CONTEXT_CHARS||30000));
const CACHE_TTL=Math.max(300,Number(process.env.GEMINI_CACHE_TTL_SECONDS||86400))*1000;
const DEFAULT_MODEL=process.env.GEMINI_MODEL||'gemini-3.7-flash';
const FAST_MODEL=process.env.GEMINI_MODEL_FAST||DEFAULT_MODEL;
const BALANCED_MODEL=process.env.GEMINI_MODEL_BALANCED||DEFAULT_MODEL;
const DEEP_MODEL=process.env.GEMINI_MODEL_DEEP||DEFAULT_MODEL;
const modelCache={expiresAt:0,names:new Set<string>()};
const cache = new Map<string,{expiresAt:number,value:any}>();
const text=(v:unknown,max:number)=>String(v??'').slice(0,max);

function modelFor(task:string){
  if(['tags','related','semantic'].includes(task))return FAST_MODEL;
  if(['learning','synthesize','compare','analyze'].includes(task))return DEEP_MODEL;
  return BALANCED_MODEL;
}
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
  };
  return schemas[task]||schemas.summary;
}
function promptFor(task:string,input:any,options:any){
 const instruction={summary:'Summarize only the supplied source.',explain:'Explain only the selected/source concept using the supplied content.',ask:'Answer only from supplied content; say not found when unsupported.',analyze:'Analyze the supplied content comprehensively without inventing facts.',concepts:'Extract important concepts and relationships from the content.',semantic:'Extract structured semantic metadata from the content.',tags:'Suggest precise OFFSCRPT tags.',related:'Generate semantic search phrases/queries that represent this content.',compare:'Compare source A and source B only.',learning:'Turn the content into a learning module.',quiz:'Generate grounded questions from the content.',flashcards:'Generate grounded flashcards from the content.',prerequisites:'Infer learning prerequisites from the supplied content.',recap:'Create a recap from the supplied learning history.',quality:'Act as an authoring aid; flag uncertainty instead of asserting unsupported facts.',synthesize:'Synthesize only the supplied sources and explicitly preserve conflicts.',creator:'Provide editable creator-assistant suggestions; do not rewrite silently.'}[task] || '';
 return `${instruction}\nReturn strict JSON matching the requested schema. Never invent facts, sources, quotes, positions or claims. Preserve uncertainty.\nTASK: ${task}\nOPTIONS: ${JSON.stringify(options||{})}\nSOURCE JSON:\n${JSON.stringify(input).slice(0,MAX_CONTEXT)}`;
}
function normalize(task:string,p:any){
 const o:any={}; for(const [k,v] of Object.entries(p||{})){ if(Array.isArray(v))o[k]=v.slice(0,20).map((x:any)=>typeof x==='string'?text(x,700):x); else if(v&&typeof v==='object')o[k]=v; else if(typeof v==='boolean'||typeof v==='number'||typeof v==='string')o[k]=v; }
 if(!o.uncertainty)o.uncertainty='Grounded only in the supplied content.'; o.meta={task,generatedAt:new Date().toISOString(),model:modelFor(task),promptVersion:'v79.1'}; return o;
}
async function verify(token:string){
  const r=await fetch(FIREBASE_LOOKUP_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
  if(!r.ok)throw new Error('INVALID_FIREBASE_TOKEN');
  const d=await r.json() as any; const u=d.users?.[0]; if(!u?.localId)throw new Error('INVALID_FIREBASE_TOKEN'); if(u.disabled)throw new Error('ACCOUNT_DISABLED'); return String(u.localId);
}
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const MAX_RETRIES_PER_MODEL=Math.min(3,Math.max(0,Number(process.env.GEMINI_MAX_RETRIES||2)));
const RETRY_BASE_MS=Math.min(2500,Math.max(250,Number(process.env.GEMINI_RETRY_BASE_MS||700)));
const MAX_RETRY_DELAY_MS=Math.min(6000,Math.max(RETRY_BASE_MS,Number(process.env.GEMINI_MAX_RETRY_DELAY_MS||4500)));
function retryableStatus(status:number,detail=''){
  if(status===408)return true;
  if(status>=500 && status<=599)return true;
  if(status===429 && !/quota|daily/i.test(detail))return true;
  return false;
}
function retryDelay(headers:Headers,attempt:number){
  const retryAfter=headers.get('retry-after');
  const parsed=retryAfter?Number(retryAfter):NaN;
  if(Number.isFinite(parsed)&&parsed>=0) return Math.min(MAX_RETRY_DELAY_MS,parsed*1000);
  const exponential=Math.min(MAX_RETRY_DELAY_MS,RETRY_BASE_MS*Math.pow(2,attempt));
  return Math.min(MAX_RETRY_DELAY_MS,exponential+Math.floor(Math.random()*350));
}
function geminiHttpError(status:number,body:string,stage:string){
  let detail=''; try { const p=JSON.parse(body); detail=String(p?.error?.message||p?.error?.status||''); } catch { detail=body.slice(0,240); }
  const e=new Error(`GEMINI_HTTP_${status}:${stage}:${detail}`); (e as any).status=status; (e as any).detail=detail; return e;
}
async function listModels(key:string){
  if(modelCache.expiresAt>Date.now() && modelCache.names.size)return modelCache.names;
  let lastError:any;
  for(let attempt=0;attempt<=MAX_RETRIES_PER_MODEL;attempt++){
    const r=await fetch(`${GEMINI_BASE}/models?pageSize=1000`,{headers:{'x-goog-api-key':key}});
    const raw=await r.text();
    if(r.ok){
      const data=JSON.parse(raw); const names=new Set<string>();
      for(const m of Array.isArray(data.models)?data.models:[]){
        const name=String(m?.name||'').replace(/^models\//,'');
        const methods=Array.isArray(m?.supportedGenerationMethods)?m.supportedGenerationMethods:[];
        if(name && methods.includes('generateContent')) names.add(name);
      }
      modelCache.expiresAt=Date.now()+10*60*1000; modelCache.names=names; return names;
    }
    const err=geminiHttpError(r.status,raw,'model-list'); lastError=err;
    if(!retryableStatus(r.status,(err as any).detail)||attempt>=MAX_RETRIES_PER_MODEL) throw err;
    await sleep(retryDelay(r.headers,attempt));
  }
  throw lastError || new Error('GEMINI_MODEL_LIST_FAILED');
}
function selectAvailableModel(requested:string,available:Set<string>){
  if(available.has(requested))return requested;
  const candidates=[requested,'gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash','gemini-2.5-flash-lite'];
  return candidates.find(x=>available.has(x)) || [...available].find(x=>/flash/i.test(x)) || [...available][0];
}
async function generateModelRequest(key:string,model:string,prompt:string){
  const endpoint=`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const payload={contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}};
  let lastError:any;
  for(let attempt=0;attempt<=MAX_RETRIES_PER_MODEL;attempt++){
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(payload)});
    const raw=await r.text();
    if(r.ok)return {model,text:extractText(JSON.parse(raw))};
    const err=geminiHttpError(r.status,raw,'generate'); lastError=err;
    if(!retryableStatus(r.status,(err as any).detail)||attempt>=MAX_RETRIES_PER_MODEL)throw err;
    await sleep(retryDelay(r.headers,attempt));
  }
  throw lastError || new Error('GEMINI_GENERATION_FAILED');
}
async function generateWithGemini(key:string,model:string,prompt:string){
  const available=await listModels(key);
  const preferred=String(process.env.GEMINI_FALLBACK_MODELS||'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash-lite').split(',').map(x=>x.trim()).filter(Boolean);
  const pool=[selectAvailableModel(model,available),...preferred.filter(x=>available.has(x)),...['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash','gemini-2.5-flash-lite'].filter(x=>available.has(x))].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,3) as string[];
  let lastError:any;
  for(const candidate of pool){
    try { return await generateModelRequest(key,candidate,prompt); }
    catch(error:any){
      lastError=error;
      const status=Number(error?.status||0);
      const detail=String(error?.detail||error?.message||'');
      // Permanent/auth/model/schema errors should surface immediately; transient capacity errors can move to the next model.
      if(!retryableStatus(status,detail)) throw error;
    }
  }
  throw lastError || new Error('NO_GEMINI_GENERATE_MODEL');
}
function extractText(data:any){
  const parts=data?.candidates?.[0]?.content?.parts;
  if(Array.isArray(parts)) return parts.map((p:any)=>String(p?.text||'')).join('').trim();
  return '';
}
export default async function handler(req:any,res:any){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 const key=String(process.env.GEMINI_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||process.env.GOOGLE_API_KEY||'').trim().replace(/^['"]|['"]$/g,'');
 if(!key)return res.status(503).json({error:'OFFSCRPT AI is not configured. Add GEMINI_API_KEY to Vercel.'});
 try{
  const authHeader=String(req.headers.authorization||''); const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():''; if(!token)return res.status(401).json({error:'Authentication required.'});
  const uid=await verify(token); const body=req.body||{}; const task=text(body.task,40); const input=body.input||{};
  const title=text(input.title,500); const content=text(input.content,MAX_CONTEXT); if(!task||!title||!content)return res.status(400).json({error:'AI task, title and content are required.'});
  const today=new Date().toISOString().slice(0,10); const b=buckets.get(uid); const current=b&&b.day===today?b:{day:today,count:0}; if(current.count>=DAILY_LIMIT)return res.status(429).json({error:'Daily AI limit reached. Try again tomorrow.'});
  const options=body.options||{}; const requestedModel=modelFor(task); const fingerprint=JSON.stringify({uid,task,title,content:content.slice(0,6000),options,model:requestedModel}); let h=2166136261; for(let i=0;i<fingerprint.length;i++){h^=fingerprint.charCodeAt(i);h=Math.imul(h,16777619);} const ck=(h>>>0).toString(36); const cached=cache.get(ck); if(cached&&cached.expiresAt>Date.now())return res.status(200).json(cached.value);
  // Count only requests that reach generation; model discovery/auth failures do not consume the quota.
  const result=await generateWithGemini(key,requestedModel,`${promptFor(task,{contentType:input.contentType,contentId:input.contentId,title,content,metadata:input.metadata||{},sourceRevision:input.sourceRevision||''},options)}\nSCHEMA: ${JSON.stringify(schemaFor(task))}`);
  current.count++; buckets.set(uid,current);
  let parsed:any; try{parsed=JSON.parse(result.text);}catch{throw new Error('GEMINI_INVALID_JSON');}
  const normalized=normalize(task,parsed); normalized.meta.model=result.model; cache.set(ck,{expiresAt:Date.now()+CACHE_TTL,value:normalized}); return res.status(200).json(normalized);
 }catch(e:any){
  console.error('ai gateway failed',e);
  const msg=String(e?.message||e); const status=Number(e?.status||0);
  if(msg==='INVALID_FIREBASE_TOKEN')return res.status(401).json({error:'Authentication expired. Please sign in again.'});
  if(msg==='ACCOUNT_DISABLED')return res.status(403).json({error:'Account disabled.'});
  if(status===401||status===403||/ACCESS_TOKEN_TYPE_UNSUPPORTED|UNAUTHENTICATED/i.test(msg)) return res.status(502).json({error:'Gemini rejected the configured API key. Create a fresh AI Studio auth key and set it as GEMINI_API_KEY in Vercel, then redeploy.',code:'GEMINI_AUTH'});
  if(status===429||/RESOURCE_EXHAUSTED|quota/i.test(msg)) return res.status(429).json({error:'Gemini rate or quota limit reached. Try again later.',code:'GEMINI_QUOTA'});
  if(status===404||/NOT_FOUND/i.test(msg)) return res.status(502).json({error:'No compatible Gemini model is available for this project.',code:'GEMINI_MODEL'});
  if(msg==='GEMINI_INVALID_JSON') return res.status(502).json({error:'Gemini returned an invalid structured response. Please retry.',code:'GEMINI_RESPONSE'});
  if(status===408||status===500||status===502||status===503||status===504||/GEMINI_HTTP_5\d\d/.test(msg)){ res.setHeader('Retry-After','3'); return res.status(503).json({error:'Gemini is temporarily busy. OFFSCRPT retried available models; please retry in a moment.',code:'GEMINI_BUSY'}); }
  return res.status(500).json({error:'AI gateway failed. Check the Vercel function log for the upstream Gemini error.',code:'AI_GATEWAY'});
 }
}
