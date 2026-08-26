import { Component, type ReactNode } from 'react';
import { useAuthStore } from './store/auth';
import Login from './pages/Login';
import Chat from './pages/Chat';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0e1a',
          fontFamily: 'sans-serif',
        }}>
          <div style={{
            textAlign: 'center',
            padding: 48,
            maxWidth: 420,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              页面出错了
            </h2>
            <pre style={{
              fontSize: 12, color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', marginBottom: 20,
              background: 'var(--bg-tertiary)', padding: 12,
              borderRadius: 12, textAlign: 'left',
            }}>
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '10px 24px',
                background: '#3b82f6',
                color: '#fff', border: 'none', borderRadius: 12,
                cursor: 'pointer', fontSize: 14, fontWeight: 500,
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
              }}
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Chat /> : <Login />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
