'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/SettingsModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const [settings, setSettings] = useState({ baseUrl: '', apiKey: '', modelName: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Halo! Ada yang bisa saya bantu hari ini?' }
  ]);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  const fetchSessions = (autoLoadFirst = false) => {
    fetch(`/api/chat?type=chat&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.sessions) {
          setSessions(data.sessions);
          if (autoLoadFirst && data.sessions.length > 0) {
            handleSelectSession(data.sessions[0].id);
          }
        }
      })
      .catch(err => console.error("Failed to load sessions", err));
  };

  const handleSelectSession = (id) => {
    localStorage.setItem('chatSessionId', id);
    setSessionId(id);
    setIsLoading(true);
    fetch(`/api/chat?sessionId=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          const loaded = data.messages.map(m => ({ role: m.role, content: m.content }));
          setMessages([{ role: 'assistant', content: 'Sesi sebelumnya berhasil dimuat!' }, ...loaded]);
        }
      })
      .catch(err => console.error("Failed to load history", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data));

    fetchSessions();

    const savedSessionId = localStorage.getItem('chatSessionId');
    if (savedSessionId) {
      handleSelectSession(savedSessionId);
    }
  }, []);



  const handleNewChat = () => {
    localStorage.removeItem('chatSessionId');
    setSessionId(null);
    setMessages([{ role: 'assistant', content: 'Sesi obrolan baru dimulai. Ada yang bisa saya bantu?' }]);
  };

  const handleDeleteSession = async (id) => {
    if (confirm("Hapus obrolan ini?")) {
      await fetch(`/api/chat?sessionId=${id}`, { method: 'DELETE' });
      if (sessionId === id) {
        handleNewChat();
      }
      fetchSessions();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveSettings = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    setShowSettings(false);
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMsg = message;
    setMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMsg, sessionId })
      });

      const data = await res.json();
      
      if (!res.ok) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : `Error: ${data.error}`;
        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        return;
      }

      if (data.session && !sessionId) {
        setSessionId(data.session.id);
        localStorage.setItem('chatSessionId', data.session.id);
        fetchSessions(); // Refresh sidebar list
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.assistantMessage.content }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Gagal menghubungi server.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        setShowSettings={setShowSettings} 
        currentMode="chat" 
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        currentSessionId={sessionId}
      />

      <div className="main-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem', borderBottom: '1px solid var(--surface-border)' }}>
          <button onClick={handleNewChat} style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer'
          }}>
            + Sesi Baru
          </button>
        </div>
        <div className="chat-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message animate-fade-in ${msg.role === 'user' ? 'user' : 'agent glass'}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          ))}
          {isLoading && (
            <div className="message agent glass animate-fade-in" style={{ opacity: 0.7 }}>
              AI sedang mengetik...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area glass">
          <div className="input-box">
            <input 
              type="text" 
              placeholder="Ketik pesan Anda di sini..." 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} disabled={isLoading}>
              {isLoading ? '...' : 'Kirim'}
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal 
          settings={settings}
          setSettings={setSettings}
          onSave={saveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
