import type { VercelRequest, VercelResponse } from '../../server/vercel-types.js';
import crypto from 'node:crypto';

const projectId = () => process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'krishficient-portfolio';
const apiKey = () => process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
const nowIso = () => new Date().toISOString();
const b64url=(input:string|Buffer)=>Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

async function serviceToken(){
  const email=process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL; const key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if(!email||!key) throw new Error('Commerce server credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
  const now=Math.floor(Date.now()/1000); const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'})); const payload=b64url(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const input=`${header}.${payload}`; const signer=crypto.createSign('RSA-SHA256'); signer.update(input); const sig=b64url(signer.sign(key.replace(/\\n/g,'\n'))); const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${input}.${sig}`})});
  if(!r.ok) throw new Error(`OAuth failed: ${r.status}`); const j:any=await r.json(); if(!j.access_token) throw new Error('OAuth access token missing.'); return String(j.access_token);
}

function firestoreBase(){return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;}
function value(v:any):any { if(v===null) return {nullValue:'NULL_VALUE'}; if(typeof v==='string') return {stringValue:v}; if(typeof v==='boolean') return {booleanValue:v}; if(typeof v==='number' && Number.isInteger(v)) return {integerValue:String(v)}; if(typeof v==='number') return {doubleValue:v}; if(Array.isArray(v)) return {arrayValue:{values:v.map(value)}}; if(v instanceof Date) return {timestampValue:v.toISOString()}; if(typeof v==='object') { const fields:any={}; for(const [k,x] of Object.entries(v)){ if(x!==undefined) fields[k]=value(x); } return {mapValue:{fields}}; } return {stringValue:String(v)}; }
function fields(obj:any){const out:any={}; for(const [k,v] of Object.entries(obj)){ if(v!==undefined) out[k]=value(v); } return out;}
function decode(v:any):any { if(!v) return null; if('stringValue'in v)return v.stringValue; if('integerValue'in v)return Number(v.integerValue); if('doubleValue'in v)return v.doubleValue; if('booleanValue'in v)return v.booleanValue; if('timestampValue'in v)return v.timestampValue; if('nullValue'in v)return null; if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode); if('mapValue'in v){const o:any={}; for(const [k,x] of Object.entries(v.mapValue.fields||{}))o[k]=decode(x); return o;} return undefined; }
function decodeFields(fs:any={}){const o:any={}; for(const [k,v] of Object.entries(fs))o[k]=decode(v); return o;}
async function fsGet(token:string,name:string){const r=await fetch(`${firestoreBase()}/${name}`,{headers:{Authorization:`Bearer ${token}`}}); if(r.status===404)return null; if(!r.ok)throw new Error(`Firestore read failed: ${r.status}`); const j:any=await r.json(); return {name:j.name,fields:decodeFields(j.fields)};}
async function fsCreate(token:string,name:string,obj:any){const parent=name.split('/').slice(0,-1).join('/'); const id=name.split('/').pop()!; const r=await fetch(`${firestoreBase()}/${parent}?documentId=${encodeURIComponent(id)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({fields:fields(obj)})}); if(r.status===409)return false; if(!r.ok)throw new Error(`Firestore create failed: ${r.status}`); return true;}
async function fsPatch(token:string,name:string,obj:any){const params=new URLSearchParams(); for(const k of Object.keys(obj))params.append('updateMask.fieldPaths',k); const r=await fetch(`${firestoreBase()}/${name}?${params.toString()}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({fields:fields(obj)})}); if(!r.ok)throw new Error(`Firestore update failed: ${r.status}`); return true;}
function firestoreResourceName(name:string){
  const restPrefix='https://firestore.googleapis.com/v1/';
  const base=firestoreBase() + '/';
  if(name.startsWith(restPrefix)){
    const resource=name.slice(restPrefix.length);
    if(resource.startsWith(`projects/${projectId()}/databases/(default)/documents/`)) return resource;
  }
  if(name.startsWith('projects/')) return name;
  if(name.startsWith(base)) return `projects/${projectId()}/databases/(default)/documents/${name.slice(base.length)}`;
  if(!name.includes('/')) return `projects/${projectId()}/databases/(default)/documents/${name}`;
  if(/^(commerceProducts|commercePrices|commerceOrders|commercePayments|commerceRefunds|entitlements|creatorRevenue|creatorPayouts|commerceAuditLogs|commerceWebhookEvents|commerceIdempotency|users)\//.test(name)) return `projects/${projectId()}/databases/(default)/documents/${name}`;
  throw new Error(`Invalid Firestore document path: ${name}`);
}
function normalizeCommitWrites(writes:any[]){
  return writes.map((write:any)=>{
    if(write?.create?.name){
      const create=write.create;
      return {
        update:{...create,name:firestoreResourceName(String(create.name))},
        currentDocument:{exists:false}
      };
    }
    if(write?.update?.name){
      const update={...write.update,name:firestoreResourceName(String(write.update.name))};
      const fieldPaths=Object.keys(update.fields||{});
      return fieldPaths.length ? {update,updateMask:{fieldPaths}} : {update};
    }
    if(write?.delete){
      return {delete:firestoreResourceName(String(write.delete))};
    }
    if(write?.transform?.document){
      return {transform:{...write.transform,document:firestoreResourceName(String(write.transform.document))}};
    }
    return write;
  });
}
async function fsCommit(token:string,writes:any[]){
  const normalized=normalizeCommitWrites(writes);
  const r=await fetch(`${firestoreBase()}:commit`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({writes:normalized})});
  if(!r.ok){const text=await r.text(); throw new Error(`Firestore commit failed: ${r.status} ${text.slice(0,500)}`);}
  return r.json();
}
async function fsRunQuery(token:string, from:string, filters:any[]){const where=filters.length===1?{fieldFilter:filters[0]}:{compositeFilter:{op:'AND',filters:filters.map(fieldFilter=>({fieldFilter}))}}; const r=await fetch(`${firestoreBase()}:runQuery`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:from}],where}})}); if(!r.ok)throw new Error(`Firestore query failed: ${r.status}`); const rows:any[]=await r.json(); return rows.filter(x=>x.document).map(x=>({name:x.document.name,fields:decodeFields(x.document.fields)}));}
async function fsCount(token:string, collectionId:string){
  const r=await fetch(`${firestoreBase()}:runAggregationQuery`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({structuredAggregationQuery:{structuredQuery:{from:[{collectionId}]},aggregations:[{alias:'count',count:{}}]}})});
  if(!r.ok){const text=await r.text();throw new Error(`Firestore count failed: ${r.status} ${text.slice(0,300)}`);}
  const rows:any[]=await r.json();
  const raw=rows?.[0]?.result?.aggregateFields?.count?.integerValue;
  return Number(raw||0);
}
async function verifyCommerceAdmin(token:string,uid:string,email?:string,emailVerified?:boolean){
  const normalized=String(email||'').trim().toLowerCase();
  // Keep backend commerce authorization aligned with the canonical OFFSCRPT master-admin bootstrap allowlist.
  if(emailVerified===true && ['ruizxzxz@gmail.com','krishsarkar456@gmail.com'].includes(normalized)) return true;
  const user=await fsGet(token,`users/${uid}`);
  if(user?.fields?.platformRole==='master_admin') return true;
  const admin=await fsGet(token,`masterAdmins/${uid}`);
  if(admin?.fields?.enabled===false) return false;
  if(admin) return true;
  if(emailVerified===true && normalized){
    const byEmail=await fsGet(token,`masterAdminEmails/${normalized}`);
    return Boolean(byEmail && byEmail.fields?.enabled!==false);
  }
  return false;
}
async function verifyFirebaseToken(idToken:string){ if(!idToken) throw new Error('Authentication required.'); if(!apiKey()) throw new Error('FIREBASE_WEB_API_KEY is not configured on the server.'); const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey())}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken})}); const j:any=await r.json(); if(!r.ok||!j.users?.[0]?.localId) throw new Error('Invalid authentication token.'); const account=j.users[0]; return {uid:String(account.localId),email:String(account.email||''),emailVerified:Boolean(account.emailVerified)}; }
function authHeader(req:VercelRequest){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();}
function testMode(){return String(process.env.COMMERCE_PAYMENT_MODE||'test').toLowerCase()==='test';}
function amountOk(n:any){return Number.isSafeInteger(n)&&n>=0&&n<=10_000_000_000;}
function idempotencyId(userId:string, key:string){return crypto.createHash('sha256').update(`${userId}:${key}`).digest('hex').slice(0,48);}

