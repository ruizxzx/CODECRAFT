import { GoogleGenAI } from '@google/genai';

function text(value: unknown, max: number) { return String(value ?? '').slice(0, max); }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Discussion AI is not configured.' });
  try {
    const body = req.body || {};
    const title = text(body.title, 500);
    const content = text(body.content, 12000);
    const replies = Array.isArray(body.replies) ? body.replies.slice(0, 120).map((r:any) => ({ id:text(r.id,80), author:text(r.author,80), content:text(r.content,5000), likes:Number(r.likes||0), authorResponse:Boolean(r.authorResponse) })) : [];
    if (!title || replies.length < 5) return res.status(400).json({ error: 'A discussion title and at least five replies are required.' });
    const ai = new GoogleGenAI({ apiKey:key });
    const prompt = [
      'You are OFFSCRPT Discussion Intelligence. Analyze ONLY the supplied discussion content and replies.',
      'Never invent facts, sources, positions, or conclusions not supported by the supplied material.',
      'Return strict JSON with keys: overview (string), arguments (string[]), agreements (string[]), disagreements (string[]), unresolved (string[]), useful (string[]).',
      'Keep each array concise, concrete, and grounded. Useful replies should identify actual reply IDs when possible.',
      `DISCUSSION TITLE:\n${title}\n\nDISCUSSION BODY:\n${content}\n\nREPLIES JSON:\n${JSON.stringify(replies)}`
    ].join('\n');
    const response:any = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    const raw = String(response?.text || '').trim();
    const parsed = JSON.parse(raw.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
    const safe = {
      overview:text(parsed.overview,1800),
      arguments:Array.isArray(parsed.arguments)?parsed.arguments.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],
      agreements:Array.isArray(parsed.agreements)?parsed.agreements.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],
      disagreements:Array.isArray(parsed.disagreements)?parsed.disagreements.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],
      unresolved:Array.isArray(parsed.unresolved)?parsed.unresolved.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],
      useful:Array.isArray(parsed.useful)?parsed.useful.map((x:any)=>text(x,300)).filter(Boolean).slice(0,8):[],
    };
    return res.status(200).json(safe);
  } catch (error:any) {
    console.error('discussion-summary failed', error);
    return res.status(500).json({ error: 'Unable to generate discussion intelligence.' });
  }
}
