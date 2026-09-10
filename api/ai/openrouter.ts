const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const text = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const sleep = (ms:number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export type OpenRouterTask = string;

export function openRouterKey() {
  return String(process.env.OPENROUTER_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
}

export function openRouterModel(task:OpenRouterTask) {
  const fast = process.env.OPENROUTER_MODEL_FAST || process.env.OPENROUTER_MODEL || 'openrouter/free';
  const balanced = process.env.OPENROUTER_MODEL_BALANCED || process.env.OPENROUTER_MODEL || 'openrouter/free';
  const deep = process.env.OPENROUTER_MODEL_DEEP || process.env.OPENROUTER_MODEL || 'openrouter/free';
  if (['tags','related','semantic'].includes(task)) return fast;
  if (['learning','synthesize','compare','analyze'].includes(task)) return deep;
  return balanced;
}

function parseError(status:number, body:string, stage:string) {
  let detail='';
  try {
    const p=JSON.parse(body);
    detail=String(p?.error?.message || p?.error || p?.message || '').slice(0,500);
  } catch { detail=body.slice(0,500); }
  const e:any=new Error(`OPENROUTER_HTTP_${status}:${stage}:${detail}`);
  e.status=status; e.detail=detail; return e;
}

function retryable(status:number, detail='') {
  if (status===408 || status===409) return true;
  if (status===429) return true;
  return status>=500 && status<=599;
}

function retryDelay(headers:Headers, attempt:number) {
  const retryAfter=headers.get('retry-after');
  const parsed=retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(parsed) && parsed>=0) return Math.min(9000, parsed*1000);
  return Math.min(9000, 700*Math.pow(2,attempt)+Math.floor(Math.random()*400));
}

function parseContent(raw:string) {
  const p=JSON.parse(raw);
  return String(p?.choices?.[0]?.message?.content ?? '').trim();
}

export async function generateOpenRouter(params:{task:string; prompt:string}) {
  const key=openRouterKey();
  if(!key) throw Object.assign(new Error('OPENROUTER_NOT_CONFIGURED'), {status:503, detail:'OPENROUTER_API_KEY is not configured.'});
  const configured = String(process.env.OPENROUTER_FALLBACK_MODELS || 'openrouter/free').split(',').map(x=>x.trim()).filter(Boolean);
  const primary=openRouterModel(params.task);
  const models=[primary,...configured,'openrouter/free'].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);
  const maxRetries=Math.min(3,Math.max(0,Number(process.env.OPENROUTER_MAX_RETRIES||2)));
  const referer=String(process.env.OPENROUTER_HTTP_REFERER||'https://offscrpt.vercel.app');
  const title=String(process.env.OPENROUTER_APP_TITLE||'OFFSCRPT');
  let last:any;
  for(const model of models){
    for(let attempt=0;attempt<=maxRetries;attempt++){
      const response=await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${key}`,
          'HTTP-Referer':referer,
          'X-Title':title,
        },
        body:JSON.stringify({
          model,
          messages:[{role:'user',content:params.prompt}],
          temperature:0.2,
          response_format:{type:'json_object'},
          provider:{allow_fallbacks:true},
          max_tokens: Number(process.env.OPENROUTER_MAX_OUTPUT_TOKENS||5000),
        })
      });
      const raw=await response.text();
      if(response.ok) return {model,text:parseContent(raw)};
      last=parseError(response.status,raw,'generate');
      if(!retryable(response.status,last.detail) || attempt>=maxRetries) break;
      await sleep(retryDelay(response.headers,attempt));
    }
  }
  throw last || Object.assign(new Error('OPENROUTER_GENERATION_FAILED'),{status:502});
}
