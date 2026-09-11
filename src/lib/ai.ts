import { auth } from './firebase';

export type AITask = 'summary'|'explain'|'ask'|'analyze'|'concepts'|'semantic'|'tags'|'related'|'compare'|'learning'|'quiz'|'flashcards'|'prerequisites'|'recap'|'quality'|'synthesize'|'creator';

export interface AIContentInput {
  contentType: string;
  contentId?: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  sourceRevision?: string;
}

const AI_CACHE_NAMESPACE = 'offscrpt:ai:openrouter:v3';

function purgeLegacyAICaches(){
  try {
    const stale:string[]=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && (k.startsWith('offscrpt:ai:v1:') || k.startsWith('offscrpt:ai:v2:') || k.startsWith('offscrpt:ai:gemini:'))) stale.push(k);
    }
    stale.forEach(k=>localStorage.removeItem(k));
    const marker='offscrpt:ai:openrouter:cache-migrated:v1';
    if(localStorage.getItem(marker)!=='1') localStorage.setItem(marker,'1');
  } catch (error) { console.warn('Legacy AI cache cleanup skipped:', error); }
}

purgeLegacyAICaches();

const localCacheKey = (task:AITask,input:AIContentInput,options:Record<string,unknown>) => {
  const raw = JSON.stringify({provider:'openrouter',task,id:input.contentId||'',title:input.title,content:input.content.slice(0,12000),revision:input.sourceRevision||'',options});
  let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return `${AI_CACHE_NAMESPACE}:${task}:${(h>>>0).toString(36)}`;
};

function readCache<T>(key:string):T|null { try { const raw=localStorage.getItem(key); if(!raw)return null; const parsed=JSON.parse(raw); if(parsed?.expiresAt && parsed.expiresAt<Date.now()){localStorage.removeItem(key);return null;} return parsed?.value ?? null; } catch (error) { console.warn('AI cache read skipped:', error); return null; } }
function writeCache(key:string,value:unknown,ttlMs=24*60*60*1000){ try { localStorage.setItem(key,JSON.stringify({value,expiresAt:Date.now()+ttlMs})); } catch (error) { console.warn('AI cache clear skipped:', error); } }

export type AIChatMessage = { role: 'user' | 'assistant'; content: string; createdAt?: string };

const AI_HISTORY_NAMESPACE = 'offscrpt:ai:conversations:v1';
const AI_USAGE_NAMESPACE = 'offscrpt:ai:usage:v1';

function aiUsageKey(uid?: string | null) { return `${AI_USAGE_NAMESPACE}:${uid || auth.currentUser?.uid || 'guest'}:${new Date().toISOString().slice(0,10)}`; }
export function getAIUsageToday(uid?: string | null) { try { return Number(localStorage.getItem(aiUsageKey(uid)) || 0); } catch { return 0; } }
function incrementAIUsage(uid?: string | null) { try { const key=aiUsageKey(uid); const next=getAIUsageToday(uid)+1; localStorage.setItem(key,String(next)); return next; } catch { return getAIUsageToday(uid); } }

function safeStorageKey(input: AIContentInput) {
  const id = `${auth.currentUser?.uid || 'guest'}:${input.contentType}:${input.contentId || input.title}`;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${AI_HISTORY_NAMESPACE}:${(h >>> 0).toString(36)}`;
}

export function loadAIConversation(input: AIContentInput): AIChatMessage[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(safeStorageKey(input));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch { return []; }
}

export function saveAIConversation(input: AIContentInput, messages: AIChatMessage[]) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(safeStorageKey(input), JSON.stringify(messages.slice(-30))); } catch { /* optional local persistence */ }
}

export function clearAIConversation(input: AIContentInput) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(safeStorageKey(input)); } catch { /* optional local persistence */ }
}

export function listAIConversationSummaries(): Array<{ key: string; count: number; updatedAt: string }> {
  if (typeof localStorage === 'undefined') return [];
  const out: Array<{ key: string; count: number; updatedAt: string }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${AI_HISTORY_NAMESPACE}:`)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(parsed) || !parsed.length) continue;
      out.push({ key, count: parsed.length, updatedAt: String(parsed.at(-1)?.createdAt || '') });
    }
  } catch { /* optional */ }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function requestAI<T=any>(task:AITask,input:AIContentInput,options:Record<string,unknown>={}):Promise<T>{
  const key=localCacheKey(task,input,options); const cached=readCache<T>(key); if(cached!==null)return cached;
  const user=auth.currentUser; if(!user) throw new Error('Sign in to use OFFSCRPT AI.');
  const token=await user.getIdToken();
  const body=JSON.stringify({task,input,options});
  let response:Response; let data:any={};
  for(let attempt=0;attempt<2;attempt++){
    response=await fetch('/api/ai/gateway',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body});
    data=await response.json().catch(()=>({}));
    if(response.ok) break;
    if(!['AI_BUSY','AI_PROVIDER_RATE_LIMIT'].includes(data?.code) || attempt===1) throw new Error(String(data?.error||'AI request failed.'));
    const retryAfter=Number(response.headers.get('retry-after')||3);
    await new Promise<void>(resolve=>setTimeout(resolve,Math.min(6000,Math.max(1000,retryAfter*1000))));
  }
  incrementAIUsage(user.uid);
  writeCache(key,data,task==='ask'?6*60*60*1000:7*24*60*60*1000); return data as T;
}

export function recordAILearningItem(item:{topic?:string;title:string;content:string}){ try { const key='offscrpt:learn:history:v1'; const existing=JSON.parse(localStorage.getItem(key)||'[]'); const next=[...existing,{topic:item.topic||'AI Learning',title:item.title,content:item.content.slice(0,3000),date:new Date().toISOString().slice(0,10)}].slice(-100); localStorage.setItem(key,JSON.stringify(next)); } catch (error) { console.warn('AI learning history write skipped:', error); } }

export function clearAICache(){ try { const keys=[]; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k && (k.startsWith('offscrpt:ai:openrouter:v3:') || k.startsWith('offscrpt:ai:v2:') || k.startsWith('offscrpt:ai:v1:') || k.startsWith('offscrpt:ai:gemini:')))keys.push(k);} keys.forEach(k=>localStorage.removeItem(k)); localStorage.setItem('offscrpt:ai:openrouter:cache-migrated:v1','1'); } catch (error) { console.warn('AI cache clear skipped:', error); } }

export function contentRevision(input:AIContentInput){ const raw=`${input.sourceRevision||''}|${input.title}|${input.content.slice(0,5000)}`; let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36); }
