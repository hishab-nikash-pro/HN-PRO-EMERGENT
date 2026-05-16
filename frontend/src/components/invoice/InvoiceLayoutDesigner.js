import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InvoiceRenderer, { SAMPLE_INVOICE_PREVIEW } from './InvoiceRenderer';
import {
  applyTemplateToLayout,
  createCustomInvoiceElement,
  DEFAULT_INVOICE_LAYOUT,
  duplicateInvoiceElement,
  getInvoiceElement,
  INVOICE_CUSTOM_ELEMENT_TYPES,
  INVOICE_LAYOUT_SECTIONS,
  moveInvoiceLayoutSection,
  normalizeInvoiceLayout,
} from '../../lib/invoiceLayout';

const MM_SCALE = 3.25;
const CANVAS_WIDTH_MM = 210;
const CANVAS_HEIGHT_MM = 297;

const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.42)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 70,
  padding: '24px',
};

const panelCardStyle = {
  background: '#FFFFFF',
  border: '1px solid #D7E1EC',
  borderRadius: '20px',
  boxShadow: '0 22px 50px rgba(15,45,92,0.12)',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function mmToPx(value, zoom) {
  return value * MM_SCALE * zoom;
}

function snapValue(value, grid) {
  if (!grid?.enabled || !grid?.snap) return round(value);
  const size = Number(grid.size || 2);
  if (!size) return round(value);
  return round(Math.round(value / size) * size);
}

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

function sanitizeElementUpdate(element, patch, layout) {
  const grid = layout.grid || {};
  const next = {
    ...element,
    ...patch,
  };
  const maxX = 198 - Number(next.w || element.w || 0);
  const maxY = 287 - Number(next.h || element.h || 0);
  return {
    ...next,
    x: clamp(snapValue(next.x, grid), 0, Math.max(0, maxX)),
    y: clamp(snapValue(next.y, grid), 0, Math.max(0, maxY)),
    w: clamp(snapValue(next.w, grid), 6, 190),
    h: clamp(snapValue(next.h, grid), 4, 277),
    padding: clamp(round(next.padding), 0, 8),
    fontSize: clamp(round(next.fontSize), 6, 32),
  };
}

function replaceElement(layout, elementId, patch) {
  return {
    ...layout,
    elements: layout.elements.map((element) => (
      element.id === elementId ? sanitizeElementUpdate(element, patch, layout) : element
    )),
  };
}

function replaceSections(layout, sections) {
  return {
    ...layout,
    sections,
  };
}

function ToolbarButton({ children, active = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors"
      style={{
        borderColor: active ? '#0F2D5C' : '#CDD8E4',
        background: active ? '#EEF4FF' : '#FFFFFF',
        color: disabled ? '#94A3B8' : '#455A72',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ModalCard({ title, children, onClose, footer = null, width = 480 }) {
  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div
        style={{ ...panelCardStyle, width: `min(${width}px, calc(100vw - 32px))`, maxHeight: '80vh', overflow: 'auto' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#E6E8EA' }}>
          <h4 className="text-base font-semibold" style={{ color: '#191C1E' }}>{title}</h4>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-semibold" style={{ color: '#455A72' }}>
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="border-t px-5 py-4" style={{ borderColor: '#E6E8EA' }}>{footer}</div>}
      </div>
    </div>
  );
}

function SectionEditor({ title, children }) {
  return (
    <div className="rounded-[16px] border bg-white p-3" style={{ borderColor: '#D7E1EC' }}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function InvoiceLayoutDesigner({
  settings,
  selectedCompany,
  patchSettings,
  onSave,
  inputStyle,
  inputProps,
}) {
  const companyId = selectedCompany?.company_id || 'ckfrozen';
  const derivedLayout = useMemo(
    () => normalizeInvoiceLayout(settings.invoice_layout || DEFAULT_INVOICE_LAYOUT, companyId),
    [companyId, settings.invoice_layout]
  );
  const [workingLayout, setWorkingLayout] = useState(derivedLayout);
  const [selectedElementId, setSelectedElementId] = useState(derivedLayout.elements[0]?.id || 'companyLogo');
  const [showProperties, setShowProperties] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMarginsModal, setShowMarginsModal] = useState(false);
  const [showGridModal, setShowGridModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [zoom, setZoom] = useState(0.58);
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [formatClipboard, setFormatClipboard] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [marginDraft, setMarginDraft] = useState(derivedLayout.pageMargins);
  const [gridDraft, setGridDraft] = useState(derivedLayout.grid);
  const previewRef = useRef(null);

  useEffect(() => {
    setWorkingLayout(derivedLayout);
    setMarginDraft(derivedLayout.pageMargins);
    setGridDraft(derivedLayout.grid);
    setSelectedElementId((current) => {
      if (derivedLayout.elements.some((element) => element.id === current)) return current;
      return derivedLayout.elements[0]?.id || 'companyLogo';
    });
  }, [derivedLayout]);

  const selectedElement = useMemo(
    () => getInvoiceElement(workingLayout, selectedElementId),
    [selectedElementId, workingLayout]
  );

  const commitLayout = useCallback((nextLayout, options = {}) => {
    const normalized = normalizeInvoiceLayout(nextLayout, companyId);
    const previous = options.previous || workingLayout;
    const shouldTrack = options.trackHistory !== false;
    setWorkingLayout(normalized);
    patchSettings({ invoice_layout: normalized });
    if (shouldTrack) {
      setHistoryPast((current) => [...current, cloneLayout(previous)].slice(-40));
      setHistoryFuture([]);
    }
  }, [companyId, patchSettings, workingLayout]);

  const setLayoutWithoutHistory = useCallback((nextLayout) => {
    const normalized = normalizeInvoiceLayout(nextLayout, companyId);
    setWorkingLayout(normalized);
    patchSettings({ invoice_layout: normalized });
  }, [companyId, patchSettings]);

  const handleUndo = () => {
    if (!historyPast.length) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((current) => current.slice(0, -1));
    setHistoryFuture((current) => [cloneLayout(workingLayout), ...current].slice(0, 40));
    setWorkingLayout(previous);
    patchSettings({ invoice_layout: previous });
  };

  const handleRedo = () => {
    if (!historyFuture.length) return;
    const next = historyFuture[0];
    setHistoryFuture((current) => current.slice(1));
    setHistoryPast((current) => [...current, cloneLayout(workingLayout)].slice(-40));
    setWorkingLayout(next);
    patchSettings({ invoice_layout: next });
  };

  const patchElement = useCallback((elementId, patch, options = {}) => {
    const previous = options.previous || workingLayout;
    const nextLayout = replaceElement(workingLayout, elementId, patch);
    if (options.trackHistory === false) {
      setLayoutWithoutHistory(nextLayout);
      return;
    }
    commitLayout(nextLayout, { previous });
  }, [commitLayout, setLayoutWithoutHistory, workingLayout]);

  const handleSelectElement = (elementId) => {
    if (formatClipboard && selectedElementId && formatClipboard.sourceId !== elementId) {
      const target = getInvoiceElement(workingLayout, elementId);
      if (target) {
        const nextLayout = replaceElement(workingLayout, elementId, {
          align: formatClipboard.align,
          padding: formatClipboard.padding,
          border: formatClipboard.border,
          fontSize: formatClipboard.fontSize,
          italic: formatClipboard.italic,
          bold: formatClipboard.bold,
        });
        commitLayout(nextLayout, { previous: workingLayout });
      }
      setFormatClipboard(null);
    }
    setSelectedElementId(elementId);
  };

  const handleStartPointer = (event, element, mode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedElementId(element.id);
    setDragState({
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      base: cloneLayout(element),
      layoutBeforeDrag: cloneLayout(workingLayout),
    });
  };

  useEffect(() => {
    if (!dragState) return undefined;
    const handleMove = (event) => {
      const dxMm = (event.clientX - dragState.startX) / (MM_SCALE * zoom);
      const dyMm = (event.clientY - dragState.startY) / (MM_SCALE * zoom);
      if (dragState.mode === 'resize') {
        const nextLayout = replaceElement(workingLayout, dragState.id, {
          w: dragState.base.w + dxMm,
          h: dragState.base.h + dyMm,
        });
        setLayoutWithoutHistory(nextLayout);
        return;
      }
      const nextLayout = replaceElement(workingLayout, dragState.id, {
        x: dragState.base.x + dxMm,
        y: dragState.base.y + dyMm,
      });
      setLayoutWithoutHistory(nextLayout);
    };
    const handleUp = () => {
      const changed = JSON.stringify(dragState.layoutBeforeDrag) !== JSON.stringify(workingLayout);
      if (changed) {
        setHistoryPast((current) => [...current, dragState.layoutBeforeDrag].slice(-40));
        setHistoryFuture([]);
      }
      setDragState(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState, setLayoutWithoutHistory, workingLayout, zoom]);

  const handleTemplateChange = (templateId) => {
    const nextLayout = applyTemplateToLayout(workingLayout, templateId, companyId);
    commitLayout(nextLayout, { previous: workingLayout });
  };

  const handleSectionVisibility = (sectionId, visible) => {
    const sections = workingLayout.sections.map((section) => (
      section.id === sectionId ? { ...section, visible } : section
    ));
    commitLayout(replaceSections(workingLayout, sections), { previous: workingLayout });
  };

  const handleSectionMove = (sectionId, direction) => {
    const sections = workingLayout.sections;
    const currentIndex = sections.findIndex((entry) => entry.id === sectionId);
    const target = sections[currentIndex + direction];
    if (!target) return;
    commitLayout(moveInvoiceLayoutSection(workingLayout, sectionId, target.id, companyId), { previous: workingLayout });
  };

  const handleAddElement = (typeId) => {
    const nextElement = createCustomInvoiceElement(typeId);
    const nextLayout = {
      ...workingLayout,
      elements: [...workingLayout.elements, nextElement],
    };
    commitLayout(nextLayout, { previous: workingLayout });
    setSelectedElementId(nextElement.id);
    setShowAddModal(false);
    setShowProperties(true);
  };

  const handleDuplicate = () => {
    if (!selectedElement) return;
    const nextElement = duplicateInvoiceElement(selectedElement);
    const nextLayout = {
      ...workingLayout,
      elements: [...workingLayout.elements, nextElement],
    };
    commitLayout(nextLayout, { previous: workingLayout });
    setSelectedElementId(nextElement.id);
  };

  const handleRemove = () => {
    if (!selectedElement || selectedElement.required) return;
    const nextLayout = {
      ...workingLayout,
      elements: workingLayout.elements.filter((element) => element.id !== selectedElement.id),
    };
    commitLayout(nextLayout, { previous: workingLayout });
    const fallback = nextLayout.elements[0]?.id || 'companyLogo';
    setSelectedElementId(fallback);
  };

  const handleCopyFormat = () => {
    if (!selectedElement) return;
    setFormatClipboard({
      sourceId: selectedElement.id,
      align: selectedElement.align,
      padding: selectedElement.padding,
      border: selectedElement.border,
      fontSize: selectedElement.fontSize,
      italic: selectedElement.italic,
      bold: selectedElement.bold,
    });
  };

  const handleApplyMargins = () => {
    const nextLayout = {
      ...workingLayout,
      pageMargins: {
        top: clamp(Number(marginDraft.top || 0), 4, 20),
        right: clamp(Number(marginDraft.right || 0), 4, 20),
        bottom: clamp(Number(marginDraft.bottom || 0), 4, 20),
        left: clamp(Number(marginDraft.left || 0), 4, 20),
      },
    };
    commitLayout(nextLayout, { previous: workingLayout });
    setShowMarginsModal(false);
  };

  const handleApplyGrid = () => {
    const nextLayout = {
      ...workingLayout,
      grid: {
        enabled: Boolean(gridDraft.enabled),
        snap: Boolean(gridDraft.snap),
        size: clamp(Number(gridDraft.size || 2), 1, 10),
      },
    };
    commitLayout(nextLayout, { previous: workingLayout });
    setShowGridModal(false);
  };

  const handleElementPropertyChange = (key, value) => {
    if (!selectedElement) return;
    patchElement(selectedElement.id, { [key]: value }, { previous: workingLayout });
  };

  const handleLogoUpload = (settingKey, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchSettings({ [settingKey]: reader.result });
    reader.readAsDataURL(file);
  };

  const previewWidth = CANVAS_WIDTH_MM * MM_SCALE * zoom;
  const previewHeight = CANVAS_HEIGHT_MM * MM_SCALE * zoom;

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] p-4 sm:p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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
                onChange={(event) => patchSettings({ [key]: type === 'number' ? parseInt(event.target.value, 10) || 0 : event.target.value })}
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
            <textarea rows={2} value={settings.invoice_footer_notes || ''} onChange={(event) => patchSettings({ invoice_footer_notes: event.target.value })} className={`${inputStyle} resize-none`} style={inputProps} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Terms & Conditions Text</label>
            <textarea rows={3} value={settings.invoice_terms_text || ''} onChange={(event) => patchSettings({ invoice_terms_text: event.target.value })} className={`${inputStyle} resize-none`} style={inputProps} />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border bg-white shadow-[0_12px_28px_rgba(15,45,92,0.08)]" style={{ borderColor: '#C7D3E2' }}>
        <div className="flex items-center justify-between rounded-t-[24px] px-4 py-3 text-white" style={{ background: 'linear-gradient(180deg, #214A76 0%, #17365A 100%)' }}>
          <div className="text-sm font-semibold">Layout Designer - {selectedCompany?.name || 'Invoice Workspace'}</div>
          <div className="flex items-center gap-2">
            {formatClipboard && <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold">Select another element to apply copied format</span>}
            {onSave && (
              <button type="button" onClick={onSave} className="rounded-xl bg-white/10 px-3 py-2 text-[12px] font-semibold text-white">
                Save Layout
              </button>
            )}
          </div>
        </div>

        <div className="border-b px-3 py-3" style={{ borderColor: '#D7E1EC', background: '#F8FBFE' }}>
          <div className="flex flex-wrap gap-2">
            <ToolbarButton active={showProperties} onClick={() => setShowProperties((current) => !current)}>Properties</ToolbarButton>
            <ToolbarButton onClick={() => setShowAddModal(true)}>Add</ToolbarButton>
            <ToolbarButton onClick={handleDuplicate} disabled={!selectedElement}>Copy</ToolbarButton>
            <ToolbarButton onClick={handleRemove} disabled={!selectedElement || selectedElement.required}>Remove</ToolbarButton>
            <ToolbarButton active={Boolean(formatClipboard)} onClick={handleCopyFormat} disabled={!selectedElement}>Copy Format</ToolbarButton>
            <ToolbarButton onClick={handleUndo} disabled={!historyPast.length}>Undo</ToolbarButton>
            <ToolbarButton onClick={handleRedo} disabled={!historyFuture.length}>Redo</ToolbarButton>
            <ToolbarButton onClick={() => setZoom((current) => clamp(round(current - 0.06), 0.36, 1.1))}>Zoom Out</ToolbarButton>
            <ToolbarButton onClick={() => setZoom((current) => clamp(round(current + 0.06), 0.36, 1.1))}>Zoom In</ToolbarButton>
            <ToolbarButton onClick={() => { setMarginDraft(workingLayout.pageMargins); setShowMarginsModal(true); }}>Margins</ToolbarButton>
            <ToolbarButton onClick={() => { setGridDraft(workingLayout.grid); setShowGridModal(true); }}>Grid</ToolbarButton>
            <ToolbarButton onClick={() => setShowHelpModal(true)}>Help</ToolbarButton>
          </div>
        </div>

        <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-[18px] border bg-[#F4F7FB] p-3" style={{ borderColor: '#D7E1EC' }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#0F2D5C' }}>Live A4 Preview</div>
                  <div className="text-xs" style={{ color: '#60758C' }}>Same layout data used by print and PDF output.</div>
                </div>
                <div className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: '#E8F2FF', color: '#0F2D5C' }}>
                  Zoom {Math.round(zoom * 100)}%
                </div>
              </div>
              <div className="overflow-auto rounded-[14px] border bg-[#E9EEF5] p-4" style={{ borderColor: '#C9D5E2' }}>
                <div
                  ref={previewRef}
                  className="relative mx-auto"
                  style={{
                    width: previewWidth,
                    height: previewHeight,
                    background: workingLayout.grid?.enabled
                      ? `repeating-linear-gradient(0deg, rgba(15,45,92,0.04) 0, rgba(15,45,92,0.04) 1px, transparent 1px, transparent ${mmToPx(workingLayout.grid.size, zoom)}px),
                         repeating-linear-gradient(90deg, rgba(15,45,92,0.04) 0, rgba(15,45,92,0.04) 1px, transparent 1px, transparent ${mmToPx(workingLayout.grid.size, zoom)}px)`
                      : 'transparent',
                  }}
                >
                  <InvoiceRenderer
                    invoice={SAMPLE_INVOICE_PREVIEW}
                    customer={{ name: SAMPLE_INVOICE_PREVIEW.customer_name }}
                    settings={settings}
                    company={selectedCompany}
                    companyId={companyId}
                    layout={workingLayout}
                    preview
                    sample
                    scale={MM_SCALE * zoom}
                  />
                  <div className="absolute inset-0">
                    {workingLayout.elements.filter((element) => element.visible !== false).map((element) => {
                      const active = selectedElementId === element.id;
                      return (
                        <button
                          key={element.id}
                          type="button"
                          onClick={() => handleSelectElement(element.id)}
                          onPointerDown={(event) => handleStartPointer(event, element, 'move')}
                          className="absolute border-2 text-left"
                          style={{
                            left: mmToPx(element.x, zoom),
                            top: mmToPx(element.y, zoom),
                            width: mmToPx(element.w, zoom),
                            height: mmToPx(element.h, zoom),
                            borderColor: active ? '#1A67C5' : 'rgba(15,45,92,0.25)',
                            background: active ? 'rgba(26,103,197,0.08)' : 'rgba(255,255,255,0.02)',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span
                            className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: active ? '#1A67C5' : 'rgba(15,45,92,0.55)', color: '#FFFFFF' }}
                          >
                            {element.label}
                          </span>
                          <span
                            onPointerDown={(event) => handleStartPointer(event, element, 'resize')}
                            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                            style={{ background: active ? '#1A67C5' : 'rgba(15,45,92,0.55)' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border bg-white p-4" style={{ borderColor: '#D7E1EC' }}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#0F2D5C' }}>Section Visibility</div>
                  <div className="text-xs" style={{ color: '#60758C' }}>Required core blocks stay safe. You can reorder and hide sections that support it.</div>
                </div>
              </div>
              <div className="space-y-2">
                {workingLayout.sections.map((section, index) => {
                  const meta = INVOICE_LAYOUT_SECTIONS.find((entry) => entry.id === section.id);
                  return (
                    <div key={section.id} className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-3" style={{ borderColor: '#E3EAF2', background: '#FBFDFF' }}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold" style={{ color: '#191C1E' }}>{meta?.label || section.id}</div>
                        <div className="text-xs" style={{ color: '#60758C' }}>{meta?.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleSectionMove(section.id, -1)} disabled={index === 0} className="rounded-lg border px-2 py-1 text-xs font-semibold" style={{ borderColor: '#CDD8E4', color: '#455A72' }}>Up</button>
                        <button type="button" onClick={() => handleSectionMove(section.id, 1)} disabled={index === workingLayout.sections.length - 1} className="rounded-lg border px-2 py-1 text-xs font-semibold" style={{ borderColor: '#CDD8E4', color: '#455A72' }}>Down</button>
                        <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#20384F' }}>
                          <input type="checkbox" checked={section.visible !== false} onChange={(event) => handleSectionVisibility(section.id, event.target.checked)} />
                          Visible
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SectionEditor title="Layout Setup">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input type="color" value={workingLayout.accentColor} onChange={(event) => commitLayout({ ...workingLayout, accentColor: event.target.value }, { previous: workingLayout })} className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent" />
                  <input value={workingLayout.accentColor} onChange={(event) => commitLayout({ ...workingLayout, accentColor: event.target.value }, { previous: workingLayout })} className={inputStyle} style={inputProps} />
                </div>
                <select value={workingLayout.fontFamily} onChange={(event) => commitLayout({ ...workingLayout, fontFamily: event.target.value }, { previous: workingLayout })} className={inputStyle} style={inputProps}>
                  <option>Georgia</option>
                  <option>Times New Roman</option>
                  <option>Arial</option>
                  <option>Courier New</option>
                </select>
                <select value={workingLayout.activeCompanyTemplateId || workingLayout.templateId} onChange={(event) => handleTemplateChange(event.target.value)} className={inputStyle} style={inputProps}>
                  {workingLayout.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
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
                        value={workingLayout[key]}
                        onChange={(event) => commitLayout({ ...workingLayout, [key]: Number(event.target.value) || DEFAULT_INVOICE_LAYOUT[key] }, { previous: workingLayout })}
                        className={inputStyle}
                        style={inputProps}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['compactPrint', 'Compact print spacing'],
                    ['showBrandLogos', 'Show brand logos'],
                    ['emphasizeTotals', 'Highlight totals card'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded border px-2 py-2 text-[11px] font-semibold" style={{ borderColor: '#E3EAF2', background: '#FBFDFF', color: '#20384F' }}>
                      <input type="checkbox" checked={Boolean(workingLayout[key])} onChange={(event) => commitLayout({ ...workingLayout, [key]: event.target.checked }, { previous: workingLayout })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </SectionEditor>

            {showProperties && (
              <SectionEditor title="Properties">
                {!selectedElement ? (
                  <div className="text-sm" style={{ color: '#667085' }}>Select a layout element to edit its properties.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: '#E3EAF2', background: '#FBFDFF' }}>
                      <div className="text-sm font-semibold" style={{ color: '#191C1E' }}>{selectedElement.label}</div>
                      <div className="text-xs" style={{ color: '#60758C' }}>Type: {selectedElement.type}{selectedElement.required ? ' · Core element' : ' · Optional element'}</div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>Label / Title</label>
                      <input
                        value={selectedElement.text || selectedElement.label}
                        onChange={(event) => handleElementPropertyChange(selectedElement.text !== undefined ? 'text' : 'label', event.target.value)}
                        className={inputStyle}
                        style={inputProps}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['x', 'X'],
                        ['y', 'Y'],
                        ['w', 'Width'],
                        ['h', 'Height'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>{label}</label>
                          <input
                            type="number"
                            step="0.5"
                            value={selectedElement[key]}
                            onChange={(event) => handleElementPropertyChange(key, Number(event.target.value))}
                            className={inputStyle}
                            style={inputProps}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>Padding</label>
                        <input type="number" step="0.2" value={selectedElement.padding} onChange={(event) => handleElementPropertyChange('padding', Number(event.target.value))} className={inputStyle} style={inputProps} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>Font Size</label>
                        <input type="number" step="0.2" value={selectedElement.fontSize} onChange={(event) => handleElementPropertyChange('fontSize', Number(event.target.value))} className={inputStyle} style={inputProps} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide" style={{ color: '#688097' }}>Alignment</label>
                      <select value={selectedElement.align || 'left'} onChange={(event) => handleElementPropertyChange('align', event.target.value)} className={inputStyle} style={inputProps}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 rounded border px-2 py-2 text-[11px] font-semibold" style={{ borderColor: '#E3EAF2', background: '#FBFDFF', color: '#20384F' }}>
                        <input type="checkbox" checked={selectedElement.visible !== false} onChange={(event) => handleElementPropertyChange('visible', event.target.checked)} />
                        Visible
                      </label>
                      <label className="flex items-center gap-2 rounded border px-2 py-2 text-[11px] font-semibold" style={{ borderColor: '#E3EAF2', background: '#FBFDFF', color: '#20384F' }}>
                        <input type="checkbox" checked={selectedElement.border !== false} onChange={(event) => handleElementPropertyChange('border', event.target.checked)} />
                        Border
                      </label>
                      <label className="flex items-center gap-2 rounded border px-2 py-2 text-[11px] font-semibold" style={{ borderColor: '#E3EAF2', background: '#FBFDFF', color: '#20384F' }}>
                        <input type="checkbox" checked={Boolean(selectedElement.bold)} onChange={(event) => handleElementPropertyChange('bold', event.target.checked)} />
                        Bold
                      </label>
                      <label className="flex items-center gap-2 rounded border px-2 py-2 text-[11px] font-semibold" style={{ borderColor: '#E3EAF2', background: '#FBFDFF', color: '#20384F' }}>
                        <input type="checkbox" checked={Boolean(selectedElement.italic)} onChange={(event) => handleElementPropertyChange('italic', event.target.checked)} />
                        Italic
                      </label>
                    </div>
                  </div>
                )}
              </SectionEditor>
            )}

            <SectionEditor title="Logos & Options">
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
              </div>
            </SectionEditor>
          </div>
        </div>
      </div>

      {showAddModal && (
        <ModalCard title="Add Layout Element" onClose={() => setShowAddModal(false)} footer={
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowAddModal(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: '#CDD8E4', color: '#455A72' }}>
              Cancel
            </button>
          </div>
        }>
          <div className="grid gap-3 sm:grid-cols-2">
            {INVOICE_CUSTOM_ELEMENT_TYPES.map((entry) => (
              <button key={entry.id} type="button" onClick={() => handleAddElement(entry.id)} className="rounded-2xl border p-4 text-left transition-colors" style={{ borderColor: '#D7E1EC', background: '#FBFDFF' }}>
                <div className="text-sm font-semibold" style={{ color: '#191C1E' }}>{entry.label}</div>
                <div className="mt-1 text-xs" style={{ color: '#60758C' }}>Adds a supported optional block to the live invoice layout.</div>
              </button>
            ))}
          </div>
        </ModalCard>
      )}

      {showMarginsModal && (
        <ModalCard title="Page Margins" onClose={() => setShowMarginsModal(false)} footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowMarginsModal(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: '#CDD8E4', color: '#455A72' }}>Cancel</button>
            <button type="button" onClick={handleApplyMargins} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#0F2D5C' }}>Apply</button>
          </div>
        }>
          <div className="grid gap-3 sm:grid-cols-2">
            {['top', 'right', 'bottom', 'left'].map((side) => (
              <div key={side}>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#688097' }}>{side}</label>
                <input type="number" step="0.5" value={marginDraft[side]} onChange={(event) => setMarginDraft((current) => ({ ...current, [side]: event.target.value }))} className={inputStyle} style={inputProps} />
              </div>
            ))}
          </div>
        </ModalCard>
      )}

      {showGridModal && (
        <ModalCard title="Grid & Snap" onClose={() => setShowGridModal(false)} footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowGridModal(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: '#CDD8E4', color: '#455A72' }}>Cancel</button>
            <button type="button" onClick={handleApplyGrid} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#0F2D5C' }}>Apply</button>
          </div>
        }>
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-2xl border px-3 py-3" style={{ borderColor: '#E3EAF2', background: '#FBFDFF' }}>
              <input type="checkbox" checked={Boolean(gridDraft.enabled)} onChange={(event) => setGridDraft((current) => ({ ...current, enabled: event.target.checked }))} />
              <span className="text-sm font-semibold" style={{ color: '#191C1E' }}>Show grid overlay in preview</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border px-3 py-3" style={{ borderColor: '#E3EAF2', background: '#FBFDFF' }}>
              <input type="checkbox" checked={Boolean(gridDraft.snap)} onChange={(event) => setGridDraft((current) => ({ ...current, snap: event.target.checked }))} />
              <span className="text-sm font-semibold" style={{ color: '#191C1E' }}>Snap moves and resizes to grid</span>
            </label>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#688097' }}>Grid Size (mm)</label>
              <input type="number" step="0.5" value={gridDraft.size} onChange={(event) => setGridDraft((current) => ({ ...current, size: event.target.value }))} className={inputStyle} style={inputProps} />
            </div>
          </div>
        </ModalCard>
      )}

      {showHelpModal && (
        <ModalCard title="Layout Designer Help" onClose={() => setShowHelpModal(false)} width={560}>
          <div className="space-y-3 text-sm leading-6" style={{ color: '#455A72' }}>
            <p>Click any element on the preview page to select it. Drag anywhere inside the selection box to move it, or drag the lower-right corner to resize it.</p>
            <p><strong>Properties</strong> edits the selected element. Position and size are saved in millimeters so the print output stays aligned with the preview.</p>
            <p><strong>Add</strong> inserts only supported optional blocks. <strong>Copy</strong> duplicates the selected block. <strong>Remove</strong> deletes optional blocks only; required invoice blocks can only be hidden.</p>
            <p><strong>Copy Format</strong> stores typography and border settings from the selected block. After clicking it, select a second block and the saved formatting will be applied automatically.</p>
            <p><strong>Undo</strong> and <strong>Redo</strong> track layout edits in this editing session. <strong>Zoom</strong> changes the preview scale only and does not affect A4 print sizing.</p>
            <p><strong>Margins</strong> controls the print-safe page shell. <strong>Grid</strong> controls the design grid and snap behavior for cleaner alignment.</p>
          </div>
        </ModalCard>
      )}
    </div>
  );
}
