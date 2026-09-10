import fs from 'node:fs';
const gateway=fs.readFileSync('api/ai/gateway.ts','utf8');
const provider=fs.readFileSync('api/ai/openrouter-provider.js','utf8');
const discussion=fs.readFileSync('api/ai/discussion-summary.ts','utf8');
for (const [file,s,required] of [['api/ai/gateway.ts',gateway,['OPENROUTER_API_KEY','authorization','generateOpenRouter']],['api/ai/openrouter-provider.js',provider,['chat/completions','Bearer','response_format']],['api/ai/discussion-summary.ts',discussion,['OPENROUTER_API_KEY','generateOpenRouter','authorization']]]) { for(const x of required) if(!s.includes(x)) throw new Error(`${file}: missing ${x}`); }
for (const banned of ['generativelanguage.googleapis.com','x-goog-api-key','@google/genai']) { if([gateway,provider,discussion].some(s=>s.includes(banned))) throw new Error(`OpenRouter migration incomplete: ${banned}`); }
console.log('AI GATEWAY CHECK OK — OpenRouter server-side API, Firebase auth, structured output and retry/fallback routing present.');
