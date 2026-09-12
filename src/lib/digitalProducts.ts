import { auth } from './firebase';

export type DigitalProductSubtype =
  | 'pdf'|'ebook'|'template'|'spreadsheet'|'presentation'|'document'|'zip'
  | 'research_pack'|'dataset'|'prompt_pack'|'design_assets'|'audio'|'video'
  | 'guide'|'checklist'|'worksheet'|'resource_pack'|'other';

export type DigitalProductVisibility = 'public'|'unlisted'|'private';

export interface DigitalProduct {
  id:string; creatorId:string; creatorUsername?:string; creatorDisplayName?:string;
  title:string; subtitle?:string; description:string; type:'digital_product'; subtype:DigitalProductSubtype;
  status:'draft'|'pending_review'|'published'|'rejected'|'archived'|'suspended';
  visibility:DigitalProductVisibility; category:string; subcategory?:string; tags:string[];
  thumbnail?:string; gallery?:string[]; preview?:unknown; version:number;
  currentVersionId?:string; currentVersionNumber?:number;
  license?:string; usageRestrictions?:string; requirements?:string; whatIsIncluded?:string;
  fileCount?:number; totalSizeBytes?:number; priceIds:string[];
  createdAt?:string; updatedAt?:string; publishedAt?:string; archivedAt?:string;
}

export interface DigitalProductVersion {
  id:string; productId:string; creatorId:string; versionNumber:number; versionLabel:string;
  changelog:string; status:'draft'|'processing'|'published'|'archived';
  fileIds:string[]; fileCount:number; totalSizeBytes:number; createdAt?:string; updatedAt?:string;
}

export interface DigitalProductFile {
  id:string; productId:string; versionId:string; creatorId:string; originalFilename:string;
  safeFilename:string; mimeType:string; sizeBytes:number; checksum?:string; checksumSource?:string;
  role:'preview'|'cover'|'product_file'|'documentation'; status:'pending'|'processing'|'ready'|'failed'|'rejected'|'deleted';
  objectKey:string; createdAt?:string; updatedAt?:string;
}

const endpoint='/api/digital-products';
async function token(){const user=auth.currentUser;if(!user)throw new Error('Sign in required.');return user.getIdToken();}
async function api<T>(action:string, body:Record<string,unknown>={}):Promise<T>{
  const idToken=await token();
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${idToken}`},body:JSON.stringify({action,...body})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(String((payload as any)?.error||`Digital product request failed (${response.status}).`));
  return payload as T;
}

export async function createDigitalProduct(input:{
  title:string; subtitle?:string; description:string; subtype:DigitalProductSubtype;
  category:string; subcategory?:string; tags:string[]; license:string; usageRestrictions?:string;
  requirements?:string; whatIsIncluded?:string; currency:string; amount:number;
  visibility:DigitalProductVisibility; thumbnail?:string; gallery?:string[];
}){
  return api<{product:DigitalProduct;price:any;version:DigitalProductVersion}>('createProduct',input);
}
export async function updateDigitalProduct(input:Record<string,unknown> & {productId:string;expectedUpdatedAt?:string}){
  return api<{product:DigitalProduct}>('updateProduct',input);
}
export async function createDigitalProductVersion(productId:string, versionLabel:string, changelog:string){
  return api<{version:DigitalProductVersion}>('createVersion',{productId,versionLabel,changelog});
}
export async function requestDigitalProductUpload(input:{productId:string;versionId:string;fileName:string;contentType:string;size:number;role:DigitalProductFile['role']}){
  return api<{uploadUrl:string;file:DigitalProductFile;expiresIn:number;limits:any}>('requestUpload',input);
}
export async function uploadDigitalProductFile(
  input:{productId:string;versionId:string;file:File;role:DigitalProductFile['role'];onProgress?:(progress:number)=>void}
){
  const request=await requestDigitalProductUpload({productId:input.productId,versionId:input.versionId,fileName:input.file.name,contentType:input.file.type||'application/octet-stream',size:input.file.size,role:input.role});
  input.onProgress?.(10);
  const response=await fetch(request.uploadUrl,{method:'PUT',headers:{'content-type':input.file.type||'application/octet-stream'},body:input.file});
  if(!response.ok) throw new Error(`Upload failed (${response.status}).`);
  input.onProgress?.(85);
  const digest=await crypto.subtle.digest('SHA-256',await input.file.arrayBuffer());
  const checksum=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const result=await api<{file:DigitalProductFile}>('completeUpload',{
    productId:input.productId,versionId:input.versionId,fileId:request.file.id,objectKey:request.file.objectKey,
    fileName:input.file.name,contentType:input.file.type||'application/octet-stream',size:input.file.size,role:input.role,checksum
  });
  input.onProgress?.(100);
  return result;
}
export async function listMyDigitalProducts(){
  return api<{products:DigitalProduct[];versions:DigitalProductVersion[];files:DigitalProductFile[]}>('listMine');
}
export async function publishDigitalProduct(productId:string){return api<{product:DigitalProduct}>('publishProduct',{productId});}
export async function publishDigitalProductVersion(productId:string,versionId:string){return api<{product:DigitalProduct;version:DigitalProductVersion}>('publishVersion',{productId,versionId});}
export async function archiveDigitalProduct(productId:string){return api<{product:DigitalProduct}>('archiveProduct',{productId});}
