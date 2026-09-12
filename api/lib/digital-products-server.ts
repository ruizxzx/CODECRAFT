import crypto from 'node:crypto';

const projectId = () => process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'krishficient-portfolio';
const apiKey = () => process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
const firestoreBase = () => `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
const nowIso = () => new Date().toISOString();
const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

function fields(obj: any) {
  const value = (v:any):any => {
    if (v === null) return { nullValue: 'NULL_VALUE' };
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number' && Number.isInteger(v)) return { integerValue: String(v) };
    if (typeof v === 'number') return { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (typeof v === 'object') {
      const nested:any = {};
      for (const [k,x] of Object.entries(v)) if (x !== undefined) nested[k] = value(x);
      return { mapValue: { fields: nested } };
    }
    return { stringValue: String(v) };
  };
  const out:any = {};
  for (const [k,v] of Object.entries(obj)) if (v !== undefined) out[k] = value(v);
  return out;
}

function decode(v:any):any {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) {
    const o:any = {};
    for (const [k,x] of Object.entries(v.mapValue.fields || {})) o[k] = decode(x);
    return o;
  }
  return undefined;
}
function decodeFields(fs:any={}) {
  const o:any = {};
  for (const [k,v] of Object.entries(fs)) o[k] = decode(v);
  return o;
}

export async function serviceToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) throw new Error('Commerce server credentials are not configured.');
  const now = Math.floor(Date.now()/1000);
  const header = b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const input = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  const sig = b64url(signer.sign(String(key).replace(/\\n/g,'\n')));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:`${input}.${sig}`
    })
  });
  if (!response.ok) throw new Error(`OAuth failed: ${response.status}`);
  const data:any = await response.json();
  if (!data.access_token) throw new Error('OAuth access token missing.');
  return String(data.access_token);
}

export async function verifyFirebaseToken(idToken:string) {
  if (!idToken) throw new Error('Authentication required.');
  const key = apiKey();
  if (!key) throw new Error('FIREBASE_WEB_API_KEY is not configured on the server.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({idToken})
  });
  const data:any = await response.json().catch(() => ({}));
  if (!response.ok || !data.users?.[0]?.localId) throw new Error('Invalid authentication token.');
  const account = data.users[0];
  return {
    uid:String(account.localId),
    email:String(account.email || '').toLowerCase(),
    emailVerified:Boolean(account.emailVerified)
  };
}

export async function fsGet(token:string, name:string) {
  const response = await fetch(`${firestoreBase()}/${name}`, {headers:{Authorization:`Bearer ${token}`}});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed: ${response.status}`);
  const data:any = await response.json();
  return {name:String(data.name),fields:decodeFields(data.fields)};
}

function resourceName(name:string) {
  if (name.startsWith('projects/')) return name;
  return `projects/${projectId()}/databases/(default)/documents/${name.replace(/^https:\/\/firestore\.googleapis\.com\/v1\/projects\/[^/]+\/databases\/\(default\)\/documents\//,'')}`;
}

export async function fsCommit(token:string, writes:any[]) {
  const normalized = writes.map((w:any) => {
    if (w?.create?.name) return {
      update:{...w.create,name:resourceName(String(w.create.name))},
      currentDocument:{exists:false}
    };
    if (w?.update?.name) {
      const update = {...w.update,name:resourceName(String(w.update.name))};
      const mask = Object.keys(update.fields || {});
      return mask.length ? {update,updateMask:{fieldPaths:mask}} : {update};
    }
    if (w?.transform?.document) return {
      transform:{...w.transform,document:resourceName(String(w.transform.document))}
    };
    if (w?.delete) return {delete:resourceName(String(w.delete))};
    return w;
  });
  const response = await fetch(`${firestoreBase()}:commit`, {
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({writes:normalized})
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firestore commit failed: ${response.status} ${text.slice(0,500)}`);
  }
  return response.json();
}

export async function fsQuery(token:string, collectionId:string, filters:any[] = []) {
  const structured:any = {from:[{collectionId}]};
  if (filters.length === 1) structured.where = {fieldFilter:filters[0]};
  if (filters.length > 1) structured.where = {compositeFilter:{op:'AND',filters:filters.map(fieldFilter=>({fieldFilter}))}};
  const response = await fetch(`${firestoreBase()}:runQuery`, {
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({structuredQuery:structured})
  });
  if (!response.ok) throw new Error(`Firestore query failed: ${response.status}`);
  const rows:any[] = await response.json();
  return rows.filter(row=>row.document).map(row=>({name:String(row.document.name),fields:decodeFields(row.document.fields)}));
}

function hmac(key:Buffer|string, value:string) { return crypto.createHmac('sha256', key).update(value).digest(); }
function hash(value:string) { return crypto.createHash('sha256').update(value).digest('hex'); }
function awsEncode(value:string) { return encodeURIComponent(value).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`); }
function amzDate(date:Date) { return date.toISOString().replace(/[-:]|\.\d{3}/g,''); }
function shortDate(date:Date) { return amzDate(date).slice(0,8); }

export function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const bucket = process.env.R2_PRODUCT_BUCKET_NAME || '';
  const accessKey = process.env.R2_ACCESS_KEY_ID || '';
  const secretKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const endpoint = process.env.R2_S3_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  if (!accountId || !bucket || !accessKey || !secretKey || !endpoint) {
    throw new Error('Digital product storage is not configured. Set R2_PRODUCT_BUCKET_NAME, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.');
  }
  return {accountId,bucket,accessKey,secretKey,endpoint};
}

