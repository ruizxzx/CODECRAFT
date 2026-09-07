import { db, auth, checkIsAdmin } from './firebase';
import { collection, collectionGroup, doc, getDoc, getDocs, query, orderBy, where, limit, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, onSnapshot, increment } from 'firebase/firestore';
import { CommunityUser } from '../types';

const id = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const date = (v:any) => v?.toDate ? v.toDate().toISOString() : (v || new Date().toISOString());
const map = (d:any) => ({ ...d.data(), id:d.id, createdAt:date(d.data().createdAt), updatedAt:date(d.data().updatedAt) });

async function profile(uid:string){ const s=await getDoc(doc(db,'users',uid)); return s.exists()?s.data() as CommunityUser:null; }
async function notify(uid:string, data:any){ if(!uid || uid===data.actorId) return; await setDoc(doc(db,'users',uid,'notifications',id()),{...data,read:false,createdAt:serverTimestamp()}); }

export interface SocialCommunity { id:string; name:string; slug:string; description:string; iconUrl?:string; bannerUrl?:string; rules?:string[]; membersCount:number; postsCount:number; ownerId:string; ownerUsername?:string; ownerName?:string; ownerAvatar?:string; createdAt:string; updatedAt?:string; }
export interface CommunityFeedPost { id:string; communityId:string; title:string; content:string; authorId:string; authorUsername:string; authorName:string; authorAvatar:string; score:number; commentsCount:number; isFeatured?:boolean; createdAt:string; updatedAt?:string; editedAt?:string; }
export interface SocialQuestion { id:string; title:string; details:string; authorId:string; authorUsername:string; authorName:string; authorAvatar:string; topics:string[]; followersCount:number; answersCount:number; upvotesCount:number; bestAnswerId?:string; createdAt:string; updatedAt?:string; }
export interface SocialAnswer { id:string; questionId:string; content:string; authorId:string; authorUsername:string; authorName:string; authorAvatar:string; upvotesCount:number; downvotesCount:number; isBest:boolean; createdAt:string; updatedAt:string; }
export interface SocialTopic { id:string; name:string; slug:string; description:string; followersCount:number; createdAt:string; updatedAt?:string; createdBy?:string; creatorUsername?:string; }
export interface SocialMessage { id:string; senderId:string; senderUsername:string; senderName:string; senderAvatar:string; recipientId:string; content:string; read:boolean; createdAt:string; }
export interface SocialReport { id:string; reporterId:string; reporterUsername?:string; targetType:string; targetId:string; reason:string; status:string; createdAt:string; resolvedBy?:string; resolvedAt?:string; response?:string; }

export const isSocialAdmin = () => checkIsAdmin(auth.currentUser?.email);

