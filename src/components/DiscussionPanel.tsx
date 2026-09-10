import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, ChevronDown, ChevronRight, Edit3, Flag, Link2, MessageCircle, Quote, Reply, RotateCcw, Sparkles, ThumbsUp, Trash2, Users, X } from 'lucide-react';
import { CommunityComment, CommunityPost, CommunityUser } from '../types';
import { subscribeCommunityComments, deleteComment } from '../lib/community';
import { auth } from '../lib/firebase';
import { requestAI } from '../lib/ai';
import { DiscussionSort, getDiscussionParticipants, getDiscussionReadState, getDiscussionReplies, getThread, replyToDiscussion, saveDiscussionReadState, sortDiscussionReplies, toggleDiscussionReplyReaction, updateDiscussionReply, followDiscussion, unfollowDiscussion, isFollowingDiscussion, DiscussionThreadPart } from '../lib/discussion';
import { notifyToast } from '../lib/toast';
import { RichText } from './RichText';
import { UserIdentity } from './UserIdentity';
import { ReportButton } from './ReportButton';
import { MediaUploadButton } from './MediaUploadButton';
import { MentionTextarea } from './MentionAutocomplete';
import { AIAssistantPanel } from './AIAssistantPanel';

interface Props {
  post: CommunityPost;
  user: CommunityUser | null;
  onNavigate?: (page: any, param?: string) => void;
  onQuote?: (post: CommunityPost, selectedText?: string) => void;
  onCreated?: () => void;
}

type ReplyNode = CommunityComment & { children: ReplyNode[]; childCount: number; depth: number };

const toTree = (items: CommunityComment[], sort: DiscussionSort, authorId?: string, unreadIds = new Set<string>()): ReplyNode[] => {
  const sorted = [...items];
  const byParent = new Map<string, CommunityComment[]>();
  sorted.forEach(item => { const key = item.parentId || ''; const list = byParent.get(key) || []; list.push(item); byParent.set(key, list); });
  const childCount = new Map<string, number>(); items.forEach(item => { if (item.parentId) childCount.set(item.parentId, (childCount.get(item.parentId) || 0) + 1); });
  const score = (item: CommunityComment) => Number(item.likeCount || 0) * 2 + Number(childCount.get(item.id) || 0) + Number(item.isAuthorResponse || item.authorId === authorId) * 4;
  const cmp = (a: CommunityComment, b: CommunityComment) => {
    if (sort === 'newest') return new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime();
    if (sort === 'oldest') return new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime();
    if (sort === 'author') return Number(!!(b.isAuthorResponse || b.authorId===authorId)) - Number(!!(a.isAuthorResponse || a.authorId===authorId)) || score(b)-score(a);
    if (sort === 'helpful') return score(b)-score(a);
    if (sort === 'unread') return Number(unreadIds.has(b.id))-Number(unreadIds.has(a.id)) || score(b)-score(a);
    if (sort === 'discussed') return Number(childCount.get(b.id)||0)-Number(childCount.get(a.id)||0) || score(b)-score(a);
    return score(b)-score(a) || new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime();
  };
  const build = (parentId: string, depth: number): ReplyNode[] => (byParent.get(parentId)||[]).sort(cmp).map(item=>({ ...item, depth, childCount: childCount.get(item.id)||0, children: build(item.id, Math.min(depth+1, 8)) }));
  return build('',0);
};

