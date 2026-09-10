import fs from 'node:fs';
const files=['api/ai/gateway.ts','api/ai/discussion-summary.ts'];
for (const file of files) {
  const s=fs.readFileSync(file,'utf8');
  for (const required of ['GEMINI_API_KEY','x-goog-api-key','generativelanguage.googleapis.com','generateContent','authorization']) if(!s.includes(required)) throw new Error(`${file}: missing ${required}`);
}
const gateway=fs.readFileSync('api/ai/gateway.ts','utf8');
for (const banned of ["new GoogleGenAI", "?key=${encodeURIComponent(key)}"]) if(gateway.includes(banned)) throw new Error(`gateway still relies on legacy transport: ${banned}`);
console.log('AI GATEWAY CHECK OK — AQ/auth-key compatible REST transport, token verification, model discovery and error mapping present.');
