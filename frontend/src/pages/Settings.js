import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getSettings, updateSettings, getTeamMembers, getPendingRegistrations, approveMember, rejectMember, updateMemberRole, importCustomersCSV, importVendorsCSV, importProductsCSV, runDailyLowStockCheck } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Gear, Buildings, Receipt, Users, Bell, Upload, Check, X, Shield, UserCirclePlus } from '@phosphor-icons/react';

const TABS = [
  { id: 'company', label: 'Company', icon: Buildings },
  { id: 'invoice', label: 'Invoice', icon: Receipt },
  { id: 'team', label: 'Team & Roles', icon: Users },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'import', label: 'CSV Import', icon: Upload },
];

const ROLES = ['Owner', 'Admin', 'Manager', 'Staff/Accountant', 'Viewer'];

const ROLE_DESCRIPTIONS = {
  'Owner': 'Full access across all modules, companies, users, permissions, and settings.',
  'Admin': 'Full access across all modules and team administration.',
  'Manager': 'Access to operational modules and reports. Cannot manage users or company setup.',
  'Staff/Accountant': 'Day-to-day entry: invoices, payments, expenses, stock receiving.',
  'Viewer': 'Read-only access to dashboard and reports.',
};

export default function Settings() {
  const { selectedCompany } = useCompany();
  const [tab, setTab] = useState('company');
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [alertResult, setAlertResult] = useState(null);

  useEffect(() => {
    if (!selectedCompany) return;
    getSettings(selectedCompany.company_id).then(res => setSettings(res.data)).catch(console.error);
    getTeamMembers().then(res => setMembers(res.data)).catch(() => {});
    getPendingRegistrations().then(res => setPending(res.data.filter(r => r.status === 'Pending'))).catch(() => {});
  }, [selectedCompany]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings(selectedCompany.company_id, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleApprove = async (reqId, role) => {
    await approveMember(reqId, { role, companies: [selectedCompany.company_id] });
    setPending(prev => prev.filter(p => p.request_id !== reqId));
    getTeamMembers().then(res => setMembers(res.data)).catch(() => {});
  };

  const handleReject = async (reqId) => {
    await rejectMember(reqId);
    setPending(prev => prev.filter(p => p.request_id !== reqId));
  };

  const handleCSVImport = async (type, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const fn = { customers: importCustomersCSV, vendors: importVendorsCSV, products: importProductsCSV }[type];
      const res = await fn(selectedCompany.company_id, formData);
      setImportResult(res.data);
      setTimeout(() => setImportResult(null), 5000);
    } catch (err) {
      setImportResult({ error: true, message: 'Import failed' });
    }
    e.target.value = '';
  };

  const handleDailyCheck = async () => {
    try {
      const res = await runDailyLowStockCheck();
      setAlertResult(res.data);
    } catch (err) { setAlertResult({ error: true }); }
  };

  const inputStyle = "w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1";
  const inputProps = { background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' };

  return (
    <AppShell>
      <div data-testid="settings-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Settings</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>{selectedCompany?.name} — Configuration & Administration</p>
          </div>
          {(tab === 'company' || tab === 'invoice') && (
            <button data-testid="save-settings-btn" onClick={handleSaveSettings} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: saved ? '#16a34a' : 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              {saved ? <><Check size={16} /> Saved</> : saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F2F4F6' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} data-testid={`settings-tab-${t.id}`} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? '' : 'hover:bg-white/50'}`}
                style={{ background: tab === t.id ? '#FFFFFF' : 'transparent', color: tab === t.id ? '#0F2D5C' : '#434655', boxShadow: tab === t.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Company Settings */}
        {tab === 'company' && (
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Company Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'company_address', label: 'Company Address' },
                { key: 'company_phone', label: 'Phone' },
                { key: 'company_email', label: 'Email' },
                { key: 'company_website', label: 'Website' },
                { key: 'currency', label: 'Currency' },
                { key: 'tax_rate', label: 'Default Tax Rate (%)', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>{label}</label>
                  <input type={type || 'text'} value={settings[key] || ''}
                    onChange={(e) => setSettings({ ...settings, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                    className={inputStyle} style={inputProps} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Company Logo URL</label>
                <input type="text" value={settings.logo_url || ''}
                  onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className={inputStyle} style={inputProps} />
              </div>
            </div>
          </div>
        )}

        {/* Invoice Settings */}
        {tab === 'invoice' && (
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Invoice Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Invoice Prefix</label>
                <input type="text" value={settings.invoice_prefix || ''} onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })} className={inputStyle} style={inputProps} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Starting Number</label>
                <input type="number" value={settings.invoice_starting_number || ''} onChange={(e) => setSettings({ ...settings, invoice_starting_number: parseInt(e.target.value) || 0 })} className={inputStyle} style={inputProps} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Default Payment Terms</label>
                <select value={settings.default_terms || 'Net 30'} onChange={(e) => setSettings({ ...settings, default_terms: e.target.value })} className={inputStyle} style={inputProps}>
                  <option>Net 30</option><option>Net 15</option><option>Net 60</option><option>Due on Receipt</option>
                </select></div>
              <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Invoice Footer Notes</label>
                <textarea value={settings.invoice_footer_notes || ''} onChange={(e) => setSettings({ ...settings, invoice_footer_notes: e.target.value })} rows={2} className={inputStyle + " resize-none"} style={inputProps} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Terms & Conditions Text</label>
                <textarea value={settings.invoice_terms_text || ''} onChange={(e) => setSettings({ ...settings, invoice_terms_text: e.target.value })} rows={3} className={inputStyle + " resize-none"} style={inputProps} /></div>
            </div>
          </div>
        )}

        {/* Team & Roles */}
        {tab === 'team' && (
          <div className="space-y-6">
            {/* Pending Approvals */}
            {pending.length > 0 && (
              <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <UserCirclePlus size={18} style={{ color: '#7F2500' }} />
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Pending Approvals ({pending.length})</h3>
                </div>
                <div className="space-y-3">
                  {pending.map(p => (
                    <div key={p.request_id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#F7F9FB' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{p.name}</p>
                        <p className="text-xs" style={{ color: '#434655' }}>{p.email} — Requested: {p.role_requested}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select data-testid={`approve-role-${p.request_id}`} defaultValue={p.role_requested} className="px-2 py-1 text-xs rounded-lg" style={{ boxShadow: '0 0 0 1px #C4C5D7' }}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button data-testid={`approve-btn-${p.request_id}`} onClick={() => handleApprove(p.request_id, p.role_requested)}
                          className="p-1.5 rounded-lg text-white" style={{ background: '#16a34a' }}><Check size={14} /></button>
                        <button onClick={() => handleReject(p.request_id)}
                          className="p-1.5 rounded-lg" style={{ color: '#BA1A1A', background: '#fef2f2' }}><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team Members */}
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Team Members</h3>
              <div className="mb-4 p-3 rounded-lg" style={{ background: '#F7F9FB' }}>
                <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: '#475569' }}>Role Permissions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs" style={{ color: '#475569' }}>
                  <div><Shield size={12} className="inline mr-1" style={{ color: '#0F2D5C' }} /><strong>Owner / Admin</strong>: Full access across all modules, users, and settings.</div>
                  <div><Shield size={12} className="inline mr-1" style={{ color: '#0E7490' }} /><strong>Manager</strong>: All operational modules + reports. No user/company setup.</div>
                  <div><Shield size={12} className="inline mr-1" style={{ color: '#047857' }} /><strong>Staff / Accountant</strong>: Invoices, payments, expenses, stock receiving.</div>
                  <div><Shield size={12} className="inline mr-1" style={{ color: '#475569' }} /><strong>Viewer</strong>: Read-only dashboard and reports.</div>
                </div>
              </div>
              {members.length === 0 ? (
                <p className="text-center py-6 text-sm" style={{ color: '#434655' }}>No team members yet. Members can register and you approve them.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => (
                      <tr key={m.member_id} style={{ borderBottom: '1px solid #F2F4F6' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{m.name}</td>
                        <td className="px-4 py-3" style={{ color: '#434655' }}>{m.email}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#0F2D5C' }}>{m.role}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{m.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Alerts */}
        {tab === 'alerts' && (
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Automated Alerts</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ background: '#F7F9FB' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#191C1E' }}>Daily Low Stock Check</p>
                    <p className="text-xs mt-1" style={{ color: '#434655' }}>Sends email alerts for all companies when items drop below reorder point. Recipient: {settings.alert_email || 'ckfrozenfishus@gmail.com'}</p>
                  </div>
                  <button data-testid="run-daily-check" onClick={handleDailyCheck}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                    Run Now
                  </button>
                </div>
                {alertResult && (
                  <div className="mt-3 p-3 rounded-lg" style={{ background: '#FFFFFF' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: '#191C1E' }}>Results:</p>
                    {(alertResult.results || []).map((r, i) => (
                      <p key={i} className="text-xs" style={{ color: r.status === 'sent' ? '#BA1A1A' : '#16a34a' }}>
                        {r.company}: {r.low_stock > 0 ? `${r.low_stock} low-stock items — alert ${r.status}` : 'All stock levels OK'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CSV Import */}
        {tab === 'import' && (
          <div className="space-y-6">
            {importResult && (
              <div className="rounded-lg p-3" style={{ background: importResult.error ? '#fef2f2' : '#dcfce7' }}>
                <p className="text-sm font-medium" style={{ color: importResult.error ? '#BA1A1A' : '#16a34a' }}>
                  {importResult.error ? 'Import failed' : `Successfully imported ${importResult.imported} ${importResult.type}`}
                </p>
              </div>
            )}
            {[
              { type: 'customers', title: 'Import Customers', desc: 'CSV with columns: Name, Company, Phone, Email, Address, Balance', icon: Users },
              { type: 'vendors', title: 'Import Vendors', desc: 'CSV with columns: Name, Company, Phone, Email, Address, Balance', icon: Buildings },
              { type: 'products', title: 'Import Products', desc: 'CSV with columns: Name, Description, Category, Unit, Cost, Price, Case Price, SKU', icon: Receipt },
            ].map(({ type, title, desc, icon: Icon }) => (
              <div key={type} className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F2F4F6' }}><Icon size={20} style={{ color: '#0F2D5C' }} /></div>
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: '#191C1E' }}>{title}</h3>
                      <p className="text-xs mt-0.5" style={{ color: '#434655' }}>{desc}</p>
                    </div>
                  </div>
                  <label data-testid={`import-${type}-btn`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors hover:bg-[#F2F4F6]"
                    style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #0F2D5C' }}>
                    <Upload size={16} /> Upload CSV
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleCSVImport(type, e)} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