export const DiscussionPanel: React.FC<Props> = ({ post, user, onNavigate, onQuote }) => {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [sort, setSort] = useState<DiscussionSort>('top');
  const [replyTo, setReplyTo] = useState<string>('');
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string>('');
  const [editingText, setEditingText] = useState('');
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState(false);
  const [sending, setSending] = useState(false);
  const [readId, setReadId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [threadParts, setThreadParts] = useState<DiscussionThreadPart[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ overview:string; arguments:string[]; agreements:string[]; disagreements:string[]; unresolved:string[]; useful:string[] }|null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [replyMedia, setReplyMedia] = useState<string[]>([]);
  const [replyPoll, setReplyPoll] = useState(false);
  const [replyPollQuestion, setReplyPollQuestion] = useState('');
  const [replyPollOptions, setReplyPollOptions] = useState(['','']);

  useEffect(() => subscribeCommunityComments(post.id, setComments), [post.id]);
  useEffect(() => { let active=true; void isFollowingDiscussion(post.id,user?.uid).then(v=>active&&setFollowing(v)); return()=>{active=false}; },[post.id,user?.uid]);
  useEffect(() => { let active=true; if(!user){setReadId('');return()=>{active=false}} void getDiscussionReadState(post.id,user.uid).then(v=>active&&setReadId(v?.lastReadReplyId||'')); return()=>{active=false}; },[post.id,user?.uid]);
  useEffect(() => { let active=true; if(!post.threadId){setThreadParts([]);return()=>{active=false}} void getThread(post.threadId, post.communityId).then(v=>active&&setThreadParts(v)).catch(()=>active&&setThreadParts([])); return()=>{active=false}; },[post.threadId,post.id]);
  useEffect(() => { let active=true; void getDiscussionParticipants(comments,post).then(v=>active&&setParticipants(v)); return()=>{active=false}; },[comments,post]);
  useEffect(() => { const raw=new URLSearchParams(window.location.search).get('reply')||''; if(raw){setExpanded(prev=>new Set(prev).add(raw)); setTimeout(()=>document.getElementById(`discussion-reply-${raw}`)?.scrollIntoView({behavior:'smooth',block:'center'}),120); void saveDiscussionReadState(post.id,user?.uid,raw).catch(()=>{});} },[post.id,user?.uid]);

  const nodes = useMemo(()=>toTree(comments,sort,post.authorId,readId?new Set(comments.filter(c=>c.id!==readId).map(c=>c.id)):new Set()),[comments,sort,post.authorId,readId]);
  const unreadCount = useMemo(()=>readId ? Math.max(0, comments.findIndex(c=>c.id===readId) < 0 ? 0 : comments.length - comments.findIndex(c=>c.id===readId)-1) : 0,[comments,readId]);

  const publishReply = async () => {
    if (!user || !input.trim()) return;
    setSending(true);
    try {
      const mentionedUsernames=Array.from(input.matchAll(/@([a-zA-Z0-9_]{3,30})/g)).map(x=>x[1].toLowerCase()).slice(0,20);
      const pollOptions=replyPollOptions.map(x=>x.trim()).filter(Boolean);
      const created = await replyToDiscussion(post.id,user,input,replyTo||undefined,{mentionedUsernames,mediaUrls:replyMedia, ...(replyPoll && pollOptions.length>=2 ? { poll:{question:replyPollQuestion.trim()||input.slice(0,120),options:pollOptions,allowMultiple:false} } : {}) } as any);
      setInput(''); setReplyTo(''); setReplyMedia([]); setReplyPoll(false); setReplyPollQuestion(''); setReplyPollOptions(['','']); setExpanded(prev=>new Set(prev).add(created.id));
      await saveDiscussionReadState(post.id,user.uid,created.id);
    } catch(e:any){notifyToast(e?.message||'Could not publish reply.','error')} finally{setSending(false)}
  };
  const editReply = async () => { if(!editingId||!editingText.trim())return; try{await updateDiscussionReply(post.id,editingId,editingText);setEditingId('');setEditingText('');notifyToast('Reply updated.','success')}catch(e:any){notifyToast(e?.message||'Could not update reply.','error')} };
  const removeReply = async (id:string) => { if(!confirm('Delete this reply?'))return; try{await deleteComment(post.id,id);notifyToast('Reply deleted.','success')}catch(e:any){notifyToast(e?.message||'Could not delete reply.','error')} };
  const reactReply = async (id:string) => { if(!user){notifyToast('Sign in to react.','error');return;} try{const active=await toggleDiscussionReplyReaction(post.id,id);setLiked(prev=>{const n=new Set(prev);active?n.add(id):n.delete(id);return n;});}catch(e:any){notifyToast(e?.message||'Reaction failed.','error')} };
  const toggleFollow = async () => { if(!user){notifyToast('Sign in to follow this discussion.','error');return;} try{if(following){await unfollowDiscussion(post.id,user.uid);setFollowing(false)}else{await followDiscussion(post.id,user.uid);setFollowing(true)}}catch(e:any){notifyToast(e?.message||'Could not update follow state.','error')} };
  const goReply = (id:string) => { setReplyTo(id); setExpanded(prev=>new Set(prev).add(id)); document.getElementById(`discussion-composer-${post.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}); };
  const copyReplyLink = async (id:string) => { const url=`${window.location.origin}/discussion/${encodeURIComponent(post.id)}?reply=${encodeURIComponent(id)}`; try{await navigator.clipboard.writeText(url);notifyToast('Reply link copied.','success')}catch{window.prompt('Copy reply link',url)} };

  const makeSummary = async () => {
    if(summary || summaryBusy) return;
    if(comments.length < 5){ notifyToast('Add at least 5 replies before generating a discussion summary.','error'); return; }
    setSummaryBusy(true);
    try {
      const data:any = await requestAI('analyze',{contentType:'discussion',contentId:post.id,title:post.title,content:`${post.content}\n\nREPLIES\n${comments.slice(0,120).map(c=>`[${c.id}] @${c.authorUsername}: ${c.content}`).join('\n')}`,metadata:{author:post.authorName,replyCount:comments.length}});
      setSummary({overview:data.overview||data.mainIdea||'Analysis generated.',arguments:data.arguments||data.keyPoints||[],agreements:data.agreements||[],disagreements:data.disagreements||[],unresolved:data.unresolved||data.openQuestions||[],useful:data.useful||[]}); notifyToast('Discussion intelligence generated.','success');
    }catch(e:any){notifyToast(e?.message||'AI summary unavailable.','error')}finally{setSummaryBusy(false)}
  };

  const renderNode = (node:ReplyNode):React.ReactNode => {
    const isExpanded = expanded.has(node.id) || node.depth < 2;
    const isUnread = !!readId && node.id !== readId && comments.findIndex(c=>c.id===node.id) > comments.findIndex(c=>c.id===readId);
    const isAuthor = node.authorId===post.authorId;
    return <div key={node.id} id={`discussion-reply-${node.id}`} className={`relative border-2 border-black bg-white ${node.depth?'ml-3 sm:ml-8 mt-2':''} ${isUnread?'ring-2 ring-[var(--color-primary)]':''}`}>
      <div className="p-3 sm:p-4">
        {node.depth>0 && <div className="font-mono text-[8px] text-neutral-500 mb-2">↳ REPLYING IN THREAD · DEPTH {node.depth}</div>}
        <div className="flex items-start gap-2">
          <UserIdentity name={node.authorName||'User'} username={node.authorUsername} avatar={node.authorAvatar} verified={node.isVerified} verificationColor={node.verificationColor} size="sm" onClick={node.authorUsername&&onNavigate?()=>onNavigate('community_profile',node.authorUsername):undefined}/>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] font-black uppercase flex flex-wrap items-center gap-2"><span>{node.authorId===post.authorId?'AUTHOR':node.platformRole==='master_admin'?'MASTER ADMIN':node.platformRole==='moderator'?'MODERATOR':''}</span>{(node.isAuthorResponse||isAuthor)&&<span className="border-2 border-black bg-[var(--color-primary)] px-1.5">AUTHOR RESPONSE</span>}{node.editedAt&&<span className="text-neutral-500">· EDITED</span>}{isUnread&&<span className="border-2 border-black px-1 bg-black text-white">NEW</span>}</div>
            {editingId===node.id?<div className="mt-2"><textarea value={editingText} onChange={e=>setEditingText(e.target.value)} className="w-full min-h-28 border-2 border-black p-2"/><div className="mt-2 flex gap-2"><button onClick={()=>void editReply()} className="border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-[10px] font-black">SAVE</button><button onClick={()=>setEditingId('')} className="border-2 border-black px-3 py-2 font-mono text-[10px]">CANCEL</button></div></div>:<div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words"><RichText text={node.isDeleted?'[deleted]':node.content} onMentionClick={u=>onNavigate?.('community_profile',u)}/></div>}
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[9px] font-black uppercase">
              <button onClick={()=>void reactReply(node.id)} className={`border-2 border-black px-2 py-1 ${liked.has(node.id)?'bg-[var(--color-primary)]':''}`}><ThumbsUp className="inline w-3 h-3"/> {Number(node.likeCount||0)}</button>
              <button onClick={()=>goReply(node.id)} className="border-2 border-black px-2 py-1"><Reply className="inline w-3 h-3"/> REPLY</button>
              <button onClick={()=>onQuote?.(post,node.content)} className="border-2 border-black px-2 py-1"><Quote className="inline w-3 h-3"/> QUOTE</button>
              <button onClick={()=>void copyReplyLink(node.id)} className="border-2 border-black px-2 py-1"><Link2 className="inline w-3 h-3"/> COPY LINK</button>
              {user?.uid===node.authorId&&!node.isDeleted&&<button onClick={()=>{setEditingId(node.id);setEditingText(node.content)}} className="border-2 border-black px-2 py-1"><Edit3 className="inline w-3 h-3"/> EDIT</button>}
              {(user?.uid===node.authorId)&&<button onClick={()=>void removeReply(node.id)} className="border-2 border-black px-2 py-1 text-red-600"><Trash2 className="inline w-3 h-3"/> DELETE</button>}
              <ReportButton targetType="comment" targetId={`${post.id}/${node.id}`} />
            </div>
          </div>
        </div>
        {!!node.childCount&&<div className="mt-3"><button onClick={()=>setExpanded(prev=>{const n=new Set(prev);n.has(node.id)?n.delete(node.id):n.add(node.id);return n})} className="font-mono text-[9px] font-black border-2 border-black px-2 py-1 bg-neutral-50">{isExpanded?<ChevronDown className="inline w-3 h-3"/>:<ChevronRight className="inline w-3 h-3"/>}{node.childCount} {node.childCount===1?'REPLY':'REPLIES'}</button></div>}
      </div>
      {isExpanded&&node.children.map(renderNode)}
    </div>;
  };

  return <section className="mt-12 border-4 border-black bg-neutral-50 p-4 sm:p-6 space-y-5" aria-label="Discussion 2.0">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-black pb-4">
      <div><div className="font-mono text-[9px] font-black uppercase">V78 · DISCUSSION 2.0</div><h2 className="font-display text-3xl font-black uppercase">THE CONVERSATION</h2><div className="font-mono text-[9px] text-neutral-500 mt-1">{comments.length} REPLIES · {participants.length} PARTICIPANTS · {post.commentsCount||comments.length} TOTAL COMMENTS</div></div>
      <div className="flex flex-wrap gap-2"><button onClick={()=>void toggleFollow()} className={`border-2 border-black px-3 py-2 font-mono text-[10px] font-black ${following?'bg-[var(--color-primary)] shadow-[3px_3px_0_#000]':''}`}>{following?<BellOff className="inline w-3 h-3"/>:<Bell className="inline w-3 h-3"/>} {following?'UNFOLLOW':'FOLLOW DISCUSSION'}</button><button onClick={()=>void navigator.clipboard?.writeText(`${window.location.origin}/discussion/${post.id}`).then(()=>notifyToast('Discussion link copied.','success')).catch(()=>{})} className="border-2 border-black px-3 py-2 font-mono text-[10px] font-black"><Link2 className="inline w-3 h-3"/> SHARE</button></div>
    </div>
    {threadParts.length>1&&<div className="border-4 border-black bg-white p-4"><div className="flex justify-between gap-3"><div><div className="font-mono text-[9px] font-black uppercase">THREAD</div><div className="font-display font-black text-xl uppercase">{post.threadTopic||post.title}</div></div><div className="font-mono text-xs font-black">{post.threadIndex||1}/{post.threadTotal||threadParts.length}</div></div><div className="mt-3 flex gap-1 overflow-x-auto pb-1">{threadParts.map(part=><button key={part.id} onClick={()=>onNavigate?.('community_post',part.id)} className={`min-w-12 border-2 border-black px-2 py-2 font-mono text-[9px] font-black ${part.id===post.id?'bg-[var(--color-primary)]':''}`}>{part.threadIndex||1}/{part.threadTotal||threadParts.length}</button>)}</div><div className="mt-3 flex flex-wrap gap-2">{threadParts.filter(p=>Number(p.threadIndex||0)<Number(post.threadIndex||0)).slice(-1).map(p=><button key={p.id} onClick={()=>onNavigate?.('community_post',p.id)} className="border-2 border-black px-3 py-2 font-mono text-[9px]">← PREVIOUS PART</button>)}{threadParts.filter(p=>Number(p.threadIndex||0)>Number(post.threadIndex||0)).slice(0,1).map(p=><button key={p.id} onClick={()=>onNavigate?.('community_post',p.id)} className="border-2 border-black px-3 py-2 font-mono text-[9px]">NEXT PART →</button>)}</div></div>}
    <AIAssistantPanel input={{contentType:'discussion',contentId:post.id,title:post.title,content:post.content,metadata:{author:post.authorName,replyCount:comments.length,participants:participants.length},sourceRevision:post.updatedAt||post.createdAt}}/>
    {participants.length>0&&<div className="border-2 border-black bg-white p-3 flex flex-wrap items-center gap-3"><Users className="w-4 h-4"/><span className="font-mono text-[10px] font-black uppercase">PARTICIPANTS</span>{participants.slice(0,10).map(p=><button key={p.uid} title={`@${p.username||''}`} onClick={()=>p.username&&onNavigate?.('community_profile',p.username)} className="flex items-center gap-1 border-2 border-black px-2 py-1 bg-white"><span className="w-5 h-5 bg-neutral-200 overflow-hidden inline-block">{p.avatar&&<img src={p.avatar} alt="" className="w-full h-full object-cover"/>}</span><span className="font-mono text-[9px]">@{p.username||'user'}</span></button>)}{participants.length>10&&<span className="font-mono text-[9px]">+{participants.length-10} MORE</span>}</div>}
    <div className="flex flex-wrap gap-2"><span className="font-mono text-[9px] font-black uppercase px-2 py-2 border-2 border-black bg-white">SORT</span>{(['top','newest','most','author','helpful','oldest','unread'] as const).map(v=>{const mapped:any=v==='most'?'discussed':v;return <button key={v} onClick={()=>setSort(mapped)} className={`border-2 border-black px-2 py-2 font-mono text-[9px] font-black ${sort===mapped?'bg-black text-white':''}`}>{v==='most'?'MOST DISCUSSED':v.toUpperCase()}</button>})}{unreadCount>0&&<button onClick={()=>setSort('unread')} className="border-2 border-black px-2 py-2 bg-[var(--color-primary)] font-mono text-[9px] font-black">{unreadCount} NEW</button>}</div>
    {comments.length>=5&&<div className="border-4 border-black bg-[var(--color-primary)] p-4 flex flex-wrap items-center justify-between gap-3"><div><div className="font-display font-black uppercase flex items-center gap-2"><Sparkles className="w-4 h-4"/> CONVERSATION INTELLIGENCE</div><div className="font-mono text-[9px] mt-1">Summary, arguments, agreements, disagreements and unresolved questions.</div></div><button disabled={summaryBusy} onClick={()=>void makeSummary()} className="border-2 border-black bg-white px-3 py-2 font-mono text-[10px] font-black">{summaryBusy?'ANALYZING…':'GENERATE SUMMARY'}</button></div>}
    {summary&&<div className="border-4 border-black bg-white p-4 space-y-4"><div className="flex justify-between"><h3 className="font-display text-xl font-black uppercase">DISCUSSION SUMMARY</h3><button onClick={()=>setSummary(null)}><X className="w-4 h-4"/></button></div><p className="text-sm leading-relaxed">{summary.overview}</p>{[['MAIN ARGUMENTS',summary.arguments],['AGREEMENTS',summary.agreements],['DISAGREEMENTS',summary.disagreements],['UNRESOLVED',summary.unresolved],['USEFUL REPLIES',summary.useful]].map(([label,items])=><div key={String(label)}><div className="font-mono text-[9px] font-black mb-1">{label}</div><ul className="list-disc ml-5 text-sm">{(items as string[]).slice(0,8).map((x,i)=><li key={i}>{x}</li>)}</ul></div>)}</div>}
    <div className="space-y-2">{nodes.length?nodes.map(renderNode):<div className="border-4 border-dashed border-black p-10 text-center font-mono text-[10px]">NO REPLIES YET. START THE CONVERSATION.</div>}</div>
    <div id={`discussion-composer-${post.id}`} className="border-4 border-black bg-white p-4 sm:p-5 sticky bottom-3 z-10 shadow-[4px_4px_0_#000]">
      {replyTo&&<div className="mb-3 border-2 border-black bg-[var(--color-primary)] px-3 py-2 flex justify-between gap-2 font-mono text-[9px] font-black"><span>REPLYING TO {comments.find(c=>c.id===replyTo)?.authorUsername?'@'+comments.find(c=>c.id===replyTo)?.authorUsername:'REPLY'}</span><button onClick={()=>setReplyTo('')}><X className="w-3 h-3"/></button></div>}
      {user?<><div className="border-2 border-black bg-neutral-50 p-3"><div className="flex flex-wrap gap-2 mb-2"><button type="button" onClick={()=>setInput(v=>v+'**bold**')} className="border-2 border-black px-2 py-1 font-mono text-[9px] font-black">B</button><button type="button" onClick={()=>setInput(v=>v+'`code`')} className="border-2 border-black px-2 py-1 font-mono text-[9px]">CODE</button><button type="button" onClick={()=>setInput(v=>v+'[link](https://)')} className="border-2 border-black px-2 py-1 font-mono text-[9px]">LINK</button><button type="button" onClick={()=>setInput(v=>v+`\n> quoted text\n`)} className="border-2 border-black px-2 py-1 font-mono text-[9px]">QUOTE</button><button type="button" onClick={()=>setReplyPoll(v=>!v)} className={`border-2 border-black px-2 py-1 font-mono text-[9px] ${replyPoll?'bg-[var(--color-primary)]':''}`}>POLL</button></div><MentionTextarea value={input} setValue={setInput} placeholder={replyTo?'Write your reply…':'Add to the conversation… Mention @username to notify people.'} maxLength={5000} rows={6} className="w-full min-h-28 border-2 border-black p-3"/><div className="mt-2 flex flex-wrap gap-2"><MediaUploadButton folder="discussion-replies" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" label="IMAGE" compact onUploaded={url=>setReplyMedia(v=>Array.from(new Set([...v,url])).slice(0,6))}/><MediaUploadButton folder="discussion-replies" accept="video/mp4,video/webm,video/quicktime" label="VIDEO" compact onUploaded={url=>setReplyMedia(v=>Array.from(new Set([...v,url])).slice(0,4))}/>{replyMedia.map(url=><button key={url} onClick={()=>setReplyMedia(v=>v.filter(x=>x!==url))} className="border-2 border-black px-2 py-1 font-mono text-[9px] max-w-[180px] truncate">{url.split('/').pop()} ×</button>)}</div>{replyPoll&&<div className="mt-3 border-2 border-black bg-white p-3 space-y-2"><input value={replyPollQuestion} onChange={e=>setReplyPollQuestion(e.target.value)} placeholder="POLL QUESTION" className="w-full border-2 border-black p-2 font-mono text-xs"/>{replyPollOptions.map((v,i)=><input key={i} value={v} onChange={e=>setReplyPollOptions(p=>p.map((x,j)=>j===i?e.target.value:x))} placeholder={`OPTION ${i+1}`} className="w-full border-2 border-black p-2 font-mono text-xs"/>)}<button type="button" onClick={()=>setReplyPollOptions(p=>p.length<6?[...p,'']:p)} className="border-2 border-black px-2 py-1 font-mono text-[9px]">+ OPTION</button></div>}</div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[9px] text-neutral-500">{input.length}/5000 · {replyMedia.length} MEDIA · replies, quotes, mentions & polls</span><div className="flex gap-2"><button onClick={()=>onQuote?.(post,input.trim().slice(0,1000))} disabled={!input.trim()} className="border-2 border-black px-3 py-2 font-mono text-[9px] font-black"><Quote className="inline w-3 h-3"/> QUOTE</button><button disabled={sending||(!input.trim()&&!replyPoll)} onClick={()=>void publishReply()} className="border-2 border-black bg-black text-white px-4 py-2 font-mono text-[10px] font-black">{sending?'POSTING…':'POST REPLY'}</button></div></div></>:<div className="text-center border-2 border-black bg-neutral-50 p-5 font-mono text-xs">SIGN IN TO JOIN THE DISCUSSION.</div>}
    </div>
  </section>;
};
