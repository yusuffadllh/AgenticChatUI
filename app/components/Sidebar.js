'use client';

import Link from 'next/link';

export default function Sidebar({ setShowSettings, currentMode, sessions = [], onSelectSession, onDeleteSession, currentSessionId }) {
  return (
    <div className="sidebar glass" style={{ display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}>
      <h2 style={{ marginBottom: '2rem', fontSize: '1.25rem', fontWeight: 'bold' }}>AI Agent</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link href="/" style={{
          padding: '0.75rem',
          borderRadius: '8px',
          background: currentMode === 'agent' ? 'var(--surface)' : 'transparent',
          border: currentMode === 'agent' ? '1px solid var(--surface-border)' : '1px solid transparent',
          textDecoration: 'none',
          color: 'inherit'
        }}>
          🤖 Agent Mode
        </Link>
        <Link href="/chat" style={{
          padding: '0.75rem',
          borderRadius: '8px',
          background: currentMode === 'chat' ? 'var(--surface)' : 'transparent',
          border: currentMode === 'chat' ? '1px solid var(--surface-border)' : '1px solid transparent',
          textDecoration: 'none',
          color: 'inherit'
        }}>
          💬 Chat Mode
        </Link>
      </div>

      {currentMode === 'agent' && sessions.length > 0 && (
        <div style={{ marginTop: '2rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.7 }}>Riwayat Agent</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sessions.map(session => (
              <div 
                key={session.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  background: session.id === currentSessionId ? 'var(--surface)' : 'transparent',
                  border: session.id === currentSessionId ? '1px solid var(--surface-border)' : '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                <div onClick={() => onSelectSession && onSelectSession(session.id)} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  🤖 {session.goal || session.messages?.[0]?.content || "Sesi Agent"}
                </div>
                {onDeleteSession && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0 0.5rem' }}
                    title="Hapus Sesi"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {currentMode === 'chat' && sessions.length > 0 && (
        <div style={{ marginTop: '2rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.7 }}>Riwayat Obrolan</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sessions.map(session => (
              <div 
                key={session.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  background: session.id === currentSessionId ? 'var(--surface)' : 'transparent',
                  border: session.id === currentSessionId ? '1px solid var(--surface-border)' : '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                <div onClick={() => onSelectSession && onSelectSession(session.id)} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.messages?.[0]?.content || "Sesi Obrolan"}
                </div>
                {onDeleteSession && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0 0.5rem' }}
                    title="Hapus Sesi"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn-primary" onClick={() => setShowSettings(true)} style={{ marginTop: currentMode === 'chat' && sessions.length > 0 ? '1rem' : 'auto' }}>
        ⚙️ Konfigurasi API
      </button>
      
      <div style={{ marginTop: 'auto', fontSize: '0.8rem', opacity: 0.6 }}>
        Antigravity UI Clone
      </div>
    </div>
  );
}
