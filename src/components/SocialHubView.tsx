import React, { useEffect, useMemo, useState } from 'react';
import { CommunityUser, CommunityPost, PageView } from '../types';
import {
  getCommunities, createCommunity, updateCommunity, deleteCommunity, joinCommunity, leaveCommunity,
  subscribeCommunityFeed, createCommunityPost, updateCommunityPost, deleteCommunityPost,
  voteCommunityPost, voteCommunityPoll, getCommunityMembers, setCommunityMemberRole, removeCommunityMember,
  getQuestions, createQuestion, updateQuestion, deleteQuestion, getAnswers, createAnswer, updateAnswer,
  deleteAnswer, markBestAnswer, voteAnswer, getTopics, createTopic, updateTopic, deleteTopic, toggleTopicFollow,
  subscribeMessages, subscribeConversation, sendMessage, deleteMessage, markConversationRead,
  reportContent, adminSetCommunityPostModeration, isSocialAdmin,
  SocialCommunity, CommunityFeedPost, SocialQuestion, SocialAnswer, SocialTopic, SocialMessage
} from '../lib/social';
import { getAllCommunityUsers, subscribeCommunityPosts, getPosts, createPost, updatePost, deletePost } from '../lib/community';
import {
  Users, MessageSquare, HelpCircle, Hash, Plus, Send, Search, Shield, Mail, TrendingUp, X,
  Edit2, Trash2, Settings, UserMinus, Flag, Pin, Lock, Link as LinkIcon, Image as ImageIcon,
  Share2, Archive, Star, Bell, CheckCircle2
} from 'lucide-react';
import { formatDisplayDate } from '../lib/dateUtils';

interface Props { userProfile: CommunityUser | null; onNavigate: (page: PageView, param?: string) => void; }
type Tab = 'feed' | 'blogs' | 'discussions' | 'communities' | 'questions' | 'topics' | 'messages';
type SortMode = 'new' | 'hot' | 'top' | 'rising';
type PostType = 'discussion' | 'question' | 'link' | 'poll' | 'announcement';

const notifyError = (e: unknown) => e instanceof Error ? e.message : 'Operation failed.';
const dedupeById = <T extends { id: string }>(items: T[]) => Array.from(new Map(items.map(x => [x.id, x])).values());

