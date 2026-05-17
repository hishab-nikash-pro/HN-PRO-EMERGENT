import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Export, MagnifyingGlass, Plus, CaretDown, CaretUp, Trash } from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { createCustomer, deleteCustomer, getCustomers } from '../lib/api';

const EXPORT_FIELDS = [
  ['name', 'Store Name'],
  ['company_name', 'Contact Person'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['open_balance', 'Balance'],
  ['status', 'Status'],
];

const PAGE_SIZE = 10;

export default function CustomersList() {
  const { selectedCompany, role, can } = useCompany();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [newCustomer, setNewCustomer] = useState({ store_name: '', contact_person: '', phone: '', email: '', address: '', website: '' });
  const [exportConfig, setExportConfig] = useState({
    format: 'csv',
    scope: can.exportData ? 'all' : 'filtered',
    fields: Object.fromEntries(EXPORT_FIELDS.map(([key]) => [key, true])),
  });

  useEffect(() => {
    if (!selectedCompany?.company_id) return;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getCustomers(selectedCompany.company_id);
        setCustomers(response.data || []);
      } catch (error) {
        console.error(error);
        setFeedback({ type: 'error', message: 'Unable to load customers right now.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompany]);

  useEffect(() => {
    setExportConfig((current) => ({
      ...current,
      scope: can.exportData ? current.scope : 'filtered',
    }));
  }, [can.exportData]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.company_name, customer.email, customer.phone]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [customers, search]);

  const sortedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    list.sort((left, right) => {
      const leftValue = left[sortConfig.key];
      const rightValue = right[sortConfig.key];
      if (sortConfig.key === 'open_balance') {
        const diff = Number(leftValue || 0) - Number(rightValue || 0);
        return sortConfig.direction === 'asc' ? diff : -diff;
      }
      const a = String(leftValue || '').toLowerCase();
      const b = String(rightValue || '').toLowerCase();
      if (a < b) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a > b) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredCustomers, sortConfig]);

  const pagedCustomers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedCustomers.slice(start, start + PAGE_SIZE);
  }, [page, sortedCustomers]);

  const pageCount = Math.max(1, Math.ceil(sortedCustomers.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'open_balance' ? 'desc' : 'asc' }
    );
  };

  const handleCreateCustomer = async () => {
    setSavingCustomer(true);
    setFeedback(null);
    try {
      const payload = {
        name: newCustomer.store_name,
        store_name: newCustomer.store_name,
        company_name: newCustomer.contact_person,
        contact_person: newCustomer.contact_person,
        phone: newCustomer.phone,
        email: newCustomer.email,
        address: newCustomer.address,
        website: newCustomer.website,
      };
      const createdResponse = await createCustomer(selectedCompany.company_id, payload);
      const createdCustomer = createdResponse.data;
      if (createdCustomer?.customer_id) {
        setCustomers((current) => [
          createdCustomer,
          ...current.filter((customer) => customer.customer_id !== createdCustomer.customer_id),
        ]);
      }
      const response = await getCustomers(selectedCompany.company_id);
      setCustomers(response.data || []);
      setShowCreateModal(false);
      setNewCustomer({ store_name: '', contact_person: '', phone: '', email: '', address: '', website: '' });
      setFeedback({ type: 'success', message: 'Customer saved successfully.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Customer could not be saved.' });
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(selectedCompany.company_id, deleteTarget.customer_id);
      const response = await getCustomers(selectedCompany.company_id);
      setCustomers(response.data || []);
      setFeedback({ type: 'success', message: `${deleteTarget.name} was moved to deleted records.` });
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to delete this customer.' });
    } finally {
      setDeleting(false);
    }
  };

  const exportRows = (source) =>
    source.map((customer) => {
      const row = {};
      EXPORT_FIELDS.forEach(([key, label]) => {
        if (!exportConfig.fields[key]) return;
        row[label] = key === 'open_balance'
          ? Number(customer.open_balance || 0).toFixed(2)
          : customer[key] || '';
      });
      return row;
    });

  const handleExport = () => {
    const selectedFields = EXPORT_FIELDS.filter(([key]) => exportConfig.fields[key]);
    if (selectedFields.length === 0) {
      setFeedback({ type: 'error', message: 'Select at least one field to export.' });
      return;
    }
    if (!window.confirm('Are you sure you want to export customer data?')) {
      return;
    }

    const source = exportConfig.scope === 'all' && can.exportData ? customers : sortedCustomers;
    const rows = exportRows(source);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const filename = `customers_export_${stamp}.${exportConfig.format === 'xlsx' ? 'xlsx' : 'csv'}`;

    if (exportConfig.format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
      XLSX.writeFile(workbook, filename);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }

    setShowExportModal(false);
    setFeedback({ type: 'success', message: `Customer export created: ${filename}` });
  };

  const sortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />;
  };

  return (
    <AppShell>
      <div data-testid="customers-list-page" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Customers</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Manage customer accounts and balances</p>
          </div>
          <button
            data-testid="create-customer-btn"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
          >
            <Plus size={16} weight="bold" /> Add Customer
          </button>
        </div>

        {feedback && (
          <div
            className="rounded-2xl px-4 py-3 text-sm font-medium"
            style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}
          >
            {feedback.message}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input
              data-testid="customers-search"
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
            />
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            aria-label="Export customers"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-white"
            style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #C4C5D7', background: '#FFFFFF' }}
          >
            <Export size={18} />
            Export
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                      {[
                        ['name', 'Store Name'],
                        ['company_name', 'Contact Person'],
                        ['phone', 'Phone'],
                        ['email', 'Email'],
                        ['open_balance', 'Open Balance'],
                        ['status', 'Status'],
                        ['actions', 'Actions'],
                      ].map(([key, label]) => (
                        <th
                          key={key}
                          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${key === 'open_balance' ? 'text-right' : key === 'actions' ? 'text-center' : 'text-left'}`}
                          style={{ color: '#434655' }}
                        >
                          {key === 'actions' ? label : (
                            <button onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 ${key === 'open_balance' ? 'ml-auto' : ''}`}>
                              {label}
                              {sortIcon(key)}
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCustomers.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No customers found</td></tr>
                    ) : (
                      pagedCustomers.map((customer, index) => (
                        <tr
                          key={customer.customer_id}
                          data-testid={`customer-row-${customer.customer_id}`}
                          onClick={() => navigate(`/customers/${customer.customer_id}`)}
                          className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                          style={{ background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#0E7490' }}>
                                {customer.name?.charAt(0)}
                              </div>
                              <span className="font-medium" style={{ color: '#191C1E' }}>{customer.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3" style={{ color: '#434655' }}>{customer.company_name}</td>
                          <td className="px-4 py-3" style={{ color: '#434655' }}>{customer.phone}</td>
                          <td className="px-4 py-3" style={{ color: '#434655' }}>{customer.email}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: Number(customer.open_balance || 0) > 0 ? '#7F2500' : '#191C1E' }}>
                            ${Number(customer.open_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: customer.status === 'Active' ? '#DCFCE7' : '#F2F4F6', color: customer.status === 'Active' ? '#16A34A' : '#434655' }}>
                              {customer.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {can.admin && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteTarget(customer);
                                }}
                                className="rounded-lg p-1.5 transition-colors hover:bg-[#FEF2F2]"
                                style={{ color: '#B42318' }}
                              >
                                <Trash size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#F2F4F6' }}>
                <p className="text-sm" style={{ color: '#667085' }}>
                  Showing {(page - 1) * PAGE_SIZE + (pagedCustomers.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + pagedCustomers.length} of {sortedCustomers.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="rounded-xl px-3 py-2 text-sm font-semibold"
                    style={{ background: page === 1 ? '#F2F4F6' : '#FFFFFF', color: page === 1 ? '#98A2B3' : '#0F2D5C', boxShadow: page === 1 ? 'none' : '0 0 0 1px #C4C5D7' }}
                  >
                    Previous
                  </button>
                  <span className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: '#F7F9FB', color: '#191C1E' }}>
                    Page {page} / {pageCount}
                  </span>
                  <button
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={page === pageCount}
                    className="rounded-xl px-3 py-2 text-sm font-semibold"
                    style={{ background: page === pageCount ? '#F2F4F6' : '#FFFFFF', color: page === pageCount ? '#98A2B3' : '#0F2D5C', boxShadow: page === pageCount ? 'none' : '0 0 0 1px #C4C5D7' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {showExportModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(25,28,30,0.52)' }}>
            <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-[0_28px_60px_rgba(15,45,92,0.18)]">
              <h3 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Export Customers</h3>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#667085' }}>Format</p>
                  <div className="mt-3 space-y-2">
                    {[
                      ['csv', 'CSV'],
                      ['xlsx', 'Excel (XLSX)'],
                    ].map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                        <input
                          type="radio"
                          checked={exportConfig.format === value}
                          onChange={() => setExportConfig((current) => ({ ...current, format: value }))}
                        />
                        <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#667085' }}>Data Scope</p>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                      <input
                        type="radio"
                        checked={exportConfig.scope === 'all'}
                        disabled={!can.exportData}
                        onChange={() => setExportConfig((current) => ({ ...current, scope: 'all' }))}
                      />
                      <span className="text-sm font-medium" style={{ color: !can.exportData ? '#98A2B3' : '#191C1E' }}>All Customers</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                      <input
                        type="radio"
                        checked={exportConfig.scope === 'filtered'}
                        onChange={() => setExportConfig((current) => ({ ...current, scope: 'filtered' }))}
                      />
                      <span className="text-sm font-medium" style={{ color: '#191C1E' }}>Filtered Results</span>
                    </label>
                    {!can.exportData && (
                      <p className="text-xs" style={{ color: '#B54708' }}>
                        {role} users can export only filtered customer results.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#667085' }}>Fields</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {EXPORT_FIELDS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: '#F8FAFC' }}>
                      <input
                        type="checkbox"
                        checked={exportConfig.fields[key]}
                        onChange={(event) => setExportConfig((current) => ({
                          ...current,
                          fields: {
                            ...current.fields,
                            [key]: event.target.checked,
                          },
                        }))}
                      />
                      <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setShowExportModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ color: '#667085' }}>
                  Cancel
                </button>
                <button onClick={handleExport} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  Export
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDeleteModal
          open={Boolean(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteCustomer}
          loading={deleting}
        />

        {showCreateModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>New Customer</h3>
              <div className="space-y-4">
                {[
                  { key: 'store_name', label: 'Store Name', placeholder: 'Store name' },
                  { key: 'contact_person', label: 'Contact Person', placeholder: 'Contact person' },
                  { key: 'phone', label: 'Phone', placeholder: '(xxx) xxx-xxxx' },
                  { key: 'email', label: 'Email', placeholder: 'email@company.com' },
                  { key: 'address', label: 'Address', placeholder: 'Street, City, State' },
                  { key: 'website', label: 'Website', placeholder: 'https://example.com' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>{label}</label>
                    <input
                      data-testid={`new-customer-${key}`}
                      type="text"
                      value={newCustomer[key]}
                      onChange={(event) => setNewCustomer({ ...newCustomer, [key]: event.target.value })}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                      style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button
                  data-testid="save-customer-btn"
                  onClick={handleCreateCustomer}
                  disabled={savingCustomer}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', opacity: savingCustomer ? 0.7 : 1 }}
                >
                  {savingCustomer ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
