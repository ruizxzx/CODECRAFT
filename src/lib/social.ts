import { db, auth, checkIsAdmin } from './firebase';
import { collection, collectionGroup, doc, getDoc, getDocs, query, orderBy, where, limit, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, onSnapshot, increment, runTransaction } from 'firebase/firestore';
import { CommunityUser } from '../types';

const id = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const date = (v:any) => v?.toDate ? v.toDate().toISOString() : (v || new Date().toISOString());
const map = (d:any) => ({ ...d.data(), id:d.id, createdAt:date(d.data().createdAt), updatedAt:date(d.data().updatedAt) });

async function profile(uid:string){ const s=await getDoc(doc(db,'users',uid)); return s.exists()?s.data() as CommunityUser:null; }
async function notify(uid:string, data:any){ if(!uid || uid===data.actorId) return; await setDoc(doc(db,'users',uid,'notifications',id()),{...data,read:false,createdAt:serverTimestamp()}); }

export interface SocialCommunity { id:string; name:string; slug:string; description:string; iconUrl?:string; bannerUrl?:string; rules?:string[]; membersCount:number; postsCount:number; ownerId:string; ownerUsername?:string; ownerName?:string; ownerAvatar?:string; createdAt:string; updatedAt?:string; isPrivate?:boolean; isArchived?:boolean; isLocked?:boolean; allowLinks?:boolean; allowMedia?:boolean; defaultPostType?:'discussion'|'question'|'link'|'poll'; }
export interface CommunityFeedPost { id:string; communityId?:string; parentPostId?:string; postType?:'blog'|'discussion'|'question'|'link'|'poll'|'announcement'; title:string; content:string; authorId:string; authorUsername:string; authorName:string; authorAvatar:string; authorPlatformRole?:'member'|'moderator'|'master_admin'; score:number; commentsCount:number; isFeatured?:boolean; isPinned?:boolean; isLocked?:boolean; isArchived?:boolean; flair?:string; dedupeKey?:string; linkUrl?:string; mediaUrls?:string[]; poll?:{question:string;options:string[];votes?:Record<string,number>}; createdAt:string; updatedAt?:string; editedAt?:string; }
export interface SocialQuestion { id:string; title:string; details:string; authorId:string; authorUsername:string; authorName:string; authorAvatar:string; topics:string[]; followersCount:number; answersCount:number; upvotesCount:number; bestAnswerId?:string; createdAt:string; updatedAt?:string; }
export interface SocialAnswer { id:string; questionId:string; content:string; authorId:string; authorUsername:string; authorName:string; authorAvatar:string; upvotesCount:number; downvotesCount:number; isBest:boolean; createdAt:string; updatedAt:string; }
export interface SocialTopic { id:string; name:string; slug:string; description:string; followersCount:number; createdAt:string; updatedAt?:string; createdBy?:string; creatorUsername?:string; }
export interface SocialMessage { id:string; senderId:string; senderUsername:string; senderName:string; senderAvatar:string; recipientId:string; content:string; read:boolean; createdAt:string; }
export interface SocialReport { id:string; reporterId:string; reporterUsername?:string; targetType:string; targetId:string; reason:string; status:string; createdAt:string; resolvedBy?:string; resolvedAt?:string; response?:string; }

export const isSocialAdmin = () => checkIsAdmin(auth.currentUser?.email);
const staffRole=(u:CommunityUser)=> (u.platformRole || (checkIsAdmin(auth.currentUser?.email)?'master_admin':u.role==='Moderator'?'moderator':'member')) as 'member'|'moderator'|'master_admin';
const dedupePosts=(items:CommunityFeedPost[])=>{ const seen=new Set<string>(); const sigs=new Set<string>(); return items.filter(p=>{ if(seen.has(p.id)) return false; seen.add(p.id); const sig=`${p.authorId}|${p.title.trim().toLowerCase()}|${p.content.trim()}|${Math.floor(new Date(p.createdAt||0).getTime()/60000)}`; if(sigs.has(sig)) return false; sigs.add(sig); return true; }); };


const stripUndefined=(value:any):any=>Array.isArray(value)?value.filter((v:any)=>v!==undefined).map(stripUndefined):(value&&typeof value==='object'&&!(value instanceof Date)&&!('_methodName' in value)&&!String(value.constructor?.name||'').includes('FieldValue')?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,stripUndefined(v)])):value);
const hashText=(raw:string)=>{ let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(36); };
const communityDedupeKey=(data:{communityId:string;authorId:string;title:string;content:string;postType:string;parentPostId?:string})=> hashText(`${data.communityId}|${data.authorId}|${data.postType}|${data.parentPostId||''}|${data.title.trim().toLowerCase()}|${data.content.trim()}`);