export async function getCommunities():Promise<SocialCommunity[]> {
  let snap;
  try { snap=await getDocs(query(collection(db,'communities'),limit(100))); }
  catch { snap=await getDocs(collection(db,'communities')); }
  const items=(snap.docs.map(map) as SocialCommunity[]).sort((a,b)=>(b.membersCount||0)-(a.membersCount||0));
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
  const data={name:clean,slug,description:description.trim().slice(0,1000),rules:rules.map(x=>x.trim()).filter(Boolean).slice(0,20),membersCount:1,postsCount:0,ownerId:user.uid,ownerUsername:user.username,ownerName:user.displayName,ownerAvatar:user.photoURL||'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  const b=writeBatch(db); b.set(doc(db,'communities',cid),data); b.set(doc(db,'communities',cid,'members',user.uid),{uid:user.uid,username:user.username,role:'owner',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); await b.commit();
  return {...data,id:cid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as SocialCommunity;
}

export async function updateCommunity(communityId:string, userId:string, data:Partial<Pick<SocialCommunity,'name'|'description'|'iconUrl'|'bannerUrl'|'rules'>>){
  if(!auth.currentUser) throw new Error('Sign in required.');
  const c=await getCommunity(communityId); if(!c) throw new Error('Community not found.');
  if(c.ownerId!==userId && !isSocialAdmin()) throw new Error('Only the community creator or an admin can edit this community.');
  const payload:any={updatedAt:serverTimestamp()}; Object.entries(data).forEach(([k,v])=>{ if(v!==undefined) payload[k]=v; });
  await updateDoc(doc(db,'communities',communityId),payload);
}

export async function deleteCommunity(communityId:string,userId:string){
  const c=await getCommunity(communityId); if(!c) return;
  if(c.ownerId!==userId && !isSocialAdmin()) throw new Error('Only the community creator or an admin can delete this community.');

  // Delete descendants BEFORE the parent. Keeping the parent document alive while
  // descendant rules execute avoids permission failures in Firestore rule lookups.
  const deleteInBatches = async (refs:any[]) => {
    for(let i=0;i<refs.length;i+=400){
      const b=writeBatch(db);
      refs.slice(i,i+400).forEach((r:any)=>b.delete(r));
      if (refs.length) await b.commit();
    }
  };

  const postRefs:any[]=[];
  const posts=await getDocs(collection(db,'communities',communityId,'posts'));
  for(const post of posts.docs){
    const votes=await getDocs(collection(db,'communities',communityId,'posts',post.id,'votes'));
    votes.docs.forEach(v=>postRefs.push(v.ref));
    postRefs.push(post.ref);
  }
  await deleteInBatches(postRefs);

  const members=await getDocs(collection(db,'communities',communityId,'members'));
  await deleteInBatches(members.docs.filter(d=>d.id!==c.ownerId).map(d=>d.ref));
  // Finally remove the owner membership and root community. Admin/owner is allowed.
  const ownerMember=doc(db,'communities',communityId,'members',c.ownerId);
  try { await deleteDoc(ownerMember); } catch (e) {
    if (!isSocialAdmin()) throw e;
  }
  await deleteDoc(doc(db,'communities',communityId));
}

export async function getCommunityMembers(cid:string){ const s=await getDocs(collection(db,'communities',cid,'members')); return s.docs.map(d=>({id:d.id,...d.data()})) as Array<{id:string;uid:string;username:string;role:string;createdAt:any}>; }
export async function setCommunityMemberRole(cid:string,memberId:string,role:'member'|'moderator'|'owner',actorId:string){
  const c=await getCommunity(cid); if(!c) throw new Error('Community not found.');
  if(c.ownerId!==actorId && !isSocialAdmin()) throw new Error('Only the community creator or an admin can manage members.');
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
  if(c.ownerId!==actorId && !isSocialAdmin()) throw new Error('Only the community creator or an admin can manage members.');
  if(c.ownerId===memberId) throw new Error('Transfer ownership before removing the creator.');
  await deleteDoc(doc(db,'communities',cid,'members',memberId)); await updateDoc(doc(db,'communities',cid),{membersCount:increment(-1),updatedAt:serverTimestamp()});
}

export async function isCommunityMember(cid:string,uid:string){ return (await getDoc(doc(db,'communities',cid,'members',uid))).exists(); }
export async function joinCommunity(cid:string,user:CommunityUser){ const ref=doc(db,'communities',cid,'members',user.uid); if((await getDoc(ref)).exists()) return false; const b=writeBatch(db); b.set(ref,{uid:user.uid,username:user.username,role:'member',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); b.update(doc(db,'communities',cid),{membersCount:increment(1),updatedAt:serverTimestamp()}); await b.commit(); return true; }
export async function leaveCommunity(cid:string,uid:string){ const ref=doc(db,'communities',cid,'members',uid); if(!(await getDoc(ref)).exists()) return false; const c=await getDoc(doc(db,'communities',cid)); if(c.exists()&&c.data().ownerId===uid) throw new Error('Community owner cannot leave. Transfer ownership first.'); const b=writeBatch(db); b.delete(ref); b.update(doc(db,'communities',cid),{membersCount:increment(-1),updatedAt:serverTimestamp()}); await b.commit(); return true; }

export async function getCommunityPosts(cid:string){ const s=await getDocs(query(collection(db,'communities',cid,'posts'),limit(100))); return (s.docs.map(map) as CommunityFeedPost[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); }
export function subscribeCommunityFeed(cid:string,cb:(x:CommunityFeedPost[])=>void){ return onSnapshot(query(collection(db,'communities',cid,'posts'),limit(100)),s=>cb((s.docs.map(map) as CommunityFeedPost[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))),()=>cb([])); }
export async function createCommunityPost(cid:string,user:CommunityUser,title:string,content:string){
  const c=await getCommunity(cid); if(!c) throw new Error('Community not found.');
  if(!(await isCommunityMember(cid,user.uid))){ if(c.ownerId===user.uid){ await setDoc(doc(db,'communities',cid,'members',user.uid),{uid:user.uid,username:user.username,role:'owner',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); } else throw new Error('Join the community first.'); }
  const pid=id(); const data={communityId:cid,title:title.trim().slice(0,256),content:content.trim().slice(0,100000),authorId:user.uid,authorUsername:user.username,authorName:user.displayName,authorAvatar:user.photoURL||'',score:0,commentsCount:0,isFeatured:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  await setDoc(doc(db,'communities',cid,'posts',pid),data);
  try { await updateDoc(doc(db,'communities',cid),{postsCount:increment(1),updatedAt:serverTimestamp()}); } catch { /* post creation remains successful even if an older ruleset blocks the counter update */ }
  return {...data,id:pid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as CommunityFeedPost;
}
async function canModerateCommunity(cid:string,uid:string){ if(isSocialAdmin()) return true; const c=await getCommunity(cid); if(c?.ownerId===uid) return true; const m=await getDoc(doc(db,'communities',cid,'members',uid)); return m.exists() && ['owner','moderator'].includes(m.data().role||'member'); }
export async function updateCommunityPost(cid:string,pid:string,uid:string,data:Pick<CommunityFeedPost,'title'|'content'>){ const p=await getDoc(doc(db,'communities',cid,'posts',pid)); if(!p.exists()) throw new Error('Post not found.'); if(p.data().authorId!==uid && !(await canModerateCommunity(cid,uid))) throw new Error('You cannot edit this post.'); await updateDoc(p.ref,{title:data.title.trim().slice(0,256),content:data.content.trim().slice(0,100000),editedAt:serverTimestamp(),updatedAt:serverTimestamp()}); }
export async function deleteCommunityPost(cid:string,pid:string,uid:string){ const p=await getDoc(doc(db,'communities',cid,'posts',pid)); if(!p.exists()) return; if(p.data().authorId!==uid && !(await canModerateCommunity(cid,uid))) throw new Error('You cannot delete this post.'); const votes=await getDocs(collection(db,'communities',cid,'posts',pid,'votes')); const b=writeBatch(db); votes.docs.forEach(v=>b.delete(v.ref)); b.delete(p.ref); await b.commit(); try{await updateDoc(doc(db,'communities',cid),{postsCount:increment(-1),updatedAt:serverTimestamp()});}catch{} }
export async function voteCommunityPost(cid:string,pid:string,uid:string,type:'up'|'down'){ const ref=doc(db,'communities',cid,'posts',pid,'votes',uid); const existing=await getDoc(ref); const post=doc(db,'communities',cid,'posts',pid); const b=writeBatch(db); if(existing.exists()&&existing.data().type===type){b.delete(ref);b.update(post,{score:increment(type==='up'?-1:1),updatedAt:serverTimestamp()});}else{const prev=existing.exists()?existing.data().type:null; const delta=prev ? (prev==='up' ? (type==='up'?0:-2) : (type==='down' ? 0 : 2)) : (type==='up'?1:-1); b.set(ref,{type,uid,createdAt:serverTimestamp()}); b.update(post,{score:increment(delta),updatedAt:serverTimestamp()});}await b.commit();}

export async function getQuestions(){ const s=await getDocs(query(collection(db,'questions'),limit(100))); return (s.docs.map(map) as SocialQuestion[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); }
export async function createQuestion(user:CommunityUser,title:string,details:string,topics:string[]){ const qid=id(); const data={title:title.trim().slice(0,256),details:details.trim().slice(0,100000),authorId:user.uid,authorUsername:user.username,authorName:user.displayName,authorAvatar:user.photoURL||'',topics:topics.map(x=>x.toLowerCase().trim()).filter(Boolean).slice(0,10),followersCount:0,answersCount:0,upvotesCount:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}; await setDoc(doc(db,'questions',qid),data); return {...data,id:qid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as SocialQuestion; }
export async function updateQuestion(qid:string,uid:string,title:string,details:string){ const q=await getDoc(doc(db,'questions',qid));if(!q.exists())throw new Error('Question not found.');if(q.data().authorId!==uid&&!isSocialAdmin())throw new Error('You cannot edit this question.');await updateDoc(q.ref,{title:title.trim().slice(0,256),details:details.trim().slice(0,100000),updatedAt:serverTimestamp()}); }
export async function deleteQuestion(qid:string,uid:string){ const q=await getDoc(doc(db,'questions',qid));if(!q.exists())return;if(q.data().authorId!==uid&&!isSocialAdmin())throw new Error('You cannot delete this question.');const a=await getDocs(collection(db,'questions',qid,'answers'));const v=await getDocs(collection(db,'questions',qid,'votes'));const f=await getDocs(collection(db,'questions',qid,'followers'));const b=writeBatch(db);a.docs.forEach(d=>b.delete(d.ref));v.docs.forEach(d=>b.delete(d.ref));f.docs.forEach(d=>b.delete(d.ref));b.delete(q.ref);await b.commit(); }
export async function getAnswers(qid:string){ const s=await getDocs(query(collection(db,'questions',qid,'answers'),orderBy('upvotesCount','desc'),limit(100))); return s.docs.map(map) as SocialAnswer[]; }
export async function createAnswer(qid:string,user:CommunityUser,content:string){ const aid=id(); const data={questionId:qid,content:content.trim().slice(0,100000),authorId:user.uid,authorUsername:user.username,authorName:user.displayName,authorAvatar:user.photoURL||'',upvotesCount:0,downvotesCount:0,isBest:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}; const b=writeBatch(db); b.set(doc(db,'questions',qid,'answers',aid),data); b.update(doc(db,'questions',qid),{answersCount:increment(1),updatedAt:serverTimestamp()}); await b.commit(); const q=await getDoc(doc(db,'questions',qid)); if(q.exists()) await notify(q.data().authorId,{type:'reply',actorId:user.uid,actorUsername:user.username,actorName:user.displayName,actorAvatar:user.photoURL||'',message:'answered your question',targetType:'question',targetId:qid}); return {...data,id:aid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as SocialAnswer; }
export async function updateAnswer(qid:string,aid:string,uid:string,content:string){const a=await getDoc(doc(db,'questions',qid,'answers',aid));if(!a.exists())throw new Error('Answer not found.');if(a.data().authorId!==uid&&!isSocialAdmin()&&(await getDoc(doc(db,'questions',qid))).data()?.authorId!==uid)throw new Error('You cannot edit this answer.');await updateDoc(a.ref,{content:content.trim().slice(0,100000),updatedAt:serverTimestamp()});}
export async function deleteAnswer(qid:string,aid:string,uid:string){const a=await getDoc(doc(db,'questions',qid,'answers',aid));if(!a.exists())return;const q=await getDoc(doc(db,'questions',qid));if(a.data().authorId!==uid&&!isSocialAdmin()&&q.data()?.authorId!==uid)throw new Error('You cannot delete this answer.');await deleteDoc(a.ref);try{await updateDoc(q.ref,{answersCount:increment(-1),updatedAt:serverTimestamp()});}catch{}}
export async function markBestAnswer(qid:string,aid:string,uid:string){ const q=await getDoc(doc(db,'questions',qid)); if(!q.exists()||q.data().authorId!==uid&&!isSocialAdmin()) throw new Error('Only the question author or an admin can choose the best answer.'); const answers=await getDocs(collection(db,'questions',qid,'answers')); const b=writeBatch(db); answers.docs.forEach(d=>b.update(d.ref,{isBest:d.id===aid,updatedAt:serverTimestamp()})); b.update(q.ref,{bestAnswerId:aid,updatedAt:serverTimestamp()}); await b.commit(); const a=await getDoc(doc(db,'questions',qid,'answers',aid)); if(a.exists()) await notify(a.data().authorId,{type:'reply',actorId:uid,actorUsername:(await profile(uid))?.username||'',actorName:(await profile(uid))?.displayName||'',message:'marked your answer as the best answer',targetType:'question',targetId:qid}); }
export async function voteAnswer(qid:string,aid:string,uid:string,type:'up'|'down'){ const ref=doc(db,'questions',qid,'votes',uid); const existing=await getDoc(ref); const b=writeBatch(db); const aRef=doc(db,'questions',qid,'answers',aid); if(existing.exists()&&existing.data().type===type){b.delete(ref);b.update(aRef,{[type==='up'?'upvotesCount':'downvotesCount']:increment(-1)});} else { const prev=existing.exists()?existing.data().type:null; b.set(ref,{type,answerId:aid,createdAt:serverTimestamp()}); b.update(aRef,{[type==='up'?'upvotesCount':'downvotesCount']:increment(1),...(prev?{[prev==='up'?'upvotesCount':'downvotesCount']:increment(-1)}:{})}); } await b.commit(); }

export async function getTopics(){ const s=await getDocs(query(collection(db,'topics'),limit(100))); return (s.docs.map(map) as SocialTopic[]).sort((a,b)=>(b.followersCount||0)-(a.followersCount||0)); }
export async function createTopic(user:CommunityUser,name:string,description:string){ const clean=name.trim(); const slug=clean.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50); const existing=await getDocs(query(collection(db,'topics'),where('slug','==',slug),limit(1))); if(!existing.empty) return existing.docs[0].id; const tid=id(); await setDoc(doc(db,'topics',tid),{name:clean.slice(0,80),slug,description:description.trim().slice(0,300),followersCount:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:user.uid,creatorUsername:user.username}); return tid; }
export async function updateTopic(tid:string,uid:string,name:string,description:string){const t=await getDoc(doc(db,'topics',tid));if(!t.exists())throw new Error('Topic not found.');if(t.data().createdBy!==uid&&!isSocialAdmin())throw new Error('You cannot edit this topic.');const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50);await updateDoc(t.ref,{name:name.trim().slice(0,80),slug,description:description.trim().slice(0,300),updatedAt:serverTimestamp()});}
export async function deleteTopic(tid:string,uid:string){const t=await getDoc(doc(db,'topics',tid));if(!t.exists())return;if(t.data().createdBy!==uid&&!isSocialAdmin())throw new Error('You cannot delete this topic.');const f=await getDocs(collection(db,'topics',tid,'followers'));const b=writeBatch(db);f.docs.forEach(d=>b.delete(d.ref));b.delete(t.ref);await b.commit();}
export async function toggleTopicFollow(topicId:string,user:CommunityUser){ const ref=doc(db,'topics',topicId,'followers',user.uid); const exists=await getDoc(ref); const b=writeBatch(db); b.update(doc(db,'topics',topicId),{followersCount:increment(exists.exists()?-1:1),updatedAt:serverTimestamp()}); if(exists.exists()) b.delete(ref); else b.set(ref,{uid:user.uid,username:user.username,createdAt:serverTimestamp()}); await b.commit(); return !exists.exists(); }

export async function getMessages(uid:string,otherUid:string){
  if(!uid || !otherUid) return [];
  // Do not depend on the participants array: older messages may not have it.
  // Two single-field queries are also covered by the sender/recipient rules.
  const [sentSnap,receivedSnap]=await Promise.all([
    getDocs(query(collection(db,'messages'),where('senderId','==',uid),limit(300))),
    getDocs(query(collection(db,'messages'),where('recipientId','==',uid),limit(300)))
  ]);
  const byId=new Map<string,SocialMessage>();
  [...sentSnap.docs,...receivedSnap.docs].forEach(d=>{const m=map(d) as SocialMessage;if((m.senderId===uid&&m.recipientId===otherUid)||(m.senderId===otherUid&&m.recipientId===uid)) byId.set(d.id,m);});
  return Array.from(byId.values()).sort((a,b)=>new Date(a.createdAt||0).getTime()-new Date(b.createdAt||0).getTime()).slice(-200);
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

export async function reportContent(user:CommunityUser,targetType:string,targetId:string,reason:string){
  const rid=id();
  await setDoc(doc(db,'reports',rid),{reporterId:user.uid,reporterUsername:user.username,targetType,targetId,reason:reason.slice(0,500),status:'open',createdAt:serverTimestamp()});
  if(!isSocialAdmin()) { try { await setDoc(doc(db,'admin_notifications',id()),{type:'message',actorId:user.uid,actorUsername:user.username,actorName:user.displayName,actorAvatar:user.photoURL||'',message:'reported '+targetType+': '+reason.slice(0,120),targetType:'report',targetId:rid,read:false,createdAt:serverTimestamp()}); } catch(e) { console.warn('Admin report notification failed:',e); } }
}
export async function getReports():Promise<SocialReport[]> { const s=await getDocs(query(collection(db,'reports'),orderBy('createdAt','desc'),limit(200))); return s.docs.map(map) as SocialReport[]; }
export async function resolveReport(reportId:string,uid:string,status:'resolved'|'dismissed',response=''){
  if(!isSocialAdmin()) throw new Error('Admin access required.');
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


export interface SocialAdminPost extends CommunityFeedPost { sourceType:'community'|'root'; communityId?:string; communitySlug?:string; isFeatured?:boolean; }

export async function getAdminRootAndCommunityPosts():Promise<SocialAdminPost[]> {
  if(!isSocialAdmin()) throw new Error('Admin access required.');
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

export async function adminUpdateRootPost(postId:string,title:string,content:string){ if(!isSocialAdmin()) throw new Error('Admin access required.'); const p=await getDoc(doc(db,'posts',postId)); if(!p.exists()) throw new Error('Post not found.'); await updateDoc(p.ref,{title:title.trim().slice(0,256),content:content.trim().slice(0,100000),editedAt:serverTimestamp(),updatedAt:serverTimestamp()}); }
export async function adminUpdateCommunityPost(cid:string,pid:string,title:string,content:string){ if(!isSocialAdmin()) throw new Error('Admin access required.'); await updateDoc(doc(db,'communities',cid,'posts',pid),{title:title.trim().slice(0,256),content:content.trim().slice(0,100000),editedAt:serverTimestamp(),updatedAt:serverTimestamp()}); }
export async function adminSetCommunityPostFeatured(cid:string,pid:string,featured:boolean){ if(!isSocialAdmin()) throw new Error('Admin access required.'); await updateDoc(doc(db,'communities',cid,'posts',pid),{isFeatured:featured,updatedAt:serverTimestamp()}); }
export async function adminDeleteRootPost(postId:string){ if(!isSocialAdmin()) throw new Error('Admin access required.'); const p=await getDoc(doc(db,'posts',postId)); if(!p.exists()) return; const refs:any[]=[]; for(const sub of ['comments','votes','claps','reposts']){const snap=await getDocs(collection(db,'posts',postId,sub));snap.docs.forEach(d=>refs.push(d.ref));} refs.push(p.ref); for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit();} }
export async function adminDeleteCommunityPost(cid:string,pid:string){ if(!isSocialAdmin()) throw new Error('Admin access required.'); const p=await getDoc(doc(db,'communities',cid,'posts',pid)); if(!p.exists()) return; const votes=await getDocs(collection(db,'communities',cid,'posts',pid,'votes')); const refs=[...votes.docs.map(v=>v.ref),p.ref]; for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit();} try{await updateDoc(doc(db,'communities',cid),{postsCount:increment(-1),updatedAt:serverTimestamp()});}catch{} }
export async function adminSetRootPostFeatured(postId:string,featured:boolean){ if(!isSocialAdmin()) throw new Error('Admin access required.'); await updateDoc(doc(db,'posts',postId),{isFeatured:featured,updatedAt:serverTimestamp()}); }
export async function getAdminMessages():Promise<SocialMessage[]>{ if(!isSocialAdmin()) throw new Error('Admin access required.'); const s=await getDocs(query(collection(db,'messages'),limit(500))); return s.docs.map(map).sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()) as SocialMessage[]; }
export async function adminUpdateMessage(mid:string,content:string){ if(!isSocialAdmin()) throw new Error('Admin access required.'); await updateDoc(doc(db,'messages',mid),{content:content.trim().slice(0,5000)}); }
export async function adminDeleteMessage(mid:string){ if(!isSocialAdmin()) throw new Error('Admin access required.'); await deleteDoc(doc(db,'messages',mid)); }
export async function adminUpdateUser(uid:string,data:{displayName?:string;bio?:string;photoURL?:string;coverImageUrl?:string;websiteUrl?:string;location?:string;socialX?:string;socialGithub?:string;socialTelegram?:string;role?:string;isAuthor?:boolean;isVerified?:boolean;verificationColor?:string;isBlocked?:boolean}){ if(!isSocialAdmin()) throw new Error('Admin access required.'); await updateDoc(doc(db,'users',uid),{...data,updatedAt:serverTimestamp()}); }
export async function adminDeleteUserProfile(uid:string){ if(!isSocialAdmin()) throw new Error('Admin access required.'); await deleteDoc(doc(db,'users',uid)); }
