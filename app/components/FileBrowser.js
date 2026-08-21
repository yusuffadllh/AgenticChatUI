'use client';

import { useEffect, useState, useCallback } from 'react';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(entry) {
  if (entry.type === 'dir') return '📁';
  const ext = entry.name.split('.').pop().toLowerCase();
  const map = {
    js: '📜', jsx: '📜', ts: '📜', tsx: '📜', mjs: '📜', cjs: '📜',
    json: '🧾', md: '📝', txt: '📄', html: '🌐', css: '🎨', scss: '🎨',
    py: '🐍', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
    lock: '🔒', env: '🔑', yml: '⚙️', yaml: '⚙️',
  };
  return map[ext] || '📄';
}

export default function FileBrowser({ sessionId, onClose }) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null); // { path, content, size, binary, tooLarge }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDir = useCallback(async (dirPath) => {
    setLoading(true);
    setError('');
    setSelectedFile(null);
    try {
      const res = await fetch(`/api/agent/files?sessionId=${sessionId}&path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat folder');
      setEntries(data.entries || []);
      setPath(data.path || '');
    } catch (e) {
      setError(e.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const openFile = async (filePath) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/agent/files?sessionId=${sessionId}&mode=read&path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuka file');
      setSelectedFile(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDir('');
  }, [loadDir]);

  const goUp = () => {
    if (!path) return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    loadDir(parts.join('/'));
  };

  const crumbs = path ? path.split('/').filter(Boolean) : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{
          width: '90vw', maxWidth: '1100px', height: '82vh',
          borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ color: 'var(--accent)', margin: 0 }}>📂 File Project</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span onClick={() => loadDir('')} style={{ cursor: 'pointer', color: 'var(--accent)' }}>root</span>
          {crumbs.map((c, i) => (
            <span key={i}>
              <span style={{ opacity: 0.5 }}> / </span>
              <span
                onClick={() => loadDir(crumbs.slice(0, i + 1).join('/'))}
                style={{ cursor: 'pointer', color: 'var(--accent)' }}
              >
                {c}
              </span>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
          {/* Left: file tree */}
          <div style={{
            width: '320px', flexShrink: 0, overflowY: 'auto',
            border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '0.5rem',
            background: 'var(--input-bg)',
          }}>
            {path && (
              <div
                onClick={goUp}
                style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem', opacity: 0.8 }}
              >
                ⬅️ ..
              </div>
            )}
            {loading && !selectedFile && <div style={{ padding: '0.5rem', opacity: 0.6 }}>Memuat...</div>}
            {!loading && entries.length === 0 && (
              <div style={{ padding: '0.5rem', opacity: 0.5, fontStyle: 'italic' }}>Folder kosong.</div>
            )}
            {entries.map((entry) => (
              <div
                key={entry.path}
                onClick={() => (entry.type === 'dir' ? loadDir(entry.path) : openFile(entry.path))}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.4rem 0.5rem', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem',
                  background: selectedFile && selectedFile.path === entry.path ? 'var(--surface)' : 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = selectedFile && selectedFile.path === entry.path ? 'var(--surface)' : 'transparent')}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileIcon(entry)} {entry.name}
                </span>
                {entry.type === 'file' && (
                  <span style={{ opacity: 0.5, fontSize: '0.7rem', flexShrink: 0, marginLeft: '0.5rem' }}>{formatSize(entry.size)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Right: file preview */}
          <div style={{
            flex: 1, minWidth: 0, overflow: 'auto',
            border: '1px solid var(--surface-border)', borderRadius: '8px',
            background: '#0d1117',
          }}>
            {error && <div style={{ padding: '1rem', color: '#ef5350' }}>❌ {error}</div>}
            {!selectedFile && !error && (
              <div style={{ padding: '1rem', opacity: 0.5, fontStyle: 'italic' }}>Pilih file untuk dilihat isinya.</div>
            )}
            {selectedFile && (
              <div>
                <div style={{
                  position: 'sticky', top: 0, background: '#161b22', padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid #30363d', fontSize: '0.8rem', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFile.path}
                  </span>
                  <span style={{ opacity: 0.6, flexShrink: 0, marginLeft: '0.5rem' }}>{formatSize(selectedFile.size)}</span>
                </div>
                <pre style={{
                  margin: 0, padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem',
                  color: '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {selectedFile.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
