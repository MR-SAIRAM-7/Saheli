import { useState, useRef, useEffect } from 'react';
import { Brain, Mic, Send, X, MessageCircle, Zap, QrCode } from 'lucide-react';
import { aiAgentApi, qrApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useApiFetch } from '../hooks/useApi';

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  isVoice?: boolean;
  time: string;
  txHash?: string;
  showQR?: boolean;
  qrData?: any;
}

export default function WhatsAppDemo({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'bot',
      content: '👋 Namaste! I\'m your Saheli AI Agent.\n\nYou can say:\n• "Deposit 500 rupees"\n• "I need a loan for ₹5000"\n• "My balance"\n• "Generate QR proof"\n\nI understand Hindi too! 🇮🇳',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const memberId = user?._id;
  const memberName = user?.name || 'Lakshmi Devi';
  const { data: promptSuggestions } = useApiFetch(
    () => aiAgentApi.getSuggestions(user?._id),
    [user?._id],
  );
  const quickPrompts = (promptSuggestions && promptSuggestions.length > 0)
    ? promptSuggestions
    : [
      { label: '🚨 Emergency ₹8000 hospital', text: 'Emergency 8000 rupees for hospital' },
      { label: '💰 Deposit 500 rupees', text: 'Deposit 500 rupees' },
      { label: '📋 Loan ₹5000', text: 'I need a loan for ₹5000' },
      { label: '📊 My balance', text: 'My balance' },
      { label: '📱 Generate QR proof', text: 'Generate QR proof' },
    ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      isVoice: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Add typing indicator
    const typingId = 'typing-' + Date.now();
    setMessages(prev => [...prev, {
      id: typingId,
      type: 'system',
      content: '...',
      time: '',
    }]);

    try {
      const response = await aiAgentApi.chat({
        message: text,
        memberId,
        memberName,
      });

      // Generate QR if needed
      let qrData = null;
      if (response.showQR && response.txHash) {
        try {
          qrData = await qrApi.generate({
            txHash: response.txHash,
            memberId,
            memberName,
            amount: response.amount,
            type: response.action,
          });
        } catch {
          // QR generation is optional
        }
      }

      // Remove typing indicator and add real response
      setMessages(prev => prev.filter(m => m.id !== typingId).concat({
        id: Date.now().toString(),
        type: 'bot',
        content: response.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        txHash: response.txHash,
        showQR: response.showQR,
        qrData,
      }));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== typingId).concat({
        id: Date.now().toString(),
        type: 'bot',
        content: '⚠️ Backend not connected yet. Start the Saheli API server first:\n`cd backend && npm run dev`',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[700px]">
        {/* Header */}
        <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Saheli Bot</p>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#25d366] rounded-full" />
              <p className="text-white/70 text-xs">Powered by AI Agent</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{ background: '#e5ddd5', backgroundImage: 'radial-gradient(circle, #d4c9b0 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          {/* AI Badge */}
          <div className="flex justify-center">
            <div className="bg-white/80 backdrop-blur-sm text-[#075e54] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
              <Brain className="w-3 h-3" />
              ChatGPT-4o / Whisper AI
            </div>
          </div>

          {messages.map(msg => (
            <div key={msg.id}>
              {msg.type === 'system' ? (
                <div className="flex justify-start">
                  <div className="bg-white rounded-xl px-4 py-2 shadow-sm max-w-[80%]">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                      msg.type === 'user'
                        ? 'bg-[#dcf8c6] rounded-tr-sm'
                        : msg.content.includes('EMERGENCY')
                          ? 'bg-red-50 border border-red-200 rounded-tl-sm'
                          : 'bg-white rounded-tl-sm'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.isVoice && <Mic className="w-3 h-3 text-[#075e54]" />}
                      {msg.type === 'bot' && <Brain className="w-3 h-3 text-[#075e54]" />}
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">
                      {msg.content}
                    </p>
                    {/* QR Code embedded in chat */}
                    {msg.showQR && msg.qrData && (
                      <div className="mt-3 p-2 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center">
                        <img
                          src={msg.qrData.qrCode}
                          alt="Transaction QR"
                          className="w-28 h-28 rounded-lg"
                        />
                        <p className="text-[10px] text-gray-500 mt-1 font-mono">
                          {msg.txHash?.slice(0, 20)}...
                        </p>
                        <div className={`flex items-center gap-1 text-[10px] font-bold mt-1 ${msg.qrData?.payload?.txStatus === 'confirmed' ? 'text-[#075e54]' : 'text-amber-600'}`}>
                          <QrCode className="w-3 h-3" />
                          {msg.qrData?.payload?.txStatus === 'confirmed'
                            ? 'Confirmed on Algorand'
                            : 'Pending confirmation'}
                        </div>
                      </div>
                    )}
                    {msg.time && (
                      <p className="text-[10px] text-gray-500 mt-1 text-right">{msg.time} ✓✓</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="bg-white px-3 pt-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {quickPrompts.map(prompt => (
            <button
              key={prompt.text}
              onClick={() => sendMessage(prompt.text)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold hover:opacity-80 transition-all whitespace-nowrap flex items-center gap-1 ${
                prompt.text.includes('Emergency') || prompt.text.includes('hospital')
                  ? 'bg-red-500/10 text-red-600 border border-red-200'
                  : 'bg-[#075e54]/10 text-[#075e54]'
              }`}
            >
              <Zap className="w-3 h-3" />
              {prompt.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="bg-white px-3 py-3 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Type a message..."
              className="bg-transparent text-sm flex-1 focus:outline-none text-gray-900"
              disabled={loading}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-[#075e54] rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-[#128c7e] transition-colors active:scale-95"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
