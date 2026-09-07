import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { CommunityUser } from '../types';
import { createCommunityProfile, isUsernameAvailable } from '../lib/community';
import { X, Check, AlertCircle, Loader2, AtSign } from 'lucide-react';

interface UniqueHandleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onProfileCreated: (profile: CommunityUser) => void;
}

export const UniqueHandleModal: React.FC<UniqueHandleModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileCreated,
}) => {
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('Software builder & writer');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (currentUser?.email && (currentUser.email === 'ruizxzxz@gmail.com' || currentUser.email === 'krishsarkar456@gmail.com')) {
      setHandle('krishsarkar');
      return;
    }
    if (currentUser?.displayName) {
      const suggested = currentUser.displayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .substring(0, 20);
      setHandle(suggested);
    }
  }, [currentUser]);

  useEffect(() => {
    const clean = handle.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (!clean) {
      setStatus('idle');
      return;
    }
    if (clean.length < 3) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(clean);
        setStatus(available ? 'available' : 'taken');
      } catch {
        setStatus('idle');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [handle]);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = handle.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) {
      setErrorMessage('Handle must be at least 3 characters long.');
      return;
    }
    if (status === 'taken') {
      setErrorMessage('This handle is already taken. Please choose another.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const profile = await createCommunityProfile({
        uid: currentUser.uid,
        username: clean,
        displayName: clean === 'krishsarkar' ? 'Krish Sarkar' : (currentUser.displayName || clean),
        photoURL: currentUser.photoURL || '',
        bio: bio.trim() || 'Software builder',
        themeColor: '#000000',
      });
      onProfileCreated(profile);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Failed to claim handle. It may have been claimed by someone else.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border-4 border-black neo-shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-[var(--color-primary)] px-6 py-4 border-b-4 border-black flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AtSign className="w-6 h-6 stroke-[3] text-black" />
            <h2 className="font-display font-black text-xl uppercase tracking-tight text-black">
              Claim Your Unique Handle
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white border-2 border-black hover:bg-black hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center space-x-4 p-4 bg-neutral-100 border-2 border-black">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt=""
                className="w-12 h-12 rounded-full border-2 border-black object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--color-secondary)] border-2 border-black flex items-center justify-center font-bold">
                {currentUser.displayName ? currentUser.displayName[0] : 'U'}
              </div>
            )}
            <div className="overflow-hidden">
              <div className="font-display font-black text-base truncate">{currentUser.displayName || 'Google User'}</div>
              <div className="font-mono text-xs text-neutral-500 truncate">{currentUser.email}</div>
            </div>
          </div>

          <p className="font-sans text-sm text-neutral-700 leading-relaxed">
            Choose your unique <strong>@handle</strong> to publish blogs and discussions in the community, participate in debates, and like posts.
          </p>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-2">
              Community Handle (Unique)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-mono font-bold text-base text-neutral-500">
                @
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={30}
                placeholder="your_handle"
                className="w-full pl-8 pr-12 py-3 border-2 border-black font-mono text-base font-bold tracking-tight focus:outline-none focus:bg-neutral-50"
                required
              />
              <div className="absolute right-3 flex items-center">
                {status === 'checking' && <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />}
                {status === 'available' && <Check className="w-5 h-5 text-green-600 stroke-[3]" />}
                {status === 'taken' && <AlertCircle className="w-5 h-5 text-red-600 stroke-[2.5]" />}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-500">Only lowercase letters, numbers, and underscores (3-30 chars).</span>
              {status === 'available' && (
                <span className="font-bold text-green-700">✓ Handle available</span>
              )}
              {status === 'taken' && (
                <span className="font-bold text-red-600">✗ Handle taken</span>
              )}
              {status === 'invalid' && handle.length > 0 && (
                <span className="font-bold text-neutral-600">Too short</span>
              )}
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-2">
              Bio (Optional)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={150}
              placeholder="What do you build or write about?"
              className="w-full px-4 py-2.5 border-2 border-black font-sans text-sm focus:outline-none focus:bg-neutral-50"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-100 border-2 border-red-500 font-mono text-xs text-red-800">
              {errorMessage}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-mono text-xs font-bold uppercase border-2 border-neutral-300 hover:border-black transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || status !== 'available'}
              className="px-6 py-3 bg-[var(--color-primary)] font-display font-black text-sm uppercase border-2 border-black neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Claiming...</span>
                </>
              ) : (
                <span>Claim @{handle || 'handle'} & Continue</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
