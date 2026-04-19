import { useState, useRef, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { aiChat, aiExtractInvoice, getAiSessions, getAiSessionMessages } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import {
  PaperPlaneRight, Robot, Plus, Image, SpinnerGap, ClockCounterClockwise,
  Lightning, ChartBar, Users, Package, Receipt, FilePdf, Microphone,
  MicrophoneSlash, ArrowRight, Invoice, Wallet, Calculator, Notebook
} from '@phosphor-icons/react';

const SUGGESTIONS = [
  { icon: ChartBar, label: 'Summarize sales this month', prompt: 'Summarize my sales performance this month including total sales, top customers, and trends.' },
  { icon: Users, label: 'Show overdue customers', prompt: 'Which customers have overdue invoices? List them with amounts and days overdue.' },
  { icon: Receipt, label: 'Compare expenses by month', prompt: 'Compare my expenses from last month vs this month. Which categories increased?' },
  { icon: Package, label: 'Low stock items', prompt: 'What items are currently low on stock and need to be reordered?' },
  { icon: Lightning, label: 'Cash flow analysis', prompt: 'Analyze my cash flow. What are the main inflows and outflows?' },
  { icon: Calculator, label: 'Month-end summary', prompt: 'Generate a month-end summary: total revenue, expenses, profit, AR balance, AP balance, and any critical alerts.' },
];

const ACTION_BUTTONS = [
  { id: 'create_invoice', label: 'Create Invoice', icon: Invoice, path: '/sales/new', color: '#0F2D5C' },
  { id: 'enter_bill', label: 'Enter Vendor Bill', icon: Wallet, path: '/bills', color: '#BA1A1A' },
  { id: 'enter_expense', label: 'Record Expense', icon: Receipt, path: '/expenses/new', color: '#7F2500' },
  { id: 'enter_inventory', label: 'Receive Stock', icon: Package, path: '/receive-stock', color: '#0E7490' },
  { id: 'view_reports', label: 'View Reports', icon: ChartBar, path: '/reports', color: '#16a34a' },
  { id: 'journal_entry', label: 'Journal Entry', icon: Notebook, path: '/journal-entries', color: '#191C1E' },
];

export default function AIAssistant() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  useEffect(() => {
    getAiSessions().then(res => setSessions(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await aiChat({ message: msg, session_id: sessionId || undefined, company_id: selectedCompany?.company_id || '' });
      setSessionId(res.data.session_id);
      // Check if response suggests an action
      const response = res.data.response;
      let actions = [];
      const lowerResp = response.toLowerCase();
      if (lowerResp.includes('invoice') && (lowerResp.includes('create') || lowerResp.includes('generate'))) actions.push('create_invoice');
      if (lowerResp.includes('bill') && (lowerResp.includes('enter') || lowerResp.includes('record'))) actions.push('enter_bill');
      if (lowerResp.includes('expense') && (lowerResp.includes('record') || lowerResp.includes('enter'))) actions.push('enter_expense');
      if (lowerResp.includes('stock') && (lowerResp.includes('receive') || lowerResp.includes('inventory'))) actions.push('enter_inventory');
      if (lowerResp.includes('report') && (lowerResp.includes('view') || lowerResp.includes('generate') || lowerResp.includes('run'))) actions.push('view_reports');
      setMessages([...newMessages, { role: 'assistant', content: response, suggestedActions: actions }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => { setMessages([]); setSessionId(''); setShowSessions(false); };

  const handleLoadSession = async (sid) => {
    try {
      const res = await getAiSessionMessages(sid);
      setMessages(res.data.map(m => ({ role: m.role, content: m.content })));
      setSessionId(sid); setShowSessions(false);
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    const label = type === 'pdf' ? 'PDF document' : 'invoice image';
    setMessages(prev => [...prev, { role: 'user', content: `Uploading ${label}: ${file.name}` }]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await aiExtractInvoice(formData);
      const data = res.data.extracted_data;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.raw_response ? data.raw_response :
          `**Data extracted from ${file.name}:**\n\n- **Customer:** ${data.customer_name || 'N/A'}\n- **Date:** ${data.invoice_date || 'N/A'}\n- **Items:** ${(data.items || []).length} line items\n- **Total:** $${(data.total || 0).toLocaleString()}\n\nI can create an invoice from this data. Click the button below.`,
        extractedData: data.raw_response ? null : data,
        suggestedActions: data.raw_response ? [] : ['create_invoice']
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Failed to process ${file.name}. Please try a clearer file.` }]);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        // For now, show a message that voice was captured
        setInput(prev => prev + ' [Voice input captured - type your message]');
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      // Auto-stop after 30 seconds
      setTimeout(() => { if (recorder.state === 'recording') { recorder.stop(); setIsRecording(false); } }, 30000);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const handleCreateFromExtracted = (data) => {
    navigate('/sales/new', { state: { extractedData: data } });
  };

  return (
    <AppShell>
      <div data-testid="ai-assistant-page" className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Sidebar - Sessions */}
        <div className={`${showSessions ? 'w-72' : 'w-0'} transition-all overflow-hidden flex-shrink-0`}>
          <div className="rounded-2xl h-full overflow-y-auto p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Chat History</h3>
              <button onClick={handleNewChat} className="p-1 rounded hover:bg-[#F2F4F6]" style={{ color: '#0F2D5C' }}><Plus size={16} /></button>
            </div>
            <div className="space-y-1">
              {sessions.map(s => (
                <button key={s.session_id} onClick={() => handleLoadSession(s.session_id)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${sessionId === s.session_id ? 'bg-[#F2F4F6]' : 'hover:bg-[#F7F9FB]'}`}>
                  <p className="font-medium truncate" style={{ color: '#191C1E' }}>{s.preview}</p>
                  <p className="mt-0.5" style={{ color: '#434655' }}>{s.message_count} messages</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                <Robot size={22} color="white" />
              </div>
              <div>
                <h1 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>AI Business Copilot</h1>
                <p className="text-xs" style={{ color: '#434655' }}>{selectedCompany?.name} — GPT-5.2 | English + Bangla</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="ai-history-btn" onClick={() => setShowSessions(!showSessions)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ClockCounterClockwise size={20} /></button>
              <button data-testid="ai-new-chat" onClick={handleNewChat} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}><Plus size={14} /> New Chat</button>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {ACTION_BUTTONS.map(a => {
              const Icon = a.icon;
              return (
                <button key={a.id} onClick={() => navigate(a.path)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80"
                  style={{ background: `${a.color}12`, color: a.color }}>
                  <Icon size={14} /> {a.label}
                </button>
              );
            })}
          </div>

          {/* Messages */}
          <div className="flex-1 rounded-2xl overflow-y-auto p-6 space-y-4 mb-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Robot size={48} style={{ color: '#C4C5D7' }} />
                <h2 className="text-lg font-semibold mt-4 mb-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Hishab Nikash AI Copilot</h2>
                <p className="text-sm mb-2 text-center max-w-md" style={{ color: '#434655' }}>Ask in English or Bangla. Upload invoices, PDFs, or images.</p>
                <p className="text-xs mb-6" style={{ color: '#434655' }}>I can create invoices, enter bills, record expenses, and generate reports.</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
                  {SUGGESTIONS.map(s => {
                    const Icon = s.icon;
                    return (
                      <button key={s.label} onClick={() => handleSend(s.prompt)}
                        className="text-left p-3 rounded-xl transition-colors hover:bg-[#F7F9FB]" style={{ border: '1px solid #E6E8EA' }}>
                        <Icon size={18} style={{ color: '#0F2D5C' }} />
                        <p className="text-xs font-medium mt-2" style={{ color: '#191C1E' }}>{s.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3`}
                    style={{ background: msg.role === 'user' ? '#0F2D5C' : '#F2F4F6', color: msg.role === 'user' ? '#FFFFFF' : '#191C1E' }}>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    {/* Extracted data action */}
                    {msg.extractedData && (
                      <button onClick={() => handleCreateFromExtracted(msg.extractedData)}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ background: '#16a34a' }}>
                        <Invoice size={14} /> Create Invoice from Extracted Data
                      </button>
                    )}
                    {/* Suggested actions */}
                    {msg.suggestedActions?.length > 0 && !msg.extractedData && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {msg.suggestedActions.map(actionId => {
                          const action = ACTION_BUTTONS.find(a => a.id === actionId);
                          if (!action) return null;
                          const Icon = action.icon;
                          return (
                            <button key={actionId} onClick={() => navigate(action.path)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                              style={{ background: '#FFFFFF', color: action.color, boxShadow: '0 0 0 1px ' + action.color }}>
                              <Icon size={12} /> {action.label} <ArrowRight size={10} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: '#F2F4F6' }}>
                  <SpinnerGap size={16} className="animate-spin" style={{ color: '#0F2D5C' }} />
                  <span className="text-xs" style={{ color: '#434655' }}>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="rounded-2xl p-3 flex items-center gap-2" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
            <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, 'pdf')} />

            {/* Upload image */}
            <button data-testid="ai-upload-image" onClick={() => fileInputRef.current?.click()} disabled={extracting}
              title="Upload Invoice Image"
              className="p-2 rounded-lg transition-colors hover:bg-[#F2F4F6]" style={{ color: extracting ? '#C4C5D7' : '#434655' }}>
              <Image size={20} />
            </button>

            {/* Upload PDF */}
            <button data-testid="ai-upload-pdf" onClick={() => pdfInputRef.current?.click()} disabled={extracting}
              title="Upload PDF Document"
              className="p-2 rounded-lg transition-colors hover:bg-[#F2F4F6]" style={{ color: extracting ? '#C4C5D7' : '#434655' }}>
              <FilePdf size={20} />
            </button>

            {/* Voice input */}
            <button data-testid="ai-voice-input" onClick={handleVoiceToggle}
              title={isRecording ? 'Stop Recording' : 'Voice Input'}
              className="p-2 rounded-lg transition-colors"
              style={{ color: isRecording ? '#FFFFFF' : '#434655', background: isRecording ? '#BA1A1A' : 'transparent' }}>
              {isRecording ? <MicrophoneSlash size={20} /> : <Microphone size={20} />}
            </button>

            {/* Text input */}
            <input data-testid="ai-chat-input" type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask in English or Bangla..."
              className="flex-1 px-3 py-2.5 text-sm rounded-lg focus:outline-none"
              style={{ background: '#F7F9FB', color: '#191C1E' }} />

            {/* Send */}
            <button data-testid="ai-send-btn" onClick={() => handleSend()} disabled={loading || !input.trim()}
              className="p-2.5 rounded-lg transition-opacity"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', opacity: loading || !input.trim() ? 0.5 : 1 }}>
              <PaperPlaneRight size={18} color="white" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