async function checkAccess(token:string,uid:string,b:any){
  const resourceType=String(b.resourceType||'').trim(), resourceId=String(b.resourceId||'').trim(); if(!resourceType||!resourceId) throw new Error('resourceType and resourceId are required.');
  const rows=await fsRunQuery(token,'entitlements',[{field:{fieldPath:'userId'},op:'EQUAL',value:{stringValue:uid}},{field:{fieldPath:'resourceType'},op:'EQUAL',value:{stringValue:resourceType}},{field:{fieldPath:'resourceId'},op:'EQUAL',value:{stringValue:resourceId}}]);
  const now=Date.now(); const access=rows.some(x=>{const d=x.fields; if(d.status!=='active')return false; const starts=d.startsAt?Date.parse(String(d.startsAt)):0; const expires=d.expiresAt?Date.parse(String(d.expiresAt)):NaN; return (!starts||starts<=now)&&(!Number.isFinite(expires)||expires>now);});
  return {access,resourceType,resourceId,userId:uid};
}

async function createProduct(token:string,uid:string,b:any){
  const user=await fsGet(token,`users/${uid}`); if(!user)throw new Error('Creator profile not found.'); if(!(user.fields.isAuthor===true || user.fields.creatorStatus===true || user.fields.platformRole==='master_admin'))throw new Error('Creator commerce is not configured for this account.');
  const title=String(b.title||'').trim().slice(0,160), description=String(b.description||'').trim().slice(0,5000), type=String(b.type||'digital_product'), visibility=String(b.visibility||'private'), currency=String(b.currency||'INR').toUpperCase();
  if(!title||!['content','digital_product','course','subscription','community','service','bundle','tip'].includes(type))throw new Error('Invalid product.');
  if(!['private','public'].includes(visibility)||!/^[A-Z]{3}$/.test(currency))throw new Error('Invalid product visibility or currency.');
  const productId=crypto.randomUUID(); const priceInput=b.price; const writes=[{create:{name:`${firestoreBase()}/commerceProducts/${productId}`,fields:fields({creatorId:uid,creatorUsername:String(user.fields.username||''),title,description,type,status:'draft',visibility,featured:false,currency,priceIds:[],version:1,createdAt:nowIso(),updatedAt:nowIso()})}}];
  let price:any=undefined;
  if(priceInput){ if(!amountOk(priceInput.amount)||String(priceInput.currency||currency).toUpperCase()!==currency)throw new Error('Invalid initial price.'); const priceId=crypto.randomUUID(); price={id:priceId,productId,amount:Number(priceInput.amount),currency,billingType:priceInput.billingType==='recurring'?'recurring':'one_time',interval:priceInput.interval,intervalCount:priceInput.intervalCount||1,trialDays:Math.max(0,Math.min(365,Number(priceInput.trialDays||0))),active:true,createdAt:nowIso(),updatedAt:nowIso()}; writes[0].create.fields.priceIds=value([priceId]); writes.push({create:{name:`${firestoreBase()}/commercePrices/${priceId}`,fields:fields(price)}}); }
  await fsCommit(token,writes); return {product:{id:productId,creatorId:uid,creatorUsername:String(user.fields.username||''),title,description,type,status:'draft',visibility,currency,priceIds:price?.id?[price.id]:[],version:1,createdAt:nowIso(),updatedAt:nowIso()},price};
}