export function r2PresignedUrl(input:{method:'PUT'|'HEAD'|'GET';bucket:string;key:string;expiresIn:number}) {
  const cfg = r2Config();
  const now = new Date();
  const date = amzDate(now);
  const day = shortDate(now);
  const region = 'auto';
  const service = 's3';
  const scope = `${day}/${region}/${service}/aws4_request`;
  const host = new URL(cfg.endpoint).host;
  const params = new URLSearchParams({
    'X-Amz-Algorithm':'AWS4-HMAC-SHA256',
    'X-Amz-Credential':`${cfg.accessKey}/${scope}`,
    'X-Amz-Date':date,
    'X-Amz-Expires':String(expiresIn),
    'X-Amz-SignedHeaders':'host'
  });
  const canonicalQuery = [...params.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>`${awsEncode(k)}=${awsEncode(v)}`).join('&');
  const canonicalHeaders = `host:${host}\n`;
  const canonicalPath = `/${cfg.bucket}/${cfgKeyPath(input.key)}`;
  const canonicalRequest = [input.method,canonicalPath,canonicalQuery,canonicalHeaders,'host','UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256',date,scope,hash(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${cfg.secretKey}`,day);
  const kRegion = hmac(kDate,region);
  const kService = hmac(kRegion,service);
  const kSigning = hmac(kService,'aws4_request');
  params.set('X-Amz-Signature',crypto.createHmac('sha256',kSigning).update(stringToSign).digest('hex'));
  return `${cfg.endpoint.replace(/\/$/,'')}/${encodeURIComponent(cfg.bucket)}/${input.key.split('/').map(awsEncode).join('/')}?${params.toString()}`;
}
function cfgKeyPath(key:string) { return key.split('/').map(awsEncode).join('/'); }

export function productLimits() {
  return {
    maxFileBytes: Number(process.env.OFFSCRPT_PRODUCT_MAX_FILE_BYTES || 100 * 1024 * 1024),
    maxFilesPerVersion: Number(process.env.OFFSCRPT_PRODUCT_MAX_FILES_PER_VERSION || 50),
    maxTotalBytesPerVersion: Number(process.env.OFFSCRPT_PRODUCT_MAX_TOTAL_BYTES_PER_VERSION || 500 * 1024 * 1024)
  };
}

export const blockedExtensions = new Set(['exe','bat','cmd','scr','ps1','vbs','apk','dmg','sh','com','msi','jar']);
export const blockedMimeTypes = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/vnd.android.package-archive'
]);

export function safeName(input:string) {
  const raw = input.split(/[\\/]/).pop() || 'file';
  return raw.replace(/[\u0000-\u001f\u007f]/g,'_').replace(/\s+/g,' ').trim().slice(0,180) || 'file';
}
export function fileExtension(name:string) {
  const base = name.toLowerCase().split(/[\\/]/).pop() || '';
  const idx = base.lastIndexOf('.');
  return idx > -1 ? base.slice(idx+1) : '';
}
export function isBlockedFile(name:string,mime:string) {
  return blockedExtensions.has(fileExtension(name)) || blockedMimeTypes.has(String(mime).toLowerCase());
}
export function storageKey(uid:string,productId:string,versionId:string,fileId:string,name:string) {
  const clean = safeName(name).replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').slice(0,120) || 'file';
  return `digital-products/${uid}/${productId}/${versionId}/${fileId}-${clean}`;
}
export { fields, nowIso };
