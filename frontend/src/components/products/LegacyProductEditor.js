import { useMemo, useState } from 'react';

const panelStyle = {
  background: '#FFFFFF',
  border: '1px solid #9BB6D3',
  borderRadius: '14px',
  boxShadow: 'inset 0 0 0 1px #E3ECF6',
};

const fieldStyle = {
  width: '100%',
  minHeight: '28px',
  padding: '4px 8px',
  fontSize: '12px',
  color: '#1A1A1A',
  background: '#FFFFFF',
  border: '1px solid #B7C7D9',
  borderRadius: '4px',
  boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.08)',
};

const buttonStyle = {
  width: '100%',
  minHeight: '28px',
  borderRadius: '4px',
  border: '1px solid #B7C7D9',
  background: 'linear-gradient(180deg, #FFFFFF 0%, #E9EEF4 100%)',
  color: '#4A4A4A',
  fontSize: '12px',
  fontWeight: 700,
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: 'linear-gradient(180deg, #0F68C8 0%, #0B4D96 100%)',
  border: '1px solid #0B4D96',
  color: '#FFFFFF',
};

const sectionTitleStyle = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#223B57',
  marginBottom: '4px',
};

const labelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: '#294866',
};

const smallNoteStyle = {
  fontSize: '11px',
  color: '#51667D',
  lineHeight: 1.35,
};

