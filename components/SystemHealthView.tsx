import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { auth, checkIsAdmin } from '../lib/firebase';
import { buildHealthSummary, runClientHealthChecks, type HealthCheckResult, type HealthStatus } from '../lib/health';

const statusLabel: Record<HealthStatus,string> = { healthy: 'HEALTHY', degraded: 'DEGRADED', unavailable: 'UNAVAILABLE' };

export const SystemHealthView: React.FC = () => {
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    if (!checkIsAdmin(auth.currentUser?.email)) { setError('Master admin access required.'); setLoading(false); return; }
    setLoading(true); setError('');
    try { setResults(await runClientHealthChecks()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void run(); }, [run]);
  const overall = buildHealthSummary(results);

  return <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <div className="border-4 border-black bg-white neo-shadow-lg">
      <div className="border-b-4 border-black bg-black text-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div><div className="font-mono text-[10px] text-[var(--color-primary)] font-black uppercase">OFFSCRPT // SYSTEM HEALTH</div><h1 className="font-display font-black text-3xl uppercase mt-1">Infrastructure Status</h1></div>
        <button onClick={() => void run()} disabled={loading} className="border-2 border-white bg-[var(--color-primary)] text-black px-4 py-2 font-mono text-xs font-black uppercase flex items-center gap-2 disabled:opacity-50"><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Recheck</button>
      </div>
      <div className="p-5 border-b-2 border-black bg-neutral-50 flex items-center gap-3">
        <Activity className="w-5 h-5" />
        <span className="font-mono text-xs font-black uppercase">Overall: {statusLabel[overall]}</span>
        <span className="font-mono text-[10px] text-neutral-500 ml-auto">Build {typeof __OFFSCRPT_VERSION__ === 'string' ? __OFFSCRPT_VERSION__ : 'unknown'}</span>
      </div>
      {error && <div className="m-5 border-2 border-black bg-red-100 p-4 font-mono text-xs font-bold">{error}</div>}
      {loading && !results.length ? <div className="p-12 flex items-center justify-center gap-3 font-mono text-xs font-black uppercase"><Loader2 className="animate-spin" /> Running health checks…</div> :
        <div className="grid md:grid-cols-2 gap-4 p-5">
          {results.map(result => <div key={result.name} className="border-2 border-black p-4 bg-white">
            <div className="flex items-start justify-between gap-3"><div className="font-display font-black uppercase">{result.name}</div>{result.status === 'healthy' ? <CheckCircle2 className="w-5 h-5" /> : result.status === 'degraded' ? <CircleAlert className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}</div>
            <div className="font-mono text-[10px] font-black uppercase mt-2">{statusLabel[result.status]}{typeof result.latencyMs === 'number' ? ` · ${result.latencyMs}ms` : ''}</div>
            <p className="font-mono text-xs text-neutral-600 mt-3 leading-relaxed">{result.detail}</p>
          </div>)}
        </div>}
    </div>
  </section>;
};
