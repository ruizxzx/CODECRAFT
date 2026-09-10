const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function openRouterKey() {
  return String(process.env.OPENROUTER_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
}

export function openRouterModel(task) {
  const fast = process.env.OPENROUTER_MODEL_FAST || process.env.OPENROUTER_MODEL || 'openrouter/free';
  const balanced = process.env.OPENROUTER_MODEL_BALANCED || process.env.OPENROUTER_MODEL || 'openrouter/free';
  const deep = process.env.OPENROUTER_MODEL_DEEP || process.env.OPENROUTER_MODEL || 'openrouter/free';
  if (['tags', 'related', 'semantic'].includes(task)) return fast;
  if (['learning', 'synthesize', 'compare', 'analyze'].includes(task)) return deep;
  return balanced;
}

function parseError(status, body, stage) {
  let detail = '';
  try {
    const p = JSON.parse(body);
    detail = String(p?.error?.message || p?.error || p?.message || '').slice(0, 500);
  } catch {
    detail = body.slice(0, 500);
  }
  const e = new Error(`OPENROUTER_HTTP_${status}:${stage}:${detail}`);
  e.status = status;
  e.detail = detail;
  return e;
}

function retryable(status) {
  if (status === 408 || status === 409 || status === 429) return true;
  return status >= 500 && status <= 599;
}

function likelyStructuredOutputUnsupported(status, detail) {
  if (status !== 400) return false;
  const value = String(detail || '').toLowerCase();
  return value.includes('response_format') || value.includes('json_object') || value.includes('structured output') || value.includes('json mode');
}

function parseJsonText(text) {
  const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(clean); } catch {}
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(clean.slice(first, last + 1));
  throw new Error('AI_INVALID_JSON');
}

function retryDelay(headers, attempt) {
  const retryAfter = headers.get('retry-after');
  const parsed = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0) return Math.min(9000, parsed * 1000);
  return Math.min(9000, 700 * Math.pow(2, attempt) + Math.floor(Math.random() * 400));
}

function parseContent(raw) {
  const p = JSON.parse(raw);
  return String(p?.choices?.[0]?.message?.content ?? '').trim();
}

export async function generateOpenRouter(params) {
  const key = openRouterKey();
  if (!key) throw Object.assign(new Error('OPENROUTER_NOT_CONFIGURED'), { status: 503, detail: 'OPENROUTER_API_KEY is not configured.' });

  const configured = String(process.env.OPENROUTER_FALLBACK_MODELS || 'openrouter/free')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const primary = openRouterModel(params.task);
  const models = [primary, ...configured, 'openrouter/free'].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
  const maxRetries = Math.min(3, Math.max(0, Number(process.env.OPENROUTER_MAX_RETRIES || 2)));
  const referer = String(process.env.OPENROUTER_HTTP_REFERER || 'https://offscrpt.vercel.app');
  const title = String(process.env.OPENROUTER_APP_TITLE || 'OFFSCRPT');
  let last;

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let useStructuredOutput = true;
      let response;
      let raw = '';
      for (let formatAttempt = 0; formatAttempt < 2; formatAttempt++) {
        const payload = {
          model,
          messages: [{ role: 'user', content: params.prompt }],
          temperature: 0.2,
          provider: { allow_fallbacks: true },
          max_tokens: Number(process.env.OPENROUTER_MAX_OUTPUT_TOKENS || 5000),
          ...(useStructuredOutput ? { response_format: { type: 'json_object' } } : {}),
        };
        response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': referer,
            'X-Title': title,
          },
          body: JSON.stringify(payload),
        });
        raw = await response.text();
        if (response.ok) {
          const content = parseContent(raw);
          if (!useStructuredOutput) {
            // Validate fallback JSON before returning it. The gateway will normalize it.
            parseJsonText(content);
          }
          return { model, text: content };
        }
        const candidate = parseError(response.status, raw, 'generate');
        if (useStructuredOutput && likelyStructuredOutputUnsupported(response.status, candidate.detail)) {
          useStructuredOutput = false;
          continue;
        }
        last = candidate;
        break;
      }
      if (!retryable(response.status) || attempt >= maxRetries) break;
      await sleep(retryDelay(response.headers, attempt));
    }
  }

  throw last || Object.assign(new Error('OPENROUTER_GENERATION_FAILED'), { status: 502 });
}
