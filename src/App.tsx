import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Bot,
  User,
  Plus,
  Trash2,
  ExternalLink,
  GraduationCap,
  Users,
  FileText,
  Briefcase,
  Home,
  BookOpen,
  Bus,
  MapPin,
  Menu,
  X,
  Sparkles,
  Building2,
  ShieldCheck,
  Compass,
  ChevronRight,
} from 'lucide-react';

interface SourceCitation {
  title: string;
  url: string;
  department?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  timestamp: string;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

const QUICK_CARDS = [
  {
    icon: GraduationCap,
    title: 'Courses & Departments',
    desc: 'Approved B.E. / B.Tech / M.E. / MBA degrees and seat intake',
    prompt: 'What courses does JJCET offer?',
  },
  {
    icon: Users,
    title: 'Faculty & HOD',
    desc: 'Department faculty rosters, HODs, and qualifications',
    prompt: 'CSE faculty list',
  },
  {
    icon: FileText,
    title: 'Admissions',
    desc: 'TNEA Counseling Code 3806, criteria & eligibility',
    prompt: 'Admission eligibility enna?',
  },
  {
    icon: Briefcase,
    title: 'Placements',
    desc: 'Training cell, recruiters (Zoho, TCS, EY) & statistics',
    prompt: 'JJCET placement details',
  },
  {
    icon: Home,
    title: 'Hostel',
    desc: 'Boys & girls accommodation, dining & student amenities',
    prompt: 'JJCET hostel facilities',
  },
  {
    icon: BookOpen,
    title: 'Library',
    desc: 'Central library, 55,280+ volumes, DELNET & NDLI',
    prompt: 'What facilities are in the central library?',
  },
  {
    icon: Bus,
    title: 'Transport',
    desc: '35 college bus routes across Trichy & neighbouring districts',
    prompt: 'college bus enga enga pogum',
  },
  {
    icon: MapPin,
    title: 'Campus & Location',
    desc: 'Ammapettai, Poolankulathupatti, Tiruchirappalli address & contacts',
    prompt: 'JJCET enga iruku?',
  },
];

const SIDEBAR_TOPICS = [
  { label: 'Courses', icon: GraduationCap, query: 'What courses does JJCET offer?' },
  { label: 'Admissions', icon: FileText, query: 'Admission eligibility enna?' },
  { label: 'Faculty', icon: Users, query: 'faculty list' },
  { label: 'Placements', icon: Briefcase, query: 'JJCET placement details' },
  { label: 'Hostel', icon: Home, query: 'JJCET hostel facilities' },
  { label: 'Library', icon: BookOpen, query: 'JJCET central library pathi sollu' },
  { label: 'Transport', icon: Bus, query: 'college bus enga enga pogum' },
  { label: 'About JJCET', icon: Building2, query: 'Where is JJCET located and what is its contact info?' },
];

function cleanSourceTitle(title: string): string {
  if (!title) return 'Official JJCET Document';
  return title
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<svg[^>]*\/>/gi, '')
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .replace(/^\[?svg\s*/i, '')
    .replace(/\[\/?svg\]?/gi, '')
    .replace(/\*{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*\*{1,4}/gi, '')
    .replace(/_{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*_{1,4}/gi, '')
    .replace(/(?:^|\s)\*{1,4}\s*svg\s*\*{1,4}(?:\s|$)/gim, ' ')
    .replace(/\*{2,}svg\*{2,}/gi, '')
    .replace(/\b(?:svgVerified|svgSuggested)\b/gi, '')
    .replace(/\bsvg[a-zA-Z0-9_]*\b/gi, '')
    .replace(/\bsvg\b/gi, '')
    .replace(/(?<=[a-zA-Z0-9])\s*svg\b/gi, '')
    .replace(/\bchunk_[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bchk-[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bscore:\s*\d+(\.\d+)?\b/gi, '')
    .replace(/\[\/?TABLE\]/gi, '')
    .replace(/^[\[\(\{\s]+|[\]\)\}\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAssistantText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<svg[^>]*\/>/gi, '')
    .replace(/<svg[^>]*>/gi, '')
    .replace(/<\/svg>/gi, '')
    .replace(/\[\/?svg\]?/gi, '')
    .replace(/\*{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*\*{1,4}/gi, '')
    .replace(/_{1,4}\s*svg(?:Verified|Suggested|[a-zA-Z0-9_]*)\s*_{1,4}/gi, '')
    .replace(/(?:^|\s)\*{1,4}\s*svg\s*\*{1,4}(?:\s|$)/gim, ' ')
    .replace(/\*{2,}svg\*{2,}/gi, '')
    .replace(/\b(?:svgVerified|svgSuggested)\b/gi, '')
    .replace(/\bsvg[a-zA-Z0-9_]*\b/gi, '')
    .replace(/\bsvg\b/gi, '')
    .replace(/(?<=[a-zA-Z0-9])\s*svg\b/gi, '')
    .replace(/\bchunk_[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bchk-[a-zA-Z0-9_-]+\b/gi, '')
    .replace(/\bscore:\s*\d+(\.\d+)?\b/gi, '')
    .replace(/\[\/?TABLE\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Check real backend status
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setIsOnline(data.status === 'online' && data.indexed === true);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      setIsOnline(true);

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: cleanAssistantText(data.answer) || 'No response generated from official records.',
        sources: (data.sources || []).map((s: SourceCitation) => ({
          ...s,
          title: cleanSourceTitle(s.title),
        })),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat request failed:', err);
      setIsOnline(false);

      const errorMessage: Message = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content:
          'JJCET AI is temporarily unavailable. Please make sure the backend server is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    textareaRef.current?.focus();
  };

  return (
    <div className="layout-root">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* LEFT SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-badge">JJ</div>
            <div className="brand-text">
              <span className="brand-title">JJCET AI</span>
              <span className="brand-subtitle">Trichy • Anna Univ</span>
            </div>
          </div>
          <button
            className="mobile-close-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-action">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="sidebar-nav">
          <div className="sidebar-section-title">Official Topics</div>
          <div className="sidebar-links-list">
            {SIDEBAR_TOPICS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  className="sidebar-nav-item"
                  onClick={() => handleSend(item.query)}
                  disabled={isLoading}
                >
                  <Icon size={17} className="nav-item-icon" />
                  <span className="nav-item-label">{item.label}</span>
                  <ChevronRight size={14} className="nav-item-arrow" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="sidebar-footer">
          {messages.length > 0 && (
            <button className="clear-chat-btn" onClick={handleNewChat}>
              <Trash2 size={15} />
              <span>Clear Conversation</span>
            </button>
          )}
          <div className="footer-meta">
            <div className="meta-badge">TNEA Code: 3806</div>
            <div className="meta-sub">AICTE Approved • ISO 9001:2008</div>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <div className="main-content">
        {/* Top Header */}
        <header className="main-header">
          <div className="header-left">
            <button
              className="menu-toggle-btn"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <div className="header-title-group">
              <div className="header-app-name">
                <Sparkles size={18} className="sparkle-icon" />
                <span>JJCET AI</span>
              </div>
              <span className="header-divider">•</span>
              <span className="header-tagline">Official Knowledge Assistant</span>
            </div>
          </div>

          <div className="header-right">
            <div
              className={`status-pill ${
                isOnline === true ? 'online' : isOnline === false ? 'offline' : 'checking'
              }`}
              title={
                isOnline === true
                  ? 'Connected to local RAG backend'
                  : 'Backend server not responding at port 3001'
              }
            >
              <span className="status-indicator-dot" />
              <span className="status-indicator-text">
                {isOnline === true ? 'AI Online' : isOnline === false ? 'AI Offline' : 'Connecting...'}
              </span>
            </div>
          </div>
        </header>

        {/* Chat Body */}
        <main className="chat-body">
          {messages.length === 0 ? (
            /* WELCOME SCREEN */
            <div className="welcome-container">
              <div className="welcome-hero">
                <div className="welcome-icon-ring">
                  <div className="welcome-icon-inner">
                    <Compass size={32} />
                  </div>
                </div>
                <h1 className="welcome-title">Ask anything about JJCET.</h1>
                <p className="welcome-subtitle">
                  Your AI assistant for official J.J. College of Engineering and Technology information.
                </p>
                <div className="language-pills">
                  <span className="lang-pill">English</span>
                  <span className="lang-pill">தமிழ்</span>
                  <span className="lang-pill">Tanglish</span>
                </div>
              </div>

              <div className="cards-grid">
                {QUICK_CARDS.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={idx}
                      className="quick-card"
                      onClick={() => handleSend(card.prompt)}
                      disabled={isLoading}
                    >
                      <div className="card-icon-box">
                        <Icon size={20} />
                      </div>
                      <div className="card-text">
                        <div className="card-heading">{card.title}</div>
                        <div className="card-description">{card.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* CONVERSATION TIMELINE */
            <div className="messages-stream">
              {messages.map(msg => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  <div className={`message-avatar ${msg.role}`}>
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={20} />}
                  </div>

                  <div className="message-content-wrapper">
                    <div className="message-bubble">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ node, ...props }) => (
                            <div className="markdown-table-wrapper">
                              <table className="markdown-table" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => (
                            <thead className="markdown-thead" {...props} />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody className="markdown-tbody" {...props} />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr className="markdown-tr" {...props} />
                          ),
                          th: ({ node, ...props }) => (
                            <th className="markdown-th" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="markdown-td" {...props} />
                          ),
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="markdown-link"
                            />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Official Source Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="sources-block">
                        <div className="sources-header">
                          <BookOpen size={14} className="sources-header-icon" />
                          <span>Official JJCET Source</span>
                        </div>
                        <div className="sources-cards-list">
                          {msg.sources.map((src, i) => {
                            const cleanTitle = cleanSourceTitle(src.title);
                            return (
                              <div key={i} className="source-card">
                                <div className="source-card-main">
                                  <div className="source-card-org">
                                    J.J. College of Engineering and Technology
                                  </div>
                                  <div className="source-card-title">{cleanTitle}</div>
                                </div>
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="source-card-btn"
                                  title={cleanTitle}
                                >
                                  <span>View Source</span>
                                  <ExternalLink size={13} />
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="message-timestamp">{msg.timestamp}</div>
                  </div>
                </div>
              ))}

              {/* Thinking / Loading State */}
              {isLoading && (
                <div className="message-row assistant">
                  <div className="message-avatar assistant">
                    <Bot size={20} />
                  </div>
                  <div className="message-content-wrapper">
                    <div className="message-bubble thinking-bubble">
                      <div className="thinking-text">JJCET AI is thinking...</div>
                      <div className="typing-dots">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input Bar */}
        <div className="input-panel">
          <div className="input-container">
            <form
              className="input-form"
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
            >
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                rows={1}
                placeholder="Ask anything about JJCET (English, தமிழ், Tanglish)..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                autoFocus
              />
              <button
                type="submit"
                className="send-btn"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
          <div className="input-disclaimer">
            <ShieldCheck size={13} className="disclaimer-icon" />
            <span>
              Answers are strictly grounded in official records from{' '}
              <a href="https://jjcet.ac.in/" target="_blank" rel="noopener noreferrer">
                jjcet.ac.in
              </a>
              . Anna University Affiliated • Trichy, Tamil Nadu.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