export const SocialHubView: React.FC<Props> = ({ userProfile, onNavigate }) => {
  const [tab, setTab] = useState<Tab>('feed');
  const [legacyPosts, setLegacyPosts] = useState<CommunityPost[]>([]);
  const [communities, setCommunities] = useState<SocialCommunity[]>([]);
  const [selected, setSelected] = useState<SocialCommunity | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityFeedPost[]>([]);
  const [questions, setQuestions] = useState<SocialQuestion[]>([]);
  const [topics, setTopics] = useState<SocialTopic[]>([]);
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [conversationMessages, setConversationMessages] = useState<SocialMessage[]>([]);
  const [activeChat, setActiveChat] = useState<CommunityUser | null>(null);
  const [answers, setAnswers] = useState<Record<string, SocialAnswer[]>>({});

  const [search, setSearch] = useState('');
  const [communitySearch, setCommunitySearch] = useState('');
  const [postSearch, setPostSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [legacyComposer, setLegacyComposer] = useState(false);
  const [legacyPostType, setLegacyPostType] = useState<'blog' | 'discussion'>('blog');
  const [communityForm, setCommunityForm] = useState(false);
  const [questionForm, setQuestionForm] = useState(false);
  const [topicForm, setTopicForm] = useState(false);
  const [postForm, setPostForm] = useState(false);
  const [editCommunity, setEditCommunity] = useState(false);
  const [manageMembers, setManageMembers] = useState(false);
  const [editPost, setEditPost] = useState<CommunityFeedPost | null>(null);
  const [editQuestion, setEditQuestion] = useState<SocialQuestion | null>(null);
  const [editAnswer, setEditAnswer] = useState<SocialAnswer | null>(null);
  const [editTopic, setEditTopic] = useState<SocialTopic | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [threadView, setThreadView] = useState<CommunityFeedPost | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topicsInput, setTopicsInput] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [rulesInput, setRulesInput] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [postType, setPostType] = useState<PostType>('discussion');
  const [flair, setFlair] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [pollOptions, setPollOptions] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const admin = isSocialAdmin();
  const currentIsModerator = userProfile?.platformRole === 'moderator';
  const canStaff = admin || currentIsModerator;

  const showError = (e: unknown) => setError(notifyError(e));
  const requireAuth = () => {
    if (!userProfile) { setError('Sign in to use this feature.'); return false; }
    return true;
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    const result = await Promise.allSettled([
      getCommunities(), getQuestions(), getTopics(), getAllCommunityUsers(), getPosts()
    ]);
    const [c, q, t, u, p] = result;
    const failures: string[] = [];
    if (c.status === 'fulfilled') {
      setCommunities(c.value);
      if (selected) {
        const fresh = c.value.find(x => x.id === selected.id);
        if (fresh) setSelected(fresh); else setSelected(null);
      }
    } else failures.push('communities');
    if (q.status === 'fulfilled') setQuestions(q.value); else failures.push('questions');
    if (t.status === 'fulfilled') setTopics(qToTopics(t.value)); else failures.push('topics');
    if (u.status === 'fulfilled') setUsers(u.value); else failures.push('people');
    if (p.status === 'fulfilled') setLegacyPosts(p.value); else failures.push('posts');
    if (failures.length === 5) setError('Unable to load Social / Community cloud data.');
    else if (failures.length) setMessage(`Some sections failed to load: ${failures.join(', ')}`);
    setLoading(false);
  };

  const qToTopics = (value: unknown): SocialTopic[] => Array.isArray(value) ? value as SocialTopic[] : [];

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!selected) { setCommunityPosts([]); return; }
    return subscribeCommunityFeed(selected.id, snap => setCommunityPosts(dedupeById(snap)));
  }, [selected?.id]);
  useEffect(() => subscribeCommunityPosts(undefined, snap => setLegacyPosts(dedupeById(snap))), []);
  useEffect(() => {
    if (!selected || !manageMembers) return;
    getCommunityMembers(selected.id).then(setMembers).catch(() => setMembers([]));
  }, [selected?.id, manageMembers]);
  useEffect(() => {
    if (!userProfile) { setMessages([]); return; }
    return subscribeMessages(userProfile.uid, setMessages);
  }, [userProfile?.uid]);
  useEffect(() => {
    if (!userProfile || !activeChat) { setConversationMessages([]); return; }
    getConversationSafe(userProfile.uid, activeChat.uid);
    const unsub = subscribeConversation(userProfile.uid, activeChat.uid, setConversationMessages);
    markConversationRead(userProfile.uid, activeChat.uid).catch(() => {});
    return unsub;
  }, [activeChat?.uid, userProfile?.uid]);

  const getConversationSafe = async (uid: string, otherUid: string) => {
    try {
      const { getMessages } = await import('../lib/social');
      setConversationMessages(await getMessages(uid, otherUid));
    } catch (e) { showError(e); }
  };

  const chooseCommunity = (c: SocialCommunity) => { setSelected(c); setTab('communities'); setError(''); };

  const createLegacy = async () => {
    if (!requireAuth() || !title.trim() || !content.trim()) return;
    try {
      const p = await createPost({
        type: legacyPostType, title: title.trim(), content: content.trim(), authorId: userProfile!.uid,
        authorUsername: userProfile!.username, authorName: userProfile!.displayName, authorAvatar: userProfile!.photoURL || '',
        isVerified: !!userProfile!.isVerified, verificationColor: userProfile!.verificationColor,
        platformRole: userProfile!.platformRole || (admin ? 'master_admin' : undefined)
      });
      setLegacyPosts(x => [p, ...x.filter(v => v.id !== p.id)]);
      resetComposer(); setLegacyComposer(false);
    } catch (e) { showError(e); }
  };

  const editLegacy = async (p: CommunityPost) => {
    if (!userProfile || (p.authorId !== userProfile.uid && !canStaff)) return;
    const nextTitle = window.prompt('Edit title', p.title); if (nextTitle === null) return;
    const nextContent = window.prompt('Edit content', p.content); if (nextContent === null) return;
    try { await updatePost(p.id, { title: nextTitle, content: nextContent }); setLegacyPosts(x => x.map(v => v.id === p.id ? { ...v, title: nextTitle, content: nextContent } : v)); }
    catch (e) { showError(e); }
  };

  const removeLegacy = async (p: CommunityPost) => {
    if (!userProfile || (p.authorId !== userProfile.uid && !canStaff) || !window.confirm('Delete this post?')) return;
    try { await deletePost(p.id); setLegacyPosts(x => x.filter(v => v.id !== p.id)); }
    catch (e) { showError(e); }
  };

  const createC = async () => {
    if (!requireAuth() || !name.trim()) return;
    try {
      const c = await createCommunity(userProfile!, name, description, rulesInput.split('\n'));
      setCommunities(x => [c, ...x.filter(v => v.id !== c.id)]);
      setSelected(c); setTab('communities'); setCommunityForm(false); resetComposer();
    } catch (e) { showError(e); }
  };

  const saveC = async () => {
    if (!selected || !userProfile) return;
    try {
      await updateCommunity(selected.id, userProfile.uid, {
        name, description, iconUrl: iconUrl || undefined, bannerUrl: bannerUrl || undefined,
        rules: rulesInput.split('\n').map(x => x.trim()).filter(Boolean), isPrivate: !!selected.isPrivate,
        isLocked: !!selected.isLocked, isArchived: !!selected.isArchived, allowLinks: selected.allowLinks !== false, allowMedia: selected.allowMedia !== false
      });
      setSelected({ ...selected, name, description, iconUrl: iconUrl || undefined, bannerUrl: bannerUrl || undefined, rules: rulesInput.split('\n').map(x => x.trim()).filter(Boolean) });
      setEditCommunity(false); await refresh();
    } catch (e) { showError(e); }
  };

  const removeC = async () => {
    if (!selected || !userProfile || !window.confirm(`Delete c/${selected.slug} and all its community posts?`)) return;
    try {
      const cid = selected.id;
      await deleteCommunity(cid, userProfile.uid);
      setSelected(null); setCommunityPosts([]); setCommunities(x => x.filter(c => c.id !== cid)); setMessage('Community deleted from the cloud.');
    } catch (e) { showError(e); }
  };

  const join = async () => {
    if (!selected || !requireAuth()) return;
    try { await joinCommunity(selected.id, userProfile!); await refresh(); }
    catch (e) { showError(e); }
  };
  const leave = async () => {
    if (!selected || !requireAuth()) return;
    try { await leaveCommunity(selected.id, userProfile!.uid); await refresh(); }
    catch (e) { showError(e); }
  };

  const resetComposer = () => {
    setTitle(''); setContent(''); setLinkUrl(''); setMediaUrl(''); setPollOptions(''); setFlair(''); setReplyFor(null); setPostType('discussion');
  };

  const createP = async (parentPostId?: string) => {
    if (!requireAuth() || !selected || !title.trim() || !content.trim()) return;
    const opts = pollOptions.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8);
    if (postType === 'poll' && opts.length < 2) { setError('A poll needs at least two options.'); return; }
    if (postType === 'link' && !/^https?:\/\//i.test(linkUrl.trim())) { setError('Links must start with http:// or https://'); return; }
    try {
      const p = await createCommunityPost(selected.id, userProfile!, title, content, {
        parentPostId, postType, flair: flair.trim(), linkUrl: linkUrl.trim(),
        mediaUrls: selected.allowMedia === false ? [] : mediaUrl.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6),
        poll: postType === 'poll' ? { question: title.trim(), options: opts } : undefined
      });
      setCommunityPosts(x => [p, ...x.filter(v => v.id !== p.id)]);
      resetComposer(); setPostForm(false); setMessage(parentPostId ? 'Thread reply posted.' : 'Community post published.');
    } catch (e) { showError(e); }
  };

  const saveP = async () => {
    if (!editPost || !selected || !userProfile) return;
    try { await updateCommunityPost(selected.id, editPost.id, userProfile.uid, { title, content }); setCommunityPosts(x => x.map(v => v.id === editPost.id ? { ...v, title, content, editedAt: new Date().toISOString() } : v)); setEditPost(null); resetComposer(); }
    catch (e) { showError(e); }
  };

  const removeP = async (p: CommunityFeedPost) => {
    if (!selected || !userProfile || !window.confirm('Delete this community post?')) return;
    try { await deleteCommunityPost(selected.id, p.id, userProfile.uid); setCommunityPosts(x => x.filter(v => v.id !== p.id)); }
    catch (e) { showError(e); }
  };

  const moderate = async (p: CommunityFeedPost, changes: any) => {
    if (!selected || !userProfile) return;
    try { await adminSetCommunityPostModeration(selected.id, p.id, changes); setCommunityPosts(x => x.map(v => v.id === p.id ? { ...v, ...changes } : v)); }
    catch (e) { showError(e); }
  };

  const createQ = async () => {
    if (!requireAuth() || !title.trim() || !content.trim()) return;
    try { const q = await createQuestion(userProfile!, title, content, topicsInput.split(',').map(x => x.trim())); setQuestions(x => [q, ...x.filter(v => v.id !== q.id)]); resetComposer(); setQuestionForm(false); }
    catch (e) { showError(e); }
  };
  const saveQ = async () => {
    if (!editQuestion || !userProfile) return;
    try { await updateQuestion(editQuestion.id, userProfile.uid, title, content); setQuestions(x => x.map(v => v.id === editQuestion.id ? { ...v, title, details: content } : v)); setEditQuestion(null); resetComposer(); }
    catch (e) { showError(e); }
  };
  const removeQ = async (q: SocialQuestion) => {
    if (!userProfile || !window.confirm('Delete this question and its answers?')) return;
    try { await deleteQuestion(q.id, userProfile.uid); setQuestions(x => x.filter(v => v.id !== q.id)); }
    catch (e) { showError(e); }
  };
  const loadAnswers = async (qid: string) => { try { const loaded = await getAnswers(qid); setAnswers(x => ({ ...x, [qid]: loaded })); } catch (e) { showError(e); } };
  const answer = async (qid: string) => {
    if (!requireAuth() || !content.trim()) return;
    try { const a = await createAnswer(qid, userProfile!, content); setAnswers(x => ({ ...x, [qid]: [a, ...(x[qid] || []).filter(v => v.id !== a.id)] })); setContent(''); }
    catch (e) { showError(e); }
  };
  const saveA = async () => {
    if (!editAnswer || !userProfile) return;
    try { await updateAnswer(editAnswer.questionId, editAnswer.id, userProfile.uid, content); await loadAnswers(editAnswer.questionId); setEditAnswer(null); setContent(''); }
    catch (e) { showError(e); }
  };
  const removeA = async (a: SocialAnswer) => {
    if (!userProfile || !window.confirm('Delete this answer?')) return;
    try { await deleteAnswer(a.questionId, a.id, userProfile.uid); await loadAnswers(a.questionId); }
    catch (e) { showError(e); }
  };
  const best = async (qid: string, aid: string) => { if (!userProfile) return; try { await markBestAnswer(qid, aid, userProfile.uid); await loadAnswers(qid); } catch (e) { showError(e); } };

  const createT = async () => {
    if (!requireAuth() || !name.trim()) return;
    try {
      const t = await createTopic(userProfile!, name, description) as SocialTopic;
      setTopics(x => [t, ...x.filter(v => v.id !== t.id)]); setName(''); setDescription(''); setTopicForm(false);
    } catch (e) { showError(e); }
  };
  const saveT = async () => { if (!editTopic || !userProfile) return; try { await updateTopic(editTopic.id, userProfile.uid, name, description); setTopics(x => x.map(v => v.id === editTopic.id ? { ...v, name, description } : v)); setEditTopic(null); setName(''); setDescription(''); } catch (e) { showError(e); } };
  const removeT = async (t: SocialTopic) => { if (!userProfile || !window.confirm('Delete this topic?')) return; try { await deleteTopic(t.id, userProfile.uid); setTopics(x => x.filter(v => v.id !== t.id)); } catch (e) { showError(e); } };

  const send = async () => { if (!requireAuth() || !activeChat || !content.trim()) return; try { await sendMessage(userProfile!, activeChat, content); setContent(''); } catch (e) { showError(e); } };
  const removeMessageSafe = async (m: SocialMessage) => { if (!userProfile) return; try { await deleteMessage(m.id, userProfile.uid); } catch (e) { showError(e); } };

  const legacyType = tab === 'blogs' ? 'blog' : tab === 'discussions' ? 'discussion' : undefined;
  const legacyVisible = useMemo(() => legacyPosts.filter(p => !legacyType || p.type === legacyType).filter(p => {
    const q = search.trim().toLowerCase(); return !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.authorUsername.toLowerCase().includes(q);
  }), [legacyPosts, legacyType, search]);
  const communityVisible = useMemo(() => communityPosts.filter(p => {
    const q = postSearch.trim().toLowerCase(); return !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.authorUsername.toLowerCase().includes(q) || (p.flair || '').toLowerCase().includes(q);
  }), [communityPosts, postSearch]);
  const sortedCommunity = useMemo(() => {
    return [...communityVisible].sort((a, b) => {
      if (!!b.isPinned !== !!a.isPinned) return b.isPinned ? -1 : 1;
      const ageA = Math.max(1, (Date.now() - new Date(a.createdAt || 0).getTime()) / 3600000);
      const ageB = Math.max(1, (Date.now() - new Date(b.createdAt || 0).getTime()) / 3600000);
      if (sortMode === 'top') return (b.score || 0) - (a.score || 0);
      if (sortMode === 'hot') return ((b.score || 0) * 4 + new Date(b.createdAt || 0).getTime() / 86400000) - ((a.score || 0) * 4 + new Date(a.createdAt || 0).getTime() / 86400000);
      if (sortMode === 'rising') return (((b.score || 0) + (b.commentsCount || 0) * 1.5) / ageB) - (((a.score || 0) + (a.commentsCount || 0) * 1.5) / ageA);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [communityVisible, sortMode]);
  const filteredCommunities = useMemo(() => communities.filter(c => `${c.name} ${c.slug} ${c.ownerUsername || ''}`.toLowerCase().includes(communitySearch.toLowerCase())), [communities, communitySearch]);
  const filteredUsers = useMemo(() => users.filter(u => u.uid !== userProfile?.uid && `${u.displayName} ${u.username}`.toLowerCase().includes(search.toLowerCase())).slice(0, 20), [users, search, userProfile?.uid]);

  const tabs: Array<[Tab, string, React.ComponentType<any>]> = [
    ['feed', 'FEED', TrendingUp], ['blogs', 'BLOGS', FileTextStub], ['discussions', 'DISCUSSIONS', MessageSquare],
    ['communities', 'COMMUNITIES', Users], ['questions', 'QUESTIONS', HelpCircle], ['topics', 'TOPICS', Hash], ['messages', 'MESSAGES', Mail]
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <header className="border-4 border-black bg-black text-white p-7 flex flex-wrap justify-between gap-4">
        <div><div className="font-mono text-[10px] text-[var(--color-primary)] font-black">OFFSCRPT SOCIAL GRAPH</div><h1 className="font-display font-black text-5xl sm:text-7xl uppercase mt-1">SOCIAL / COMMUNITY</h1><p className="font-mono text-sm mt-2 max-w-3xl text-neutral-300">A unified public network for blogs, discussions, communities, questions, answers, topics and direct conversations.</p></div>
        <div className="flex flex-wrap gap-2 h-fit">
          {requireAuth() && <button onClick={() => { resetComposer(); setQuestionForm(true); }} className="px-4 py-3 bg-[var(--color-primary)] text-black border-2 border-white font-mono text-xs font-black">+ QUESTION</button>}
          {requireAuth() && <button onClick={() => { resetComposer(); setPostForm(true); }} className="px-4 py-3 bg-white text-black border-2 border-white font-mono text-xs font-black">+ POST</button>}
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b-4 border-black">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-3 border-2 border-black border-b-0 font-display font-black text-xs flex items-center gap-2 ${tab === id ? 'bg-[var(--color-primary)]' : ''}`}><Icon className="w-4 h-4" />{label}</button>)}</div>
      {error && <div className="border-2 border-red-500 bg-red-100 p-3 font-mono text-xs font-bold flex justify-between"><span>{error}</span><button onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}
      {message && <div className="border-2 border-black bg-[var(--color-primary)] p-3 font-mono text-xs font-bold flex justify-between"><span>{message}</span><button onClick={() => setMessage('')}><X className="w-4 h-4" /></button></div>}
      {loading && <div className="border-2 border-black p-3 bg-white font-mono text-xs">SYNCING SOCIAL CLOUD...</div>}

      {tab === 'feed' && <section className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="border-4 border-black bg-white p-5"><h2 className="font-display font-black text-2xl uppercase">Your Network</h2><p className="font-mono text-xs text-neutral-500 mt-1">Communities, creators and questions in one discovery layer.</p></div>
          {communities.slice(0, 10).map(c => <button key={c.id} onClick={() => chooseCommunity(c)} className="w-full text-left border-2 border-black bg-white p-5 hover:bg-[var(--color-primary)]"><div className="flex justify-between gap-3"><div><div className="font-display font-black text-lg">c/{c.slug}</div><div className="font-mono text-[10px]">{c.membersCount} MEMBERS · {c.postsCount} POSTS · BY @{c.ownerUsername || 'creator'}</div></div><Users /></div><p className="text-sm mt-2">{c.description}</p></button>)}
          {questions.slice(0, 8).map(q => <button key={q.id} onClick={() => { setTab('questions'); loadAnswers(q.id); }} className="w-full text-left border-2 border-black bg-white p-5"><div className="font-mono text-[10px] inline-flex items-center gap-1">QUESTION · @{q.authorUsername} · {q.answersCount} ANSWERS</div><div className="font-display font-black text-xl">{q.title}</div></button>)}
        </div>
        <aside className="space-y-4"><div className="border-4 border-black bg-[var(--color-primary)] p-5"><h3 className="font-display font-black uppercase">Trending Topics</h3>{topics.slice(0, 8).map(t => <button key={t.id} onClick={() => setTab('topics')} className="block w-full text-left mt-3 font-mono text-xs font-bold">#{t.slug}<span className="float-right">{t.followersCount}</span></button>)}</div><div className="border-2 border-black p-5"><h3 className="font-display font-black uppercase">People</h3><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people" className="w-full mt-3 border-2 border-black p-2 font-mono text-xs" />{filteredUsers.map(u => <button key={u.uid} onClick={() => onNavigate('community_profile', u.username)} className="flex items-center gap-2 w-full mt-3 text-left"><div className="w-8 h-8 border-2 border-black rounded-full overflow-hidden">{u.photoURL && <img src={u.photoURL} className="w-full h-full object-cover" />}</div><div><div className="font-bold text-sm">{u.displayName}</div><div className="font-mono text-[10px]">@{u.username}</div></div></button>)}</div></aside>
      </section>}

      {(tab === 'blogs' || tab === 'discussions') && <section className="space-y-4"><div className="flex flex-wrap justify-between gap-3 items-center border-4 border-black bg-white p-5"><div><h2 className="font-display font-black text-2xl uppercase">{tab}</h2><p className="font-mono text-xs text-neutral-500">Cloud-backed user publishing. Previous posts remain available.</p></div><div className="flex gap-2"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="border-2 border-black p-2 font-mono text-xs" /><button onClick={() => { if (requireAuth()) { setLegacyPostType(tab === 'blogs' ? 'blog' : 'discussion'); resetComposer(); setLegacyComposer(true); } }} className="border-2 border-black px-4 py-2 bg-[var(--color-primary)] font-mono text-xs font-black">+ {tab === 'blogs' ? 'BLOG' : 'DISCUSSION'}</button></div></div>{legacyVisible.map(p => <article key={p.id} className="border-4 border-black bg-white p-5"><div className="font-mono text-[10px] inline-flex items-center gap-1">@{p.authorUsername}{((p as any).platformRole==='master_admin'||(p as any).platformRole==='moderator')&&<span className="px-1 border border-black bg-[var(--color-primary)] font-mono text-[9px] font-black">{(p as any).platformRole==='master_admin'?'MASTER':'MOD'}</span>} · {formatDisplayDate(p.createdAt)}</div><h2 className="font-display font-black text-2xl mt-1">{p.title}</h2><p className="mt-2 whitespace-pre-wrap">{p.content}</p><div className="flex flex-wrap gap-2 mt-4"><button onClick={() => onNavigate('community_post', p.id)} className="border-2 border-black px-3 py-2 font-mono text-[10px]">OPEN</button>{userProfile && (p.authorId === userProfile.uid || canStaff) && <><button onClick={() => editLegacy(p)} className="border-2 border-black px-3 py-2 font-mono text-[10px]">EDIT</button><button onClick={() => removeLegacy(p)} className="border-2 border-black bg-red-100 px-3 py-2 font-mono text-[10px]">DELETE</button></>}</div></article>)}{!legacyVisible.length && <Empty text={`NO ${tab.toUpperCase()} YET.`} />}</section>}

      {tab === 'communities' && <section className="grid lg:grid-cols-[340px_1fr] gap-6"><div className="space-y-3"><div className="flex gap-2"><input value={communitySearch} onChange={e => setCommunitySearch(e.target.value)} placeholder="Search communities" className="flex-1 border-2 border-black p-3 font-mono text-xs" /><button onClick={() => { if (requireAuth()) { setName(''); setDescription(''); setRulesInput(''); setCommunityForm(true); } }} className="border-2 border-black px-3 bg-[var(--color-primary)]"><Plus /></button></div>{filteredCommunities.map(c => <button key={c.id} onClick={() => chooseCommunity(c)} className={`w-full text-left border-2 border-black p-4 ${selected?.id === c.id ? 'bg-[var(--color-primary)]' : 'bg-white'}`}><div className="flex gap-3 items-center"><div className="w-10 h-10 border-2 border-black grid place-items-center font-black">{c.iconUrl ? <img src={c.iconUrl} className="w-full h-full object-cover" /> : 'C'}</div><div><div className="font-display font-black">c/{c.slug}</div><div className="font-mono text-[10px]">{c.membersCount} MEMBERS · {c.postsCount} POSTS</div><div className="font-mono text-[10px]">BY @{c.ownerUsername || 'creator'}</div></div></div><p className="text-xs mt-2">{c.description}</p></button>)}</div><div>{selected ? <CommunityPanel onNavigate={onNavigate} community={selected} user={userProfile} posts={sortedCommunity} sortMode={sortMode} setSortMode={setSortMode} postSearch={postSearch} setPostSearch={setPostSearch} canManage={!!userProfile && (selected.ownerId === userProfile.uid || canStaff)} onJoin={join} onLeave={leave} onPost={() => { resetComposer(); setPostForm(true); }} onEdit={() => { setName(selected.name); setDescription(selected.description); setIconUrl(selected.iconUrl || ''); setBannerUrl(selected.bannerUrl || ''); setRulesInput((selected.rules || []).join('\n')); setEditCommunity(true); }} onDelete={removeC} onMembers={() => setManageMembers(true)} onEditPost={p => { setTitle(p.title); setContent(p.content); setEditPost(p); }} onDeletePost={removeP} canManagePost={(p:CommunityFeedPost) => !!userProfile && (p.authorId === userProfile.uid || selected.ownerId === userProfile.uid || canStaff)} onModerate={moderate} onReply={p => { setReplyFor(p.id); setTitle(`Re: ${p.title}`); setContent(''); setPostType('discussion'); setPostForm(true); }} onThread={p => setThreadView(p)} onPoll={async (p,i) => { if (!userProfile) { setError('Sign in to vote.'); return; } try { await voteCommunityPoll(selected.id,p.id,userProfile.uid,i); } catch (e) { showError(e); } }} onReport={(targetType, targetId) => { if (!requireAuth()) return; const r = window.prompt('Reason for report?'); if (r?.trim()) reportContent(userProfile!, targetType, targetId, r).then(() => setMessage('Report submitted.')).catch(showError); }} /> : <Empty text="SELECT A COMMUNITY." />}</div></section>}

      {tab === 'questions' && <section className="space-y-4"><div className="flex flex-wrap justify-between gap-3 border-4 border-black bg-white p-5"><div><h2 className="font-display font-black text-2xl uppercase">Questions & Answers</h2><p className="font-mono text-xs text-neutral-500">Ask, answer, vote and mark the best answer.</p></div><button onClick={() => { if (requireAuth()) { resetComposer(); setQuestionForm(true); } }} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">+ ASK</button></div>{questions.map(q => <article key={q.id} className="border-4 border-black bg-white p-5"><div className="font-mono text-[10px]">@{q.authorUsername} · {q.answersCount} ANSWERS · {q.upvotesCount} UPVOTES</div><h2 className="font-display font-black text-2xl mt-1">{q.title}</h2><p className="mt-2 whitespace-pre-wrap">{q.details}</p><div className="flex flex-wrap gap-2 mt-4"><button onClick={() => loadAnswers(q.id)} className="border-2 border-black px-3 py-2 font-mono text-[10px]">SHOW ANSWERS</button>{userProfile && (q.authorId === userProfile.uid || canStaff) && <><button onClick={() => { setEditQuestion(q); setTitle(q.title); setContent(q.details); }} className="border-2 border-black px-3 py-2 font-mono text-[10px]">EDIT</button><button onClick={() => removeQ(q)} className="border-2 border-black bg-red-100 px-3 py-2 font-mono text-[10px]">DELETE</button></>}</div>{answers[q.id]?.map(a => <div key={a.id} className={`mt-4 border-2 border-black p-4 ${a.isBest ? 'bg-[var(--color-primary)]' : 'bg-neutral-50'}`}><div className="font-mono text-[10px] inline-flex items-center gap-1">@{a.authorUsername}{((a as any).platformRole==='master_admin'||(a as any).platformRole==='moderator')&&<span className="px-1 border border-black bg-[var(--color-primary)] font-mono text-[9px] font-black">{(a as any).platformRole==='master_admin'?'MASTER':'MOD'}</span>} {a.isBest ? '· BEST ANSWER' : ''}</div><p className="mt-2 whitespace-pre-wrap">{a.content}</p><div className="flex flex-wrap gap-2 mt-3"><button onClick={() => userProfile && voteAnswer(q.id, a.id, userProfile.uid, 'up')} className="border-2 border-black px-2 py-1 font-mono text-[10px]">▲ {a.upvotesCount}</button><button onClick={() => userProfile && voteAnswer(q.id, a.id, userProfile.uid, 'down')} className="border-2 border-black px-2 py-1 font-mono text-[10px]">▼ {a.downvotesCount}</button>{userProfile && (a.authorId === userProfile.uid || canStaff) && <><button onClick={() => { setEditAnswer(a); setContent(a.content); }} className="border-2 border-black px-2 py-1 font-mono text-[10px]">EDIT</button><button onClick={() => removeA(a)} className="border-2 border-black bg-red-100 px-2 py-1 font-mono text-[10px]">DELETE</button></>}{userProfile?.uid === q.authorId && <button onClick={() => best(q.id, a.id)} className="border-2 border-black px-2 py-1 font-mono text-[10px]">✓ BEST</button>}</div></div>)}{userProfile && <div className="mt-4 border-2 border-black p-3"><textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write an answer..." className="w-full border-2 border-black p-3 min-h-24" /><button onClick={() => answer(q.id)} className="mt-2 border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-xs font-black">PUBLISH ANSWER</button></div>}</article>)}{!questions.length && <Empty text="NO QUESTIONS YET." />}</section>}

      {tab === 'topics' && <section className="space-y-4"><div className="flex flex-wrap justify-between border-4 border-black bg-[var(--color-primary)] p-5"><div><h2 className="font-display font-black text-2xl">TOPICS</h2><p className="font-mono text-xs">Follow knowledge areas.</p></div><button onClick={() => { if (requireAuth()) { setName(''); setDescription(''); setTopicForm(true); } }} className="border-2 border-black bg-white px-3 py-2 font-mono text-xs font-black">+ TOPIC</button></div>{topics.map(t => <article key={t.id} className="border-2 border-black bg-white p-4 flex flex-wrap justify-between gap-3"><div><div className="font-display font-black">#{t.slug}</div><div className="font-mono text-[10px]">{t.followersCount} FOLLOWERS · BY @{t.creatorUsername || 'creator'}</div><p className="text-sm mt-1">{t.description}</p></div><div className="flex gap-2"><button onClick={() => userProfile && toggleTopicFollow(t.id, userProfile)} className="border-2 border-black px-3 py-2 font-mono text-[10px]">FOLLOW</button>{userProfile && (t.createdBy === userProfile.uid || canStaff) && <><button onClick={() => { setEditTopic(t); setName(t.name); setDescription(t.description); }} className="border-2 border-black px-2 py-2 font-mono text-[10px]">EDIT</button><button onClick={() => removeT(t)} className="border-2 border-black bg-red-100 px-2 py-2 font-mono text-[10px]">DELETE</button></>}</div></article>)}</section>}

      {tab === 'messages' && <MessagesView user={userProfile} users={users} messages={messages} activeChat={activeChat} setActiveChat={setActiveChat} conversationMessages={conversationMessages} search={search} setSearch={setSearch} content={content} setContent={setContent} onSend={send} onDelete={removeMessageSafe} />}

      {communityForm && <Modal title="Create Community" close={() => setCommunityForm(false)}><input value={name} onChange={e => setName(e.target.value)} placeholder="Community name" className="w-full border-2 border-black p-3" /><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your space" className="w-full border-2 border-black p-3 min-h-28" /><textarea value={rulesInput} onChange={e => setRulesInput(e.target.value)} placeholder="One rule per line" className="w-full border-2 border-black p-3 min-h-24" /><button onClick={createC} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">CREATE COMMUNITY</button></Modal>}
      {postForm && selected && <Modal title={`${replyFor ? 'Reply in' : 'Post in'} c/${selected.slug}`} close={() => { setPostForm(false); setReplyFor(null); resetComposer(); }}><select value={postType} onChange={e => setPostType(e.target.value as PostType)} className="w-full border-2 border-black p-3 font-mono text-xs"><option value="discussion">Discussion</option><option value="question">Question</option><option value="link">Link</option><option value="poll">Poll</option><option value="announcement">Announcement</option></select><input value={title} onChange={e => setTitle(e.target.value.slice(0, 256))} placeholder="Title" className="w-full border-2 border-black p-3" /><textarea value={content} onChange={e => setContent(e.target.value.slice(0, 100000))} placeholder="Write your post..." className="w-full border-2 border-black p-3 min-h-36" /><div className="font-mono text-[10px] text-neutral-500">{content.length}/100000 characters</div>{postType === 'link' && selected.allowLinks !== false && <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full border-2 border-black p-3" />}{postType !== 'announcement' && <input value={flair} onChange={e => setFlair(e.target.value.slice(0, 30))} placeholder="Flair (optional)" className="w-full border-2 border-black p-3" />}{selected.allowMedia !== false && <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="Image URLs, comma separated (max 6)" className="w-full border-2 border-black p-3" />}{postType === 'poll' && <textarea value={pollOptions} onChange={e => setPollOptions(e.target.value)} placeholder="Poll options, one per line (2-8)" className="w-full border-2 border-black p-3 min-h-24" />}<button onClick={() => createP(replyFor || undefined)} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">PUBLISH</button></Modal>}
      {editPost && <Modal title="Edit Community Post" close={() => setEditPost(null)}><input value={title} onChange={e => setTitle(e.target.value)} className="w-full border-2 border-black p-3" /><textarea value={content} onChange={e => setContent(e.target.value)} className="w-full border-2 border-black p-3 min-h-40" /><button onClick={saveP} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">SAVE POST</button></Modal>}
      {editCommunity && selected && <Modal title={`Manage c/${selected.slug}`} close={() => setEditCommunity(false)}><input value={name} onChange={e => setName(e.target.value)} className="w-full border-2 border-black p-3" /><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border-2 border-black p-3" /><input value={iconUrl} onChange={e => setIconUrl(e.target.value)} placeholder="Icon image URL" className="w-full border-2 border-black p-3" /><input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="Banner image URL" className="w-full border-2 border-black p-3" /><textarea value={rulesInput} onChange={e => setRulesInput(e.target.value)} placeholder="One rule per line" className="w-full border-2 border-black p-3 min-h-24" /><div className="grid sm:grid-cols-2 gap-2 font-mono text-xs"><Toggle label="PRIVATE" checked={!!selected.isPrivate} onChange={v => setSelected({ ...selected, isPrivate: v })} /><Toggle label="LOCKED" checked={!!selected.isLocked} onChange={v => setSelected({ ...selected, isLocked: v })} /><Toggle label="ARCHIVED" checked={!!selected.isArchived} onChange={v => setSelected({ ...selected, isArchived: v })} /><Toggle label="ALLOW LINKS" checked={selected.allowLinks !== false} onChange={v => setSelected({ ...selected, allowLinks: v })} /><Toggle label="ALLOW MEDIA" checked={selected.allowMedia !== false} onChange={v => setSelected({ ...selected, allowMedia: v })} /></div><button onClick={saveC} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">SAVE COMMUNITY</button></Modal>}
      {manageMembers && selected && <Modal title={`Members · c/${selected.slug}`} close={() => setManageMembers(false)}><div className="space-y-2 max-h-96 overflow-auto">{members.map(m => <div key={m.id} className="border-2 border-black p-3 flex items-center justify-between"><div><div className="font-mono text-xs font-black">@{m.username}</div><div className="font-mono text-[10px]">{m.role}</div></div>{m.uid !== selected.ownerId && <div className="flex gap-2"><select value={m.role} onChange={async e => { try { await setCommunityMemberRole(selected.id, m.uid, e.target.value as any, userProfile!.uid); setMembers(await getCommunityMembers(selected.id)); } catch (err) { showError(err); } }} className="border border-black font-mono text-[10px]"><option value="member">member</option><option value="moderator">moderator</option></select><button onClick={async () => { try { await removeCommunityMember(selected.id, m.uid, userProfile!.uid); setMembers(await getCommunityMembers(selected.id)); } catch (err) { showError(err); } }} className="border border-black px-2"><UserMinus className="w-3 h-3" /></button></div>}</div>)}{!members.length && <Empty text="NO MEMBERS FOUND." />}</div></Modal>}
      {questionForm && <Modal title="Ask a Question" close={() => setQuestionForm(false)}><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Question title" className="w-full border-2 border-black p-3" /><textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details" className="w-full border-2 border-black p-3 min-h-40" /><input value={topicsInput} onChange={e => setTopicsInput(e.target.value)} placeholder="topics, comma separated" className="w-full border-2 border-black p-3" /><button onClick={createQ} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">PUBLISH QUESTION</button></Modal>}
      {editQuestion && <Modal title="Edit Question" close={() => setEditQuestion(null)}><input value={title} onChange={e => setTitle(e.target.value)} className="w-full border-2 border-black p-3" /><textarea value={content} onChange={e => setContent(e.target.value)} className="w-full border-2 border-black p-3 min-h-40" /><button onClick={saveQ} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">SAVE QUESTION</button></Modal>}
      {editAnswer && <Modal title="Edit Answer" close={() => setEditAnswer(null)}><textarea value={content} onChange={e => setContent(e.target.value)} className="w-full border-2 border-black p-3 min-h-40" /><button onClick={saveA} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">SAVE ANSWER</button></Modal>}
      {editTopic && <Modal title="Edit Topic" close={() => setEditTopic(null)}><input value={name} onChange={e => setName(e.target.value)} className="w-full border-2 border-black p-3" /><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border-2 border-black p-3" /><button onClick={saveT} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">SAVE TOPIC</button></Modal>}
      {legacyComposer && <Modal title={`Create ${legacyPostType === 'blog' ? 'Blog' : 'Discussion'}`} close={() => setLegacyComposer(false)}><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full border-2 border-black p-3" /><textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Content" className="w-full border-2 border-black p-3 min-h-52" /><button onClick={createLegacy} className="border-2 border-black bg-[var(--color-primary)] px-4 py-2 font-mono text-xs font-black">PUBLISH</button></Modal>}
      {threadView && <ThreadModal post={threadView} posts={communityPosts} onClose={() => setThreadView(null)} onNavigate={onNavigate} onReply={p => { setThreadView(null); setReplyFor(p.id); setTitle(`Re: ${p.title}`); setContent(''); setPostType('discussion'); setPostForm(true); }} />}
    </div>
  );
};

interface CommunityPanelProps {
  community: SocialCommunity; user: CommunityUser | null; posts: CommunityFeedPost[]; sortMode: SortMode; setSortMode: (v: SortMode) => void;
  postSearch: string; setPostSearch: (v: string) => void; canManage: boolean; onJoin: () => void; onLeave: () => void; onPost: () => void;
  onEdit: () => void; onDelete: () => void; onMembers: () => void; onEditPost: (p: CommunityFeedPost) => void; onDeletePost: (p: CommunityFeedPost) => void;
  canManagePost: (p: CommunityFeedPost) => boolean; onModerate: (p: CommunityFeedPost, c: any) => void; onReply: (p: CommunityFeedPost) => void;
  onThread: (p: CommunityFeedPost) => void; onPoll: (p: CommunityFeedPost, index: number) => Promise<void>; onReport: (t: string, id: string) => void;
  onNavigate: (page: PageView, param?: string) => void;
}

const CommunityPanel: React.FC<CommunityPanelProps> = props => {
  const { community, user, posts, sortMode, setSortMode, postSearch, setPostSearch, canManage, onJoin, onLeave, onPost, onEdit, onDelete, onMembers, onEditPost, onDeletePost, canManagePost, onModerate, onReply, onThread, onPoll, onReport, onNavigate } = props;
  const [member, setMember] = useState(false); const [role, setRole] = useState('');
  useEffect(() => { if (!user) { setMember(false); setRole(''); return; } getCommunityMembers(community.id).then(ms => { const me = ms.find((m: any) => m.uid === user.uid); setMember(!!me); setRole(me?.role || ''); }).catch(() => {}); }, [community.id, user?.uid]);
  const canModerate = canManage || role === 'moderator' || user?.platformRole === 'moderator';
  const roots = posts.filter(p => !p.parentPostId);
  const children = (id: string) => posts.filter(p => p.parentPostId === id);
  const pinned = posts.filter(p => p.isPinned);

  const renderPost = (p: CommunityFeedPost, depth = 0): React.ReactNode => (
    <article key={p.id} className={`border-2 border-black p-4 bg-white ${depth ? 'ml-6 border-l-8' : ''}`}>
      <div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2 items-center"><button onClick={() => props.onNavigate?.('community_profile', p.authorUsername)} className="font-mono text-[10px] font-black">@{p.authorUsername}</button>{(p.authorPlatformRole === 'moderator' || p.authorPlatformRole === 'master_admin') && <span className="border border-black bg-[var(--color-primary)] px-1 font-mono text-[9px] font-black">{p.authorPlatformRole === 'master_admin' ? 'MASTER' : 'MOD'}</span>}{p.flair && <span className="border border-black px-1 font-mono text-[9px]">{p.flair}</span>}<span className="font-mono text-[9px] uppercase text-neutral-500">{p.postType || 'discussion'}</span></div><span className="font-mono text-[9px] text-neutral-500">{formatDisplayDate(p.createdAt)}{p.editedAt ? ' · EDITED' : ''}</span></div>
      <div className="flex flex-wrap gap-1 mt-2">{p.isPinned && <span className="px-1 bg-[var(--color-primary)] font-mono text-[9px]"><Pin className="inline w-3 h-3" /> PINNED</span>}{p.isLocked && <span className="px-1 bg-neutral-200 font-mono text-[9px]"><Lock className="inline w-3 h-3" /> LOCKED</span>}{p.isArchived && <span className="px-1 bg-neutral-200 font-mono text-[9px]"><Archive className="inline w-3 h-3" /> ARCHIVED</span>}{p.isFeatured && <span className="px-1 bg-yellow-200 font-mono text-[9px]"><Star className="inline w-3 h-3" /> FEATURED</span>}</div>
      <h3 className="font-display font-black text-xl mt-2">{p.title}</h3><p className="text-sm mt-2 whitespace-pre-wrap">{p.content}</p>
      {p.linkUrl && <a href={p.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 font-mono text-xs underline"><LinkIcon className="w-3 h-3" /> OPEN LINK</a>}
      {!!p.mediaUrls?.length && <div className="grid grid-cols-2 gap-2 mt-3">{p.mediaUrls.map((u, i) => <img key={`${p.id}-m-${i}`} src={u} alt="" className="w-full max-h-64 object-cover border-2 border-black" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />)}</div>}
      {p.poll?.options?.length && <div className="mt-3 border-2 border-black p-3"><div className="font-mono text-[10px] font-black">POLL</div>{p.poll.options.map((o, i) => <button key={i} onClick={() => onPoll(p, i)} className="mt-2 w-full text-left border border-black p-2 font-mono text-xs hover:bg-[var(--color-primary)]">{o}<span className="float-right">{Number(p.poll?.votes?.[String(i)] || 0)}</span></button>)}</div>}
      <div className="font-mono text-[10px] mt-4">SCORE {p.score || 0} · {p.commentsCount || 0} REPLIES</div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => user && voteCommunityPost(community.id, p.id, user.uid, 'up')} className="border-2 border-black px-2 py-1 font-mono text-[10px]">▲ UPVOTE</button>
        <button onClick={() => user && voteCommunityPost(community.id, p.id, user.uid, 'down')} className="border-2 border-black px-2 py-1 font-mono text-[10px]">▼ DOWNVOTE</button>
        <button onClick={() => onThread(p)} className="border-2 border-black px-2 py-1 font-mono text-[10px]">THREAD</button>
        <button onClick={() => onReply(p)} disabled={!!p.isLocked} className="border-2 border-black px-2 py-1 font-mono text-[10px]">REPLY</button>
        <button onClick={() => { const url = `${window.location.origin}/#social`; navigator.clipboard?.writeText(url).then(() => window.alert('Post link copied.')).catch(() => {}); }} className="border-2 border-black px-2 py-1 font-mono text-[10px]"><Share2 className="inline w-3 h-3" /> SHARE</button>
        {canManagePost(p) && <><button onClick={() => onEditPost(p)} className="border-2 border-black px-2 py-1 font-mono text-[10px]"><Edit2 className="inline w-3 h-3" /> EDIT</button><button onClick={() => onDeletePost(p)} className="border-2 border-black bg-red-100 px-2 py-1 font-mono text-[10px]"><Trash2 className="inline w-3 h-3" /> DELETE</button></>}
        {canModerate && <><button onClick={() => onModerate(p, { isPinned: !p.isPinned })} className="border-2 border-black px-2 py-1 font-mono text-[10px]">{p.isPinned ? 'UNPIN' : 'PIN'}</button><button onClick={() => onModerate(p, { isLocked: !p.isLocked })} className="border-2 border-black px-2 py-1 font-mono text-[10px]">{p.isLocked ? 'UNLOCK' : 'LOCK'}</button><button onClick={() => onModerate(p, { isFeatured: !p.isFeatured })} className="border-2 border-black px-2 py-1 font-mono text-[10px]">{p.isFeatured ? 'UNFEATURE' : 'FEATURE'}</button><button onClick={() => onModerate(p, { isArchived: !p.isArchived })} className="border-2 border-black px-2 py-1 font-mono text-[10px]">{p.isArchived ? 'UNARCHIVE' : 'ARCHIVE'}</button></>}
        <button onClick={() => onReport('community_post', `${community.id}:${p.id}`)} className="border-2 border-black px-2 py-1 font-mono text-[10px]"><Flag className="inline w-3 h-3" /> REPORT</button>
      </div>
      {children(p.id).map(c => renderPost(c, depth + 1))}
    </article>
  );

  return <div className="border-4 border-black bg-white"><div className="relative p-5 border-b-4 border-black bg-[var(--color-primary)]" style={community.bannerUrl ? { backgroundImage: `url(${community.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><div className="bg-white/90 border-2 border-black p-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-mono text-xs font-black">c/{community.slug}</div><h2 className="font-display font-black text-3xl uppercase">{community.name}</h2><div className="font-mono text-[10px] mt-1">{community.membersCount} MEMBERS · {posts.length} POSTS · CREATED BY <span className="underline">@{community.ownerUsername || 'creator'}</span></div></div><div className="flex gap-2"><button onClick={member ? onLeave : onJoin} className="border-2 border-black px-3 py-2 font-mono text-xs">{member ? 'LEAVE' : 'JOIN'}</button>{member && !community.isArchived && !community.isLocked && <button onClick={onPost} className="border-2 border-black bg-black text-white px-3 py-2 font-mono text-xs">+ POST</button>}</div></div><p className="text-sm mt-3">{community.description}</p><div className="flex flex-wrap gap-2 mt-4">{canManage && <><button onClick={onEdit} className="border-2 border-black px-3 py-2 font-mono text-xs"><Edit2 className="inline w-3 h-3" /> MANAGE</button><button onClick={onMembers} className="border-2 border-black px-3 py-2 font-mono text-xs"><Settings className="inline w-3 h-3" /> MEMBERS / MODS</button><button onClick={onDelete} className="border-2 border-black bg-red-100 px-3 py-2 font-mono text-xs"><Trash2 className="inline w-3 h-3" /> DELETE</button></>}</div>{pinned.length > 0 && <div className="mt-4 border-2 border-black bg-[var(--color-primary)] p-3"><div className="font-mono text-[10px] font-black">PINNED DISCUSSIONS</div><div className="font-mono text-xs mt-1">{pinned.length} pinned item{pinned.length === 1 ? '' : 's'} are prioritized in the feed.</div></div>}{(community.rules || []).length > 0 && <div className="mt-4 border-2 border-black p-3"><div className="font-mono text-[10px] font-black">COMMUNITY RULES</div>{community.rules!.map((r, i) => <div key={i} className="font-mono text-[10px] mt-1">{i + 1}. {r}</div>)}</div>}</div></div><div className="p-5"><div className="flex flex-wrap gap-2 items-center mb-4"><input value={postSearch} onChange={e => setPostSearch(e.target.value)} placeholder="Search this community" className="flex-1 min-w-44 border-2 border-black p-2 font-mono text-xs" /><button onClick={() => setSortMode('new')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] ${sortMode === 'new' ? 'bg-[var(--color-primary)]' : ''}`}>NEW</button><button onClick={() => setSortMode('hot')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] ${sortMode === 'hot' ? 'bg-[var(--color-primary)]' : ''}`}>HOT</button><button onClick={() => setSortMode('top')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] ${sortMode === 'top' ? 'bg-[var(--color-primary)]' : ''}`}>TOP</button><button onClick={() => setSortMode('rising')} className={`border-2 border-black px-3 py-2 font-mono text-[10px] ${sortMode === 'rising' ? 'bg-[var(--color-primary)]' : ''}`}>RISING</button></div>{!roots.length ? <Empty text={community.isArchived ? 'THIS COMMUNITY IS ARCHIVED.' : 'NO POSTS YET. JOIN AND START THE DISCUSSION.'} /> : roots.map(renderPost)}</div></div>;
};

const MessagesView: React.FC<any> = ({ user, users, activeChat, setActiveChat, conversationMessages, search, setSearch, content, setContent, onSend, onDelete }) => {
  if (!user) return <Empty text="SIGN IN TO USE DIRECT MESSAGES." />;
  const people = users.filter((u: CommunityUser) => u.uid !== user.uid && `${u.username} ${u.displayName}`.toLowerCase().includes(search.toLowerCase())).slice(0, 50);
  return <div className="grid lg:grid-cols-[300px_1fr] gap-4 min-h-[560px]"><div className="border-4 border-black bg-white p-3 space-y-2"><div className="font-display font-black text-xl uppercase">Messages</div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find people" className="w-full border-2 border-black p-2 font-mono text-xs" />{people.map((u: CommunityUser) => <button key={u.uid} onClick={() => setActiveChat(u)} className={`w-full text-left border-2 border-black p-3 ${activeChat?.uid === u.uid ? 'bg-[var(--color-primary)]' : ''}`}><div className="font-display font-black">{u.displayName}</div><div className="font-mono text-[10px]">@{u.username}</div></button>)}</div><div className="border-4 border-black bg-white flex flex-col">{activeChat ? <><div className="p-4 border-b-4 border-black bg-[var(--color-primary)] flex justify-between"><div><div className="font-display font-black">{activeChat.displayName}</div><div className="font-mono text-[10px]">@{activeChat.username}</div></div><button onClick={() => setActiveChat(null)}><X /></button></div><div className="flex-1 p-4 space-y-2 overflow-auto">{conversationMessages.map((m: SocialMessage) => <div key={m.id} className={`max-w-[78%] border-2 border-black p-3 ${m.senderId === user.uid ? 'ml-auto bg-[var(--color-secondary)]' : 'bg-neutral-50'}`}><div className="font-mono text-[10px]">{m.senderId === user.uid ? 'YOU' : `@${m.senderUsername}`}</div><div className="text-sm whitespace-pre-wrap mt-1">{m.content}</div><div className="font-mono text-[9px] text-neutral-500 mt-1">{formatDisplayDate(m.createdAt)} {m.read && m.senderId === user.uid ? '· READ' : ''}</div><button onClick={() => onDelete(m)} className="mt-1 font-mono text-[9px] underline">DELETE</button></div>)}{!conversationMessages.length && <Empty text="NO MESSAGES YET." />}</div><div className="p-3 border-t-4 border-black flex gap-2"><textarea value={content} onChange={e => setContent(e.target.value.slice(0, 5000))} placeholder="Write a message..." className="flex-1 border-2 border-black p-2 min-h-12" /><button onClick={onSend} disabled={!content.trim()} className="border-2 border-black bg-[var(--color-primary)] px-4"><Send /></button></div></> : <div className="h-full grid place-items-center font-mono text-xs text-neutral-500">SELECT A CONVERSATION.</div>}</div></div>;
};

const ThreadModal: React.FC<{ post: CommunityFeedPost; posts: CommunityFeedPost[]; onClose: () => void; onNavigate: (p: PageView, param?: string) => void; onReply: (p: CommunityFeedPost) => void }> = ({ post, posts, onClose, onNavigate, onReply }) => {
  const replies = posts.filter(p => p.parentPostId === post.id).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  return <Modal title={`Thread · ${post.title}`} close={onClose}><div className="border-2 border-black p-4"><div className="font-mono text-xs font-black">@{post.authorUsername}</div><h3 className="font-display font-black text-xl mt-1">{post.title}</h3><p className="whitespace-pre-wrap mt-2">{post.content}</p><button onClick={() => onReply(post)} disabled={!!post.isLocked} className="mt-3 border-2 border-black bg-[var(--color-primary)] px-3 py-2 font-mono text-xs font-black">REPLY</button></div><div className="space-y-2">{replies.map(r => <div key={r.id} className="border-2 border-black p-3 ml-4"><div className="font-mono text-[10px] font-black inline-flex items-center gap-1">@{r.authorUsername}{((r as any).authorPlatformRole==='master_admin'||(r as any).authorPlatformRole==='moderator')&&<span className="px-1 border border-black bg-[var(--color-primary)] font-mono text-[9px]">{(r as any).authorPlatformRole==='master_admin'?'MASTER':'MOD'}</span>}</div><p className="text-sm whitespace-pre-wrap mt-1">{r.content}</p></div>)}{!replies.length && <Empty text="NO REPLIES YET." />}</div></Modal>;
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => <label className="border-2 border-black p-2 flex gap-2 items-center"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
const Modal: React.FC<{ title: string; close: () => void; children: React.ReactNode }> = ({ title, close, children }) => <div className="fixed inset-0 z-[100] bg-black/60 p-4 grid place-items-center"><div className="bg-white border-4 border-black w-full max-w-xl neo-shadow-lg max-h-[90vh] overflow-auto"><div className="bg-[var(--color-primary)] border-b-4 border-black p-4 flex justify-between"><h2 className="font-display font-black uppercase">{title}</h2><button onClick={close}><X /></button></div><div className="p-5 space-y-4">{children}</div></div></div>;
const Empty = ({ text }: { text: string }) => <div className="border-4 border-dashed border-black p-10 text-center font-mono text-xs">{text}</div>;
const FileTextStub: React.FC<any> = props => <span {...props} className="inline-block w-4 h-4 border-2 border-current rounded-sm" />;
