import {StrictMode, Component, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installRuntimeErrorReporting, reportRuntimeError, flushQueuedRuntimeErrors } from './lib/runtime';
import { auth } from './lib/firebase';

if (typeof window !== 'undefined') {
  installRuntimeErrorReporting();
  auth.onAuthStateChanged((user) => { if (user) void flushQueuedRuntimeErrors(); });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('PWA service worker registration failed:', error);
      void reportRuntimeError(error, 'pwa.service-worker');
    });
  });
}

class AppErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
  state = {hasError: false};
  static getDerivedStateFromError() { return {hasError: true}; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('OFFSCRPT runtime error:', error, info);
    void reportRuntimeError(error, 'react.root-boundary');
  }
  render() {
    if (this.state.hasError) {
      return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:'32px',fontFamily:'Arial,sans-serif',background:'#fff',color:'#000'}}>
        <div style={{maxWidth:'720px',width:'100%',border:'4px solid #000',boxShadow:'10px 10px 0 #000',padding:'28px'}}>
          <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'12px',letterSpacing:'0.08em',marginBottom:'12px'}}>OFFSCRPT // RUNTIME FAILURE</div>
          <h1 style={{fontSize:'42px',lineHeight:1,fontWeight:900,margin:'0 0 16px'}}>PAGE FAILED TO LOAD</h1>
          <p style={{fontSize:'16px',lineHeight:1.5,margin:'0 0 24px'}}>The application hit an unexpected runtime error. Reloading is safe; your cloud data is not deleted by this screen.</p>
          <button onClick={() => window.location.reload()} style={{border:'3px solid #000',background:'#D97706',padding:'12px 18px',fontWeight:900,cursor:'pointer'}}>RELOAD OFFSCRPT</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('OFFSCRPT root element is missing.');
createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
