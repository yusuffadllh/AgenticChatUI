'use client';

export default function SettingsModal({ settings, setSettings, onSave, onCancel }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="glass" style={{ padding: '2rem', borderRadius: '16px', width: '400px', background: 'rgba(20, 22, 32, 0.95)' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Konfigurasi Gateway</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Base URL</label>
          <input 
            type="text" 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'white' }}
            value={settings.baseUrl || ''}
            onChange={e => setSettings({...settings, baseUrl: e.target.value})}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>API Key</label>
          <input 
            type="password" 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'white' }}
            value={settings.apiKey || ''}
            onChange={e => setSettings({...settings, apiKey: e.target.value})}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Model AI</label>
          <input 
            type="text" 
            placeholder="e.g. google/gemini-2.5-pro"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'white' }}
            value={settings.modelName || ''}
            onChange={e => setSettings({...settings, modelName: e.target.value})}
          />
          <small style={{ display: 'block', marginTop: '0.5rem', opacity: 0.6 }}>Masukkan nama model dari OpenRouter</small>
        </div>

        <div style={{ borderTop: '1px solid var(--surface-border)', margin: '0.5rem 0 1rem', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', opacity: 0.85 }}>🚀 Kredensial Deploy (opsional)</div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Vercel Token</label>
            <input
              type="password"
              placeholder="vercel token (untuk deploy Next.js/frontend)"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'white' }}
              value={settings.vercelToken || ''}
              onChange={e => setSettings({ ...settings, vercelToken: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: '0.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Netlify Token</label>
            <input
              type="password"
              placeholder="netlify auth token"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'white' }}
              value={settings.netlifyToken || ''}
              onChange={e => setSettings({ ...settings, netlifyToken: e.target.value })}
            />
          </div>
          <small style={{ display: 'block', marginTop: '0.5rem', opacity: 0.6 }}>Diisi agar agent bisa deploy sendiri. Kosongkan bila tidak dipakai.</small>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" style={{ flex: 1, margin: 0 }} onClick={onSave}>Simpan</button>
          <button className="btn-primary" style={{ flex: 1, margin: 0, background: 'transparent', border: '1px solid var(--surface-border)' }} onClick={onCancel}>Batal</button>
        </div>
      </div>
    </div>
  );
}