function LegacyField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function LegacyStat({ label, value, muted = false }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 2 }}>{label}</div>
      <div
        className="min-h-[24px] rounded px-2 py-1 text-[12px]"
        style={{
          border: '1px solid #D3DCE7',
          background: muted ? '#F6F8FB' : '#FFFFFF',
          color: '#1D3650',
          boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.04)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LegacySection({ title, children, className = '' }) {
  return (
    <div className={className}>
      <div style={sectionTitleStyle}>{title}</div>
      <div className="rounded-md border p-3" style={{ borderColor: '#D7E1EC', background: '#FBFCFE' }}>
        {children}
      </div>
    </div>
  );
}

export default function LegacyProductEditor({
  title,
  saveLabel,
  form,
  setForm,
  categoryOptions,
  canEditPrice,
  effectiveCasePrice,
  packDisplay,
  finalDispatchPrice,
  onSave,
  onCancel,
  saveDisabled,
  saving,
}) {
  const [legacyNote, setLegacyNote] = useState('');

  const inventorySummary = useMemo(() => {
    const stockCases = Number(form.stock_cases) || 0;
    const unitCost = Number(form.cost_price) || 0;
    const averageCost = form.product_mode === 'WEIGHT'
      ? Number(form.default_box_weight_lb || 0) * unitCost
      : unitCost;
    return {
      onHand: stockCases.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      averageCost: averageCost.toFixed(4),
      onPurchaseOrder: '0',
      onSalesOrder: '0',
    };
  }, [form.cost_price, form.default_box_weight_lb, form.product_mode, form.stock_cases]);

  const showLegacyPlaceholder = (message) => setLegacyNote(message);

  return (
    <div className="space-y-3">
      <div className="rounded-[20px] bg-white p-3 shadow-[0_10px_24px_rgba(15,45,92,0.08)] sm:p-4" style={panelStyle}>
        <div className="mb-3 flex items-start justify-between gap-4 border-b pb-2" style={{ borderColor: '#D7E1EC' }}>
          <div>
            <h3 className="text-[14px] font-bold sm:text-[16px]" style={{ color: '#2A2A2A' }}>{title}</h3>
            <p style={smallNoteStyle}>Compact product setup with purchase, sales, and inventory details arranged like the legacy desktop screen.</p>
          </div>
          <div className="hidden text-right text-[11px] sm:block" style={{ color: '#61778F' }}>
            <div>Legacy desktop view</div>
            <div>Current save logic preserved</div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_118px]">
          <div className="space-y-3">
            <LegacySection title="Type">
              <div className="grid gap-3 lg:grid-cols-[130px_minmax(0,1fr)_160px]">
                <LegacyField label="Type">
                  <select
                    value={form.product_type}
                    onChange={(event) => setForm((current) => ({ ...current, product_type: event.target.value }))}
                    style={fieldStyle}
                  >
                    <option value="Inventory">Inventory Part</option>
                    <option value="Non-Inventory">Non-Inventory</option>
                  </select>
                </LegacyField>
                <div className="flex items-end pb-1 text-[12px]" style={{ color: '#263C56' }}>
                  Use for goods you purchase, track as inventory, and resell.
                </div>
                <LegacyField label="SKU">
                  <input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} style={fieldStyle} />
                </LegacyField>
              </div>
            </LegacySection>

            <div className="grid gap-3 lg:grid-cols-3">
              <LegacyField label="Item Name/Number">
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} style={fieldStyle} />
              </LegacyField>
              <LegacyField label="Subitem Of">
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} style={fieldStyle}>
                  <option value="">Select Category</option>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </LegacyField>
              <LegacyField label="Manufacturer's Part Number">
                <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} style={fieldStyle} />
              </LegacyField>
            </div>

            <div className="grid gap-3 lg:grid-cols-[170px_110px_minmax(0,1fr)]">
              <LegacyField label="Unit Of Measure">
                <select value={form.unit_type} onChange={(event) => setForm((current) => ({ ...current, unit_type: event.target.value }))} style={fieldStyle}>
                  <option value="PCS">PCS</option>
                  <option value="PACK">PACK</option>
                  <option value="PKT">PKT</option>
                  <option value="BLK">BLK</option>
                  <option value="BOX">BOX</option>
                  <option value="LB">LB</option>
                  <option value="KG">KG</option>
                </select>
              </LegacyField>
              <LegacyField label="Unit Label">
                <input value={form.unit_label} onChange={(event) => setForm((current) => ({ ...current, unit_label: event.target.value.toUpperCase() }))} style={fieldStyle} />
              </LegacyField>
              <LegacyField label="Packing / Pack">
                <input value={form.packing_text} onChange={(event) => setForm((current) => ({ ...current, packing_text: event.target.value }))} style={fieldStyle} />
              </LegacyField>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <LegacySection title="Purchase Information">
                <div className="space-y-3">
                  <LegacyField label="Description on Purchase Transactions">
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      style={{ ...fieldStyle, minHeight: '84px', resize: 'none' }}
                    />
                  </LegacyField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LegacyField label="Cost Type">
                      <select value={form.cost_type} onChange={(event) => setForm((current) => ({ ...current, cost_type: event.target.value }))} style={fieldStyle}>
                        <option value="UNIT">Unit</option>
                        <option value="CASE">Case</option>
                      </select>
                    </LegacyField>
                    <LegacyField label="Cost">
                      <input type="number" step="0.01" value={form.cost_price} onChange={(event) => setForm((current) => ({ ...current, cost_price: Number(event.target.value) || 0 }))} style={fieldStyle} />
                    </LegacyField>
                    <LegacyField label="Case Cost">
                      <input type="number" step="0.01" value={form.case_cost} onChange={(event) => setForm((current) => ({ ...current, case_cost: Number(event.target.value) || 0 }))} style={fieldStyle} />
                    </LegacyField>
                    <LegacyField label="Preferred Vendor">
                      <input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal note" style={fieldStyle} />
                    </LegacyField>
                  </div>
                </div>
              </LegacySection>

              <LegacySection title="Sales Information">
                <div className="space-y-3">
                  <LegacyField label="Description on Sales Transactions">
                    <textarea
                      rows={3}
                      value={form.packing_text}
                      onChange={(event) => setForm((current) => ({ ...current, packing_text: event.target.value }))}
                      style={{ ...fieldStyle, minHeight: '84px', resize: 'none' }}
                    />
                  </LegacyField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LegacyField label="Sales Price">
                      <input
                        type="number"
                        step="0.01"
                        value={form.unit_price}
                        disabled={!canEditPrice}
                        onChange={(event) => setForm((current) => ({ ...current, unit_price: Number(event.target.value) || 0 }))}
                        style={{ ...fieldStyle, opacity: canEditPrice ? 1 : 0.7 }}
                      />
                    </LegacyField>
                    <LegacyField label="Case Override">
                      <input
                        type="number"
                        step="0.01"
                        value={form.case_price_override}
                        disabled={!canEditPrice || form.product_mode === 'WEIGHT'}
                        onChange={(event) => setForm((current) => ({ ...current, case_price_override: event.target.value }))}
                        style={{ ...fieldStyle, opacity: canEditPrice && form.product_mode !== 'WEIGHT' ? 1 : 0.7 }}
                      />
                    </LegacyField>
                    <LegacyField label="Price Basis">
                      <select value={form.price_basis} onChange={(event) => setForm((current) => ({ ...current, price_basis: event.target.value }))} style={fieldStyle}>
                        <option value="">Select Basis</option>
                        <option value="PCS">PCS</option>
                        <option value="PACK">PACK</option>
                        <option value="LB">LB</option>
                        <option value="KG">KG</option>
                        <option value="BOX">BOX</option>
                      </select>
                    </LegacyField>
                    <LegacyField label="Item is inactive">
                      <select value={String(form.in_stock)} onChange={(event) => setForm((current) => ({ ...current, in_stock: event.target.value === 'true' }))} style={fieldStyle}>
                        <option value="true">No</option>
                        <option value="false">Yes</option>
                      </select>
                    </LegacyField>
                  </div>
                </div>
              </LegacySection>
            </div>

            <LegacySection title="Inventory Information">
              <div className="grid gap-3 md:grid-cols-[170px_110px_110px_80px_90px_70px_92px]">
                <LegacyStat label="Asset Account" value={form.product_mode === 'WEIGHT' ? 'Inventory Asset' : 'Inventory Item'} />
                <LegacyField label="Reorder Point (Min)">
                  <input type="number" step="1" value={form.units_per_case} onChange={(event) => setForm((current) => ({ ...current, units_per_case: Number(event.target.value) || 1 }))} style={fieldStyle} />
                </LegacyField>
                <LegacyField label="Max">
                  <input type="number" step="1" value={form.default_box_weight_kg} onChange={(event) => setForm((current) => ({ ...current, default_box_weight_kg: Number(event.target.value) || 0 }))} style={fieldStyle} />
                </LegacyField>
                <LegacyStat label="On Hand" value={inventorySummary.onHand} />
                <LegacyStat label="Average Cost" value={inventorySummary.averageCost} />
                <LegacyStat label="On P.O." value={inventorySummary.onPurchaseOrder} muted />
                <LegacyStat label="On Sales Order" value={inventorySummary.onSalesOrder} muted />
              </div>
            </LegacySection>

            <div className="grid gap-3 lg:grid-cols-3">
              <LegacySection title="Pricing Snapshot">
                <div className="grid gap-3 sm:grid-cols-3">
                  <LegacyStat label="Effective Case Price" value={`$${effectiveCasePrice.toFixed(2)}`} />
                  <LegacyStat label="Pack Display" value={packDisplay} />
                  <LegacyStat label="Final Dispatch Price" value={`$${finalDispatchPrice.toFixed(2)}`} />
                </div>
              </LegacySection>

              <LegacySection title="Additional Details" className="lg:col-span-2">
                <div className="grid gap-3 sm:grid-cols-3">
                  <LegacyField label="Product Mode">
                    <select value={form.product_mode} onChange={(event) => setForm((current) => ({ ...current, product_mode: event.target.value }))} style={fieldStyle}>
                      <option value="CASE">CASE</option>
                      <option value="UNIT">UNIT</option>
                      <option value="WEIGHT">WEIGHT</option>
                    </select>
                  </LegacyField>
                  <LegacyField label="Barcode">
                    <input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} style={fieldStyle} />
                  </LegacyField>
                  <LegacyField label="Size Range">
                    <input value={form.size_range} onChange={(event) => setForm((current) => ({ ...current, size_range: event.target.value.toUpperCase() }))} style={fieldStyle} />
                  </LegacyField>
                  <LegacyField label="Default Box Weight LB">
                    <input type="number" step="0.01" value={form.default_box_weight_lb} onChange={(event) => setForm((current) => ({ ...current, default_box_weight_lb: Number(event.target.value) || 0 }))} style={fieldStyle} />
                  </LegacyField>
                  <LegacyField label="Actual Dispatch Weight LB">
                    <input value={form.actual_dispatch_weight_lb} onChange={(event) => setForm((current) => ({ ...current, actual_dispatch_weight_lb: event.target.value }))} style={fieldStyle} />
                  </LegacyField>
                  <LegacyField label="Actual Dispatch Unit Price">
                    <input value={form.actual_dispatch_unit_price} onChange={(event) => setForm((current) => ({ ...current, actual_dispatch_unit_price: event.target.value }))} style={fieldStyle} />
                  </LegacyField>
                </div>
              </LegacySection>
            </div>
          </div>

          <div className="space-y-2">
            <button type="button" onClick={onSave} disabled={saveDisabled} style={{ ...primaryButtonStyle, opacity: saveDisabled ? 0.6 : 1 }}>
              {saving ? 'Saving...' : saveLabel}
            </button>
            <button type="button" onClick={onCancel} style={buttonStyle}>Cancel</button>
            <button type="button" onClick={() => showLegacyPlaceholder('Notes are already saved in the current product form.')} style={buttonStyle}>New Note</button>
            <button type="button" onClick={() => showLegacyPlaceholder('Custom fields are not mapped yet in the current data model.')} style={buttonStyle}>Custom Fields</button>
            <button type="button" onClick={() => showLegacyPlaceholder('Spelling helper is visual only in this legacy layout pass.')} style={buttonStyle}>Spelling</button>
            <div className="rounded-md border p-2 text-[11px]" style={{ borderColor: '#D7E1EC', background: '#F8FBFE', color: '#4E6278' }}>
              {legacyNote || 'Legacy action buttons are styled to match the screenshot. Product save/update behavior still uses the current React workflow.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