async function setProductStatus(token:string,uid:string,b:any){
  const productId=String(b.productId||''); const next=String(b.status||'');
  if(!['active','archived','disabled','draft'].includes(next)) throw new Error('Invalid product status.');
  const product=await fsGet(token,`commerceProducts/${productId}`); if(!product) throw new Error('Product not found.');
  if(product.fields.creatorId!==uid) throw new Error('You do not own this product.');
  if(next==='active' && !(Array.isArray(product.fields.priceIds)&&product.fields.priceIds.length>0)) throw new Error('Add at least one price before activating the product.');
  const stamp=nowIso();
  await fsPatch(token,`commerceProducts/${productId}`,{status:next,updatedAt:stamp,...(next==='active'?{publishedAt:product.fields.publishedAt||stamp}:{}) ,...(next==='archived'?{archivedAt:stamp}:{})});
  return {product:{id:productId,...product.fields,status:next,updatedAt:stamp}};
}

async function createPrice(token:string,uid:string,b:any){
  const product=await fsGet(token,`commerceProducts/${String(b.productId||'')}`); if(!product)throw new Error('Product not found.'); if(product.fields.creatorId!==uid)throw new Error('You do not own this product.');
  const currency=String(b.currency||product.fields.currency||'INR').toUpperCase(), amount=Number(b.amount); if(!amountOk(amount)||!/^[A-Z]{3}$/.test(currency))throw new Error('Invalid price.');
  const priceId=crypto.randomUUID(); const price={id:priceId,productId:String(b.productId),amount,currency,billingType:b.billingType==='recurring'?'recurring':'one_time',interval:b.interval,intervalCount:Math.max(1,Math.min(12,Number(b.intervalCount||1))),trialDays:Math.max(0,Math.min(365,Number(b.trialDays||0))),active:Boolean(b.active!==false),createdAt:nowIso(),updatedAt:nowIso()};
  await fsCommit(token,[{create:{name:`${firestoreBase()}/commercePrices/${priceId}`,fields:fields(price)}},{update:{name:`${firestoreBase()}/commerceProducts/${price.productId}`,fields:fields({priceIds:[...(Array.isArray(product.fields.priceIds)?product.fields.priceIds:[]),priceId],updatedAt:nowIso()})}}]); return {price};
}

async function createCheckout(token:string,uid:string,b:any){
  const product=await fsGet(token,`commerceProducts/${String(b.productId||'')}`); const price=await fsGet(token,`commercePrices/${String(b.priceId||'')}`); if(!product||!price)throw new Error('Product or price not found.'); if(product.fields.status!=='active')throw new Error('Product is not available.'); if(price.fields.productId!==product.name.split('/').pop())throw new Error('Price does not belong to product.'); if(String(price.fields.currency||'').toUpperCase()!==String(product.fields.currency||'').toUpperCase())throw new Error('Price currency does not match product currency.'); if(price.fields.active!==true)throw new Error('Price is inactive.'); if(!amountOk(Number(price.fields.amount)))throw new Error('Invalid price.');
  const key=String(b.idempotencyKey||'').trim(); if(key.length<8||key.length>200)throw new Error('Valid idempotencyKey is required.'); const idem=idempotencyId(uid,key); const idemName=`commerceIdempotency/${idem}`; const idemDoc=await fsGet(token,idemName); if(idemDoc) {const orderId=String(idemDoc.fields.orderId||''); const paymentId=String(idemDoc.fields.paymentId||''); const order=orderId?await fsGet(token,`commerceOrders/${orderId}`):null; const payment=paymentId?await fsGet(token,`commercePayments/${paymentId}`):null; if(order&&payment)return {order:{id:orderId,...order.fields},payment:{id:paymentId,...payment.fields},entitlement:undefined};}
  const orderId=crypto.randomUUID(),paymentId=crypto.randomUUID(); const title=String(product.fields.title||'Untitled'); const item={productId:product.name.split('/').pop(),priceId:price.name.split('/').pop(),quantity:1,unitAmount:Number(price.fields.amount),lineTotal:Number(price.fields.amount),title,type:String(product.fields.type||'digital_product')};
  const order={customerId:uid,creatorId:String(product.fields.creatorId||''),items:[item],subtotal:Number(price.fields.amount),discount:0,tax:0,fees:0,total:Number(price.fields.amount),currency:String(price.fields.currency||product.fields.currency||'INR'),status:'pending_payment',createdAt:nowIso(),updatedAt:nowIso(),metadata:{testMode:testMode()}};
  const payment={orderId,customerId:uid,amount:Number(order.total),currency:order.currency,status:'pending',provider:testMode()?'offscript_test':'unconfigured',testMode:testMode(),createdAt:nowIso(),updatedAt:nowIso()};
  await fsCommit(token,[{create:{name:`${firestoreBase()}/commerceOrders/${orderId}`,fields:fields(order)}},{create:{name:`${firestoreBase()}/commercePayments/${paymentId}`,fields:fields(payment)}},{create:{name:`${firestoreBase()}/${idemName}`,fields:fields({userId:uid,orderId,paymentId,createdAt:nowIso()})}}]);
  return {order:{id:orderId,...order},payment:{id:paymentId,...payment}};
}