export async function isPlatformModerator(uid?:string):Promise<boolean>{
  if(!uid) return false;
  if(isSocialAdmin()) return false;
  try { return (await getDoc(doc(db,'siteModerators',uid))).exists(); } catch { return false; }
}
export async function isStaffMember(uid?:string):Promise<boolean>{ return isSocialAdmin() || await isPlatformModerator(uid); }
export async function getPlatformModerators():Promise<Array<any>>{
  if(!isSocialAdmin()) throw new Error('Master admin access required.');
  const snap=await getDocs(collection(db,'siteModerators'));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
export async function addPlatformModerator(uid:string, username:string, displayName:string):Promise<void>{
  if(!isSocialAdmin()) throw new Error('Only a master admin can add moderators.');
  if(!uid) throw new Error('User is required.');
  await setDoc(doc(db,'siteModerators',uid),{uid,username,displayName,role:'moderator',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await updateDoc(doc(db,'users',uid),{role:'Moderator',platformRole:'moderator',updatedAt:serverTimestamp()});
}
export async function removePlatformModerator(uid:string):Promise<void>{
  if(!isSocialAdmin()) throw new Error('Only a master admin can remove moderators.');
  const p=await profile(uid);
  if((p as any)?.email && checkIsAdmin((p as any).email)) throw new Error('Master administrators cannot be removed.');
  await deleteDoc(doc(db,'siteModerators',uid));
  try { await updateDoc(doc(db,'users',uid),{role:'Member',platformRole:'member',updatedAt:serverTimestamp()}); } catch {}
}

export async function getCommunities():Promise<SocialCommunity[]> {
  let snap;
  try { snap=await getDocs(query(collection(db,'communities'),limit(200))); }
  catch { snap=await getDocs(collection(db,'communities')); }
  const raw=(snap.docs.map(map) as SocialCommunity[]);
  // Historical builds could create the same slug more than once. Do not delete
  // those records here; collapse them deterministically in the public UI.
  const unique = new Map<string, SocialCommunity>();
  for (const c of raw) {
    const key = (c.slug || c.id).toLowerCase();
    const prev = unique.get(key);
    if (!prev) unique.set(key,c);
    else {
      const prevScore = (prev.membersCount||0)*1000000 + (prev.postsCount||0)*1000 + new Date(prev.createdAt||0).getTime()/1e12;
      const currScore = (c.membersCount||0)*1000000 + (c.postsCount||0)*1000 + new Date(c.createdAt||0).getTime()/1e12;
      if (currScore > prevScore) unique.set(key,c);
    }
  }
  const items=Array.from(unique.values()).sort((a,b)=>(b.membersCount||0)-(a.membersCount||0) || (b.postsCount||0)-(a.postsCount||0));
  return Promise.all(items.map(async c=>{
    if(c.ownerUsername) return c;
    try { const p=await profile(c.ownerId); if(p) return {...c,ownerUsername:p.username,ownerName:p.displayName,ownerAvatar:p.photoURL||''}; } catch {}
    return c;
  }));
}

export async function getCommunity(communityId:string):Promise<SocialCommunity|null>{ const s=await getDoc(doc(db,'communities',communityId)); return s.exists()?map(s) as SocialCommunity:null; }

export async function createCommunity(user:CommunityUser,name:string,description:string,rules:string[]=[]):Promise<SocialCommunity>{
  const clean=name.trim().slice(0,60); if(!clean) throw new Error('Community name is required');
  const base=clean.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'community';
  let slug=base; let n=2;
  while(!(await getDocs(query(collection(db,'communities'),where('slug','==',slug),limit(1)))).empty) slug=`${base}-${n++}`;
  const cid=id();
  const data={name:clean,slug,description:description.trim().slice(0,1000),rules:rules.map(x=>x.trim()).filter(Boolean).slice(0,20),membersCount:1,postsCount:0,ownerId:user.uid,ownerUsername:user.username,ownerName:user.displayName,ownerAvatar:user.photoURL||'',isPrivate:false,isArchived:false,isLocked:false,allowLinks:true,allowMedia:true,defaultPostType:'discussion',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  const b=writeBatch(db); b.set(doc(db,'communities',cid),data); b.set(doc(db,'communities',cid,'members',user.uid),{uid:user.uid,username:user.username,role:'owner',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); await b.commit();
  return {...data,id:cid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as SocialCommunity;
}

export async function updateCommunity(communityId:string, userId:string, data:Partial<Pick<SocialCommunity,'name'|'description'|'iconUrl'|'bannerUrl'|'rules'|'isPrivate'|'isArchived'|'isLocked'|'allowLinks'|'allowMedia'|'defaultPostType'>>){
  if(!auth.currentUser) throw new Error('Sign in required.');
  const c=await getCommunity(communityId); if(!c) throw new Error('Community not found.');
  if(c.ownerId!==userId && !(isSocialAdmin() || await isPlatformModerator(userId))) throw new Error('Only the community creator or site staff can edit this community.');
  const payload:any={updatedAt:serverTimestamp()}; Object.entries(data).forEach(([k,v])=>{ if(v!==undefined) payload[k]=v; });
  await updateDoc(doc(db,'communities',communityId),payload);
}

export async function deleteCommunity(communityId:string,userId:string){
  const c=await getCommunity(communityId); if(!c) return;
  if(c.ownerId!==userId && !(isSocialAdmin() || await isPlatformModerator(userId))) throw new Error('Only the community creator or site staff can delete this community.');
  const chunk=async(refs:any[])=>{ for(let i=0;i<refs.length;i+=400){ const b=writeBatch(db); refs.slice(i,i+400).forEach((r:any)=>b.delete(r)); await b.commit(); } };
  const refs:any[]=[];
  const posts=await getDocs(collection(db,'communities',communityId,'posts'));
  // Remove known nested interaction documents as well as posts so deletion is
  // complete and cannot leave orphaned votes/poll votes/replies behind.
  for(const post of posts.docs){
    for(const sub of ['votes','pollVotes','comments','reposts','claps']){
      try { const snap=await getDocs(collection(db,'communities',communityId,'posts',post.id,sub)); snap.docs.forEach(d=>refs.push(d.ref)); } catch {}
    }
    refs.push(post.ref);
  }
  const members=await getDocs(collection(db,'communities',communityId,'members'));
  members.docs.forEach(d=>refs.push(d.ref));
  await chunk(refs);
  // Remove the community last so a partially-completed cleanup never points
  // users at a community whose parent was already gone.
  await deleteDoc(doc(db,'communities',communityId));
}

export async function getCommunityMembers(cid:string){ const s=await getDocs(collection(db,'communities',cid,'members')); return s.docs.map(d=>({id:d.id,...d.data()})) as Array<{id:string;uid:string;username:string;role:string;createdAt:any}>; }
export async function setCommunityMemberRole(cid:string,memberId:string,role:'member'|'moderator'|'owner',actorId:string){
  const c=await getCommunity(cid); if(!c) throw new Error('Community not found.');
  if(c.ownerId!==actorId && !(isSocialAdmin() || await isPlatformModerator(actorId))) throw new Error('Only the community creator or site staff can manage members.');
  if(role==='owner' && !isSocialAdmin()) throw new Error('Only a master admin can transfer community ownership.');
  const b=writeBatch(db);
  if(role==='owner') {
    b.update(doc(db,'communities',cid),{ownerId:memberId,updatedAt:serverTimestamp()});
    b.update(doc(db,'communities',cid,'members',c.ownerId),{role:'member',updatedAt:serverTimestamp()});
  }
  b.update(doc(db,'communities',cid,'members',memberId),{role,updatedAt:serverTimestamp()});
  await b.commit();
}
export async function removeCommunityMember(cid:string,memberId:string,actorId:string){
  const c=await getCommunity(cid); if(!c) throw new Error('Community not found.');
  if(c.ownerId!==actorId && !(isSocialAdmin() || await isPlatformModerator(actorId))) throw new Error('Only the community creator or site staff can manage members.');
  if(c.ownerId===memberId) throw new Error('Transfer ownership before removing the creator.');
  await deleteDoc(doc(db,'communities',cid,'members',memberId)); await updateDoc(doc(db,'communities',cid),{membersCount:increment(-1),updatedAt:serverTimestamp()});
}

export async function isCommunityMember(cid:string,uid:string){ return (await getDoc(doc(db,'communities',cid,'members',uid))).exists(); }
export async function joinCommunity(cid:string,user:CommunityUser){ const ref=doc(db,'communities',cid,'members',user.uid); if((await getDoc(ref)).exists()) return false; const b=writeBatch(db); b.set(ref,{uid:user.uid,username:user.username,role:'member',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); b.update(doc(db,'communities',cid),{membersCount:increment(1),updatedAt:serverTimestamp()}); await b.commit(); return true; }
export async function leaveCommunity(cid:string,uid:string){ const ref=doc(db,'communities',cid,'members',uid); if(!(await getDoc(ref)).exists()) return false; const c=await getDoc(doc(db,'communities',cid)); if(c.exists()&&c.data().ownerId===uid) throw new Error('Community owner cannot leave. Transfer ownership first.'); const b=writeBatch(db); b.delete(ref); b.update(doc(db,'communities',cid),{membersCount:increment(-1),updatedAt:serverTimestamp()}); await b.commit(); return true; }
export async function followCommunity(cid:string,user:CommunityUser){ return joinCommunity(cid,user); }
export async function getCommunityRole(cid:string,uid:string){ const s=await getDoc(doc(db,'communities',cid,'members',uid)); return s.exists()?(s.data()?.role||'member') as string:null; }
export async function recomputeCommunityCounters(cid:string){
  if(!(isSocialAdmin() || await isPlatformModerator(auth.currentUser?.uid))) return;
  const [members,posts]=await Promise.all([getDocs(collection(db,'communities',cid,'members')),getDocs(collection(db,'communities',cid,'posts'))]);
  const activePosts=posts.docs.filter(d=>!d.data().isArchived).length;
  await updateDoc(doc(db,'communities',cid),{membersCount:members.size,postsCount:activePosts,updatedAt:serverTimestamp()});
}


export async function getAllCommunityFeedPosts(): Promise<CommunityFeedPost[]> {
  try {
    const s = await getDocs(query(collectionGroup(db,'posts'), limit(500)));
    const items: CommunityFeedPost[] = [];
    for (const d of s.docs) {
      const path = d.ref.path.split('/');
      if (path.length !== 4 || path[0] !== 'communities' || path[2] !== 'posts') continue;
      const p:any = map(d);
      p.communityId = path[1];
      if (!p.isArchived) items.push(p as CommunityFeedPost);
    }
    return dedupePosts(items).sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime());
  } catch { return []; }
}

export function subscribeAllCommunityPosts(cb:(x:CommunityFeedPost[])=>void){
  const q = query(collectionGroup(db,'posts'), limit(500));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d=>{ const path=d.ref.path.split('/'); if(path.length!==4 || path[0]!=='communities' || path[2]!=='posts') return null; const p:any=map(d); p.communityId=path[1]; return p as CommunityFeedPost; }).filter(Boolean) as CommunityFeedPost[];
    cb(dedupePosts(items.filter(p=>!p.isArchived)).sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()));
  }, err => { console.warn('All-community realtime feed failed:', err); void getAllCommunityFeedPosts().then(cb); });
}

export async function getCommunityPosts(cid:string,sort:'new'|'hot'|'top'='new'){ const s=await getDocs(query(collection(db,'communities',cid,'posts'),limit(200))); const items=dedupePosts((s.docs.map(map) as CommunityFeedPost[]).filter(p=>!p.isArchived)); const rank=(a:CommunityFeedPost,b:CommunityFeedPost)=>{ if(!!b.isPinned!==!!a.isPinned) return b.isPinned?1:-1; if(sort==='top') return (b.score||0)-(a.score||0); if(sort==='hot') return ((b.score||0)*3 + new Date(b.createdAt||0).getTime()/86400000)-((a.score||0)*3 + new Date(a.createdAt||0).getTime()/86400000); return new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime(); }; return items.sort(rank); }
export function subscribeCommunityFeed(cid:string,cb:(x:CommunityFeedPost[])=>void){
  // Avoid an orderBy so a fresh project does not depend on an index. Sort the
  // cloud snapshot locally and keep a polling fallback if a listener is denied.
  let active=true; let pollTimer:ReturnType<typeof setInterval>|null=null;
  const load=async()=>{ try { const items=await getCommunityPosts(cid,'new'); if(active) cb(items); return true; } catch(err){ console.warn('Community feed fallback read failed:',err); if(active) cb([]); return false; } };
  const q=query(collection(db,'communities',cid,'posts'),limit(200));
  const unsub=onSnapshot(q,s=>{
    const items=dedupePosts((s.docs.map(map) as CommunityFeedPost[]).filter(p=>!p.isArchived));
    items.sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime());
    cb(items);
  },err=>{
    console.warn('Community feed realtime subscription failed:',err);
    void load();
    if(!pollTimer) pollTimer=setInterval(()=>void load(),15000);
  });
  return ()=>{ active=false; unsub(); if(pollTimer) clearInterval(pollTimer); };
}
export type CommunityPublishResult = CommunityFeedPost & { publishStatus: 'created' | 'existing' };

export async function createCommunityPost(cid:string,user:CommunityUser,title:string,content:string,options:{parentPostId?:string;postType?:'blog'|'discussion'|'question'|'link'|'poll'|'announcement';flair?:string;linkUrl?:string;mediaUrls?:string[];poll?:{question:string;options:string[]};contentBlocks?:any[];excerpt?:string;coverImage?:string;coverImageAlt?:string;coverImageCaption?:string;category?:string;tags?:string[];readingTimeMinutes?:number}={} ):Promise<CommunityPublishResult>{
  const c=await getCommunity(cid); if(!c) throw new Error('Community not found.');
  if(c.isArchived || c.isLocked) throw new Error('This community is not accepting new posts.');
  const memberRef=doc(db,'communities',cid,'members',user.uid);
  let memberSnap=await getDoc(memberRef);
  if(!memberSnap.exists()){
    if(c.ownerId===user.uid){
      await setDoc(memberRef,{uid:user.uid,username:user.username,role:'owner',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      memberSnap=await getDoc(memberRef);
    } else throw new Error('Join the community first.');
  }
  const postType=options.postType||c.defaultPostType||'discussion';
  const baseDedupeKey=communityDedupeKey({communityId:cid,authorId:user.uid,postType,title,content,parentPostId:options.parentPostId});
  const bucket=Math.floor(Date.now()/120000);
  const dedupeKey=`${baseDedupeKey}-${bucket}`;
  const existingSnap=await getDocs(query(collection(db,'communities',cid,'posts'),where('dedupeKey','==',dedupeKey),limit(5)));
  const existing=existingSnap.docs.find(d=>d.data()?.authorId===user.uid && !d.data()?.isArchived);
  if(existing) return Object.assign(map(existing) as CommunityFeedPost,{publishStatus:'existing' as const});
  const pid=`p_${hashText(`${dedupeKey}|${user.uid}`)}`;
  const cleanTitle=title.trim().slice(0,256); const cleanContent=content.trim().slice(0,100000);
  if(!cleanTitle || !cleanContent) throw new Error('Title and content are required.');
  if(options.parentPostId){ const parent=await getDoc(doc(db,'communities',cid,'posts',options.parentPostId)); if(!parent.exists()) throw new Error('Parent thread not found.'); if(parent.data()?.isLocked) throw new Error('This thread is locked.'); }
  const data:any={communityId:cid,parentPostId:options.parentPostId||'',postType,flair:options.flair?.trim().slice(0,30)||'',linkUrl:options.linkUrl?.trim().slice(0,2000)||'',mediaUrls:Array.isArray(options.mediaUrls)?options.mediaUrls.filter(Boolean).slice(0,6):[],dedupeKey,title:cleanTitle,content:cleanContent,authorId:user.uid,authorUsername:user.username,authorName:user.displayName,authorAvatar:user.photoURL||'',authorPlatformRole:staffRole(user),score:0,commentsCount:0,isFeatured:false,isPinned:false,isLocked:false,isArchived:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  if (Array.isArray(options.contentBlocks) && options.contentBlocks.length) data.contentBlocks=options.contentBlocks;
  for (const [k,v] of Object.entries({excerpt:options.excerpt,coverImage:options.coverImage,coverImageAlt:options.coverImageAlt,coverImageCaption:options.coverImageCaption,category:options.category,readingTimeMinutes:options.readingTimeMinutes,tags:options.tags})) if(v!==undefined) data[k]=v;
  if(options.poll && postType==='poll'){
    const pollOptions=options.poll.options.map(x=>String(x).trim()).filter(Boolean).slice(0,8);
    if(pollOptions.length<2) throw new Error('A poll needs at least two options.');
    data.poll={question:String(options.poll.question||cleanTitle).slice(0,256),options:pollOptions,votes:{}};
  }
  const postRef=doc(db,'communities',cid,'posts',pid);
  try {
    await setDoc(postRef, stripUndefined(data), {merge:false});
  } catch(err:any) {
    // A deterministic document id makes double-clicks idempotent. If the same
    // publication raced with this write, re-read the cloud document instead of
    // presenting a false failure to the user.
    const raced=await getDoc(postRef).catch(()=>null);
    if(raced?.exists()) return Object.assign(map(raced) as CommunityFeedPost,{publishStatus:'existing' as const});
    throw err;
  }
  const createdSnap=await getDoc(postRef);
  if(!createdSnap.exists()) throw new Error('Post was not confirmed in the cloud. Please refresh before retrying.');
  try { await updateDoc(doc(db,'communities',cid),{postsCount:increment(1),updatedAt:serverTimestamp()}); } catch(err) { console.warn('Community post counter sync deferred:',err); }
  if(options.parentPostId){ try { await updateDoc(doc(db,'communities',cid,'posts',options.parentPostId),{commentsCount:increment(1),updatedAt:serverTimestamp()}); } catch(err) { console.warn('Thread counter sync deferred:',err); } }
  return Object.assign(map(createdSnap) as CommunityFeedPost,{publishStatus:'created' as const});
}
async function canModerateCommunity(cid:string,uid:string){ if(isSocialAdmin()) return true; const c=await getCommunity(cid); if(c?.ownerId===uid) return true; const m=await getDoc(doc(db,'communities',cid,'members',uid)); return m.exists() && ['owner','moderator'].includes(m.data().role||'member'); }
export async function updateCommunityPost(cid:string,pid:string,uid:string,data:Pick<CommunityFeedPost,'title'|'content'> & Partial<CommunityFeedPost>){ const p=await getDoc(doc(db,'communities',cid,'posts',pid)); if(!p.exists()) throw new Error('Post not found.'); if(p.data().authorId!==uid && !(await canModerateCommunity(cid,uid))) throw new Error('You cannot edit this post.'); const payload:any={title:data.title.trim().slice(0,256),content:data.content.trim().slice(0,100000),editedAt:serverTimestamp(),updatedAt:serverTimestamp()}; const optional=['excerpt','coverImage','coverImageAlt','coverImageCaption','category','tags','readingTimeMinutes','contentBlocks']; optional.forEach(k=>{if((data as any)[k]!==undefined) payload[k]=(data as any)[k];}); await updateDoc(p.ref,payload); }
export async function deleteCommunityPost(cid:string,pid:string,uid:string){
  const p=await getDoc(doc(db,'communities',cid,'posts',pid)); if(!p.exists()) return;
  if(p.data().authorId!==uid && !(await canModerateCommunity(cid,uid))) throw new Error('You cannot delete this post.');
  const refs:any[]=[];
  for(const sub of ['votes','pollVotes','comments','reposts','claps']){ try { const snap=await getDocs(collection(db,'communities',cid,'posts',pid,sub)); snap.docs.forEach(v=>refs.push(v.ref)); } catch {} }
  refs.push(p.ref);
  for(let i=0;i<refs.length;i+=400){ const b=writeBatch(db); refs.slice(i,i+400).forEach(r=>b.delete(r)); await b.commit(); }
  const gone=await getDoc(p.ref); if(gone.exists()) throw new Error('Post deletion was not confirmed in the cloud.');
  try{await updateDoc(doc(db,'communities',cid),{postsCount:increment(-1),updatedAt:serverTimestamp()});}catch(err){console.warn('Community delete counter sync deferred:',err);}
}

export async function moderateCommunityPost(cid:string,pid:string,uid:string,changes:{isPinned?:boolean;isLocked?:boolean;isArchived?:boolean;isFeatured?:boolean;flair?:string}){ if(!(await canModerateCommunity(cid,uid))) throw new Error('Moderator access required.'); const payload:any={updatedAt:serverTimestamp()}; Object.entries(changes).forEach(([k,v])=>payload[k]=v); await updateDoc(doc(db,'communities',cid,'posts',pid),payload); }


export async function voteCommunityPoll(cid:string,pid:string,uid:string,optionIndex:number){
  if(!Number.isInteger(optionIndex) || optionIndex<0 || optionIndex>7) throw new Error('Invalid poll option.');
  const postRef=doc(db,'communities',cid,'posts',pid); const voteRef=doc(db,'communities',cid,'posts',pid,'pollVotes',uid);
  const [postSnap,existing]=await Promise.all([getDoc(postRef),getDoc(voteRef)]);
  if(!postSnap.exists()) throw new Error('Post not found.');
  const data=postSnap.data() as any; if(data.postType!=='poll' || !data.poll?.options?.[optionIndex]) throw new Error('Poll not found.');
  const b=writeBatch(db);
  if(existing.exists()){
    const old=Number(existing.data().optionIndex);
    if(old===optionIndex) return;
    b.update(postRef,{[`poll.votes.${old}`]:increment(-1),[`poll.votes.${optionIndex}`]:increment(1),updatedAt:serverTimestamp()});
    b.update(voteRef,{optionIndex,updatedAt:serverTimestamp()});
  }else{
    b.set(voteRef,{uid,optionIndex,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    b.update(postRef,{[`poll.votes.${optionIndex}`]:increment(1),updatedAt:serverTimestamp()});
  }
  await b.commit();
}

export async function voteCommunityPost(cid:string,pid:string,uid:string,type:'up'|'down'){ const ref=doc(db,'communities',cid,'posts',pid,'votes',uid); const existing=await getDoc(ref); const post=doc(db,'communities',cid,'posts',pid); const b=writeBatch(db); if(existing.exists()&&existing.data().type===type){b.delete(ref);b.update(post,{score:increment(type==='up'?-1:1),updatedAt:serverTimestamp()});}else{const prev=existing.exists()?existing.data().type:null; const delta=prev ? (prev==='up' ? (type==='up'?0:-2) : (type==='down' ? 0 : 2)) : (type==='up'?1:-1); b.set(ref,{type,uid,createdAt:serverTimestamp()}); b.update(post,{score:increment(delta),updatedAt:serverTimestamp()});}await b.commit();}

export async function getQuestions(){ const s=await getDocs(query(collection(db,'questions'),limit(100))); return (s.docs.map(map) as SocialQuestion[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); }
export async function createQuestion(user:CommunityUser,title:string,details:string,topics:string[]){ const qid=id(); const data={title:title.trim().slice(0,256),details:details.trim().slice(0,100000),authorId:user.uid,authorUsername:user.username,authorName:user.displayName,authorAvatar:user.photoURL||'',topics:topics.map(x=>x.toLowerCase().trim()).filter(Boolean).slice(0,10),followersCount:0,answersCount:0,upvotesCount:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}; await setDoc(doc(db,'questions',qid),data); return {...data,id:qid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as SocialQuestion; }
export async function updateQuestion(qid:string,uid:string,title:string,details:string){ const q=await getDoc(doc(db,'questions',qid));if(!q.exists())throw new Error('Question not found.');if(q.data().authorId!==uid&&!isSocialAdmin())throw new Error('You cannot edit this question.');await updateDoc(q.ref,{title:title.trim().slice(0,256),details:details.trim().slice(0,100000),updatedAt:serverTimestamp()}); }
export async function deleteQuestion(qid:string,uid:string){ const q=await getDoc(doc(db,'questions',qid));if(!q.exists())return;if(q.data().authorId!==uid&&!isSocialAdmin())throw new Error('You cannot delete this question.');const a=await getDocs(collection(db,'questions',qid,'answers'));const v=await getDocs(collection(db,'questions',qid,'votes'));const f=await getDocs(collection(db,'questions',qid,'followers'));const b=writeBatch(db);a.docs.forEach(d=>b.delete(d.ref));v.docs.forEach(d=>b.delete(d.ref));f.docs.forEach(d=>b.delete(d.ref));b.delete(q.ref);await b.commit(); }
export async function getAnswers(qid:string){ const s=await getDocs(query(collection(db,'questions',qid,'answers'),limit(200))); return (s.docs.map(map) as SocialAnswer[]).sort((a,b)=>(b.upvotesCount||0)-(a.upvotesCount||0)); }
export async function createAnswer(qid:string,user:CommunityUser,content:string){ const aid=id(); const data={questionId:qid,content:content.trim().slice(0,100000),authorId:user.uid,authorUsername:user.username,authorName:user.displayName,authorAvatar:user.photoURL||'',upvotesCount:0,downvotesCount:0,isBest:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}; const b=writeBatch(db); b.set(doc(db,'questions',qid,'answers',aid),data); b.update(doc(db,'questions',qid),{answersCount:increment(1),updatedAt:serverTimestamp()}); await b.commit(); const q=await getDoc(doc(db,'questions',qid)); if(q.exists()) await notify(q.data().authorId,{type:'reply',actorId:user.uid,actorUsername:user.username,actorName:user.displayName,actorAvatar:user.photoURL||'',message:'answered your question',targetType:'question',targetId:qid}); return {...data,id:aid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as SocialAnswer; }
export async function updateAnswer(qid:string,aid:string,uid:string,content:string){const a=await getDoc(doc(db,'questions',qid,'answers',aid));if(!a.exists())throw new Error('Answer not found.');if(a.data().authorId!==uid&&!isSocialAdmin()&&(await getDoc(doc(db,'questions',qid))).data()?.authorId!==uid)throw new Error('You cannot edit this answer.');await updateDoc(a.ref,{content:content.trim().slice(0,100000),updatedAt:serverTimestamp()});}
export async function deleteAnswer(qid:string,aid:string,uid:string){const a=await getDoc(doc(db,'questions',qid,'answers',aid));if(!a.exists())return;const q=await getDoc(doc(db,'questions',qid));if(a.data().authorId!==uid&&!isSocialAdmin()&&q.data()?.authorId!==uid)throw new Error('You cannot delete this answer.');await deleteDoc(a.ref);try{await updateDoc(q.ref,{answersCount:increment(-1),updatedAt:serverTimestamp()});}catch{}}
export async function markBestAnswer(qid:string,aid:string,uid:string){ const q=await getDoc(doc(db,'questions',qid)); if(!q.exists()||q.data().authorId!==uid&&!isSocialAdmin()) throw new Error('Only the question author or an admin can choose the best answer.'); const answers=await getDocs(collection(db,'questions',qid,'answers')); const b=writeBatch(db); answers.docs.forEach(d=>b.update(d.ref,{isBest:d.id===aid,updatedAt:serverTimestamp()})); b.update(q.ref,{bestAnswerId:aid,updatedAt:serverTimestamp()}); await b.commit(); const a=await getDoc(doc(db,'questions',qid,'answers',aid)); if(a.exists()) await notify(a.data().authorId,{type:'reply',actorId:uid,actorUsername:(await profile(uid))?.username||'',actorName:(await profile(uid))?.displayName||'',message:'marked your answer as the best answer',targetType:'question',targetId:qid}); }
export async function voteAnswer(qid:string,aid:string,uid:string,type:'up'|'down'){ const ref=doc(db,'questions',qid,'votes',uid); const existing=await getDoc(ref); const b=writeBatch(db); const aRef=doc(db,'questions',qid,'answers',aid); if(existing.exists()&&existing.data().type===type){b.delete(ref);b.update(aRef,{[type==='up'?'upvotesCount':'downvotesCount']:increment(-1)});} else { const prev=existing.exists()?existing.data().type:null; b.set(ref,{type,answerId:aid,createdAt:serverTimestamp()}); b.update(aRef,{[type==='up'?'upvotesCount':'downvotesCount']:increment(1),...(prev?{[prev==='up'?'upvotesCount':'downvotesCount']:increment(-1)}:{})}); } await b.commit(); }

export async function getTopics(){ const s=await getDocs(query(collection(db,'topics'),limit(100))); return (s.docs.map(map) as SocialTopic[]).sort((a,b)=>(b.followersCount||0)-(a.followersCount||0)); }
export async function createTopic(user:CommunityUser,name:string,description:string):Promise<SocialTopic>{ const clean=name.trim(); if(!clean) throw new Error('Topic name is required.'); const slug=clean.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'topic'; const existing=await getDocs(query(collection(db,'topics'),where('slug','==',slug),limit(1))); if(!existing.empty) return map(existing.docs[0]) as SocialTopic; const tid=id(); const data={name:clean.slice(0,80),slug,description:description.trim().slice(0,300),followersCount:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:user.uid,creatorUsername:user.username}; await setDoc(doc(db,'topics',tid),data); return {...data,id:tid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as SocialTopic; }
export async function updateTopic(tid:string,uid:string,name:string,description:string){const t=await getDoc(doc(db,'topics',tid));if(!t.exists())throw new Error('Topic not found.');if(t.data().createdBy!==uid&&!isSocialAdmin())throw new Error('You cannot edit this topic.');const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50);await updateDoc(t.ref,{name:name.trim().slice(0,80),slug,description:description.trim().slice(0,300),updatedAt:serverTimestamp()});}
export async function deleteTopic(tid:string,uid:string){const t=await getDoc(doc(db,'topics',tid));if(!t.exists())return;if(t.data().createdBy!==uid&&!isSocialAdmin())throw new Error('You cannot delete this topic.');const f=await getDocs(collection(db,'topics',tid,'followers'));const b=writeBatch(db);f.docs.forEach(d=>b.delete(d.ref));b.delete(t.ref);await b.commit();}
export async function toggleTopicFollow(topicId:string,user:CommunityUser){ const ref=doc(db,'topics',topicId,'followers',user.uid); const exists=await getDoc(ref); const b=writeBatch(db); b.update(doc(db,'topics',topicId),{followersCount:increment(exists.exists()?-1:1),updatedAt:serverTimestamp()}); if(exists.exists()) b.delete(ref); else b.set(ref,{uid:user.uid,username:user.username,createdAt:serverTimestamp()}); await b.commit(); return !exists.exists(); }

export async function getMessages(uid:string,otherUid:string){
  if(!uid || !otherUid) return [];
  const [sentSnap,receivedSnap]=await Promise.all([
    getDocs(query(collection(db,'messages'),where('senderId','==',uid),where('recipientId','==',otherUid),limit(500))),
    getDocs(query(collection(db,'messages'),where('senderId','==',otherUid),where('recipientId','==',uid),limit(500)))
  ]);
  const byId=new Map<string,SocialMessage>();
  [...sentSnap.docs,...receivedSnap.docs].forEach(d=>byId.set(d.id,map(d) as SocialMessage));
  return Array.from(byId.values()).sort((a,b)=>new Date(a.createdAt||0).getTime()-new Date(b.createdAt||0).getTime());
}
export async function sendMessage(user:CommunityUser,recipient:CommunityUser,content:string){
  const text=content.trim().slice(0,5000); if(!text) return;
  const mid=id();
  await setDoc(doc(db,'messages',mid),{senderId:user.uid,senderUsername:user.username,senderName:user.displayName,senderAvatar:user.photoURL||'',recipientId:recipient.uid,content:text,read:false,participants:[user.uid,recipient.uid],createdAt:serverTimestamp()});
  await notify(recipient.uid,{type:'message',actorId:user.uid,actorUsername:user.username,actorName:user.displayName,actorAvatar:user.photoURL||'',message:'sent you a message',targetType:'profile',targetId:user.username});
  return mid;
}
export async function markConversationRead(uid:string,otherUid:string){
  const sent=await getDocs(query(collection(db,'messages'),where('senderId','==',otherUid),where('recipientId','==',uid),limit(200)));
  const unread=sent.docs.filter(d=>d.data().read!==true);
  for(let i=0;i<unread.length;i+=400){ const b=writeBatch(db); unread.slice(i,i+400).forEach(d=>b.update(d.ref,{read:true})); await b.commit(); }
}
export async function deleteMessage(mid:string,uid:string){const m=await getDoc(doc(db,'messages',mid));if(!m.exists())return;if(m.data().senderId!==uid&&m.data().recipientId!==uid&&!isSocialAdmin())throw new Error('You cannot delete this message.');await deleteDoc(m.ref);}
export function subscribeMessages(uid:string,cb:(m:SocialMessage[])=>void){
  if(!uid) return ()=>{};
  const sentQ=query(collection(db,'messages'),where('senderId','==',uid),limit(300));
  const receivedQ=query(collection(db,'messages'),where('recipientId','==',uid),limit(300));
  let sent:SocialMessage[]=[]; let received:SocialMessage[]=[];
  const emit=()=>{const byId=new Map<string,SocialMessage>(); [...sent,...received].forEach(m=>byId.set(m.id,m)); cb(Array.from(byId.values()).sort((a,b)=>new Date(a.createdAt||0).getTime()-new Date(b.createdAt||0).getTime()));};
  const a=onSnapshot(sentQ,s=>{sent=s.docs.map(map) as SocialMessage[];emit();},err=>{console.warn('Sent-message listener failed',err);sent=[];emit();});
  const b=onSnapshot(receivedQ,s=>{received=s.docs.map(map) as SocialMessage[];emit();},err=>{console.warn('Received-message listener failed',err);received=[];emit();});
  return ()=>{a();b();};
}

export function subscribeConversation(uid:string,otherUid:string,cb:(m:SocialMessage[])=>void){
  if(!uid||!otherUid) return ()=>{};
  // Query each direction explicitly. This recovers legacy messages even when
  // older records do not contain the participants array.
  const sentQ=query(collection(db,'messages'),where('senderId','==',uid),where('recipientId','==',otherUid),limit(500));
  const receivedQ=query(collection(db,'messages'),where('senderId','==',otherUid),where('recipientId','==',uid),limit(500));
  let sent:SocialMessage[]=[]; let received:SocialMessage[]=[];
  const emit=()=>{
    const byId=new Map<string,SocialMessage>();
    [...sent,...received].forEach(m=>byId.set(m.id,m));
    cb(Array.from(byId.values()).sort((a,b)=>new Date(a.createdAt||0).getTime()-new Date(b.createdAt||0).getTime()));
  };
  const a=onSnapshot(sentQ,s=>{sent=s.docs.map(map) as SocialMessage[];emit();},err=>{console.warn('Conversation sent listener failed',err);sent=[];emit();});
  const b=onSnapshot(receivedQ,s=>{received=s.docs.map(map) as SocialMessage[];emit();},err=>{console.warn('Conversation received listener failed',err);received=[];emit();});
  return ()=>{a();b();};
}

export async function reportContent(user:CommunityUser,targetType:string,targetId:string,reason:string){
  const rid=id();
  await setDoc(doc(db,'reports',rid),{reporterId:user.uid,reporterUsername:user.username,targetType,targetId,reason:reason.slice(0,500),status:'open',createdAt:serverTimestamp()});
  if(!isSocialAdmin()) { try { await setDoc(doc(db,'admin_notifications',id()),{type:'message',actorId:user.uid,actorUsername:user.username,actorName:user.displayName,actorAvatar:user.photoURL||'',message:'reported '+targetType+': '+reason.slice(0,120),targetType:'report',targetId:rid,read:false,createdAt:serverTimestamp()}); } catch(e) { console.warn('Admin report notification failed:',e); } }
}
export async function getReports():Promise<SocialReport[]> { const s=await getDocs(query(collection(db,'reports'),orderBy('createdAt','desc'),limit(200))); return s.docs.map(map) as SocialReport[]; }
export async function resolveReport(reportId:string,uid:string,status:'resolved'|'dismissed',response=''){
  await requireStaff();
  const reportRef=doc(db,'reports',reportId); const report=await getDoc(reportRef);
  if(!report.exists()) throw new Error('Report not found.');
  const data:any=report.data();
  await updateDoc(reportRef,{status,resolvedBy:uid,resolvedAt:serverTimestamp(),response:response.trim().slice(0,1000)});
  if(data.reporterId && data.reporterId!==uid){
    const actor=await profile(uid);
    if(actor) await notify(data.reporterId,{type:'message',actorId:uid,actorUsername:actor.username,actorName:actor.displayName,actorAvatar:actor.photoURL||'',message:response.trim().slice(0,180) || ('Your report was '+status+'.'),targetType:'report',targetId:reportId});
  }
}

export async function getCommunityPostForModeration(cid:string,pid:string):Promise<CommunityFeedPost|null>{ const s=await getDoc(doc(db,'communities',cid,'posts',pid)); return s.exists()?map(s) as CommunityFeedPost:null; }
export async function getQuestionForModeration(qid:string):Promise<SocialQuestion|null>{ const s=await getDoc(doc(db,'questions',qid)); return s.exists()?map(s) as SocialQuestion:null; }
export async function muteUser(uid:string,targetUid:string){ await setDoc(doc(db,'users',uid,'mutes',targetUid),{uid:targetUid,createdAt:serverTimestamp()}); }
export async function unmuteUser(uid:string,targetUid:string){ await deleteDoc(doc(db,'users',uid,'mutes',targetUid)); }
export async function getUserMutes(uid:string){ const s=await getDocs(collection(db,'users',uid,'mutes')); return s.docs.map(d=>d.id); }



async function requireStaff(){ if(!(await isStaffMember(auth.currentUser?.uid))) throw new Error('Staff access required.'); }

export async function adminSetCommunityPostModeration(cid:string,pid:string,changes:{isPinned?:boolean;isLocked?:boolean;isArchived?:boolean;isFeatured?:boolean;flair?:string}){ await requireStaff(); await updateDoc(doc(db,'communities',cid,'posts',pid),{...changes,updatedAt:serverTimestamp()}); }
export async function adminSetCommunitySettings(cid:string,data:Partial<Pick<SocialCommunity,'isPrivate'|'isArchived'|'isLocked'|'allowLinks'|'allowMedia'|'defaultPostType'>>){ await requireStaff(); await updateDoc(doc(db,'communities',cid),{...data,updatedAt:serverTimestamp()}); }
export async function adminSetCommunityMemberRole(cid:string,memberId:string,role:'member'|'moderator',actorId:string){ if(!isSocialAdmin()) throw new Error('Only a master admin can override community roles from Master Control.'); await setCommunityMemberRole(cid,memberId,role,actorId); }

export interface SocialAdminPost extends CommunityFeedPost { sourceType:'community'|'root'; communityId?:string; communitySlug?:string; isFeatured?:boolean; }

export async function getAdminRootAndCommunityPosts():Promise<SocialAdminPost[]> {
  await requireStaff();
  const rootSnap=await getDocs(query(collection(db,'posts'),limit(500)));
  const root=(rootSnap.docs.map(map) as any[]).map(p=>({...p,sourceType:'root',isFeatured:!!p.isFeatured}));
  let community:any[]=[];
  try {
    const groupSnap=await getDocs(query(collectionGroup(db,'posts'),limit(500)));
    for(const d of groupSnap.docs){
      const path=d.ref.path.split('/');
      if(path.length!==4 || path[0]!=='communities' || path[2]!=='posts') continue;
      const x:any=map(d); x.sourceType='community'; x.communityId=path[1];
      try { const c=await getCommunity(path[1]); x.communitySlug=c?.slug||path[1]; } catch { x.communitySlug=path[1]; }
      community.push(x);
    }
  } catch(e){ console.warn('Admin community-post scan failed',e); }
  return [...root,...community].sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()) as SocialAdminPost[];
}

export async function adminUpdateRootPost(postId:string,title:string,content:string){ await requireStaff(); const p=await getDoc(doc(db,'posts',postId)); if(!p.exists()) throw new Error('Post not found.'); await updateDoc(p.ref,{title:title.trim().slice(0,256),content:content.trim().slice(0,100000),editedAt:serverTimestamp(),updatedAt:serverTimestamp()}); }
export async function adminUpdateCommunityPost(cid:string,pid:string,title:string,content:string){ await requireStaff(); await updateDoc(doc(db,'communities',cid,'posts',pid),{title:title.trim().slice(0,256),content:content.trim().slice(0,100000),editedAt:serverTimestamp(),updatedAt:serverTimestamp()}); }
export async function adminSetCommunityPostFeatured(cid:string,pid:string,featured:boolean){ await requireStaff(); await updateDoc(doc(db,'communities',cid,'posts',pid),{isFeatured:featured,updatedAt:serverTimestamp()}); }
export async function adminDeleteRootPost(postId:string){ await requireStaff(); const p=await getDoc(doc(db,'posts',postId)); if(!p.exists()) return; const refs:any[]=[]; for(const sub of ['comments','votes','claps','reposts']){const snap=await getDocs(collection(db,'posts',postId,sub));snap.docs.forEach(d=>refs.push(d.ref));} refs.push(p.ref); for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit();} }
export async function adminDeleteCommunityPost(cid:string,pid:string){ await requireStaff(); const p=await getDoc(doc(db,'communities',cid,'posts',pid)); if(!p.exists()) return; const votes=await getDocs(collection(db,'communities',cid,'posts',pid,'votes')); const refs=[...votes.docs.map(v=>v.ref),p.ref]; for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit();} try{await updateDoc(doc(db,'communities',cid),{postsCount:increment(-1),updatedAt:serverTimestamp()});}catch{} }
export async function adminSetRootPostFeatured(postId:string,featured:boolean){ await requireStaff(); await updateDoc(doc(db,'posts',postId),{isFeatured:featured,updatedAt:serverTimestamp()}); }
export async function getAdminMessages():Promise<SocialMessage[]>{ await requireStaff(); const s=await getDocs(query(collection(db,'messages'),limit(500))); return s.docs.map(map).sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()) as SocialMessage[]; }
export async function adminUpdateMessage(mid:string,content:string){ await requireStaff(); await updateDoc(doc(db,'messages',mid),{content:content.trim().slice(0,5000)}); }
export async function adminDeleteMessage(mid:string){ await requireStaff(); await deleteDoc(doc(db,'messages',mid)); }
export async function adminUpdateUser(uid:string,data:{displayName?:string;bio?:string;photoURL?:string;coverImageUrl?:string;websiteUrl?:string;location?:string;socialX?:string;socialGithub?:string;socialTelegram?:string;socialInstagram?:string;role?:string;isAuthor?:boolean;isVerified?:boolean;verificationColor?:string;isBlocked?:boolean}){ await requireStaff(); await updateDoc(doc(db,'users',uid),{...data,updatedAt:serverTimestamp()}); }
export async function adminDeleteUserProfile(uid:string){ await requireStaff(); await deleteDoc(doc(db,'users',uid)); }
