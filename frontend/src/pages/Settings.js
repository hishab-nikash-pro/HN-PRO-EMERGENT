import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import {
  approveMember,
  createTeamMember,
  deleteTeamMember,
  changePassword,
  getPendingRegistrations,
  getSettings,
  getTeamMembers,
  importCustomersCSV,
  importProductsCSV,
  importQuickBooksDesktop,
  importVendorsCSV,
  rejectMember,
  resetBusinessData,
  runDailyLowStockCheck,
  updateProfile,
  updateMemberRole,
  updateSettings,
} from '../lib/api';
import { DEFAULT_INVOICE_LAYOUT, normalizeInvoiceLayout } from '../lib/invoiceLayout';
import InvoiceLayoutDesigner from '../components/invoice/InvoiceLayoutDesigner';
import {
  Bell,
  Buildings,
  Check,
  FloppyDisk,
  List,
  Lock,
  Receipt,
  Shield,
  Trash,
  Upload,
  User,
  UserCirclePlus,
  Users,
  X,
} from '@phosphor-icons/react';
import { BRANDING } from '../config/branding';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { useSearchParams } from 'react-router-dom';

const TABS = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'company', label: 'Company', icon: Buildings },
  { id: 'appearance', label: 'Appearance', icon: List },
  { id: 'invoice', label: 'Invoice', icon: Receipt },
  { id: 'team', label: 'Team & Roles', icon: Users },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'import', label: 'CSV Import', icon: Upload },
  { id: 'data', label: 'Data Management', icon: Trash },
];

const ROLES = ['OWNER', 'MANAGER', 'STAFF'];

const ROLE_DESCRIPTIONS = {
  OWNER: 'Full access across users, settings, companies, and all business modules.',
  MANAGER: 'Operational access across accounting workflows, without user or settings management.',
  STAFF: 'Daily transaction access with no delete access and no settings access.',
};