async function confirmTestPayment(token:string,uid:string,b:any){
  if(!testMode())throw new Error('Test payment mode is disabled. Configure a real payment provider before using production payments.');
  const orderId=String(b.orderId||''),paymentId=String(b.paymentId||''); const orderSnap=await fsGet(token,`commerceOrders/${orderId}`),paymentSnap=await fsGet(token,`commercePayments/${paymentId}`); if(!orderSnap||!paymentSnap)throw new Error('Order or payment not found.'); if(orderSnap.fields.customerId!==uid||paymentSnap.fields.customerId!==uid)throw new Error('Order ownership check failed.'); if(paymentSnap.fields.orderId!==orderId)throw new Error('Payment does not match order.'); if(orderSnap.fields.status==='paid'){const eid=Array.isArray(orderSnap.fields.entitlementIds)?orderSnap.fields.entitlementIds[0]:''; const ent=eid?await fsGet(token,`entitlements/${eid}`):null; return {order:{id:orderId,...orderSnap.fields},payment:{id:paymentId,...paymentSnap.fields},entitlement:ent?{id:eid,...ent.fields}:undefined};}
  const key=String(b.idempotencyKey||'').trim(); if(key.length<8||key.length>200)throw new Error('Valid idempotencyKey is required.'); const eventId=idempotencyId(uid,`confirm:${key}`),event=await fsGet(token,`commerceWebhookEvents/${eventId}`); if(event){const entId=String(event.fields.entitlementId||''); const ent=entId?await fsGet(token,`entitlements/${entId}`):null; return {order:{id:orderId,...orderSnap.fields},payment:{id:paymentId,...paymentSnap.fields},entitlement:ent?{id:entId,...ent.fields}:undefined};}
  const item=Array.isArray(orderSnap.fields.items)?orderSnap.fields.items[0]:null; if(!item?.productId)throw new Error('Order item is invalid.');
  const entitlementId=crypto.randomUUID(),ledgerId=crypto.randomUUID(); const entitlement={userId:uid,sourceType:'purchase',sourceId:orderId,resourceType:'product',resourceId:String(item.productId),status:'active',grantedAt:nowIso(),startsAt:nowIso(),orderId}; const gross=Number(orderSnap.fields.total||0); const revenue={creatorId:String(orderSnap.fields.creatorId||''),orderId,transactionId:paymentId,gross,discounts:Number(orderSnap.fields.discount||0),tax:Number(orderSnap.fields.tax||0),paymentFees:Number(orderSnap.fields.fees||0),platformFee:0,refundAmount:0,netCreatorAmount:gross,type:'sale',status:'posted',currency:String(orderSnap.fields.currency||'INR'),createdAt:nowIso()};
  const audit={actorId:uid,actorType:'customer',targetType:'order',targetId:orderId,event:'paymentPaid',timestamp:nowIso(),metadata:{testMode:true}};
  await fsCommit(token,[{update:{name:`${firestoreBase()}/commercePayments/${paymentId}`,fields:fields({status:'paid',paidAt:nowIso(),updatedAt:nowIso()})}},{update:{name:`${firestoreBase()}/commerceOrders/${orderId}`,fields:fields({status:'paid',paymentId,entitlementIds:[entitlementId],paidAt:nowIso(),updatedAt:nowIso()})}},{create:{name:`${firestoreBase()}/entitlements/${entitlementId}`,fields:fields(entitlement)}},{create:{name:`${firestoreBase()}/creatorRevenue/${ledgerId}`,fields:fields(revenue)}},{create:{name:`${firestoreBase()}/commerceWebhookEvents/${eventId}`,fields:fields({event:'test.payment.succeeded',orderId,paymentId,entitlementId,createdAt:nowIso()})}},{create:{name:`${firestoreBase()}/commerceAuditLogs/${crypto.randomUUID()}`,fields:fields(audit)}},{create:{name:`${firestoreBase()}/users/${uid}/notifications/commerce_${crypto.randomUUID()}`,fields:fields({type:'commerce_purchase',actorId:uid,actorUsername:String((await fsGet(token,`users/${uid}`))?.fields?.username||''),actorName:'OFFSCRPT Commerce',actorAvatar:'',message:'Your test purchase was completed.',targetType:'commerce_order',targetId:orderId,read:false,createdAt:nowIso()})}}]);
  return {order:{id:orderId,status:'paid',customerId:uid,creatorId:orderSnap.fields.creatorId,items:orderSnap.fields.items,subtotal:orderSnap.fields.subtotal,discount:orderSnap.fields.discount,tax:orderSnap.fields.tax,fees:orderSnap.fields.fees,total:orderSnap.fields.total,currency:orderSnap.fields.currency,paymentId,entitlementIds:[entitlementId],paidAt:nowIso(),createdAt:orderSnap.fields.createdAt},payment:{id:paymentId,status:'paid',orderId,customerId:uid,amount:paymentSnap.fields.amount,currency:paymentSnap.fields.currency,testMode:true,provider:'offscript_test',paidAt:nowIso()},entitlement:{id:entitlementId,...entitlement}};
}

