import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check } from 'lucide-react';
import type { CommunityPost } from '../types';
import { voteCommunityPoll, getCommunityPollVote } from '../lib/social';
import { voteRootPoll, getRootPollVote } from '../lib/community';
import { auth } from '../lib/firebase';
import { notifyToast } from '../lib/toast';

interface Props {
  poll: CommunityPost['poll'];
  postId: string;
  communityId?: string;
  userId?: string;
  compact?: boolean;
}

export const PollBlock: React.FC<Props> = ({ poll, postId, communityId, userId, compact = false }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [counts, setCounts] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => (poll?.options || []).map(x => String(x).trim()).filter(Boolean).slice(0, 8), [poll?.options]);
  useEffect(() => {
    setCounts(options.map((_, i) => Number((poll?.votes as any)?.[String(i)] ?? 0)));
  }, [poll, options]);
  useEffect(() => {
    let active = true;
    if (!userId) { setSelected(null); return () => { active = false; }; }
    (async () => {
      try {
        const idx = communityId ? await getCommunityPollVote(communityId, postId, userId) : await getRootPollVote(postId, userId);
        if (active) setSelected(idx);
      } catch (e) { console.warn('Poll vote state unavailable:', e); }
    })();
    return () => { active = false; };
  }, [communityId, postId, userId]);

  if (!poll || options.length < 2) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  const vote = async (index: number) => {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) { notifyToast('Sign in to vote in this poll.', 'error'); return; }
    if (selected !== null) return;
    setBusy(true);
    try {
      if (communityId) await voteCommunityPoll(communityId, postId, uid, index);
      else await voteRootPoll(postId, uid, index);
      setSelected(index);
      setCounts(prev => prev.map((n, i) => i === index ? n + 1 : n));
    } catch (e: any) {
      notifyToast(e?.message || 'Could not save your vote.', 'error');
    } finally { setBusy(false); }
  };

  return <section className={`border-2 border-black bg-white ${compact ? 'p-3 mt-3' : 'p-4 sm:p-5 mt-5'}`} onClick={e => e.stopPropagation()} aria-label="Poll">
    <div className="flex items-start gap-2 mb-3"><BarChart3 className="w-5 h-5 shrink-0"/><div><div className="font-mono text-[9px] font-black uppercase">POLL</div><h4 className={`${compact ? 'text-base' : 'text-lg'} font-display font-black uppercase mt-1`}>{poll.question || 'Poll'}</h4></div></div>
    <div className="space-y-2">
      {options.map((option, i) => {
        const count = counts[i] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        const isSelected = selected === i;
        return <button key={`${option}-${i}`} type="button" disabled={busy || selected !== null} onClick={() => void vote(i)} className={`relative w-full text-left border-2 border-black overflow-hidden p-3 ${isSelected ? 'bg-[var(--color-primary)]' : 'bg-white hover:bg-neutral-50'} disabled:cursor-default`}>
          <div className="absolute inset-y-0 left-0 bg-[var(--color-primary)]/30" style={{ width: `${pct}%` }} />
          <div className="relative flex items-center justify-between gap-3"><span className="font-mono text-[10px] font-black">{isSelected && <Check className="inline w-3 h-3 mr-1"/>}{option}</span><span className="font-mono text-[9px] font-black whitespace-nowrap">{pct}% · {count}</span></div>
        </button>;
      })}
    </div>
    <div className="font-mono text-[9px] text-neutral-500 mt-3">{total.toLocaleString()} VOTE{total===1?'':'S'} {selected !== null ? '· YOUR VOTE IS LOCKED' : '· SELECT ONE OPTION'}</div>
  </section>;
};
