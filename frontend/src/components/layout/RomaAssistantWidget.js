import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PaperPlaneRight,
  Robot,
  X,
  Image,
  FilePdf,
  Sparkle,
  SpinnerGap,
  ArrowSquareOut,
  PlusCircle,
  Receipt,
  Microphone,
  StopCircle,
  SpeakerHigh,
  SpeakerX,
  Compass,
} from '@phosphor-icons/react';
import { useCompany } from '../../contexts/CompanyContext';
import { aiChat, aiExtractInvoice, getSettings } from '../../lib/api';

const ROMA_AVATAR = process.env.REACT_APP_ROMA_AVATAR_URL || '/roma-avatar.svg';

const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;

const normalizeCommand = (value) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ROUTE_COMMANDS = [
  { route: '/dashboard', label: 'Dashboard', tests: ['dashboard', 'home'] },
  { route: '/sales', label: 'Sales', tests: ['sales', 'invoice list', 'all invoices', 'বিক্রয়'] },
  { route: '/sales/new', label: 'Create Invoice', tests: ['create invoice', 'new invoice', 'make invoice', 'invoice create', 'ইনভয়েস', 'চালান'] },
  { route: '/customers', label: 'Customers', tests: ['customers', 'customer list', 'কাস্টমার', 'গ্রাহক'] },
  { route: '/customer-payments/new', label: 'Receive Customer Payment', tests: ['receive payment', 'customer payment', 'record payment'] },
  { route: '/vendors', label: 'Vendors', tests: ['vendors', 'supplier', 'suppliers'] },
  { route: '/products', label: 'Products', tests: ['products', 'items', 'product list'] },
  { route: '/inventory', label: 'Inventory', tests: ['inventory', 'stock on hand', 'স্টক', 'ইনভেন্টরি'] },
  { route: '/stock-transfers', label: 'Stock Transfer', tests: ['stock transfer', 'transfer stock', 'warehouse transfer'] },
  { route: '/shipments', label: 'Shipments', tests: ['shipment', 'shipments', 'container', 'eta', 'etd', 'customs'] },
  { route: '/bills', label: 'Bills', tests: ['bills', 'vendor bills'] },
  { route: '/purchase-orders', label: 'Purchase Orders', tests: ['purchase order', 'purchase orders', 'po list'] },
  { route: '/expenses/new', label: 'New Expense', tests: ['new expense', 'create expense', 'add expense'] },
  { route: '/bank-transactions', label: 'Bank Transactions', tests: ['bank transaction', 'bank transactions', 'manual bank'] },
  { route: '/customer-ledger', label: 'Customer Ledger', tests: ['customer ledger'] },
  { route: '/vendor-ledger', label: 'Vendor Ledger', tests: ['vendor ledger'] },
  { route: '/reports', label: 'Reports', tests: ['reports', 'report center'] },
  { route: '/reports/sales', label: 'Sales Report', tests: ['sales report'] },
  { route: '/reports/profit-loss', label: 'Profit and Loss', tests: ['profit loss', 'p l', 'income statement'] },
  { route: '/settings', label: 'Settings', tests: ['settings', 'app settings', 'roles', 'users'] },
  { route: '/ai-import', label: 'AI Import Center', tests: ['ai import', 'import center', 'document import'] },
];

const DATA_QUERY_PATTERN = /\b(total|sales|balance|overdue|amount|report|reports|receivable|payable|paid|unpaid|profit|expense|low stock|stock)\b/i;
const NAVIGATION_PATTERN = /\b(open|go to|navigate|show page|take me to|launch)\b/i;

function buildRomaGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}. What do you need?`;
}

function pickRomaVoice(text) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const language = /[\u0980-\u09FF]/.test(text) ? 'bn-BD' : 'en-US';
  const voices = synth.getVoices?.() || [];
  if (!voices.length) return null;
  if (language === 'bn-BD') {
    return (
      voices.find((voice) => voice.lang?.toLowerCase().startsWith('bn')) ||
      voices.find((voice) => voice.name?.toLowerCase().includes('female')) ||
      voices[0]
    );
  }
  return (
    voices.find((voice) => voice.name === 'Samantha') ||
    voices.find((voice) => voice.name === 'Google US English') ||
    voices.find((voice) => voice.name?.toLowerCase().includes('zira')) ||
    voices.find((voice) => voice.lang === 'en-US' && voice.name?.toLowerCase().includes('female')) ||
    voices.find((voice) => voice.lang === 'en-US' && !voice.name?.toLowerCase().includes('male')) ||
    voices.find((voice) => voice.lang?.startsWith('en')) ||
    voices[0]
  );
}

function renderInlineMarkdown(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-black/10 px-1 py-0.5 text-[0.92em]">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

function MarkdownMessage({ content }) {
  const lines = String(content || '').split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (trimmed.startsWith('### ')) return <h4 key={index} className="mt-2 font-bold">{renderInlineMarkdown(trimmed.slice(4))}</h4>;
        if (trimmed.startsWith('## ')) return <h3 key={index} className="mt-2 font-bold">{renderInlineMarkdown(trimmed.slice(3))}</h3>;
        if (trimmed.startsWith('# ')) return <h2 key={index} className="mt-2 font-bold">{renderInlineMarkdown(trimmed.slice(2))}</h2>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return <p key={index} className="pl-3">• {renderInlineMarkdown(trimmed.slice(2))}</p>;
        return <p key={index}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

export default function RomaAssistantWidget() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: buildRomaGreeting(),
      meta: 'welcome',
    },
  ]);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [textFirstMode, setTextFirstMode] = useState(true);
  const [voiceLang, setVoiceLang] = useState('en-US');
  const [lastExtractedData, setLastExtractedData] = useState(null);
  const [contextMemory, setContextMemory] = useState({ last_customer: null, last_invoice: null });
  const scrollRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const panelRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!selectedCompany?.company_id) return undefined;
    let active = true;
    getSettings(selectedCompany.company_id)
      .then((response) => {
        if (!active) return;
        setVoiceEnabled(Boolean(response.data?.ai_voice_enabled));
        setTextFirstMode(response.data?.ai_text_first_mode !== false);
      })
      .catch(() => {
        if (!active) return;
        setVoiceEnabled(false);
        setTextFirstMode(true);
      });
    setSessionId('');
    setLastExtractedData(null);
    setContextMemory({ last_customer: null, last_invoice: null });
    setMessages([
      {
        role: 'assistant',
        content: buildRomaGreeting(),
        meta: 'welcome',
      },
    ]);
    return () => {
      active = false;
    };
  }, [selectedCompany?.company_id]);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      window.speechSynthesis?.cancel?.();
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (panelRef.current?.contains(target) || launcherRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  const speak = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const spokenText = textFirstMode ? String(text || '').split('\n').slice(0, 2).join(' ') : String(text || '');
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = /[\u0980-\u09FF]/.test(text) ? 'bn-BD' : 'en-US';
    utterance.voice = pickRomaVoice(text);
    utterance.rate = 1;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const addAssistantMessage = (content, extra = {}) => {
    setMessages((current) => [...current, { role: 'assistant', content, ...extra }]);
    speak(content);
  };

  const resolveTask = (message) => {
    const command = normalizeCommand(message);
    if (!command) return null;
    const asksToNavigate = NAVIGATION_PATTERN.test(command);

    if (/(read|scan|upload|extract).*(order|image|photo|pdf|file)|order image|handwritten|হাতের লেখা/.test(command)) {
      return {
        label: 'Upload Order',
        run: () => imageInputRef.current?.click(),
      };
    }

    if (/(open|create|make|prepare).*(extracted|order).*invoice|create invoice from order|open extracted invoice/.test(command)) {
      if (lastExtractedData) {
        return {
          label: 'Open Extracted Invoice',
          run: () => navigate('/sales/new', { state: { extractedData: lastExtractedData } }),
        };
      }
      return { label: 'Upload Order', run: () => imageInputRef.current?.click() };
    }

    if (/(create|make|prepare).*(invoice).*(them|that customer|this customer)/.test(command)) {
      const rememberedCustomer = contextMemory.last_customer;
      if (rememberedCustomer?.name) {
        const extractedData = {
          customer_id: rememberedCustomer.customer_id || '',
          customer_name: rememberedCustomer.name,
          items: [],
        };
        return {
          label: `Create Invoice for ${rememberedCustomer.name}`,
          run: () => navigate('/sales/new', { state: { extractedData } }),
        };
      }
      return null;
    }

    if (!asksToNavigate) {
      return null;
    }

    const matchedRoute = ROUTE_COMMANDS.find((item) => item.tests.some((test) => command.includes(test)));
    if (matchedRoute) {
      return {
        label: `Open ${matchedRoute.label}`,
        run: () => navigate(matchedRoute.route),
      };
    }

    return null;
  };

  const handleSend = async (forcedMessage = '') => {
    const normalizedForced = typeof forcedMessage === 'string' ? forcedMessage : '';
    const message = String(normalizedForced || input || '').trim();
    if (!message || loading) return;

    const nextMessages = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setInput('');

    setLoading(true);

    try {
      const suggestedAction = resolveTask(message);
      const response = await aiChat({
        message,
        session_id: sessionId || undefined,
        company_id: selectedCompany?.company_id || '',
        memory: contextMemory,
      });

      setSessionId(response.data.session_id || '');
      if (response.data.memory_updates) {
        setContextMemory((current) => ({ ...current, ...response.data.memory_updates }));
      }
      const wantsInvoice = /invoice|bill|create|draft|চালান|ইনভয়েস/i.test(message) && !DATA_QUERY_PATTERN.test(message);
      const reply = response.data.response || 'The data is not ready yet. Tell me what you want to review next.';
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: reply,
          showCreateInvoiceAction: wantsInvoice,
          suggestedAction,
        },
      ]);
      speak(reply);
    } catch (error) {
      const detail = error?.response?.data?.detail || 'ROMA could not respond right now.';
      addAssistantMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      addAssistantMessage('Voice listening is not supported in this browser. Please use Chrome or Edge, or type your command.');
      return;
    }

    window.speechSynthesis?.cancel?.();
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      addAssistantMessage('I could not hear clearly. Please try again or type the command.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setInput(transcript);
        handleSend(transcript);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setListening(false);
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setMessages((current) => [...current, { role: 'user', content: `Please read this order file: ${file.name}` }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await aiExtractInvoice(formData);
      const data = response.data.extracted_data || {};
      if (data.raw_response) {
        addAssistantMessage(data.raw_response);
      } else {
        setLastExtractedData(data);
        if (data.customer_name) {
          setContextMemory((current) => ({ ...current, last_customer: { name: data.customer_name } }));
        }
        addAssistantMessage(
          `I read the order and prepared invoice data for ${data.customer_name || 'the customer'}. Say "open extracted invoice" or press the button to review and post it.`,
          { extractedData: data }
        );
      }
    } catch (error) {
      addAssistantMessage('I could not read that file clearly. Please try a cleaner image or PDF.');
    } finally {
      setExtracting(false);
      event.target.value = '';
    }
  };

  if (!selectedCompany?.company_id) return null;

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          className="roma-assistant-widget fixed bottom-24 right-4 z-[70] w-[min(430px,calc(100vw-18px))] overflow-hidden rounded-[28px] border border-white/70 sm:right-5"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,255,0.97))', boxShadow: '0 24px 60px rgba(15,45,92,0.22)' }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: '#E6E8EA' }}>
            <div className="flex items-center gap-3">
              {ROMA_AVATAR ? (
                <div className="h-14 w-14 overflow-hidden rounded-full border-4 border-white shadow-sm" style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                  <img src={ROMA_AVATAR} alt="ROMA" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-white shadow-sm" style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                  <div className="absolute inset-[7px] rounded-full border border-white/80" />
                  <Robot size={26} color="white" weight="fill" className="relative" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold" style={{ color: '#191C1E' }}>ROMA</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#2563EB' }}>Accountant of CK Group</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('/ai-assistant')}
                className="rounded-xl p-2 transition-colors hover:bg-[#F2F4F6]"
                style={{ color: '#434655' }}
                title="Open full AI workspace"
              >
                <ArrowSquareOut size={18} />
              </button>
              <button
                onClick={() => setVoiceEnabled((current) => !current)}
                className="rounded-xl p-2 transition-colors hover:bg-[#F2F4F6]"
                style={{ color: voiceEnabled ? '#2563EB' : '#8A1C1C' }}
                title={voiceEnabled ? 'Turn ROMA voice off' : 'Turn ROMA voice on'}
              >
                {voiceEnabled ? <SpeakerHigh size={18} /> : <SpeakerX size={18} />}
              </button>
              <button
                onClick={() => setVoiceLang((current) => (current === 'en-US' ? 'bn-BD' : 'en-US'))}
                className="rounded-xl px-2.5 py-2 text-[11px] font-bold transition-colors hover:bg-[#F2F4F6]"
                style={{ color: '#2563EB' }}
                title="Switch ROMA listening language"
              >
                {voiceLang === 'en-US' ? 'EN' : 'BN'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 transition-colors hover:bg-[#F2F4F6]"
                style={{ color: '#434655' }}
                title="Close ROMA"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="border-b px-4 py-3" style={{ borderColor: '#E6E8EA', background: '#F8FBFF' }}>
            <p className="text-xs leading-relaxed" style={{ color: '#434655' }}>
              Type or speak a task: create invoices, review receivables, check stock, open reports, or read handwritten orders.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/sales/new')}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
              >
                <PlusCircle size={14} />
                Create Blank Invoice
              </button>
              {lastExtractedData && (
                <button
                  onClick={() => navigate('/sales/new', { state: { extractedData: lastExtractedData } })}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: '#E8F1FF', color: '#1D4ED8' }}
                >
                  <Receipt size={14} />
                  Open Extracted Invoice
                </button>
              )}
              <button
                onClick={listening ? stopListening : startListening}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: listening ? '#FEE2E2' : '#E8F1FF', color: listening ? '#991B1B' : '#1D4ED8' }}
              >
                {listening ? <StopCircle size={14} /> : <Microphone size={14} />}
                {listening ? `Listening ${voiceLang === 'bn-BD' ? 'BN' : 'EN'}` : 'Talk to ROMA'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['Read Order', () => imageInputRef.current?.click()],
                ['Sales', () => navigate('/sales')],
                ['Inventory', () => navigate('/inventory')],
                ['Reports', () => navigate('/reports')],
              ].map(([label, action]) => (
                <button
                  key={label}
                  onClick={action}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold"
                  style={{ background: '#FFFFFF', color: '#0F2D5C', boxShadow: '0 0 0 1px #D7DEEA' }}
                >
                  <Compass size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="space-y-3 overflow-y-auto px-4 py-4" style={{ maxHeight: 'min(52vh, 420px)' }}>
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[86%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: message.role === 'user' ? '#0F2D5C' : '#F2F4F6',
                    color: message.role === 'user' ? '#FFFFFF' : '#191C1E',
                  }}
                >
                  <MarkdownMessage content={message.content} />
                  {message.extractedData && (
                    <button
                      onClick={() => navigate('/sales/new', { state: { extractedData: message.extractedData } })}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #0E7490, #0F2D5C)' }}
                    >
                      <Sparkle size={14} />
                      Create Invoice From Order
                    </button>
                  )}
                  {message.showCreateInvoiceAction && (
                    <button
                      onClick={() => navigate('/sales/new')}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                      style={{ background: '#E8F1FF', color: '#1D4ED8' }}
                    >
                      <PlusCircle size={14} />
                      Open Create Invoice
                    </button>
                  )}
                  {message.suggestedAction && (
                    <button
                      onClick={() => message.suggestedAction.run?.()}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                      style={{ background: '#EFF6FF', color: '#0F2D5C' }}
                    >
                      <ArrowSquareOut size={14} />
                      {message.suggestedAction.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(loading || extracting) && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm" style={{ background: '#F2F4F6', color: '#434655' }}>
                  <SpinnerGap size={16} className="animate-spin" />
                  {extracting ? 'ROMA is reading the order...' : 'ROMA is thinking...'}
                </div>
              </div>
            )}
          </div>

          <div className="border-t px-4 py-3" style={{ borderColor: '#E6E8EA' }}>
            <div className="mb-2 flex items-center gap-2">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleUpload} />
              <button onClick={() => imageInputRef.current?.click()} className="rounded-xl p-2 transition-colors hover:bg-[#F2F4F6]" style={{ color: '#2563EB' }} title="Upload order image">
                <Image size={18} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="rounded-xl p-2 transition-colors hover:bg-[#F2F4F6]" style={{ color: '#2563EB' }} title="Upload PDF or scan">
                <FilePdf size={18} />
              </button>
              <button
                onClick={() => navigate('/sales/new')}
                className="ml-auto rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: '#EFF6FF', color: '#1D4ED8' }}
              >
                New Invoice
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={listening ? stopListening : startListening}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-opacity"
                style={{
                  background: listening ? '#FEE2E2' : '#EFF6FF',
                  color: listening ? '#991B1B' : '#2563EB',
                  boxShadow: listening ? '0 0 0 2px rgba(220,38,38,0.18)' : 'none',
                }}
                title={listening ? 'Stop listening' : 'Talk to ROMA'}
              >
                {listening ? <StopCircle size={19} /> : <Microphone size={19} />}
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask ROMA in English or Bangla..."
                className="flex-1 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                style={{ background: '#F7F9FB', boxShadow: '0 0 0 1px #D7DEEA', color: '#191C1E' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-opacity"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', opacity: !input.trim() || loading ? 0.5 : 1 }}
              >
                <PaperPlaneRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="roma-assistant-widget fixed bottom-24 right-4 z-[65] flex h-[78px] w-[78px] items-center justify-center rounded-full border-4 border-white text-white shadow-[0_18px_40px_rgba(37,99,235,0.42)] transition-transform hover:scale-[1.03] sm:bottom-5 sm:right-5"
        style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
        title="Open ROMA"
      >
        {ROMA_AVATAR ? (
          <img src={ROMA_AVATAR} alt="ROMA" className="h-full w-full rounded-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-[6px] rounded-full border border-white/70" />
            <div className="relative flex flex-col items-center leading-none">
              <Robot size={28} weight="fill" />
              <span className="mt-0.5 text-[11px] font-bold tracking-[0.18em]">ROMA</span>
            </div>
          </>
        )}
      </button>
    </>
  );
}
