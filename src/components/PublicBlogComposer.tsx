import React, { useEffect, useMemo, useState } from 'react';
import { calculateArticleReadingTime } from '../lib/reading';
import { ArticleContentBlock, CommunityPost, CommunityUser } from '../types';
import { createPost, updatePost, getPost, saveCommunityDraft, clearCommunityDraft } from '../lib/community';
import { createCommunityPost, updateCommunityPost, SocialCommunity } from '../lib/social';
import { getDraftSnapshot, saveDraftSnapshot, deleteDraftSnapshot } from '../lib/account';
import { Plus, Trash2, ArrowUp, ArrowDown, BookOpen, Image as ImageIcon, Video, Code2, Quote, Lightbulb, List, CheckCircle2, Eye, Save, Link2, MousePointer2 } from 'lucide-react';

type Props = {
  userProfile: CommunityUser;
  onClose: () => void;
  onPublished: (post: CommunityPost) => void;
  categories?: string[];
  community?: SocialCommunity | null;
  initialPost?: CommunityPost | null;
  onSavedDraft?: () => void;
};

const blockTypes: Array<[ArticleContentBlock['type'], string, React.ComponentType<any>]> = [
  ['paragraph', 'PARAGRAPH', BookOpen],
  ['heading2', 'SECTION', BookOpen],
  ['heading3', 'SUBSECTION', BookOpen],
  ['image', 'IMAGE', ImageIcon],
  ['video', 'VIDEO', Video],
  ['link', 'LINK', Link2],
  ['button', 'BUTTON', MousePointer2],
  ['code', 'CODE', Code2],
  ['quote', 'QUOTE', Quote],
  ['callout', 'CALLOUT', Lightbulb],
  ['list', 'LIST', List],
  ['takeaways', 'TAKEAWAYS', CheckCircle2],
];

const textFromBlocks = (blocks: ArticleContentBlock[]) => blocks.map((b) => {
  if (b.type === 'list' || b.type === 'takeaways') return (b.items || []).filter(Boolean).map((x) => `• ${x}`).join('\n');
  if (b.type === 'code') return b.codeBlock?.code || '';
  return b.content || '';
}).filter(Boolean).join('\n\n').trim();