async function refundTest(token:string,uid:string,b:any){
  if(!testMode())throw new Error('Refund test mode is disabled. Configure a payment provider before production refunds.'); const orderId=String(b.orderId||''); const order=await fsGet(token,`commerceOrders/${orderId}`); if(!order||order.fields.customerId!==uid)throw new Error('Order not found.'); if(order.fields.status!=='paid'&&order.fields.status!=='partially_refunded')throw new Error('Only paid orders can be refunded.'); const key=String(b.idempotencyKey||'').trim(); if(key.length<8||key.length>200)throw new Error('Valid idempotencyKey is required.'); const eventId=idempotencyId(uid,`refund:${key}`),existingEvent=await fsGet(token,`commerceIdempotency/${eventId}`); if(existingEvent){return {refundId:String(existingEvent.fields.refundId||''),status:'completed',orderStatus:'refunded',entitlementStatus:'refunded'};} const eid=Array.isArray(order.fields.entitlementIds)?String(order.fields.entitlementIds[0]||''):''; const refundId=crypto.randomUUID(),ledgerId=crypto.randomUUID(); const ent=eid?await fsGet(token,`entitlements/${eid}`):null; const writes:any[]=[{create:{name:`${firestoreBase()}/commerceRefunds/${refundId}`,fields:fields({orderId,customerId:uid,amount:Number(order.fields.total||0),currency:order.fields.currency,status:'completed',reason:String(b.reason||'Customer requested refund').slice(0,500),createdAt:nowIso(),completedAt:nowIso()})}},{update:{name:`${firestoreBase()}/commerceOrders/${orderId}`,fields:fields({status:'refunded',refundedAt:nowIso(),updatedAt:nowIso()})}},{update:{name:`${firestoreBase()}/commercePayments/${String(order.fields.paymentId||'')}`,fields:fields({status:'refunded',refundedAt:nowIso(),updatedAt:nowIso()})}},{create:{name:`${firestoreBase()}/creatorRevenue/${ledgerId}`,fields:fields({creatorId:String(order.fields.creatorId||''),orderId,transactionId:refundId,gross:0,discounts:0,tax:0,paymentFees:0,platformFee:0,refundAmount:Number(order.fields.total||0),netCreatorAmount:-Number(order.fields.total||0),type:'refund',status:'posted',currency:String(order.fields.currency||'INR'),createdAt:nowIso()})}},{create:{name:`${firestoreBase()}/commerceAuditLogs/${crypto.randomUUID()}`,fields:fields({actorId:uid,actorType:'customer',targetType:'order',targetId:orderId,event:'refundCompleted',timestamp:nowIso(),metadata:{refundId}})}},{create:{name:`${firestoreBase()}/commerceIdempotency/${eventId}`,fields:fields({userId:uid,orderId,refundId,createdAt:nowIso()})}},{create:{name:`${firestoreBase()}/users/${uid}/notifications/commerce_${crypto.randomUUID()}`,fields:fields({type:'commerce_refund',actorId:uid,actorUsername:'',actorName:'OFFSCRPT Commerce',actorAvatar:'',message:'Your test refund was completed.',targetType:'commerce_order',targetId:orderId,read:false,createdAt:nowIso()})}}]; if(ent){writes.push({update:{name:`${firestoreBase()}/entitlements/${eid}`,fields:fields({status:'refunded',revokedAt:nowIso()})}});} await fsCommit(token,writes); return {refundId,status:'completed',orderStatus:'refunded',entitlementStatus:ent?'refunded':undefined};
}


function fsFilter(fieldPath:string, op:string, v:any){
  return {field:{fieldPath},op,value:v};
}

function decodeCursor(raw:string|undefined): {id:string;sortKey:string}|null {
  if(!raw) return null;
  try { const parsed=JSON.parse(Buffer.from(raw,'base64url').toString('utf8')); if(!parsed || typeof parsed.id!=='string') return null; return {id:parsed.id,sortKey:String(parsed.sortKey??'')}; } catch { return null; }
}
function encodeCursor(id:string,sortKey:string){ return Buffer.from(JSON.stringify({id,sortKey}),'utf8').toString('base64url'); }

async function fsRunQueryAdvanced(token:string, from:string, filters:any[] = [], options:{limit?:number;orderBy?:Array<{fieldPath:string;direction:'ASCENDING'|'DESCENDING'}>}={}){
  const filterParts=filters.map((x:any)=>({fieldFilter:{field:x.field,op:x.op,value:x.value}}));
  const where=filterParts.length===1?filterParts[0]:filterParts.length>1?{compositeFilter:{op:'AND',filters:filterParts}}:undefined;
  const structured:any={from:[{collectionId:from}]};
  if(where) structured.where=where;
  if(options.orderBy?.length) structured.orderBy=options.orderBy.map(x=>({field:{fieldPath:x.fieldPath},direction:x.direction}));
  structured.limit=Math.max(1,Math.min(300,Number(options.limit||50)));
  const r=await fetch(`${firestoreBase()}:runQuery`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({structuredQuery:structured})});
  if(!r.ok){const text=await r.text();throw new Error(`Firestore query failed: ${r.status} ${text.slice(0,500)}`);}
  const rows:any[]=await r.json();
  return rows.filter(x=>x.document).map(x=>({name:x.document.name,fields:decodeFields(x.document.fields)}));
}

