import React from 'react';

interface Props { children: React.ReactNode; title?: string; }
interface State { hasError: boolean; }

export class MarketplaceErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('OFFSCRPT marketplace runtime error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="max-w-3xl mx-auto px-4 py-24">
        <div className="border-4 border-black bg-white p-8 text-center shadow-[7px_7px_0_#000]">
          <div className="font-mono text-[10px] font-black uppercase text-red-600">PAGE ERROR</div>
          <h1 className="font-display font-black text-4xl sm:text-5xl uppercase mt-2">THIS PAGE COULD NOT RENDER</h1>
          <p className="font-mono text-xs text-neutral-600 mt-3">{this.props.title || 'The marketplace encountered an unexpected error.'}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 border-2 border-black bg-[var(--color-primary)] px-4 py-3 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_#000]">
            RETRY PAGE
          </button>
        </div>
      </section>
    );
  }
}