const cardStyle = { background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const inputStyle = 'w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1';
const inputProps = { background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' };

export default function Settings() {
  const { selectedCompany, role } = useCompany();
  const { user, checkAuth, companies: accessibleCompanies } = useAuth();
  const { density, setDensity } = useUi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('company');
  const [settings, setSettings] = useState({});
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [pendingRoles, setPendingRoles] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', role: 'STAFF', password: '', company_ids: [] });
  const [memberFeedback, setMemberFeedback] = useState(null);
  const [memberActionId, setMemberActionId] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [alertResult, setAlertResult] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', role: '', notifications_enabled: true });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resettingData, setResettingData] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null);

  const invoiceLayout = useMemo(
    () => normalizeInvoiceLayout(settings.invoice_layout || DEFAULT_INVOICE_LAYOUT),
    [settings.invoice_layout]
  );
  const canAdminSettings = role === 'OWNER';

  const loadPageData = useCallback(async () => {
    if (!selectedCompany?.company_id) return;
    try {
      const [settingsRes, membersRes, pendingRes] = await Promise.all([
        getSettings(selectedCompany.company_id),
        getTeamMembers(selectedCompany.company_id),
        getPendingRegistrations(selectedCompany.company_id),
      ]);

      setSettings({
        ...settingsRes.data,
        invoice_layout: normalizeInvoiceLayout(settingsRes.data?.invoice_layout),
      });
      setMembers(membersRes.data || []);
      setPending((pendingRes.data || []).filter((entry) => entry.status === 'Pending'));
      setPendingRoles(
        Object.fromEntries((pendingRes.data || []).map((entry) => [entry.request_id, entry.role_requested || 'STAFF']))
      );
    } catch (error) {
      console.error(error);
    }
  }, [selectedCompany?.company_id]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (nextTab && TABS.some((entry) => entry.id === nextTab) && nextTab !== tab) {
      setTab(nextTab);
    }
  }, [searchParams, tab]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      role: role || '',
      notifications_enabled: user?.notifications_enabled !== false,
    });
  }, [user, role]);

  useEffect(() => {
    if (!selectedCompany?.company_id) return;
    setMemberForm((current) => (
      current.company_ids?.length
        ? current
        : { ...current, company_ids: [selectedCompany.company_id] }
    ));
  }, [selectedCompany?.company_id]);

  const patchSettings = (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const changeTab = (nextTab) => {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings(selectedCompany.company_id, {
        ...settings,
        invoice_layout: invoiceLayout,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    try {
      setProfileSaving(true);
      setProfileFeedback({ type: 'loading', message: 'Saving your profile...' });
      await updateProfile({
        name: profileForm.name,
        notifications_enabled: profileForm.notifications_enabled,
      });
      await checkAuth();
      setProfileFeedback({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        message: error?.response?.data?.detail || 'Unable to save your profile right now.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (event) => {
    event.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setProfileFeedback({ type: 'error', message: 'New password and confirm password must match.' });
      return;
    }
    try {
      setPasswordSaving(true);
      setProfileFeedback({ type: 'loading', message: 'Changing password...' });
      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setProfileFeedback({ type: 'success', message: 'Password changed successfully.' });
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        message: error?.response?.data?.detail || 'Unable to change the password right now.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setMemberActionId(requestId);
      await approveMember(requestId, {
        role: pendingRoles[requestId] || 'STAFF',
        companies: [selectedCompany.company_id],
      });
      await loadPageData();
    } catch (error) {
      console.error(error);
    } finally {
      setMemberActionId('');
    }
  };

  const handleReject = async (requestId) => {
    try {
      setMemberActionId(requestId);
      await rejectMember(requestId);
      await loadPageData();
    } catch (error) {
      console.error(error);
    } finally {
      setMemberActionId('');
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    try {
      setMemberFeedback({ type: 'loading', message: 'Creating user access...' });
      const response = await createTeamMember({
        ...memberForm,
        company_ids: memberForm.company_ids,
      });
      const tempPassword = response.data?.temporary_password;
      setMemberFeedback({
        type: 'success',
        message: tempPassword
          ? `User created. Temporary password: ${tempPassword}`
          : 'User access added successfully.',
      });
      setMemberForm({ name: '', email: '', role: 'STAFF', password: '', company_ids: [selectedCompany.company_id] });
      await loadPageData();
    } catch (error) {
      setMemberFeedback({
        type: 'error',
        message: error?.response?.data?.detail || 'Unable to create the user right now.',
      });
    }
  };

  const handleRoleChange = async (memberId, role) => {
    try {
      setMemberActionId(memberId);
      const currentMember = members.find((member) => member.member_id === memberId);
      await updateMemberRole(memberId, { role, companies: currentMember?.companies || [selectedCompany.company_id] });
      await loadPageData();
    } catch (error) {
      console.error(error);
    } finally {
      setMemberActionId('');
    }
  };

  const handleDeleteMember = async (memberId) => {
    try {
      setMemberActionId(memberId);
      await deleteTeamMember(memberId, selectedCompany.company_id);
      await loadPageData();
    } catch (error) {
      setMemberFeedback({
        type: 'error',
        message: error?.response?.data?.detail || 'Unable to remove this user.',
      });
    } finally {
      setMemberActionId('');
    }
  };

  const handleCSVImport = async (type, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const fn = {
        customers: importCustomersCSV,
        vendors: importVendorsCSV,
        products: importProductsCSV,
        quickbooks: importQuickBooksDesktop,
      }[type];
      const response = await fn(selectedCompany.company_id, formData);
      if (type === 'quickbooks') {
        const data = response.data || {};
        const summary = data.imported || {};
        const totalImported = Object.values(summary).reduce((sum, count) => sum + (Number(count) || 0), 0);
        setImportResult({
          imported: totalImported,
          type: `quickbooks (${data.dataset || 'detected'})`,
          details: summary,
        });
      } else {
        setImportResult(response.data);
      }
      setTimeout(() => setImportResult(null), 5000);
    } catch (error) {
      setImportResult({ error: true, message: error?.response?.data?.detail || 'Import failed' });
    }

    event.target.value = '';
  };

  const handleDailyCheck = async () => {
    try {
      const response = await runDailyLowStockCheck();
      setAlertResult(response.data);
    } catch (error) {
      setAlertResult({ error: true });
    }
  };

  const handleResetBusinessData = async () => {
    if (!selectedCompany?.company_id || !canAdminSettings) return;
    try {
      setResettingData(true);
      setResetFeedback(null);
      const response = await resetBusinessData(selectedCompany.company_id);
      setResetFeedback({
        type: 'success',
        message: response.data?.message || 'All business data cleared successfully.',
        counts: response.data?.deleted_counts || {},
      });
      setResetConfirmOpen(false);
    } catch (error) {
      setResetFeedback({
        type: 'error',
        message: error?.response?.data?.detail || 'Unable to reset business data right now.',
      });
    } finally {
      setResettingData(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="settings-page" className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-[28px] border border-white/70 px-4 py-4 sm:px-5 sm:py-5" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))', boxShadow: '0 16px 40px rgba(15,45,92,0.08)' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: '#0E7490' }}>Administration</p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Settings Workspace</h1>
              <p className="mt-1 text-sm sm:text-base" style={{ color: '#434655' }}>
                {selectedCompany?.name} configuration, invoice layout, access control, and automation tools.
              </p>
            </div>
            {(tab === 'company' || tab === 'invoice' || tab === 'team') && canAdminSettings && (
              <button
                data-testid="save-settings-btn"
                onClick={handleSaveSettings}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                style={{ background: saved ? '#15803d' : 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
              >
                {saved ? <Check size={16} /> : <FloppyDisk size={16} />}
                {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                data-testid={`settings-tab-${item.id}`}
                onClick={() => changeTab(item.id)}
                className="inline-flex min-w-fit items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  background: active ? '#FFFFFF' : '#F2F4F6',
                  color: active ? '#0F2D5C' : '#434655',
                  boxShadow: active ? '0 8px 20px rgba(15,45,92,0.1)' : 'none',
                }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'profile' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <form onSubmit={handleProfileSave} className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
              <div className="flex items-center gap-2">
                <User size={18} style={{ color: '#0E7490' }} />
                <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>My Profile</h3>
              </div>
              <p className="mt-1 text-sm" style={{ color: '#434655' }}>
                Update your own account information and notification preferences for this application.
              </p>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Name</label>
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputStyle}
                    style={inputProps}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Email</label>
                  <input value={profileForm.email} className={inputStyle} style={{ ...inputProps, background: '#F7F9FB', color: '#667085' }} disabled />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Role</label>
                  <input value={profileForm.role} className={inputStyle} style={{ ...inputProps, background: '#F7F9FB', color: '#667085' }} disabled />
                </div>
                <label className="flex items-center gap-3 rounded-2xl p-3 text-sm font-medium" style={{ background: '#F7F9FB', color: '#191C1E' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(profileForm.notifications_enabled)}
                    onChange={(event) => setProfileForm((current) => ({ ...current, notifications_enabled: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  Receive in-app and owner notification emails for account activity
                </label>
              </div>
              <button type="submit" disabled={profileSaving} className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                <FloppyDisk size={16} />
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>

            <form onSubmit={handlePasswordSave} className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
              <div className="flex items-center gap-2">
                <Lock size={18} style={{ color: '#0E7490' }} />
                <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Change Password</h3>
              </div>
              <p className="mt-1 text-sm" style={{ color: '#434655' }}>
                Use your current password to set a new local password for your account.
              </p>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                    className={inputStyle}
                    style={inputProps}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>New Password</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                    className={inputStyle}
                    style={inputProps}
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
                    className={inputStyle}
                    style={inputProps}
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={passwordSaving} className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ background: '#0F2D5C' }}>
                <Lock size={16} />
                {passwordSaving ? 'Changing...' : 'Change Password'}
              </button>
            </form>

            {profileFeedback && (
              <div className="xl:col-span-2 rounded-2xl p-4 text-sm" style={{ background: profileFeedback.type === 'error' ? '#fef2f2' : '#ecfeff', color: profileFeedback.type === 'error' ? '#B91C1C' : '#0F766E' }}>
                {profileFeedback.message}
              </div>
            )}
          </div>
        )}

        {tab === 'company' && (
          <div className="space-y-5">
            <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
              <h3 className="mb-4 text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Company Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['company_address', 'Company Address'],
                  ['company_phone', 'Phone'],
                  ['company_email', 'Email'],
                  ['company_website', 'Website'],
                  ['currency', 'Currency'],
                  ['tax_rate', 'Default Tax Rate (%)', 'number'],
                ].map(([key, label, type]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>{label}</label>
                    <input
                      type={type || 'text'}
                      value={settings[key] || ''}
                      onChange={(event) =>
                        patchSettings({ [key]: type === 'number' ? parseFloat(event.target.value) || 0 : event.target.value })
                      }
                      className={inputStyle}
                      style={inputProps}
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Company Logo URL</label>
                  <input
                    value={settings.logo_url || ''}
                    onChange={(event) => patchSettings({ logo_url: event.target.value })}
                    placeholder="https://example.com/logo.png"
                    className={inputStyle}
                    style={inputProps}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
              <h3 className="mb-2 text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>ROMA AI Runtime</h3>
              <p className="mb-4 text-sm" style={{ color: '#475569' }}>
                Keep ROMA fast by using a local free provider first, with cloud fallback only when you choose it.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>AI Provider</label>
                  <select
                    value={settings.ai_provider || 'openai'}
                    onChange={(event) => patchSettings({ ai_provider: event.target.value })}
                    className={inputStyle}
                    style={inputProps}
                  >
                    <option value="ollama">Ollama (Local / Free)</option>
                    <option value="openai_compatible">OpenAI-Compatible Local Server</option>
                    <option value="openai">OpenAI Fallback</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>AI Model</label>
                  <input
                    value={settings.ai_model || ''}
                    onChange={(event) => patchSettings({ ai_model: event.target.value })}
                    placeholder="qwen2.5:7b-instruct"
                    className={inputStyle}
                    style={inputProps}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>AI Base URL</label>
                  <input
                    value={settings.ai_base_url || ''}
                    onChange={(event) => patchSettings({ ai_base_url: event.target.value })}
                    placeholder="http://127.0.0.1:11434/v1"
                    className={inputStyle}
                    style={inputProps}
                  />
                </div>
                <label className="flex items-center gap-3 rounded-2xl p-3 text-sm font-medium" style={{ background: '#F7F9FB', color: '#191C1E' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.ai_text_first_mode ?? true)}
                    onChange={(event) => patchSettings({ ai_text_first_mode: event.target.checked })}
                    className="h-4 w-4"
                  />
                  Keep ROMA in fast text-first mode
                </label>
                <label className="flex items-center gap-3 rounded-2xl p-3 text-sm font-medium" style={{ background: '#F7F9FB', color: '#191C1E' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.ai_voice_enabled)}
                    onChange={(event) => patchSettings({ ai_voice_enabled: event.target.checked })}
                    className="h-4 w-4"
                  />
                  Enable ROMA voice playback
                </label>
              </div>
            </div>
          </div>
        )}

        {tab === 'appearance' && (
          <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
            <h3 className="mb-2 text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Appearance</h3>
            <p className="mb-5 text-sm" style={{ color: '#475569' }}>Choose how much information fits on screen. Compact is the default for the QuickBooks-style dense workspace.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { value: 'compact', title: 'Compact', description: 'About 10% tighter spacing, smaller sidebar, denser rows, and more ledger content visible.' },
                { value: 'comfortable', title: 'Comfortable', description: 'Larger spacing and roomier cards for users who prefer the original scale.' },
              ].map((option) => {
                const active = density === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDensity(option.value)}
                    className="rounded-2xl p-4 text-left transition-all"
                    style={{ background: active ? '#EFF6FF' : '#F8FAFC', boxShadow: `inset 0 0 0 1px ${active ? '#0F2D5C' : '#E6E8EA'}` }}
                  >
                    <span className="block text-sm font-bold" style={{ color: '#0F2D5C' }}>{option.title}</span>
                    <span className="mt-1 block text-xs leading-5" style={{ color: '#475569' }}>{option.description}</span>
                    {active && <span className="mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: '#0F2D5C', color: '#FFFFFF' }}>Active</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'invoice' && (
          <InvoiceLayoutDesigner
            settings={settings}
            selectedCompany={selectedCompany}
            patchSettings={patchSettings}
            onSave={handleSaveSettings}
            inputStyle={inputStyle}
            inputProps={inputProps}
          />
        )}

        {false && tab === 'invoice' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
            <div className="space-y-5">
              <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
                <h3 className="mb-4 text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Document Defaults</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['invoice_prefix', 'Invoice Prefix'],
                    ['invoice_starting_number', 'Starting Number', 'number'],
                    ['sales_order_prefix', 'Sales Order Prefix'],
                    ['purchase_order_prefix', 'Purchase Order Prefix'],
                    ['bill_prefix', 'Bill Prefix'],
                    ['fiscal_year_start', 'Fiscal Year Start'],
                    ['invoice_due_reminder_days', 'Invoice Reminder Days', 'number'],
                    ['bill_due_reminder_days', 'Bill Reminder Days', 'number'],
                    ['overdue_reminder_days', 'Overdue Reminder Delay', 'number'],
                  ].map(([key, label, type]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>{label}</label>
                      <input
                        type={type || 'text'}
                        value={settings[key] || ''}
                        onChange={(event) =>
                          patchSettings({ [key]: type === 'number' ? parseInt(event.target.value, 10) || 0 : event.target.value })
                        }
                        className={inputStyle}
                        style={inputProps}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Default Payment Terms</label>
                    <select
                      value={settings.default_terms || 'Net 30'}
                      onChange={(event) => patchSettings({ default_terms: event.target.value })}
                      className={inputStyle}
                      style={inputProps}
                    >
                      <option>Net 30</option>
                      <option>Net 15</option>
                      <option>Net 60</option>
                      <option>Due on Receipt</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Recurring Auto Run</label>
                    <select
                      value={settings.recurring_auto_run ? 'true' : 'false'}
                      onChange={(event) => patchSettings({ recurring_auto_run: event.target.value === 'true' })}
                      className={inputStyle}
                      style={inputProps}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Invoice Footer Notes</label>
                    <textarea
                      rows={2}
                      value={settings.invoice_footer_notes || ''}
                      onChange={(event) => patchSettings({ invoice_footer_notes: event.target.value })}
                      className={`${inputStyle} resize-none`}
                      style={inputProps}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Terms & Conditions Text</label>
                    <textarea
                      rows={3}
                      value={settings.invoice_terms_text || ''}
                      onChange={(event) => patchSettings({ invoice_terms_text: event.target.value })}
                      className={`${inputStyle} resize-none`}
                      style={inputProps}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border bg-white shadow-[0_12px_28px_rgba(15,45,92,0.08)]" style={{ borderColor: '#C7D3E2' }}>
                <div className="flex items-center justify-between rounded-t-[24px] px-4 py-2 text-white" style={{ background: 'linear-gradient(180deg, #214A76 0%, #17365A 100%)' }}>
                  <div className="text-sm font-semibold">Layout Designer - {selectedCompany?.name || 'Invoice Workspace'}</div>
                  <button type="button" onClick={() => patchSettings({ invoice_layout: DEFAULT_INVOICE_LAYOUT })} className="text-white/90">
                    <X size={16} weight="bold" />
                  </button>
                </div>

                <div className="border-b px-3 py-3" style={{ borderColor: '#D7E1EC', background: '#F8FBFE' }}>
                  <div className="grid gap-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_1.1fr_1fr_1fr]">
                    {['Properties...', 'Add', 'Copy', 'Remove', 'Copy Format'].map((label) => (
                      <button key={label} type="button" className="rounded border px-3 py-2 text-[12px] font-bold" style={{ borderColor: '#CDD8E4', background: '#FFFFFF', color: '#455A72' }}>
                        {label}
                      </button>
                    ))}
                    <button type="button" className="rounded border px-3 py-2 text-[12px] font-bold" style={{ borderColor: '#CDD8E4', background: '#FFFFFF', color: '#455A72' }}>Undo</button>
                    <button type="button" className="rounded border px-3 py-2 text-[12px] font-bold" style={{ borderColor: '#CDD8E4', background: '#FFFFFF', color: '#455A72' }}>Redo</button>
                    <div className="flex items-center gap-2 rounded border px-3 py-2" style={{ borderColor: '#CDD8E4', background: '#FFFFFF' }}>
                      <span className="text-[11px] font-bold uppercase" style={{ color: '#60758C' }}>Zoom</span>
                      <span className="text-[12px] font-bold" style={{ color: '#2D4661' }}>In / Out</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-[18px] border bg-[#F4F7FB] p-3" style={{ borderColor: '#D7E1EC' }}>
                    <div className="overflow-auto rounded-[14px] border bg-white p-3" style={{ borderColor: '#C9D5E2' }}>
                      <div className="mb-2 h-4 rounded-sm border-b border-t" style={{ borderColor: '#C9D5E2', background: 'repeating-linear-gradient(90deg, #F5F7FA 0, #F5F7FA 9px, #B0BDCC 9px, #B0BDCC 10px)' }} />
                      <div className="flex gap-2">
                        <div className="w-4 rounded-sm border-r" style={{ borderColor: '#C9D5E2', background: 'repeating-linear-gradient(180deg, #F5F7FA 0, #F5F7FA 9px, #B0BDCC 9px, #B0BDCC 10px)' }} />
                        <div className="relative mx-auto border bg-white shadow-inner" style={{ width: 420, height: 594, borderColor: '#AFC1D5' }}>
                          {invoiceLayout.elements.map((element) => element.visible && (
                            <div
                              key={element.id}
                              onPointerDown={(event) => handleElementPointerDown(event, element.id, 'move')}
                              className="absolute cursor-move select-none border px-2 py-1 text-[10px] font-bold"
                              style={{
                                left: element.x * 2,
                                top: element.y * 2,
                                width: element.w * 2,
                                height: element.h * 2,
                                borderColor: selectedElementId === element.id ? '#1A67C5' : '#94A3B8',
                                background: selectedElementId === element.id ? 'rgba(26,103,197,0.14)' : 'rgba(252,252,252,0.94)',
                                color: '#183B66',
                              }}
                            >
                              {element.label}
                              <button
                                type="button"
                                onPointerDown={(event) => handleElementPointerDown(event, element.id, 'resize')}
                                className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-[#1A67C5] text-white"
                                title="Resize"
                              >
                                ↘
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-3">
                      {['Margins...', 'Grid...', 'Help'].map((label) => (
                        <button key={label} type="button" className="rounded border px-3 py-2 text-[12px] font-bold" style={{ borderColor: '#CDD8E4', background: '#FFFFFF', color: '#455A72' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={handleSaveSettings} className="rounded px-4 py-2 text-[12px] font-bold text-white" style={{ background: 'linear-gradient(180deg, #6793D4 0%, #2E66B4 100%)', border: '1px solid #2E66B4' }}>OK</button>
                      <button type="button" onClick={() => patchSettings({ invoice_layout: DEFAULT_INVOICE_LAYOUT })} className="rounded border px-4 py-2 text-[12px] font-bold" style={{ borderColor: '#CDD8E4', background: '#FFFFFF', color: '#455A72' }}>Cancel</button>
                    </div>

                    <div className="rounded-[16px] border bg-white p-3" style={{ borderColor: '#D7E1EC' }}>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>Layout Setup</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <input type="color" value={invoiceLayout.accentColor} onChange={(event) => patchInvoiceLayout({ accentColor: event.target.value })} className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent" />
                          <input value={invoiceLayout.accentColor} onChange={(event) => patchInvoiceLayout({ accentColor: event.target.value })} className={inputStyle} style={inputProps} />
                        </div>
                        <select value={invoiceLayout.fontFamily} onChange={(event) => patchInvoiceLayout({ fontFamily: event.target.value })} className={inputStyle} style={inputProps}>
                          <option>Times New Roman</option>
                          <option>Arial</option>
                          <option>Georgia</option>
                          <option>Courier New</option>
                        </select>
                        <select
                          value={invoiceLayout.templateId}
                          onChange={(event) => {
                            const template = invoiceLayout.templates.find((entry) => entry.id === event.target.value);
                            patchInvoiceLayout({ templateId: event.target.value, templateName: template?.name || event.target.value });
                          }}
                          className={inputStyle}
                          style={inputProps}
                        >
                          {invoiceLayout.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                        </select>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            ['lineCount', 'Lines'],
                            ['bodyFontSize', 'Body'],
                            ['logoScale', 'Logo %'],
                          ].map(([key, label]) => (
                            <div key={key}>
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>{label}</label>
                              <input
                                type="number"
                                value={invoiceLayout[key]}
                                onChange={(event) => patchInvoiceLayout({ [key]: Number(event.target.value) || DEFAULT_INVOICE_LAYOUT[key] })}
                                className={inputStyle}
                                style={inputProps}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[16px] border bg-white p-3" style={{ borderColor: '#D7E1EC' }}>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>Element Visibility</div>
                      <div className="space-y-1.5">
                        {invoiceLayout.elements.map((element) => (
                          <label key={element.id} className="flex items-center justify-between gap-3 rounded border px-2 py-1.5 text-[11px] font-semibold" style={{ borderColor: '#E3EAF2', color: '#20384F' }}>
                            <span>{element.label}</span>
                            <input type="checkbox" checked={element.visible} onChange={(event) => patchInvoiceElement(element.id, { visible: event.target.checked })} />
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 rounded border px-2 py-2 text-[11px]" style={{ borderColor: '#E3EAF2', background: '#F8FBFE', color: '#50657D' }}>
                        Selected: <strong>{invoiceLayout.elements.find((entry) => entry.id === selectedElementId)?.label || 'None'}</strong>
                      </div>
                    </div>

                    <div className="rounded-[16px] border bg-white p-3" style={{ borderColor: '#D7E1EC' }}>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>Logos & Options</div>
                      <div className="space-y-2">
                        {[
                          ['logo_url', 'Company Logo'],
                          ['haor_logo_url', 'Haor Logo'],
                          ['shahi_logo_url', 'Shahi Logo'],
                        ].map(([key, label]) => (
                          <div key={key} className="rounded border p-2" style={{ borderColor: '#E3EAF2', background: '#FBFDFF' }}>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>{label}</label>
                            {settings[key] && <img src={settings[key]} alt={label} className="mb-2 h-10 max-w-full object-contain" />}
                            <input value={settings[key] || ''} onChange={(event) => patchSettings({ [key]: event.target.value })} className={inputStyle} style={inputProps} />
                            <input type="file" accept="image/*" onChange={(event) => handleLogoUpload(key, event.target.files?.[0])} className="mt-2 w-full text-xs" style={{ color: '#4D627A' }} />
                          </div>
                        ))}
                        {[
                          ['compactPrint', 'Compact print spacing'],
                          ['showBrandLogos', 'Show brand logos'],
                          ['emphasizeTotals', 'Highlight totals card'],
                        ].map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 rounded border px-2 py-2 text-[11px] font-semibold" style={{ borderColor: '#E3EAF2', background: '#FBFDFF', color: '#20384F' }}>
                            <input type="checkbox" checked={Boolean(invoiceLayout[key])} onChange={(event) => patchInvoiceLayout({ [key]: event.target.checked })} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t px-4 py-4" style={{ borderColor: '#D7E1EC', background: '#FBFDFF' }}>
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#62778D' }}>Section Order</div>
                  <div className="space-y-3">
                  {invoiceLayout.sections.map((section, index) => {
                    const meta = INVOICE_LAYOUT_SECTIONS.find((entry) => entry.id === section.id);
                    return (
                      <div
                        key={section.id}
                        draggable
                        onDragStart={() => setDragSectionId(section.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (!dragSectionId || dragSectionId === section.id) return;
                          patchSettings({
                            invoice_layout: moveInvoiceLayoutSection(invoiceLayout, dragSectionId, section.id),
                          });
                          setDragSectionId('');
                        }}
                        onDragEnd={() => setDragSectionId('')}
                        className="flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        style={{
                          borderColor: dragSectionId === section.id ? '#0E7490' : '#E6E8EA',
                          background: section.visible ? '#FFFFFF' : '#F7F9FB',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded px-2 py-1 text-[11px] font-bold" style={{ background: '#EEF3F8', color: '#0F2D5C' }}>
                            {String(index + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <List size={16} style={{ color: '#0E7490' }} />
                              <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{meta?.label || section.id}</p>
                            </div>
                            <p className="mt-1 text-xs" style={{ color: '#434655' }}>{meta?.description}</p>
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: '#191C1E' }}>
                          <input
                            type="checkbox"
                            checked={section.visible}
                            onChange={(event) =>
                              patchSettings({
                                invoice_layout: {
                                  ...invoiceLayout,
                                  sections: invoiceLayout.sections.map((entry) =>
                                    entry.id === section.id ? { ...entry, visible: event.target.checked } : entry
                                  ),
                                },
                              })
                            }
                          />
                          Visible
                        </label>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
              <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Live Invoice Structure</h3>
              <p className="mt-1 text-sm" style={{ color: '#434655' }}>This mirrors the print layout order that will be used by the invoice print page.</p>
              <div className="mt-5 rounded-[18px] border bg-[#F8FBFE] p-3" style={{ borderColor: '#D7E1EC' }}>
                <div className="rounded-[14px] border bg-white p-3 shadow-inner" style={{ borderColor: '#C9D5E2' }}>
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#E6E8EA' }}>
                    <div className="h-9 w-28 rounded-md" style={{ background: '#E6E8EA' }} />
                    <div className="h-8 w-24 rounded-sm" style={{ background: invoiceLayout.accentColor, opacity: 0.85 }} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {invoiceLayout.sections.filter((section) => section.visible).map((section) => {
                      const meta = INVOICE_LAYOUT_SECTIONS.find((entry) => entry.id === section.id);
                      return (
                        <div key={section.id} className="rounded border p-2" style={{ background: '#FBFDFF', boxShadow: 'inset 0 0 0 1px #E6E8EA' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#1E476F' }}>{meta?.label}</p>
                          <div
                            className="mt-2 rounded-sm"
                            style={{
                              height: section.id === 'items' ? 116 : 48,
                              background: section.id === 'totals' && invoiceLayout.emphasizeTotals ? invoiceLayout.accentColor : '#E6E8EA',
                              opacity: section.id === 'totals' && invoiceLayout.emphasizeTotals ? 0.2 : 1,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'team' && (
          <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
              <form onSubmit={handleAddMember} className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
                <div className="flex items-center gap-2">
                  <UserCirclePlus size={18} style={{ color: '#0E7490' }} />
                  <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Add User Access</h3>
                </div>
                <p className="mt-1 text-sm" style={{ color: '#434655' }}>Create a local login, assign a role, and choose which companies this user can access.</p>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Full Name</label>
                    <input value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} className={inputStyle} style={inputProps} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Email</label>
                    <input type="email" value={memberForm.email} onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })} className={inputStyle} style={inputProps} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Role</label>
                    <select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })} className={inputStyle} style={inputProps}>
                      {ROLES.map((role) => <option key={role}>{role}</option>)}
                    </select>
                    <p className="mt-1 text-xs" style={{ color: '#434655' }}>{ROLE_DESCRIPTIONS[memberForm.role]}</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Company Access</label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {accessibleCompanies.map((company) => {
                        const checked = (memberForm.company_ids || []).includes(company.company_id);
                        return (
                          <label key={company.company_id} className="flex items-start gap-3 rounded-2xl p-3" style={{ background: '#F7F9FB' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const nextCompanyIds = event.target.checked
                                  ? [...new Set([...(memberForm.company_ids || []), company.company_id])]
                                  : (memberForm.company_ids || []).filter((entry) => entry !== company.company_id);
                                setMemberForm({ ...memberForm, company_ids: nextCompanyIds });
                              }}
                              className="mt-1 h-4 w-4"
                            />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{company.name}</p>
                              <p className="mt-1 text-xs" style={{ color: '#667085' }}>{company.role}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Temporary Password (Optional)</label>
                    <input value={memberForm.password} onChange={(event) => setMemberForm({ ...memberForm, password: event.target.value })} className={inputStyle} style={inputProps} placeholder="Leave blank to auto-generate one" />
                  </div>
                </div>
                {memberFeedback && (
                  <div className="mt-4 rounded-2xl p-3 text-sm" style={{ background: memberFeedback.type === 'error' ? '#fef2f2' : '#ecfeff', color: memberFeedback.type === 'error' ? '#B91C1C' : '#0F766E' }}>
                    {memberFeedback.message}
                  </div>
                )}
                <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  <Users size={16} />
                  Create User
                </button>
              </form>

              <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
                <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Role Access Summary</h3>
                <p className="mt-1 text-sm" style={{ color: '#434655' }}>
                  The rebuilt RBAC model is fixed and simple by design.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {ROLES.map((role) => (
                    <div key={role} className="rounded-2xl p-4" style={{ background: '#F7F9FB' }}>
                      <div className="flex items-center gap-2">
                        <Shield size={16} style={{ color: '#0E7490' }} />
                        <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{role}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5" style={{ color: '#434655' }}>{ROLE_DESCRIPTIONS[role]}</p>
                      <div className="mt-4 rounded-2xl bg-white p-3 text-xs leading-6" style={{ color: '#667085' }}>
                        {role === 'OWNER' && 'Full access to all modules, company settings, and team management.'}
                        {role === 'MANAGER' && 'Can operate core accounting, inventory, invoicing, and reporting modules. Cannot manage users or settings.'}
                        {role === 'STAFF' && 'Can work in daily business modules but cannot delete records or access settings and user administration.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {pending.length > 0 && (
              <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
                <div className="flex items-center gap-2">
                  <UserCirclePlus size={18} style={{ color: '#7F2500' }} />
                  <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Pending Approvals ({pending.length})</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {pending.map((entry) => (
                    <div key={entry.request_id} className="flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center lg:justify-between" style={{ background: '#F7F9FB' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{entry.name}</p>
                        <p className="mt-1 text-xs" style={{ color: '#434655' }}>{entry.email}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          data-testid={`approve-role-${entry.request_id}`}
                          value={pendingRoles[entry.request_id] || entry.role_requested || 'STAFF'}
                          onChange={(event) => setPendingRoles((current) => ({ ...current, [entry.request_id]: event.target.value }))}
                          className={`${inputStyle} min-w-[190px]`}
                          style={inputProps}
                        >
                          {ROLES.map((role) => <option key={role}>{role}</option>)}
                        </select>
                        <button
                          data-testid={`approve-btn-${entry.request_id}`}
                          onClick={() => handleApprove(entry.request_id)}
                          disabled={memberActionId === entry.request_id}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                          style={{ background: '#15803d' }}
                        >
                          <Check size={16} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(entry.request_id)}
                          disabled={memberActionId === entry.request_id}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                          style={{ background: '#fef2f2', color: '#B91C1C' }}
                        >
                          <X size={16} />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
              <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Team Members</h3>
              <div className="mt-4 space-y-3">
                {members.length === 0 && (
                  <p className="rounded-2xl p-4 text-sm" style={{ background: '#F7F9FB', color: '#434655' }}>No team members found for this company yet.</p>
                )}
                {members.map((member) => (
                  <div key={member.member_id} className="flex flex-col gap-3 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: '#E6E8EA' }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: '#191C1E' }}>{member.name}</p>
                      <p className="mt-1 truncate text-xs" style={{ color: '#434655' }}>{member.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(member.companies || []).map((companyId) => {
                          const company = accessibleCompanies.find((entry) => entry.company_id === companyId);
                          return (
                            <span key={`${member.member_id}-${companyId}`} className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>
                              {company?.short_name || company?.name || companyId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={member.role}
                        onChange={(event) => handleRoleChange(member.member_id, event.target.value)}
                        disabled={memberActionId === member.member_id || !canAdminSettings}
                        className={`${inputStyle} min-w-[190px]`}
                        style={inputProps}
                      >
                        {ROLES.map((role) => <option key={role}>{role}</option>)}
                      </select>
                      <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: '#dcfce7', color: '#15803d' }}>
                        {member.status || 'Active'}
                      </span>
                      <button
                        onClick={() => handleDeleteMember(member.member_id)}
                        disabled={memberActionId === member.member_id || !canAdminSettings}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                        style={{ background: '#fef2f2', color: '#B91C1C' }}
                      >
                        <Trash size={16} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'alerts' && (
          <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
            <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Automated Alerts</h3>
            <div className="mt-4 rounded-[24px] p-4" style={{ background: '#F7F9FB' }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>Daily Low Stock Check</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: '#434655' }}>
                    Runs a low-stock scan across companies and sends alerts to {settings.notification_email || BRANDING.supportEmail}.
                  </p>
                </div>
                <button
                  data-testid="run-daily-check"
                  onClick={handleDailyCheck}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
                >
                  <Bell size={16} />
                  Run Now
                </button>
              </div>
              {alertResult && (
                <div className="mt-4 rounded-2xl bg-white p-4">
                  {(alertResult.results || []).map((result, index) => (
                    <p key={`${result.company}-${index}`} className="text-sm" style={{ color: result.low_stock > 0 ? '#B91C1C' : '#15803d' }}>
                      {result.company}: {result.low_stock > 0 ? `${result.low_stock} low-stock items, alert ${result.status}` : 'All stock levels look healthy.'}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'import' && (
          <div className="space-y-5">
            {importResult && (
              <div className="rounded-2xl p-4" style={{ background: importResult.error ? '#fef2f2' : '#dcfce7' }}>
                <p className="text-sm font-semibold" style={{ color: importResult.error ? '#B91C1C' : '#166534' }}>
                  {importResult.error ? `Import failed: ${importResult.message || ''}` : `Imported ${importResult.imported} ${importResult.type}`}
                </p>
              </div>
            )}
            {[
              { type: 'customers', title: 'Import Customers', description: 'CSV with Name, Company, Phone, Email, Address, Balance.' },
              { type: 'vendors', title: 'Import Vendors', description: 'CSV with Name, Company, Phone, Email, Address, Balance.' },
              { type: 'products', title: 'Import Products', description: 'CSV with Name, Description, Category, Unit, Cost, Price, Case Price, SKU.' },
              { type: 'quickbooks', title: 'Import QuickBooks Desktop', description: 'Upload CSV or IIF exports and auto-detect customers, vendors, items, invoices, and bills.' },
            ].map((item) => (
              <div key={item.type} className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: '#191C1E' }}>{item.title}</h3>
                    <p className="mt-1 text-sm" style={{ color: '#434655' }}>{item.description}</p>
                  </div>
                  <label
                    data-testid={`import-${item.type}-btn`}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                    style={{ boxShadow: '0 0 0 1px #0F2D5C', color: '#0F2D5C' }}
                  >
                    <Upload size={16} />
                    {item.type === 'quickbooks' ? 'Upload File' : 'Upload CSV'}
                    <input type="file" accept={item.type === 'quickbooks' ? '.csv,.iif' : '.csv'} className="hidden" onChange={(event) => handleCSVImport(item.type, event)} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-5">
            <div className="rounded-[28px] p-4 sm:p-6" style={cardStyle}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2">
                    <Trash size={18} style={{ color: '#B91C1C' }} />
                    <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Data Management</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6" style={{ color: '#434655' }}>
                    Reset only the selected company's business records. Company profile, users, roles, permissions,
                    settings, invoice templates, and ROMA AI configuration are protected.
                  </p>
                  <div className="mt-4 rounded-2xl p-4 text-sm leading-6" style={{ background: '#FFF7ED', color: '#7C2D12' }}>
                    This removes customers, vendors, products, inventory, invoices, estimates, sales orders, credit memos,
                    payments embedded in invoices or bills, bills, expenses, purchase orders, vendor payments, stock transfers,
                    receive stock records, bank/manual transactions, bank balances, shipments, linked documents, reminders, and journal entries for {selectedCompany?.name}.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(true)}
                  disabled={!canAdminSettings}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                  style={{ background: canAdminSettings ? '#B91C1C' : '#E5E7EB', color: '#FFFFFF' }}
                >
                  <Trash size={16} />
                  Reset All Business Data
                </button>
              </div>
              {!canAdminSettings && (
                <div className="mt-4 rounded-2xl p-3 text-sm" style={{ background: '#F7F9FB', color: '#667085' }}>
                  Only OWNER users can reset company business data.
                </div>
              )}
              {resetFeedback && (
                <div
                  className="mt-4 rounded-2xl p-4 text-sm"
                  style={{
                    background: resetFeedback.type === 'error' ? '#fef2f2' : '#dcfce7',
                    color: resetFeedback.type === 'error' ? '#B91C1C' : '#166534',
                  }}
                >
                  <p className="font-semibold">{resetFeedback.message}</p>
                  {resetFeedback.type === 'success' && (
                    <p className="mt-1 text-xs opacity-80">Refresh business pages to see the cleared workspace.</p>
                  )}
                </div>
              )}
            </div>

            {resetConfirmOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Reset All Business Data</h3>
                  <p className="mt-3 text-sm leading-6" style={{ color: '#434655' }}>
                    ⚠️ This will permanently remove all business data. Continue?
                  </p>
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setResetConfirmOpen(false)}
                      disabled={resettingData}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold"
                      style={{ boxShadow: '0 0 0 1px #C4C5D7', color: '#0F2D5C' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleResetBusinessData}
                      disabled={resettingData}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                      style={{ background: '#B91C1C' }}
                    >
                      <Trash size={16} />
                      {resettingData ? 'Resetting...' : 'Reset Business Data'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