function publicProductProjection(p:any){
  return {
    id:String(p.id||''),creatorId:String(p.creatorId||''),creatorUsername:String(p.creatorUsername||''),creatorDisplayName:String(p.creatorDisplayName||''),
    title:String(p.title||''),subtitle:String(p.subtitle||''),description:String(p.description||''),type:String(p.type||'digital_product'),subtype:String(p.subtype||''),
    status:'active',visibility:'public',featured:Boolean(p.featured),currency:String(p.currency||'INR'),priceIds:Array.isArray(p.priceIds)?p.priceIds.map(String):[],
    version:Number(p.version||1),thumbnail:String(p.thumbnail||''),gallery:Array.isArray(p.gallery)?p.gallery.map(String).slice(0,12):[],
    category:String(p.category||''),subcategory:String(p.subcategory||''),tags:Array.isArray(p.tags)?p.tags.map(String).slice(0,30):[],
    license:String(p.license||''),usageRestrictions:String(p.usageRestrictions||''),requirements:String(p.requirements||''),whatIsIncluded:String(p.whatIsIncluded||''),
    createdAt:p.createdAt,updatedAt:p.updatedAt,publishedAt:p.publishedAt,
    viewsCount:Number(p.viewsCount||0),saveCount:Number(p.saveCount||0),purchaseCount:Number(p.purchaseCount||0)
  };
}

function marketplaceRelevance(p:any,query:string){
  const q=String(query||'').toLowerCase().trim(); if(!q) return 0;
  const terms=q.split(/\s+/).filter(Boolean); const fields=[['title',String(p.title||'')],['subtitle',String(p.subtitle||'')],['category',String(p.category||'')],['subcategory',String(p.subcategory||'')],['tags',(Array.isArray(p.tags)?p.tags:[]).join(' ')],['creator',`${p.creatorUsername||''} ${p.creatorDisplayName||''}`],['description',String(p.description||'')]];
  let score=0; for(const term of terms){ for(const [name,value] of fields){const hay=value.toLowerCase(); if(!hay.includes(term)) continue; score += name==='title'?12:name==='subtitle'?8:name==='category'||name==='subcategory'?7:name==='tags'?6:name==='creator'?5:2; if(hay===term) score+=4; }}
  if(String(p.title||'').toLowerCase()===q) score+=20; return score;
}
function marketplaceTrendScore(p:any){
  const views=Number(p.viewsCount||0), saves=Number(p.saveCount||0), purchases=Number(p.purchaseCount||0);
  const published=Date.parse(String(p.publishedAt||p.updatedAt||'')); const ageDays=published>0?Math.max(0,(Date.now()-published)/86400000):365;
  const recency=Math.max(0,14-ageDays);
  return views*0.01+saves*2+purchases*6+recency;
}

async function loadPublicMarketplaceProducts(token:string, filters:any = {}){
  const category=String(filters.category||'').trim(); const subcategory=String(filters.subcategory||'').trim(); const type=String(filters.type||'').trim(); const creatorId=String(filters.creatorId||'').trim();
  const queryFilters=[fsFilter('status','EQUAL',{stringValue:'active'}),fsFilter('visibility','EQUAL',{stringValue:'public'})];
  if(creatorId) queryFilters.push(fsFilter('creatorId','EQUAL',{stringValue:creatorId}));
  const rows=await fsRunQueryAdvanced(token,'commerceProducts',queryFilters,{orderBy:[{fieldPath:'publishedAt',direction:'DESCENDING'}],limit:250});
  let products=rows.map(x=>publicProductProjection({id:x.name.split('/').pop(),...x.fields}));
  if(category) products=products.filter(p=>String(p.category||'').toLowerCase()===category.toLowerCase());
  if(subcategory) products=products.filter(p=>String(p.subcategory||'').toLowerCase()===subcategory.toLowerCase());
  if(type) products=products.filter(p=>String(p.type||'').toLowerCase()===type.toLowerCase());
  return products;
}

async function loadPublicPricesForProducts(token:string, products:any[]){
  const ids=Array.from(new Set(products.map(p=>String(p.id||'')).filter(Boolean))); const map:any={};
  for(let i=0;i<ids.length;i+=30){
    const chunk=ids.slice(i,i+30); if(!chunk.length) continue;
    try{
      const rows=await fsRunQueryAdvanced(token,'commercePrices',[fsFilter('productId','IN',{arrayValue:{values:chunk.map(id=>({stringValue:id}))}})],{limit:250});
      rows.forEach(x=>{const price={id:x.name.split('/').pop(),...x.fields}; if(price.active===true){const pid=String(price.productId||''); const amt=Number(price.amount||0); if(pid && (!map[pid]||amt<Number(map[pid].amount||0))) map[pid]={id:String(price.id||''),productId:pid,amount:amt,currency:String(price.currency||'INR'),billingType:price.billingType==='recurring'?'recurring':'one_time',active:true,validFrom:price.validFrom,validUntil:price.validUntil,createdAt:price.createdAt,updatedAt:price.updatedAt}; }});
    }catch(error){ console.warn('Marketplace price batch failed:',error); }
  }
  return map;
}

