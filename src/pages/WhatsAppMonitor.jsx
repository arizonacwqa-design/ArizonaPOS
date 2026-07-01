import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Bot,
  MessageCircle,
  MessageSquare,
  PauseCircle,
  Search,
  Send,
  User,
  X,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/translations';

const N8N_WEBHOOK = 'https://primary-production-4ad9a.up.railway.app/webhook/human-reply';

function formatMsgTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateSeparator(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function Avatar({ name, phone }) {
  const letter = (name || phone || '?')[0].toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gold-600/20 border border-gold-600/30 flex items-center justify-center text-gold-400 font-bold text-sm shrink-0">
      {letter}
    </div>
  );
}

export default function WhatsAppMonitor() {
  const [loading, setLoading] = useState(true);
  const [aiPaused, setAiPaused] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const { t } = useTranslation();
  const [unread, setUnread] = useState({});
  const messagesEndRef = useRef(null);
  const errorTimer = useRef(null);

  const showError = (msg) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  };

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('whatsapp_monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        handleNewMessage,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedPhone]);

  async function loadData() {
    setLoading(true);
    try {
      const [settingsRes, messagesRes] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'ai_paused').single(),
        supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: true }),
      ]);

      if (settingsRes.data) {
        setAiPaused(settingsRes.data.value === true);
      }

      const msgs = messagesRes.data || [];
      setMessages(msgs);

      const counts = {};
      msgs.forEach((m) => {
        if (m.direction === 'incoming') {
          counts[m.phone] = (counts[m.phone] || 0) + 1;
        }
      });
      setUnread(counts);
    } catch (err) {
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function handleNewMessage(payload) {
    const newMsg = payload.new;
    setMessages((prev) => {
      const optimisticIdx = prev.findIndex(
        (m) =>
          m._tempId &&
          m.phone === newMsg.phone &&
          m.message === newMsg.message &&
          m.sent_by === newMsg.sent_by,
      );
      if (optimisticIdx >= 0) {
        const updated = [...prev];
        updated[optimisticIdx] = newMsg;
        return updated;
      }
      return [...prev, newMsg];
    });
    if (newMsg.direction === 'incoming' && newMsg.phone !== selectedPhone) {
      setUnread((prev) => ({ ...prev, [newMsg.phone]: (prev[newMsg.phone] || 0) + 1 }));
    }
  }

  async function toggleAi() {
    setToggling(true);
    const next = !aiPaused;
    try {
      const { error: err } = await supabase
        .from('app_settings')
        .update({ value: next })
        .eq('key', 'ai_paused');
      if (err) throw err;
      setAiPaused(next);
    } catch (err) {
      showError('Failed to toggle AI status');
    } finally {
      setToggling(false);
    }
  }

  async function sendMessage() {
    const text = messageInput.trim();
    if (!text || !selectedPhone) return;
    setSending(true);
    const customer = customers.find((c) => c.phone === selectedPhone);
    const optimistic = {
      _tempId: 'opt_' + Date.now(),
      phone: selectedPhone,
      message: text,
      direction: 'outgoing',
      sent_by: 'human',
      customer_name: customer?.name || '',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setMessageInput('');
    try {
      const res = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedPhone,
          message: text,
          customer_name: customer?.name || '',
        }),
      });
      if (!res.ok) throw new Error('Webhook failed');
    } catch (err) {
      showError('Failed to send message. Please try again.');
      setMessages((prev) => prev.filter((m) => m._tempId !== optimistic._tempId));
    } finally {
      setSending(false);
    }
  }

  function selectPhone(phone) {
    setSelectedPhone(phone);
    setUnread((prev) => ({ ...prev, [phone]: 0 }));
  }

  const customers = useMemo(() => {
    const groups = {};
    messages.forEach((m) => {
      if (!groups[m.phone]) {
        groups[m.phone] = {
          phone: m.phone,
          name: m.customer_name || m.phone,
          messages: [],
          lastMessage: null,
        };
      }
      if (
        !groups[m.phone].lastMessage ||
        new Date(m.created_at) > new Date(groups[m.phone].lastMessage.created_at)
      ) {
        groups[m.phone].lastMessage = m;
      }
    });
    return Object.values(groups).sort((a, b) => {
      const da = a.lastMessage ? new Date(a.lastMessage.created_at) : new Date(0);
      const db = b.lastMessage ? new Date(b.lastMessage.created_at) : new Date(0);
      return db - da;
    });
  }, [messages]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.phone === selectedPhone) || null;
  }, [customers, selectedPhone]);

  const conversationMessages = useMemo(() => {
    return messages
      .filter((m) => m.phone === selectedPhone)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [messages, selectedPhone]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-gold-400 mx-auto mb-3" size={32} />
          <p className="text-luxury-muted text-sm">{t('loadingConversations')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex animate-fade-in relative">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg z-50 text-sm shadow-lg">
          {error}
        </div>
      )}

      {/* ── LEFT PANEL ── */}
      <div className="w-80 shrink-0 border-r border-luxury-border bg-luxury-charcoal flex flex-col">
        <div className="p-4 border-b border-luxury-border">
          <h1 className="text-xl font-bold text-luxury-foreground">WhatsApp</h1>
          <p className="text-xs text-luxury-muted mt-0.5">{t('whatsappMonitor')}</p>
        </div>

        <div className="px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={toggleAi}
            disabled={toggling}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${
              aiPaused
                ? 'border border-luxury-border text-luxury-muted hover:bg-luxury-slate'
                : 'btn-gold'
            }`}
          >
            {toggling ? (
              <Loader2 className="animate-spin" size={18} />
            ) : aiPaused ? (
              <PauseCircle size={18} />
            ) : (
              <Bot size={18} />
            )}
            {aiPaused ? t('aiPausedClickResume') : t('aiActiveClickPause')}
          </button>
          <div className="flex items-center gap-1.5 mt-1.5 justify-center">
            <span
              className={`w-2 h-2 rounded-full ${
                aiPaused ? 'bg-luxury-muted' : 'bg-green-500 animate-pulse'
              }`}
            />
            <span className="text-[11px] text-luxury-muted">
              {aiPaused ? t('aiPaused') : t('aiActive')}
            </span>
          </div>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchConversations')}
              className="input-luxury pl-9 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredCustomers.length === 0 ? (
            <div className="p-4 text-center text-luxury-muted text-sm mt-8">
              {searchQuery ? t('noConversationsMatch') : t('noConversationsYet')}
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isActive = c.phone === selectedPhone;
              const count = unread[c.phone] || 0;
              return (
                <button
                  key={c.phone}
                  type="button"
                  onClick={() => selectPhone(c.phone)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-luxury-border/50 ${
                    isActive
                      ? 'bg-gold-600/10 border-gold-600/30'
                      : 'hover:bg-luxury-slate'
                  }`}
                >
                  <Avatar name={c.name} phone={c.phone} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          count > 0 ? 'font-bold text-luxury-foreground' : 'text-luxury-foreground'
                        }`}
                      >
                        {c.name}
                      </span>
                      {c.lastMessage && (
                        <span className="text-[10px] text-luxury-muted shrink-0">
                          {formatMsgTime(c.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-luxury-muted truncate">
                        {c.lastMessage?.message || ''}
                      </span>
                      {count > 0 && (
                        <span className="w-5 h-5 rounded-full bg-gold-500 text-[10px] font-bold text-luxury-black flex items-center justify-center shrink-0">
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-luxury-black">
        {!selectedPhone ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare
                className="text-luxury-muted/40 mx-auto mb-4"
                size={64}
              />
              <p className="text-luxury-muted">{t('selectConversation')}</p>
              <p className="text-luxury-muted/60 text-sm mt-1">{t('selectConversation')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-luxury-border bg-luxury-charcoal shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={selectedCustomer?.name} phone={selectedPhone} />
                <div className="min-w-0">
                  <p className="font-bold text-luxury-foreground text-sm truncate">
                    {selectedCustomer?.name || selectedPhone}
                  </p>
                  <p className="text-[11px] text-luxury-muted truncate">{selectedPhone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhone(null)}
                className="p-2 text-luxury-muted hover:text-gold-400 hover:bg-luxury-slate rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {conversationMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-luxury-muted text-sm">
                  {t('noMessagesYet')}
                </div>
              ) : (
                conversationMessages.map((msg, idx) => {
                  const prev = conversationMessages[idx - 1];
                  const showDateSep =
                    !prev ||
                    new Date(msg.created_at).toDateString() !==
                      new Date(prev.created_at).toDateString();
                  return (
                    <div key={msg.id || msg._tempId || idx}>
                      {showDateSep && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] text-luxury-muted/60 bg-luxury-charcoal px-3 py-1 rounded-full border border-luxury-border">
                            {formatDateSeparator(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex ${
                          msg.direction === 'incoming' ? 'justify-start' : 'justify-end'
                        } mb-1`}
                      >
                        <div
                          className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                            msg.direction === 'incoming'
                              ? 'bg-luxury-slate text-luxury-foreground rounded-bl-sm'
                              : msg.sent_by === 'human'
                                ? 'bg-luxury-charcoal border border-gold-600/20 text-luxury-foreground rounded-br-sm'
                                : 'bg-luxury-charcoal text-luxury-foreground rounded-br-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          <div
                            className={`flex items-center gap-1 mt-1.5 ${
                              msg.direction === 'incoming' ? 'justify-start' : 'justify-end'
                            }`}
                          >
                            <span className="text-[10px] text-luxury-muted/60">
                              {formatMsgTime(msg.created_at)}
                            </span>
                            <span
                              className={`text-[10px] flex items-center gap-0.5 ${
                                msg.sent_by === 'human'
                                  ? 'text-gold-400/70'
                                  : msg.sent_by === 'ai'
                                    ? 'text-blue-400/60'
                                    : 'text-luxury-muted/60'
                              }`}
                            >
                              {msg.direction === 'incoming' ? (
                                t('customer')
                              ) : msg.sent_by === 'human' ? (
                                <>
                                  <User size={10} />
                                  {t('you')}
                                </>
                              ) : (
                                'AI'
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-5 py-4 border-t border-luxury-border bg-luxury-charcoal shrink-0">
              {aiPaused ? (
                <div className="flex gap-3">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={t('typeMessage')}
                    rows={2}
                    className="input-luxury resize-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending || !messageInput.trim()}
                    className="btn-gold px-4 py-2 shrink-0 self-end"
                  >
                    {sending ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={toggleAi}
                  disabled={toggling}
                  className="w-full border border-luxury-border bg-luxury-slate/50 rounded-lg px-4 py-3 text-center text-sm text-luxury-muted hover:bg-luxury-slate transition-all cursor-pointer"
                >
                  <Bot className="inline-block mr-1.5 -mt-0.5" size={16} />
                  {t('aiManaging')}
                  <br />
                  <span className="text-[11px] text-luxury-muted/60">
                    {t('pauseAiToReply')}
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
