import { useEffect, useMemo, useState } from 'react';
import { CalendarBlank, FileArrowUp, MagnifyingGlass, Package, Plus, Truck } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import {
  createLinkedDocument,
  createShipment,
  getLinkedDocuments,
  getShipments,
  getVendors,
} from '../lib/api';

const initialShipmentForm = {
  shipment_name: '',
  container_number: '',
  vendor_id: '',
  supplier_name: '',
  country: '',
  etd: '',
  eta: '',
  customs_status: 'Pending',
  status: 'In Transit',
  reference_number: '',
  notes: '',
};

const initialDocumentForm = {
  entity_type: 'shipment',
  entity_id: '',
  vendor_id: '',
  product_id: '',
  document_name: '',
  document_type: 'COA',
  file_url: '',
  file_name: '',
  file_base64: '',
  notes: '',
};

export default function ShipmentsPage() {
  const { selectedCompany, can } = useCompany();
  const [shipments, setShipments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [shipmentForm, setShipmentForm] = useState(initialShipmentForm);
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeShipmentId, setActiveShipmentId] = useState('');
  const [search, setSearch] = useState('');
  const [customsFilter, setCustomsFilter] = useState('All');

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const [shipmentRes, documentRes, vendorRes] = await Promise.all([
        getShipments(selectedCompany.company_id),
        getLinkedDocuments(selectedCompany.company_id, { entity_type: 'shipment' }),
        getVendors(selectedCompany.company_id),
      ]);
      const shipmentRows = shipmentRes.data || [];
      setShipments(shipmentRows);
      setDocuments(documentRes.data || []);
      setVendors(vendorRes.data || []);
      if (!activeShipmentId && shipmentRows[0]) {
        setActiveShipmentId(shipmentRows[0].shipment_id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedCompany]);

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => shipment.shipment_id === activeShipmentId) || null,
    [shipments, activeShipmentId],
  );

  const filteredShipments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return shipments.filter((shipment) => {
      const matchesSearch = !needle
        || shipment.shipment_name?.toLowerCase().includes(needle)
        || shipment.container_number?.toLowerCase().includes(needle)
        || shipment.supplier_name?.toLowerCase().includes(needle)
        || shipment.country?.toLowerCase().includes(needle);
      const matchesCustoms = customsFilter === 'All' || shipment.customs_status === customsFilter;
      return matchesSearch && matchesCustoms;
    });
  }, [shipments, search, customsFilter]);

  const selectedDocuments = useMemo(
    () => documents.filter((document) => document.entity_id === activeShipmentId),
    [documents, activeShipmentId],
  );

  const handleCreateShipment = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await createShipment(selectedCompany.company_id, shipmentForm);
      setShowShipmentModal(false);
      setShipmentForm(initialShipmentForm);
      setMessage('Shipment record created.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await createLinkedDocument(selectedCompany.company_id, documentForm);
      setShowDocumentModal(false);
      setDocumentForm(initialDocumentForm);
      setMessage('Compliance document linked successfully.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6" data-testid="shipments-page">
        <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: '#E6F3F5', color: '#0E7490' }}>
                <Truck size={22} weight="bold" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#64748B' }}>Import Workspace</p>
                <h1 className="text-xl font-bold leading-tight" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Shipments & Containers</h1>
              </div>
            </div>
          {can.write && (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowDocumentModal(true)} className="px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>
                <FileArrowUp size={16} className="inline mr-1" />
                Link Document
              </button>
              <button onClick={() => setShowShipmentModal(true)} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#123461' }}>
                <Plus size={16} className="inline mr-1" />
                New Shipment
              </button>
            </div>
          )}
          </div>
        </div>

        {message && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ECFDF3', color: '#166534' }}>{message}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard title="Shipments" value={shipments.length} accent="#0F2D5C" />
          <MetricCard title="In Transit" value={shipments.filter((item) => item.status === 'In Transit').length} accent="#0E7490" />
          <MetricCard title="Customs Pending" value={shipments.filter((item) => item.customs_status === 'Pending').length} accent="#B45309" />
          <MetricCard title="Linked Docs" value={documents.length} accent="#166534" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderBottom: '1px solid #E6E8EA' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Shipment Register</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search container, supplier, country" className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none sm:w-72" style={fieldSurface} />
                </div>
                <select value={customsFilter} onChange={(event) => setCustomsFilter(event.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={fieldSurface}>
                  <option>All</option>
                  <option>Pending</option>
                  <option>In Review</option>
                  <option>Cleared</option>
                  <option>Hold</option>
                </select>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>
            ) : filteredShipments.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm" style={{ color: '#64748B' }}>No shipment records yet.</div>
            ) : (
              <div className="max-h-[calc(100vh-310px)] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #E6E8EA' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Shipment</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Container</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Country</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>ETA / ETD</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Customs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShipments.map((shipment, index) => (
                      <tr
                        key={shipment.shipment_id}
                        onClick={() => setActiveShipmentId(shipment.shipment_id)}
                        className="cursor-pointer"
                        style={{
                          background: activeShipmentId === shipment.shipment_id ? '#EFF6FF' : index % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                          borderBottom: '1px solid #F2F4F6',
                        }}
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium" style={{ color: '#191C1E' }}>{shipment.shipment_name}</p>
                          <p className="text-xs mt-1" style={{ color: '#64748B' }}>{shipment.supplier_name || shipment.vendor_name || 'Supplier pending'}</p>
                        </td>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: '#0F2D5C' }}>{shipment.container_number || '—'}</td>
                        <td className="px-4 py-2.5" style={{ color: '#475569' }}>{shipment.country || '—'}</td>
                        <td className="px-4 py-2.5" style={{ color: '#475569' }}>{shipment.etd || '—'} / {shipment.eta || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={chipTone(shipment.customs_status)}>
                            {shipment.customs_status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Shipment Snapshot</h2>
                <Package size={18} style={{ color: '#0F2D5C' }} />
              </div>
              {!selectedShipment ? (
                <p className="text-sm" style={{ color: '#64748B' }}>Select a shipment to review ETA, customs status, and compliance storage.</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="rounded-lg p-4" style={{ background: '#123461', color: '#FFFFFF' }}>
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: '#BFDBFE' }}>{selectedShipment.container_number || 'Container Pending'}</p>
                    <p className="mt-2 text-xl font-bold">{selectedShipment.shipment_name}</p>
                    <p className="mt-1 text-sm" style={{ color: '#DCEBFF' }}>{selectedShipment.supplier_name || selectedShipment.vendor_name || 'Supplier pending'}</p>
                  </div>
                  <ShipmentTimeline shipment={selectedShipment} />
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Reference" value={selectedShipment.reference_number} />
                    <Info label="Status" value={selectedShipment.status} />
                    <Info label="Country" value={selectedShipment.country} />
                    <Info label="Customs" value={selectedShipment.customs_status} />
                  </div>
                  <Info label="Notes" value={selectedShipment.notes} />
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Compliance Storage</h2>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: '#F1F5F9', color: '#475569' }}>{selectedDocuments.length} files</span>
              </div>
              {!selectedShipment ? (
                <p className="text-sm" style={{ color: '#64748B' }}>Pick a shipment to see linked COA, packing list, FDA, or FSVP files.</p>
              ) : selectedDocuments.length === 0 ? (
                <p className="text-sm" style={{ color: '#64748B' }}>No compliance documents linked yet for this shipment.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDocuments.map((document) => (
                    <div key={document.document_id} className="rounded-lg p-3" style={{ background: '#F7F9FB', border: '1px solid #E2E8F0' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{document.document_name}</p>
                          <p className="text-xs mt-1" style={{ color: '#64748B' }}>{document.document_type || 'Document'} • {document.file_name || 'Attachment stored in record'}</p>
                        </div>
                        {document.file_url ? (
                          <a href={document.file_url} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: '#0F2D5C' }}>Open</a>
                        ) : null}
                      </div>
                      {document.notes ? <p className="text-xs mt-2" style={{ color: '#475569' }}>{document.notes}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {showShipmentModal && (
          <ModalShell title="New Shipment Record" onClose={() => setShowShipmentModal(false)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Shipment Name"><input value={shipmentForm.shipment_name} onChange={(e) => setShipmentForm({ ...shipmentForm, shipment_name: e.target.value })} className={fieldClass} /></Field>
              <Field label="Container Number"><input value={shipmentForm.container_number} onChange={(e) => setShipmentForm({ ...shipmentForm, container_number: e.target.value })} className={fieldClass} /></Field>
              <Field label="Vendor">
                <select value={shipmentForm.vendor_id} onChange={(e) => {
                  const vendor = vendors.find((item) => item.vendor_id === e.target.value);
                  setShipmentForm({
                    ...shipmentForm,
                    vendor_id: e.target.value,
                    supplier_name: vendor?.name || shipmentForm.supplier_name,
                    country: vendor?.country || shipmentForm.country,
                  });
                }} className={fieldClass}>
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => <option key={vendor.vendor_id} value={vendor.vendor_id}>{vendor.name}</option>)}
                </select>
              </Field>
              <Field label="Supplier Name"><input value={shipmentForm.supplier_name} onChange={(e) => setShipmentForm({ ...shipmentForm, supplier_name: e.target.value })} className={fieldClass} /></Field>
              <Field label="Country"><input value={shipmentForm.country} onChange={(e) => setShipmentForm({ ...shipmentForm, country: e.target.value })} className={fieldClass} /></Field>
              <Field label="Reference Number"><input value={shipmentForm.reference_number} onChange={(e) => setShipmentForm({ ...shipmentForm, reference_number: e.target.value })} className={fieldClass} /></Field>
              <Field label="ETD"><input type="date" value={shipmentForm.etd} onChange={(e) => setShipmentForm({ ...shipmentForm, etd: e.target.value })} className={fieldClass} /></Field>
              <Field label="ETA"><input type="date" value={shipmentForm.eta} onChange={(e) => setShipmentForm({ ...shipmentForm, eta: e.target.value })} className={fieldClass} /></Field>
              <Field label="Shipment Status">
                <select value={shipmentForm.status} onChange={(e) => setShipmentForm({ ...shipmentForm, status: e.target.value })} className={fieldClass}>
                  <option>Booked</option>
                  <option>In Transit</option>
                  <option>Arrived</option>
                  <option>Delivered</option>
                </select>
              </Field>
              <Field label="Customs Status">
                <select value={shipmentForm.customs_status} onChange={(e) => setShipmentForm({ ...shipmentForm, customs_status: e.target.value })} className={fieldClass}>
                  <option>Pending</option>
                  <option>In Review</option>
                  <option>Cleared</option>
                  <option>Hold</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes"><textarea value={shipmentForm.notes} onChange={(e) => setShipmentForm({ ...shipmentForm, notes: e.target.value })} rows={3} className={fieldClass} /></Field>
              </div>
            </div>
            <ModalActions onCancel={() => setShowShipmentModal(false)} onConfirm={handleCreateShipment} confirmLabel={saving ? 'Saving...' : 'Save Shipment'} />
          </ModalShell>
        )}

        {showDocumentModal && (
          <ModalShell title="Link Compliance Document" onClose={() => setShowDocumentModal(false)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Shipment">
                <select value={documentForm.entity_id} onChange={(e) => setDocumentForm({ ...documentForm, entity_id: e.target.value })} className={fieldClass}>
                  <option value="">Select shipment</option>
                  {shipments.map((shipment) => <option key={shipment.shipment_id} value={shipment.shipment_id}>{shipment.shipment_name}</option>)}
                </select>
              </Field>
              <Field label="Document Type">
                <select value={documentForm.document_type} onChange={(e) => setDocumentForm({ ...documentForm, document_type: e.target.value })} className={fieldClass}>
                  <option>COA</option>
                  <option>Packing List</option>
                  <option>Invoice</option>
                  <option>FDA</option>
                  <option>FSVP</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Document Name"><input value={documentForm.document_name} onChange={(e) => setDocumentForm({ ...documentForm, document_name: e.target.value })} className={fieldClass} /></Field>
              <Field label="File URL"><input value={documentForm.file_url} onChange={(e) => setDocumentForm({ ...documentForm, file_url: e.target.value })} placeholder="https://..." className={fieldClass} /></Field>
              <Field label="File Name"><input value={documentForm.file_name} onChange={(e) => setDocumentForm({ ...documentForm, file_name: e.target.value })} className={fieldClass} /></Field>
              <Field label="Vendor (Optional)">
                <select value={documentForm.vendor_id} onChange={(e) => setDocumentForm({ ...documentForm, vendor_id: e.target.value })} className={fieldClass}>
                  <option value="">No vendor linked</option>
                  {vendors.map((vendor) => <option key={vendor.vendor_id} value={vendor.vendor_id}>{vendor.name}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes"><textarea value={documentForm.notes} onChange={(e) => setDocumentForm({ ...documentForm, notes: e.target.value })} rows={3} className={fieldClass} /></Field>
              </div>
            </div>
            <ModalActions onCancel={() => setShowDocumentModal(false)} onConfirm={handleCreateDocument} confirmLabel={saving ? 'Saving...' : 'Link Document'} />
          </ModalShell>
        )}
      </div>
    </AppShell>
  );
}

function MetricCard({ title, value, accent }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>{title}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: accent, fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: '#191C1E' }}>{value || '—'}</p>
    </div>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-lg p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{title}</h3>
          <button onClick={onClose} className="text-sm font-medium" style={{ color: '#475569' }}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-2">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#475569' }}>Cancel</button>
      <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>{confirmLabel}</button>
    </div>
  );
}

function chipTone(status) {
  const tones = {
    Pending: { background: '#FEF3C7', color: '#92400E' },
    'In Review': { background: '#EFF6FF', color: '#0F2D5C' },
    Cleared: { background: '#ECFDF3', color: '#166534' },
    Hold: { background: '#FEF2F2', color: '#B91C1C' },
  };
  return tones[status] || tones.Pending;
}

const fieldClass = 'w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1';
const fieldSurface = { background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' };

function ShipmentTimeline({ shipment }) {
  const steps = [
    { key: 'Booked', label: 'Booked', date: shipment.etd },
    { key: 'In Transit', label: 'In Transit', date: shipment.etd },
    { key: 'Arrived', label: 'Arrived', date: shipment.eta },
    { key: 'Delivered', label: 'Delivered', date: shipment.eta },
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === shipment.status));
  return (
    <div className="rounded-lg p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>
        <CalendarBlank size={14} />
        ETA / ETD
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const active = index <= activeIndex;
          return (
            <div key={step.key}>
              <div className="h-1 rounded-full" style={{ background: active ? '#0E7490' : '#CBD5E1' }} />
              <p className="mt-2 text-[11px] font-bold" style={{ color: active ? '#0F2D5C' : '#64748B' }}>{step.label}</p>
              <p className="text-[11px]" style={{ color: '#64748B' }}>{step.date || '-'}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