async function marketplaceList(token:string, params:any){
  const q=String(params.q||'').trim().slice(0,100); const sort=String(params.sort||'newest'); const limitCount=Math.max(6,Math.min(24,Number(params.limit||24)));
  let products=await loadPublicMarketplaceProducts(token,params);
  const prices=await loadPublicPricesForProducts(token,products);
  if(q){const queryText=q.toLowerCase(); products=products.map(p=>({...p,__score:marketplaceRelevance(p,queryText)})).filter(p=>p.__score>0);}
  const priceAmount=(p:any)=>Number(prices[p.id]?.amount||0);
  products.sort((a:any,b:any)=>{
    if(sort==='relevance') return Number(b.__score||0)-Number(a.__score||0) || String(b.publishedAt||b.updatedAt||'').localeCompare(String(a.publishedAt||a.updatedAt||'')) || String(a.id).localeCompare(String(b.id));
    if(sort==='popular') return marketplaceTrendScore(b)-marketplaceTrendScore(a) || String(b.publishedAt||b.updatedAt||'').localeCompare(String(a.publishedAt||a.updatedAt||'')) || String(a.id).localeCompare(String(b.id));
    if(sort==='price_asc') return priceAmount(a)-priceAmount(b) || String(a.id).localeCompare(String(b.id));
    if(sort==='price_desc') return priceAmount(b)-priceAmount(a) || String(a.id).localeCompare(String(b.id));
    return String(b.publishedAt||b.updatedAt||'').localeCompare(String(a.publishedAt||a.updatedAt||'')) || String(a.id).localeCompare(String(b.id));
  });
  products=products.map(({__score,...p}:any)=>p);
  const cursor=decodeCursor(typeof params.cursor==='string'?params.cursor:undefined);
  let startIndex=0;
  if(cursor){const idx=products.findIndex((p:any)=>String(p.id)===cursor.id); startIndex=idx>=0?idx+1:0;}
  const page=products.slice(startIndex,startIndex+limitCount); const next= startIndex+limitCount<products.length && page.length ? encodeCursor(String(page[page.length-1].id), String(sort==='price_asc'||sort==='price_desc'?priceAmount(page[page.length-1]):sort==='popular'?marketplaceTrendScore(page[page.length-1]):page[page.length-1].publishedAt||page[page.length-1].updatedAt||'')) : undefined;
  return {generatedAt:nowIso(),products:page,prices,hasMore:Boolean(next),nextCursor:next,total:products.length};
}

async function marketplaceHome(token:string){
  const products=await loadPublicMarketplaceProducts(token,{}); const prices=await loadPublicPricesForProducts(token,products);
  const featured=products.filter(p=>p.featured).slice(0,8);
  const newest=[...products].sort((a,b)=>String(b.publishedAt||b.updatedAt||'').localeCompare(String(a.publishedAt||a.updatedAt||''))).slice(0,8);
  const trending=[...products].sort((a,b)=>marketplaceTrendScore(b)-marketplaceTrendScore(a)||String(b.publishedAt||'').localeCompare(String(a.publishedAt||''))).slice(0,8);
  const creatorsMap=new Map<string,any>(); for(const p of products){if(!p.creatorId)continue; const row=creatorsMap.get(p.creatorId)||{id:p.creatorId,username:p.creatorUsername,displayName:p.creatorDisplayName,productCount:0,cover:p.thumbnail||p.gallery?.[0]||''}; row.productCount++; if(!row.cover)row.cover=p.thumbnail||p.gallery?.[0]||''; creatorsMap.set(p.creatorId,row);}
  const creators=[...creatorsMap.values()].sort((a,b)=>b.productCount-a.productCount||String(a.username||'').localeCompare(String(b.username||''))).slice(0,50);
  return {generatedAt:nowIso(),featured,trending,newest,creators,prices};
}

async function marketplaceByIds(token:string, rawIds:string){
  const ids=Array.from(new Set(String(rawIds||'').split(',').map(s=>s.trim()).filter(Boolean))).slice(0,100);
  const all:any[]=[];
  for(let i=0;i<ids.length;i+=30){
    const chunk=ids.slice(i,i+30); if(!chunk.length)continue;
    try{const rows=await fsRunQueryAdvanced(token,'commerceProducts',[fsFilter('status','EQUAL',{stringValue:'active'}),fsFilter('visibility','EQUAL',{stringValue:'public'}),fsFilter('__name__','IN',{arrayValue:{values:chunk.map(id=>({referenceValue:`projects/${projectId()}/databases/(default)/documents/commerceProducts/${id}`}))}})],{limit:30}); all.push(...rows.map(x=>publicProductProjection({id:x.name.split('/').pop(),...x.fields})));}
    catch{for(const id of chunk){const row=await fsGet(token,`commerceProducts/${id}`); if(row?.fields?.status==='active'&&row?.fields?.visibility==='public')all.push(publicProductProjection({id,...row.fields}));}}
  }
  const priceMap=await loadPublicPricesForProducts(token,all); return {generatedAt:nowIso(),products:all,prices:priceMap};
}

async function listPublicProducts(token:string,creatorId?:string){
  const id=String(creatorId||'').trim();
  const products=await loadPublicMarketplaceProducts(token,{creatorId:id});
  products.sort((a:any,b:any)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||String(b.updatedAt||b.publishedAt||'').localeCompare(String(a.updatedAt||a.publishedAt||'')));
  return {generatedAt:nowIso(),products:products.slice(0,100)};
}