export const PublicBlogComposer: React.FC<Props> = ({
  userProfile,
  onClose,
  onPublished,
  categories = [],
  community = null,
  initialPost = null,
  onSavedDraft,
}) => {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Web Development');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverImageAlt, setCoverImageAlt] = useState('');
  const [coverImageCaption, setCoverImageCaption] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [seriesOrder, setSeriesOrder] = useState('');
  const [blocks, setBlocks] = useState<ArticleContentBlock[]>([{ type: 'paragraph', content: '' }]);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!initialPost) return;
    setTitle(initialPost.title || '');
    setExcerpt(initialPost.excerpt || '');
    setCategory(initialPost.category || categories[0] || 'Web Development');
    setTags(Array.isArray(initialPost.tags) ? initialPost.tags.join(', ') : '');
    setCoverImage(initialPost.coverImage || '');
    setCoverImageAlt(initialPost.coverImageAlt || '');
    setCoverImageCaption(initialPost.coverImageCaption || '');
    setSeriesName(initialPost.seriesName || '');
    setSeriesOrder(initialPost.seriesOrder ? String(initialPost.seriesOrder) : '');
    setBlocks(Array.isArray(initialPost.contentBlocks) && initialPost.contentBlocks.length
      ? initialPost.contentBlocks
      : [{ type: 'paragraph', content: initialPost.content || '' }]);
  }, [initialPost, categories]);

  const localDraftKey = `offscrpt:draft:blog:${userProfile.uid}`;
  useEffect(() => {
    if (initialPost) return;
    let cancelled = false;
    const restore = async () => {
      try {
        const raw = localStorage.getItem(localDraftKey);
        const local = raw ? JSON.parse(raw) : null;
        const cloud = await getDraftSnapshot<any>('public-blog');
        const draft = cloud || local;
        if (!cancelled && draft && (draft.title || draft.excerpt || draft.blocks?.length)) {
          if (draft.title) setTitle(draft.title);
          if (draft.excerpt) setExcerpt(draft.excerpt);
          if (draft.category) setCategory(draft.category);
          if (typeof draft.tags === 'string') setTags(draft.tags);
          if (typeof draft.coverImage === 'string') setCoverImage(draft.coverImage);
          if (typeof draft.coverImageAlt === 'string') setCoverImageAlt(draft.coverImageAlt);
          if (typeof draft.coverImageCaption === 'string') setCoverImageCaption(draft.coverImageCaption);
          if (typeof draft.seriesName === 'string') setSeriesName(draft.seriesName);
          if (draft.seriesOrder !== undefined && draft.seriesOrder !== '') setSeriesOrder(String(draft.seriesOrder));
          if (Array.isArray(draft.blocks) && draft.blocks.length) setBlocks(draft.blocks);
          setStatus('Recovered unsent draft from cloud/local backup.');
        }
      } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    };
    void restore();
    return () => { cancelled = true; };
  }, [initialPost, userProfile.uid]);

  useEffect(() => {
    if (initialPost) return;
    const hasContent = !!(title.trim() || excerpt.trim() || blocks.some(b => (b.content || b.linkText || b.buttonText || b.imageUrl || b.videoUrl)));
    if (!hasContent) return;
    const payload = { title, excerpt, category, tags, coverImage, coverImageAlt, coverImageCaption, seriesName, seriesOrder, blocks };
    try { localStorage.setItem(localDraftKey, JSON.stringify(payload)); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
    const timer = window.setTimeout(() => { void saveDraftSnapshot('public-blog', payload).catch((error) => console.warn('OFFSCRPT recoverable operation failed:', error)); }, 900);
    return () => window.clearTimeout(timer);
  }, [initialPost, localDraftKey, title, excerpt, category, tags, coverImage, coverImageAlt, coverImageCaption, seriesName, seriesOrder, blocks]);

  const readingTime = useMemo(() => {
    const words = textFromBlocks(blocks).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }, [blocks]);

  const updateBlock = (index: number, patch: Partial<ArticleContentBlock>) => {
    setBlocks((prev) => prev.map((block, i) => i === index ? { ...block, ...patch } : block));
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.length === 1 ? [{ type: 'paragraph', content: '' }] : prev.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, delta: number) => {
    setBlocks((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const insertInlineLink = (blockIndex: number, currentText: string) => {
    const el = document.activeElement as HTMLTextAreaElement | null;
    const start = el && typeof el.selectionStart === 'number' ? el.selectionStart : currentText.length;
    const end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : currentText.length;
    const selected = currentText.slice(start, end).trim();
    const label = selected || 'linked text';
    const url = window.prompt('URL (https://..., /internal-path, mailto:...):', 'https://');
    if (!url || url.trim() === 'https://') return;
    updateBlock(blockIndex, { content: `${currentText.slice(0, start)}[${label}](${url.trim()})${currentText.slice(end)}` });
  };

  const addBlock = (type: ArticleContentBlock['type']) => {
    const block: ArticleContentBlock = { type, content: '' };
    if (type === 'image') Object.assign(block, { imageUrl: '', imageAlt: '', imageCaption: '', imageHref: '' });
    if (type === 'video') Object.assign(block, { videoUrl: '', videoTitle: '', videoCaption: '' });
    if (type === 'link') Object.assign(block, { linkText: 'Open link', href: '' });
    if (type === 'button') Object.assign(block, { buttonText: 'OPEN LINK', href: '', buttonStyle: 'primary' });
    if (type === 'code') Object.assign(block, { codeBlock: { language: 'typescript', code: '', filename: '' } });
    if (type === 'callout') Object.assign(block, { calloutType: 'info', calloutTitle: '' });
    if (type === 'list' || type === 'takeaways') Object.assign(block, { items: [''] });
    setBlocks((prev) => [...prev, block]);
  };

  const draftPayload = () => ({
    type: 'blog' as const,
    title: title.trim(),
    content: textFromBlocks(blocks),
    mediaUrls: blocks.filter((b) => b.type === 'image' && b.imageUrl).map((b) => b.imageUrl || '').slice(0, 6),
  });

  const saveDraft = async () => {
    try {
      setSavingDraft(true);
      await saveCommunityDraft(userProfile.uid, draftPayload());
      setStatus('Draft saved to Firebase.');
      setError('');
      onSavedDraft?.();
    } catch (e: any) {
      setError(e?.message || 'Could not save the draft to Firebase.');
    } finally {
      setSavingDraft(false);
    }
  };

  const publish = async () => {
    if (publishing) return;
    setError('');
    setStatus('');
    const cleanTitle = title.trim();
    const body = textFromBlocks(blocks);
    const cleanExcerpt = excerpt.trim() || body.slice(0, 240);
    if (!cleanTitle || !body) {
      setError('Add a title and at least one content block.');
      return;
    }
    if (coverImage && !/^https?:\/\//i.test(coverImage.trim())) {
      setError('Cover image must use http:// or https://');
      return;
    }
    try {
      setPublishing(true);
      const metadata: any = {
        excerpt: cleanExcerpt.slice(0, 500),
        coverImage: coverImage.trim(),
        coverImageAlt: coverImageAlt.trim().slice(0, 200),
        coverImageCaption: coverImageCaption.trim().slice(0, 300),
        category: category.trim().slice(0, 80),
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
        readingTimeMinutes: calculateArticleReadingTime(blocks),
        contentBlocks: blocks,
        seriesId: seriesName.trim() ? seriesName.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) : '',
        seriesName: seriesName.trim(),
        seriesOrder: seriesName.trim() && seriesOrder ? Math.max(1, Number(seriesOrder)||1) : undefined,
      };

      let post: any;
      if (initialPost) {
        if (community) {
          await updateCommunityPost(community.id, initialPost.id, userProfile.uid, {
            title: cleanTitle,
            content: body,
            ...metadata,
          });
        } else {
          await updatePost(initialPost.id, { title: cleanTitle, content: body, ...metadata } as any);
        }
        const confirmed = !community ? await getPost(initialPost.id) : null;
        post = confirmed || {
          ...initialPost,
          title: cleanTitle,
          content: body,
          ...metadata,
          editedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setStatus('Blog changes saved to Firebase and confirmed.');
      } else if (community) {
        post = await createCommunityPost(community.id, userProfile, cleanTitle, body, {
          postType: 'blog',
          ...metadata,
        });
        setStatus(post.publishStatus === 'existing' ? 'Existing cloud copy restored.' : 'Blog published and confirmed in Firebase.');
      } else {
        post = await createPost({
          type: 'blog',
          title: cleanTitle,
          content: body,
          authorId: userProfile.uid,
          authorUsername: userProfile.username,
          authorName: userProfile.displayName,
          authorAvatar: userProfile.photoURL || '',
          isVerified: !!userProfile.isVerified,
          verificationColor: userProfile.verificationColor,
          platformRole: userProfile.platformRole || 'member',
          ...metadata,
          origin: 'community_blog',
        } as any);
        setStatus((post as any)._publishStatus === 'existing' ? 'Existing cloud copy restored.' : 'Blog published and confirmed in Firebase.');
      }

      await clearCommunityDraft(userProfile.uid).catch(() => undefined);
      await deleteDraftSnapshot('public-blog').catch(() => undefined);
      try { localStorage.removeItem(localDraftKey); } catch (error) { console.warn('OFFSCRPT recoverable operation failed:', error); }
      onPublished(post);
      // Keep the success state visible long enough for the caller to render it.
      window.setTimeout(onClose, 250);
    } catch (e: any) {
      setError(e?.message || 'Publishing failed.');
    } finally {
      setPublishing(false);
    }
  };

  const renderBlock = (block: ArticleContentBlock, index: number) => (
    <div key={index} className="border-2 border-black p-3 bg-neutral-50 space-y-2">
      <div className="flex justify-between items-center gap-2">
        <div className="font-mono text-[10px] font-black uppercase">{index + 1}. {block.type}</div>
        <div className="flex gap-1">
          <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="border border-black p-1 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
          <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="border border-black p-1 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
          <button type="button" onClick={() => removeBlock(index)} className="border border-black p-1"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {block.type === 'image' ? (
        <>
          <input value={block.imageUrl || ''} onChange={(e) => updateBlock(index, { imageUrl: e.target.value })} placeholder="Image URL" className="w-full border-2 border-black p-2 font-mono text-xs" />
          <input value={block.imageAlt || ''} onChange={(e) => updateBlock(index, { imageAlt: e.target.value })} placeholder="Alt text" className="w-full border-2 border-black p-2 font-mono text-xs" />
          <input value={block.imageCaption || ''} onChange={(e) => updateBlock(index, { imageCaption: e.target.value })} placeholder="Caption" className="w-full border-2 border-black p-2 font-mono text-xs" />
          <input value={block.imageHref || ''} onChange={(e) => updateBlock(index, { imageHref: e.target.value })} placeholder="Optional image click-through URL" className="w-full border-2 border-black p-2 font-mono text-xs" />
        </>
      ) : block.type === 'video' ? (
        <>
          <input type="url" value={block.videoUrl || ''} onChange={(e) => updateBlock(index, { videoUrl: e.target.value })} placeholder="YouTube / Vimeo / direct .mp4 / .webm URL" className="w-full border-2 border-black p-2 font-mono text-xs" />
          <input value={block.videoTitle || ''} onChange={(e) => updateBlock(index, { videoTitle: e.target.value })} placeholder="Accessible video title" className="w-full border-2 border-black p-2 font-mono text-xs" />
          <input value={block.videoCaption || ''} onChange={(e) => updateBlock(index, { videoCaption: e.target.value })} placeholder="Caption (optional)" className="w-full border-2 border-black p-2 font-mono text-xs" />
        </>
      ) : block.type === 'code' ? (
        <>
          <div className="flex gap-2">
            <select value={block.codeBlock?.language || 'typescript'} onChange={(e) => updateBlock(index, { codeBlock: { ...(block.codeBlock || { code: '' }), language: e.target.value } })} className="border-2 border-black p-2 font-mono text-xs">
              <option>typescript</option><option>javascript</option><option>python</option><option>go</option><option>rust</option><option>json</option><option>bash</option>
            </select>
            <input value={block.codeBlock?.filename || ''} onChange={(e) => updateBlock(index, { codeBlock: { ...(block.codeBlock || { language: 'typescript', code: '' }), filename: e.target.value } })} placeholder="Filename" className="flex-1 border-2 border-black p-2 font-mono text-xs" />
          </div>
          <textarea value={block.codeBlock?.code || ''} onChange={(e) => updateBlock(index, { codeBlock: { ...(block.codeBlock || { language: 'typescript' }), code: e.target.value } })} placeholder="Code" className="w-full border-2 border-black p-2 font-mono text-xs min-h-28" />
        </>
      ) : block.type === 'link' ? (
        <div className="space-y-2"><input value={block.linkText || ''} onChange={(e) => updateBlock(index, { linkText: e.target.value })} placeholder="Visible link text" className="w-full border-2 border-black p-2" /><input value={block.href || ''} onChange={(e) => updateBlock(index, { href: e.target.value })} placeholder="https://example.com or /blog" className="w-full border-2 border-black p-2 font-mono text-xs" /></div>
      ) : block.type === 'button' ? (
        <div className="space-y-2"><input value={block.buttonText || ''} onChange={(e) => updateBlock(index, { buttonText: e.target.value })} placeholder="Button label" className="w-full border-2 border-black p-2" /><div className="flex gap-2"><input value={block.href || ''} onChange={(e) => updateBlock(index, { href: e.target.value })} placeholder="https://example.com or /blog" className="flex-1 border-2 border-black p-2 font-mono text-xs" /><select value={block.buttonStyle || 'primary'} onChange={(e) => updateBlock(index, { buttonStyle: e.target.value as any })} className="border-2 border-black p-2 font-mono text-xs"><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="dark">Dark</option></select></div></div>
      ) : block.type === 'quote' ? (
        <>
          <textarea value={block.content || ''} onChange={(e) => updateBlock(index, { content: e.target.value })} placeholder="Quote" className="w-full border-2 border-black p-2 min-h-20" />
          <input value={block.quoteAuthor || ''} onChange={(e) => updateBlock(index, { quoteAuthor: e.target.value })} placeholder="Quote author" className="w-full border-2 border-black p-2 font-mono text-xs" />
        </>
      ) : block.type === 'callout' ? (
        <>
          <div className="flex gap-2">
            <select value={block.calloutType || 'info'} onChange={(e) => updateBlock(index, { calloutType: e.target.value as any })} className="border-2 border-black p-2 font-mono text-xs"><option value="info">Info</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="insight">Insight</option></select>
            <input value={block.calloutTitle || ''} onChange={(e) => updateBlock(index, { calloutTitle: e.target.value })} placeholder="Callout title" className="flex-1 border-2 border-black p-2 font-mono text-xs" />
          </div>
          <textarea value={block.content || ''} onChange={(e) => updateBlock(index, { content: e.target.value })} placeholder="Callout content" className="w-full border-2 border-black p-2 min-h-20" />
        </>
      ) : block.type === 'list' || block.type === 'takeaways' ? (
        <div className="space-y-2">
          {(block.items || ['']).map((item, itemIndex) => (
            <div key={itemIndex} className="flex gap-2">
              <input value={item} onChange={(e) => { const items = [...(block.items || [])]; items[itemIndex] = e.target.value; updateBlock(index, { items }); }} placeholder={`Item ${itemIndex + 1}`} className="flex-1 border-2 border-black p-2" />
              <button type="button" onClick={() => updateBlock(index, { items: (block.items || []).filter((_, i) => i !== itemIndex) })} className="border-2 border-black px-2">×</button>
            </div>
          ))}
          <button type="button" onClick={() => updateBlock(index, { items: [...(block.items || []), ''] })} className="border-2 border-black px-3 py-1 font-mono text-[10px]">+ ITEM</button>
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={() => insertInlineLink(index, block.content || '')} className="px-2 py-1 border-2 border-black bg-white font-mono text-[10px] font-black uppercase">LINK SELECTED TEXT</button>
          <textarea value={block.content || ''} onChange={(e) => updateBlock(index, { content: e.target.value })} placeholder={block.type === 'heading2' ? 'Section heading' : block.type === 'heading3' ? 'Subheading' : 'Write…'} className={`w-full border-2 border-black p-2 min-h-20 ${block.type === 'paragraph' ? 'font-serif' : 'font-display font-bold'}`} />
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[220] bg-black/70 p-4 overflow-auto">
      <div className="max-w-5xl mx-auto bg-white border-4 border-black neo-shadow-lg">
        <div className="bg-[var(--color-primary)] border-b-4 border-black p-4 flex justify-between items-center">
          <div>
            <div className="font-mono text-[10px] font-black">PUBLIC EDITOR · @{userProfile.username}{community ? ` · c/${community.slug}` : ''}</div>
            <h2 className="font-display font-black text-2xl uppercase">{initialPost ? 'EDIT BLOG' : 'WRITE A BLOG'}{community ? ' · COMMUNITY' : ''}</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><Trash2 className="w-5 h-5 rotate-45" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid lg:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 256))} placeholder="Blog title" className="border-2 border-black p-3 font-display font-bold text-xl" />
            <input value={excerpt} onChange={(e) => setExcerpt(e.target.value.slice(0, 500))} placeholder="Excerpt / deck" className="border-2 border-black p-3" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="border-2 border-black p-3"><option value="Web Development">Web Development</option>{categories.filter((c) => c !== 'Web Development').map((c) => <option key={c}>{c}</option>)}</select>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags: React, AI, Systems" className="border-2 border-black p-3" />
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="Cover image URL" className="border-2 border-black p-3" />
            <input value={coverImageAlt} onChange={(e) => setCoverImageAlt(e.target.value)} placeholder="Cover image alt" className="border-2 border-black p-3" />
            <input value={coverImageCaption} onChange={(e) => setCoverImageCaption(e.target.value)} placeholder="Cover caption" className="border-2 border-black p-3 lg:col-span-2" />
          </div>

          <div className="border-2 border-black p-4 bg-neutral-50 space-y-3">
            <div className="flex justify-between items-center">
              <div><div className="font-display font-black uppercase">Article blocks</div><div className="font-mono text-[10px] text-neutral-500">Same core publishing model as the admin article editor.</div></div>
              <div className="font-mono text-[10px] font-bold">~{readingTime} MIN READ</div>
            </div>
            <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-2">{blockTypes.map(([type, label, Icon]) => <button key={type} type="button" onClick={() => addBlock(type)} className="border-2 border-black bg-white p-2 font-mono text-[9px] font-black flex items-center justify-center gap-1"><Plus className="w-3 h-3" /><Icon className="w-3 h-3" />{label}</button>)}</div>
            <div className="space-y-2">{blocks.map(renderBlock)}</div>
          </div>

          {preview && <div className="border-4 border-black p-5 space-y-4 bg-white">
            <div className="font-mono text-[10px] font-black flex items-center gap-1"><Eye className="w-3 h-3" /> LIVE PREVIEW</div>
            <h1 className="font-display font-black text-3xl uppercase">{title || 'UNTITLED BLOG'}</h1>
            {excerpt && <p className="text-sm text-neutral-600">{excerpt}</p>}
            {coverImage && <img src={coverImage} alt={coverImageAlt || ''} className="w-full max-h-96 object-cover border-2 border-black" />}
            <div className="space-y-4">{blocks.map((block, index) => <div key={index}>{block.type === 'heading2' ? <h2 className="font-display font-black text-2xl">{block.content}</h2> : block.type === 'heading3' ? <h3 className="font-display font-black text-xl">{block.content}</h3> : block.type === 'code' ? <pre className="border-2 border-black bg-black text-white p-3 overflow-auto font-mono text-xs">{block.codeBlock?.code}</pre> : block.type === 'quote' ? <blockquote className="border-l-4 border-black pl-3 italic">{block.content}</blockquote> : block.type === 'list' || block.type === 'takeaways' ? <ul className="list-disc ml-5">{(block.items || []).map((item, i) => <li key={i}>{item}</li>)}</ul> : block.type === 'image' && block.imageUrl ? <figure>{block.imageHref ? <a href={block.imageHref}><img src={block.imageUrl} alt={block.imageAlt || ''} className="w-full border-2 border-black" /></a> : <img src={block.imageUrl} alt={block.imageAlt || ''} className="w-full border-2 border-black" />}{block.imageCaption && <figcaption className="font-mono text-[10px] mt-1">{block.imageCaption}</figcaption>}</figure> : block.type === 'video' && block.videoUrl ? <figure><video src={block.videoUrl} controls className="w-full border-2 border-black" />{block.videoCaption && <figcaption className="font-mono text-[10px] mt-1">{block.videoCaption}</figcaption>}</figure> : block.type === 'link' ? <a href={block.href || '#'} className="font-sans font-black underline">{block.linkText || block.href}</a> : block.type === 'button' ? <a href={block.href || '#'} className="inline-block px-4 py-2 border-2 border-black bg-[var(--color-primary)] font-display font-black uppercase">{block.buttonText || 'OPEN LINK'}</a> : <p className="whitespace-pre-wrap leading-relaxed">{block.content}</p>}</div>)}</div>
          </div>}

          {error && <div className="border-2 border-red-500 bg-red-100 p-3 font-mono text-xs font-bold">{error}</div>}
          {status && <div className="border-2 border-black bg-[var(--color-primary)] p-3 font-mono text-xs font-bold">{status}</div>}

          <div className="flex flex-wrap justify-between items-center gap-2 border-t-2 border-black pt-4">
            <div className="font-mono text-[10px] text-neutral-500">Cloud-first publishing: Firebase is the source of truth.</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPreview((value) => !value)} className="border-2 border-black px-3 py-2 font-mono text-xs">{preview ? 'CLOSE PREVIEW' : 'PREVIEW'}</button>
              {!initialPost && <button onClick={() => void saveDraft()} disabled={savingDraft} className="border-2 border-black px-3 py-2 font-mono text-xs"><Save className="inline w-3 h-3 mr-1" />{savingDraft ? 'SAVING…' : 'SAVE DRAFT'}</button>}
              <button onClick={onClose} className="border-2 border-black px-4 py-2 font-mono text-xs">CANCEL</button>
              <button onClick={() => void publish()} disabled={publishing} className="border-2 border-black bg-[var(--color-primary)] px-5 py-2 font-mono text-xs font-black disabled:opacity-50">{publishing ? (initialPost ? 'SAVING…' : 'PUBLISHING…') : (initialPost ? 'SAVE CHANGES' : 'PUBLISH BLOG')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
