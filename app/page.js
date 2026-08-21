'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function Home() {
  const [settings, setSettings] = useState({ baseUrl: '', apiKey: '', modelName: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [goal, setGoal] = useState('');
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  
  // To allow multiple sessions to run concurrently, we track executing sessions
  const [executingSessions, setExecutingSessions] = useState({});
  const abortControllersRef = useRef({});

  const [maxLoops, setMaxLoops] = useState(3);
  const [loopCount, setLoopCount] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isStopped, setIsStopped] = useState(false);

  // Live Logs for the current session
  const [liveLogs, setLiveLogs] = useState('');

  const fetchSessions = (autoLoadFirst = false) => {
    fetch(`/api/chat?type=agent&t=${Date.now()}`)
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

  const handleStop = () => {
    setIsStopped(true);
    if (sessionId && abortControllersRef.current[sessionId]) {
      abortControllersRef.current[sessionId].abort();
      delete abortControllersRef.current[sessionId];
      setExecutingSessions(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleResume = () => {
    setIsStopped(false);
  };

  const executeNextTask = async () => {
    if (!sessionId || !tasks.length || isStopped || executingSessions[sessionId]) return;
    
    const nextTask = tasks.find(t => t.status === 'PENDING' || t.status === 'RUNNING');
    if (!nextTask) return;

    const currentSessionId = sessionId;

    setExecutingSessions(prev => ({ ...prev, [currentSessionId]: true }));
    setLiveLogs('Menghubungkan ke server...\n');
    abortControllersRef.current[currentSessionId] = new AbortController();
    
    try {
      setTasks(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'RUNNING' } : t));
      
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, taskId: nextTask.id }),
        signal: abortControllersRef.current[currentSessionId].signal
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // Read SSE Stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let isDone = false;
      let finalTasks = null;
      let buffer = '';

      while (!isDone) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'log') {
                setSessionId(currentView => {
                  if (currentView === currentSessionId) {
                    setLiveLogs(prev => prev + data.message + '\n');
                  }
                  return currentView;
                });
              } else if (data.type === 'done') {
                finalTasks = data.tasks;
                isDone = true;
              } else if (data.type === 'error') {
                console.error("API Error:", data);
                if (sessionId === currentSessionId) {
                  alert(`Error: ${data.error}\n${data.details || ''}`);
                }
                isDone = true;
              }
            } catch (e) {
              console.error("Parse error on SSE line:", line, e);
            }
          }
        }
      }

      // Update tasks if we finished successfully
      if (finalTasks) {
        setSessionId(currentView => {
          if (currentView === currentSessionId) {
            setTasks(finalTasks);
          }
          return currentView;
        });
      } else {
        // Stream ended without a 'done' event (server maxDuration cut it, or the
        // connection dropped). Re-fetch task state from the DB so the loop can
        // continue instead of getting stuck on a RUNNING task forever.
        try {
          const check = await fetch(`/api/agent?sessionId=${currentSessionId}`);
          const checkData = await check.json();
          if (check.ok && checkData.tasks) {
            setSessionId(currentView => {
              if (currentView === currentSessionId) {
                setTasks(checkData.tasks);
              }
              return currentView;
            });
          }
        } catch (e) {
          console.error('Fallback task re-fetch failed:', e);
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Execution aborted by user.");
      } else {
        console.error("Execute error:", err);
      }
      setSessionId(currentView => {
        if (currentView === currentSessionId) {
          setTasks(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'PENDING' } : t));
          setIsStopped(true);
        }
        return currentView;
      });
    } finally {
      setExecutingSessions(prev => ({ ...prev, [currentSessionId]: false }));
      if (abortControllersRef.current[currentSessionId]) {
        delete abortControllersRef.current[currentSessionId];
      }
    }
  };

  const executeReview = async () => {
    if (isStopped || isReviewing) return;
    setIsReviewing(true);
    try {
      const res = await fetch('/api/agent/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      if (res.ok && data.tasks) {
        setTasks(data.tasks);
        if (data.newTasksAdded) {
          setLoopCount(prev => prev + 1);
        } else {
          setLoopCount(Infinity);
        }
      } else if (!res.ok) {
        setIsStopped(true);
        alert(data.details ? `Gagal mengevaluasi: ${data.error}\n\n${data.details}` : `Gagal mengevaluasi: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleSend = async () => {
    if (!goal.trim() || isLoading) return;
    setIsLoading(true);
    setHasSubmitted(true);
    setIsStopped(false);
    setLoopCount(0);
    setLiveLogs('');
    
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, sessionId })
      });
      
      const data = await res.json();
      
      if (res.ok && data.tasks) {
        setTasks(data.tasks);
        setSessionId(data.session.id);
        fetchSessions();
      } else if (!res.ok) {
        alert(data.details ? `${data.error}\n\nDetails: ${data.details}` : `Error: ${data.error}`);
        setHasSubmitted(false);
      }
    } catch (error) {
      console.error(error);
      setHasSubmitted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = async (id) => {
    setSessionId(id);
    setLiveLogs(''); // Reset logs for the new view
    
    // Check if the new session is currently executing in background
    if (executingSessions[id]) {
      setIsStopped(false);
      setLiveLogs('Sedang berjalan di latar belakang... (Log live mungkin terlewat sebagian)\n');
    } else {
      setIsStopped(true);
    }

    try {
      const res = await fetch(`/api/agent?sessionId=${id}`);
      const data = await res.json();
      if (res.ok) {
        if (data.session) {
          setGoal(data.session.goal);
          setTasks(data.tasks || []);
          setHasSubmitted(true);
        } else {
          setTasks([]);
          setGoal('');
          setHasSubmitted(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (id) => {
    if (abortControllersRef.current[id]) {
      abortControllersRef.current[id].abort();
      delete abortControllersRef.current[id];
    }
    
    if (sessionId === id) {
      setIsStopped(true);
      setTasks([]);
      setGoal('');
      setSessionId(null);
      setHasSubmitted(false);
      setLiveLogs('');
    }
    
    try {
      await fetch(`/api/chat?sessionId=${id}`, { method: 'DELETE' });
      fetchSessions();
    } catch (e) {
      console.error("Gagal menghapus sesi", e);
    }
  };

  const exportAsZip = async () => {
    const zip = new JSZip();
    const markdownContent = tasks.map((t, i) => `## Task ${i + 1}: ${t.description}\n\n**Status:** ${t.status}\n\n### Result\n${t.result || 'No output'}`).join('\n\n---\n\n');
    zip.file("execution_report.md", `# AI Agent Execution Report\n\n**Goal:** ${goal}\n\n---\n\n${markdownContent}`);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "agent-output.zip");
  };

  const saveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setShowSettings(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSessions(true);
  }, []);

  useEffect(() => {
    if (hasSubmitted && tasks.length > 0 && !isStopped && sessionId) {
      const hasPending = tasks.some(t => t.status === 'PENDING');
      const hasRunning = tasks.some(t => t.status === 'RUNNING');
      const isExecuting = executingSessions[sessionId];

      if ((hasPending || hasRunning) && !isExecuting && !isReviewing) {
        executeNextTask();
      } else if (!hasPending && !hasRunning && !isExecuting && !isReviewing) {
        const limit = parseInt(maxLoops, 10);
        if (isNaN(limit) || loopCount < limit) {
          executeReview();
        }
      }
    }
  }, [tasks, executingSessions, isReviewing, hasSubmitted, isStopped, maxLoops, loopCount, sessionId]);

  // Auto-scroll live logs
  const logsEndRef = useRef(null);
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-gradient)', color: 'var(--foreground)' }}>
      <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--surface-border)', zIndex: 10 }}>
        <Sidebar 
          setShowSettings={setShowSettings} 
          currentMode="agent" 
          sessions={sessions}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          currentSessionId={sessionId}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        <div className="blob" style={{ top: '-10%', left: '-10%', animationDelay: '0s' }}></div>
        <div className="blob" style={{ bottom: '-10%', right: '-10%', animationDelay: '2s', background: 'radial-gradient(circle, rgba(144,202,249,0.15) 0%, rgba(144,202,249,0) 70%)' }}></div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
          <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div className="glass" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', textAlign: 'center', background: 'linear-gradient(90deg, #bb86fc, #90caf9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Antigravity Agent
              </h1>
              
              {!hasSubmitted ? (
                <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="input-box" style={{ borderRadius: '24px', padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                    <textarea 
                      placeholder="Apa yang ingin Anda capai hari ini?"
                      value={goal}
                      onChange={(e) => {
                        setGoal(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = (e.target.scrollHeight) + 'px';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      style={{ flex: 1, padding: '1rem', border: 'none', background: 'transparent', color: 'white', resize: 'none', minHeight: '60px', maxHeight: '200px', outline: 'none' }}
                    />
                    <button onClick={handleSend} disabled={isLoading || !goal.trim()} style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--accent)', marginLeft: '0.5rem', padding: 0 }}>
                      {isLoading ? '⏳' : '↑'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <strong>Goal:</strong> {goal}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => {
                      if (sessionId && abortControllersRef.current[sessionId]) abortControllersRef.current[sessionId].abort();
                      setHasSubmitted(false);
                      setGoal('');
                      setTasks([]);
                      setSessionId(null);
                      setIsStopped(false);
                      setLiveLogs('');
                    }} style={{ background: 'var(--input-bg)', color: 'white', border: '1px solid var(--surface-border)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
                      ✨ Mulai Tujuan Baru
                    </button>
                    {!isStopped && (
                      <button onClick={handleStop} style={{ background: '#f44336', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
                        ⏹ Stop
                      </button>
                    )}
                    {isStopped && (
                      <button onClick={handleResume} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
                        ▶ Resume
                      </button>
                    )}
                    <button onClick={exportAsZip} style={{ background: 'var(--surface-border)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
                      💾 Export MD
                    </button>
                    <a href={`/api/export?sessionId=${sessionId}`} target="_blank" rel="noopener noreferrer" style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                      📦 Export Workspace ZIP
                    </a>
                  </div>
                </div>
              )}
            </div>

            {isLoading && (
              <div className="animate-fade-in" style={{ padding: '1rem', textAlign: 'center', opacity: 0.7 }}>
                Agent sedang merencanakan tugas awal...
              </div>
            )}
            
            {isReviewing && (
              <div className="animate-fade-in" style={{ padding: '1rem', textAlign: 'center', color: '#ff9800' }}>
                🔍 Agent sedang mengevaluasi hasil (Loop {loopCount + 1})...
              </div>
            )}

            {tasks.length > 0 && (
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', width: '100%', overflow: 'hidden' }}>
                
                {/* Left Column: To Do List */}
                <div className="glass animate-fade-in" style={{ width: '35%', flexShrink: 0, padding: '1.5rem', borderRadius: '12px', overflowY: 'auto', maxHeight: '70vh' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>To Do List (Plan)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tasks.map((task, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        padding: '0.6rem 0.75rem',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '8px',
                        opacity: task.status === 'PENDING' ? 0.7 : 1
                      }}>
                        <div style={{ 
                          width: '22px', 
                          height: '22px', 
                          borderRadius: '50%', 
                          border: '2px solid var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          flexShrink: 0
                        }}>
                          {task.status === 'COMPLETED' ? '✓' : (task.status === 'RUNNING' ? '⚙' : idx + 1)}
                        </div>
                        <div style={{ flex: 1, fontWeight: task.status === 'RUNNING' ? 'bold' : 'normal', fontSize: '0.85rem', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                          {task.description}
                        </div>
                        <div style={{ 
                          fontSize: '0.65rem', 
                          padding: '0.15rem 0.4rem', 
                          borderRadius: '4px',
                          flexShrink: 0,
                          background: task.status === 'PENDING' ? 'rgba(255,255,255,0.1)' : (task.status === 'RUNNING' ? '#ff9800' : 'var(--accent)'),
                          color: task.status === 'RUNNING' ? '#000' : '#fff'
                        }}>
                          {task.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Execution Results */}
                <div className="glass animate-fade-in" style={{ flex: 1, minWidth: 0, padding: '1.5rem', borderRadius: '12px', overflowY: 'auto', maxHeight: '70vh' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>Hasil Eksekusi</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {tasks.filter(t => t.result || t.status === 'RUNNING').map((task) => (
                      <div key={task.id} style={{
                        padding: '1rem',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent)', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
                          {task.description}
                        </div>
                        
                        {task.status === 'RUNNING' && (
                          <div style={{
                            background: '#0d1117',
                            color: '#00ff00',
                            padding: '1rem',
                            borderRadius: '8px',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            border: '1px solid #30363d',
                            marginTop: '0.5rem'
                          }}>
                            {liveLogs || 'Menunggu AI...'}
                            <div ref={logsEndRef} />
                          </div>
                        )}

                        {task.result && task.status === 'COMPLETED' && (
                          <div className="markdown-content" style={{ fontSize: '0.95rem', lineHeight: '1.6', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.result}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                    {tasks.filter(t => t.result || t.status === 'RUNNING').length === 0 && (
                      <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Belum ada hasil eksekusi.</div>
                    )}
                  </div>
                </div>

              </div>
            )}
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