async function listPublicPrices(token:string,productId:string){
  const id=String(productId||'').trim(); if(!id) return {generatedAt:nowIso(),prices:[]};
  const product=await fsGet(token,`commerceProducts/${id}`);
  if(!product || product.fields.status!=='active' || product.fields.visibility!=='public') return {generatedAt:nowIso(),prices:[]};
  const rows=await fsRunQuery(token,'commercePrices',[{field:{fieldPath:'productId'},op:'EQUAL',value:{stringValue:id}}]);
  const prices=rows.map(x=>({id:x.name.split('/').pop(),...x.fields})).filter((p:any)=>p.active===true).map((p:any)=>({
    id:String(p.id||''),productId:id,amount:Number(p.amount||0),currency:String(p.currency||product.fields.currency||'INR'),billingType:p.billingType==='recurring'?'recurring':'one_time',interval:p.interval,intervalCount:p.intervalCount?Number(p.intervalCount):undefined,trialDays:p.trialDays?Number(p.trialDays):undefined,active:true,validFrom:p.validFrom,validUntil:p.validUntil,createdAt:p.createdAt,updatedAt:p.updatedAt
  })).sort((a:any,b:any)=>a.amount-b.amount);
  return {generatedAt:nowIso(),prices:prices.slice(0,50)};
}

async function commerceDiagnostics(token:string,uid:string,email?:string,emailVerified?:boolean){
  if(!(await verifyCommerceAdmin(token,uid,email,emailVerified))) { const error:any=new Error('Administrator access required.'); error.statusCode=403; throw error; }
  const names=['commerceProducts','commercePrices','commerceOrders','commercePayments','commerceRefunds','entitlements','creatorRevenue','creatorPayouts','commerceAuditLogs','commerceWebhookEvents'];
  const entries=await Promise.all(names.map(async name=>{try{return [name,await fsCount(token,name),null] as const;}catch(error:any){return [name,null,String(error?.message||'Count failed')] as const;}}));
  return {generatedAt:nowIso(),counts:Object.fromEntries(entries.map(([name,count])=>[name,count??0])),errors:Object.fromEntries(entries.filter(([,count,error])=>count===null).map(([name,,error])=>[name,error]))};
}

async function setProductVisibility(token:string,uid:string,b:any){
  const productId=String(b.productId||''); const visibility=String(b.visibility||'');
  if(!['public','private','unlisted'].includes(visibility)) throw new Error('Invalid product visibility.');
  const product=await fsGet(token,`commerceProducts/${productId}`); if(!product) throw new Error('Product not found.');
  if(product.fields.creatorId!==uid) throw new Error('You do not own this product.');
  const stamp=nowIso();
  await fsPatch(token,`commerceProducts/${productId}`,{visibility,updatedAt:stamp});
  return {product:{id:productId,...product.fields,visibility,updatedAt:stamp}};
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  const action=String(req.query.action||'').trim();
  if(req.method==='GET' && action==='marketplace'){
    try{ const token=await serviceToken(); const out=await marketplaceList(token,req.query||{}); return res.status(200).json(out); }
    catch(e:any){ return res.status(500).json({error:e?.message||'Unable to load marketplace.'}); }
  }
  if(req.method==='GET' && action==='marketplaceHome'){
    try{ const token=await serviceToken(); const out=await marketplaceHome(token); return res.status(200).json(out); }
    catch(e:any){ return res.status(500).json({error:e?.message||'Unable to load marketplace home.'}); }
  }
  if(req.method==='GET' && action==='marketplaceByIds'){
    try{ const token=await serviceToken(); const ids=typeof req.query.ids==='string'?req.query.ids:''; const out=await marketplaceByIds(token,ids); return res.status(200).json(out); }
    catch(e:any){ return res.status(500).json({error:e?.message||'Unable to load saved products.'}); }
  }
  if(req.method==='GET' && action==='listPublicPrices'){
    try{ const token=await serviceToken(); const productId=typeof req.query.productId==='string'?req.query.productId:''; const out=await listPublicPrices(token,productId); return res.status(200).json(out); }
    catch(e:any){ return res.status(500).json({error:e?.message||'Unable to load public prices.'}); }
  }
  if(req.method==='GET' && action==='listPublicProducts'){
    try{ const token=await serviceToken(); const creatorId=typeof req.query.creatorId==='string'?req.query.creatorId:undefined; const out=await listPublicProducts(token,creatorId); return res.status(200).json(out); }
    catch(e:any){ return res.status(500).json({error:e?.message||'Unable to load public products.'}); }
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{const identity=await verifyFirebaseToken(authHeader(req)), uid=identity.uid, token=await serviceToken(); const body:any=req.body||{}; let out:any; if(action==='createProduct')out=await createProduct(token,uid,body); else if(action==='createPrice')out=await createPrice(token,uid,body); else if(action==='setProductStatus')out=await setProductStatus(token,uid,body); else if(action==='setProductVisibility')out=await setProductVisibility(token,uid,body); else if(action==='createCheckout')out=await createCheckout(token,uid,body); else if(action==='confirmTestPayment')out=await confirmTestPayment(token,uid,body); else if(action==='refundTestPayment')out=await refundTest(token,uid,body); else if(action==='checkAccess')out=await checkAccess(token,uid,body); else if(action==='diagnostics')out=await commerceDiagnostics(token,uid,identity.email,identity.emailVerified); else return res.status(400).json({error:'Unknown commerce action.'}); return res.status(200).json(out);}catch(e:any){const status=Number(e?.statusCode); return res.status(status>=400&&status<=599?status:400).json({error:e?.message||'Commerce request failed.'});}
}
