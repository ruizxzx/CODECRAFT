import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { subscribeNewsletter } from '../lib/cms';

interface NewsletterSignupProps {
  variant?: 'sidebar' | 'footer' | 'inline';
}

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({ variant = 'sidebar' }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address (e.g., name@domain.com).');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      await subscribeNewsletter(cleanEmail);
      setStatus('success');
      setEmail('');
    } catch (error: any) {
      console.error("Newsletter subscription failed:", error);
      setStatus('error');
      setErrorMessage(error?.message || 'Failed to subscribe. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className={`neo-border p-5 neo-shadow-sm text-black ${variant === 'sidebar' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>
        <div className="flex flex-col items-center justify-center text-center space-y-3 py-4">
          <div className="w-12 h-12 bg-[var(--color-success)] neo-border rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-black stroke-[3]" />
          </div>
          <h3 className="font-display font-black text-xl uppercase">You're on the list!</h3>
          <p className="font-sans text-sm font-medium opacity-90">
            Keep an eye on your inbox for the next architectural dispatch.
          </p>
          <button 
            onClick={() => setStatus('idle')}
            className="mt-2 text-xs font-mono font-bold underline hover:text-[var(--color-accent)]"
          >
            SUBSCRIBE ANOTHER EMAIL
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <div className="w-full">
        {status === 'success' ? (
          <div className="p-4 bg-[var(--color-success)] text-black neo-border-2 font-display font-black text-sm uppercase flex items-center space-x-2 neo-shadow-sm">
            <CheckCircle2 className="w-5 h-5 stroke-[3]" />
            <span>DISPATCH SUBSCRIPTION CONFIRMED!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
                placeholder="architect@tech.co"
                className="flex-1 px-4 py-3 bg-neutral-900 border-2 border-neutral-600 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3 bg-[var(--color-primary)] text-black font-display font-black text-xs uppercase neo-border-2 neo-shadow-sm hover:bg-[var(--color-secondary)] shrink-0 flex items-center justify-center space-x-2 active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:bg-[var(--color-primary)]"
              >
                {status === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin stroke-[3]" />
                ) : (
                  <>
                    <span>JOIN</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>
            </div>
            {status === 'error' && (
              <div className="flex items-center space-x-1.5 text-red-500 mt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold font-mono">{errorMessage}</span>
              </div>
            )}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className={`neo-border p-5 neo-shadow-sm text-black ${variant === 'sidebar' ? 'bg-[var(--color-primary)]' : 'bg-white'}`}>
      <div className="flex items-center space-x-2 mb-2 border-b-2 border-black pb-2">
        <Sparkles className="w-4 h-4 fill-black" />
        <h3 className="font-black uppercase text-sm">
          Subscribe to the Dispatch
        </h3>
      </div>
      <p className="font-sans text-sm font-medium leading-relaxed mb-4">
        Join 12,000+ engineers receiving our weekly architectural breakdowns and code-heavy essays. No fluff, ever.
      </p>
      
      <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
        <input 
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'loading'}
          className={`w-full p-2.5 neo-border font-mono text-sm placeholder-black/50 focus:outline-none focus:bg-white disabled:opacity-50 ${variant === 'sidebar' ? 'bg-[#FFFDF5]' : 'bg-gray-50'}`}
        />
        
        {status === 'error' && (
          <div className="flex items-center space-x-1.5 text-red-600 bg-red-100 neo-border-2 px-2 py-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold font-mono">{errorMessage}</span>
          </div>
        )}

        <button 
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-black text-white px-4 py-2.5 font-black uppercase text-xs neo-border hover:bg-[var(--color-success)] hover:text-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:hover:bg-black disabled:hover:text-white"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>SUBSCRIBING...</span>
            </>
          ) : (
            <>
              <span>SUBSCRIBE NOW</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
