export const INVOICE_LAYOUT_SECTIONS = [
  { id: 'header', label: 'Company Header', description: 'Logo, company identity, and invoice title block.' },
  { id: 'meta', label: 'Invoice Meta', description: 'Date, invoice number, sales rep, and terms.' },
  { id: 'address', label: 'Customer Address', description: 'Billing and shipping address block.' },
  { id: 'brands', label: 'Brand Logos', description: 'Companion brand marks shown beside the address area.' },
  { id: 'items', label: 'Line Items', description: 'Product table with quantity, rate, and totals.' },
  { id: 'terms', label: 'Terms & Notices', description: 'Payment policies, return policy, and invoice notes.' },
  { id: 'totals', label: 'Totals Summary', description: 'Grand total, payments, and balance due.' },
  { id: 'signature', label: 'Signature', description: 'Customer signature block and acknowledgement area.' },
];

export const INVOICE_STATIC_ASSETS = {
  ckLogo: '/ck-logo-transparent.png',
  haorLogo: '/haor-logo.png',
  shahiLogo: '/sk-logo.jpeg',
};

export const INVOICE_TEMPLATE_LIBRARY = [
  {
    id: 'ck-frozen-flagship',
    name: 'CK Frozen Flagship',
    accentColor: '#0F2D5C',
    bodyFontSize: 8.5,
    fontFamily: 'Georgia',
    lineCount: 22,
    logoScale: 110,
    compactPrint: false,
    showBrandLogos: true,
    emphasizeTotals: true,
    pageMargins: { top: 7, right: 7, bottom: 8, left: 7 },
    grid: { enabled: true, snap: true, size: 2 },
    sections: {
      header: true,
      meta: true,
      address: true,
      brands: true,
      items: true,
      terms: true,
      totals: true,
      signature: true,
    },
    elements: [
      { id: 'companyLogo', type: 'logo', sectionId: 'header', label: 'Company Logo', visible: true, required: true, x: 8, y: 8, w: 28, h: 34, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'companyInfo', type: 'companyInfo', sectionId: 'header', label: 'Company Information', visible: true, required: true, x: 38, y: 8, w: 102, h: 34, fontSize: 9.8, align: 'left', padding: 1.2, border: false },
      { id: 'invoiceTitle', type: 'text', sectionId: 'header', label: 'Invoice Title', visible: true, required: true, x: 142, y: 8, w: 58, h: 15, fontSize: 26, align: 'right', padding: 1, border: false, text: 'INVOICE', italic: false, bold: true },
      { id: 'invoiceMeta', type: 'meta', sectionId: 'meta', label: 'Invoice Info Box', visible: true, required: true, x: 147, y: 24, w: 51, h: 26, fontSize: 9.4, align: 'left', padding: 0, border: true },
      { id: 'customerAddress', type: 'address', sectionId: 'address', label: 'Shipping & Billing Box', visible: true, required: true, x: 8, y: 55, w: 82, h: 42, fontSize: 9.8, align: 'left', padding: 2, border: true },
      { id: 'brandLogos', type: 'brandLogos', sectionId: 'brands', label: 'Brand Logos', visible: true, required: true, x: 96, y: 54, w: 102, h: 43, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'itemTable', type: 'items', sectionId: 'items', label: 'Item Table', visible: true, required: true, x: 8, y: 103, w: 190, h: 139, fontSize: 8.5, align: 'left', padding: 0, border: true },
      { id: 'paymentInstructions', type: 'terms', sectionId: 'terms', label: 'Payment Instructions', visible: true, required: true, x: 8, y: 244, w: 124, h: 21, fontSize: 7.5, align: 'left', padding: 1.8, border: true },
      { id: 'totals', type: 'totals', sectionId: 'totals', label: 'Totals Summary', visible: true, required: true, x: 132, y: 244, w: 66, h: 21, fontSize: 9.5, align: 'right', padding: 1.6, border: true },
      { id: 'thankYouFooter', type: 'footerText', sectionId: 'terms', label: 'Thank You Footer', visible: true, required: true, x: 8, y: 265, w: 124, h: 12, fontSize: 14, align: 'left', padding: 1.5, border: true, text: 'Thank You For Your Business', italic: true, bold: true },
      { id: 'signature', type: 'signature', sectionId: 'signature', label: 'Signature Box', visible: true, required: true, x: 132, y: 265, w: 66, h: 12, fontSize: 8.6, align: 'center', padding: 1.5, border: true },
    ],
  },
  {
    id: 'haor-heritage',
    name: 'Haor Heritage Premium',
    accentColor: '#0E7490',
    bodyFontSize: 8.4,
    fontFamily: 'Georgia',
    lineCount: 22,
    logoScale: 100,
    compactPrint: false,
    showBrandLogos: true,
    emphasizeTotals: true,
    pageMargins: { top: 7, right: 7, bottom: 8, left: 7 },
    grid: { enabled: true, snap: true, size: 2 },
    sections: { header: true, meta: true, address: true, brands: true, items: true, terms: true, totals: true, signature: true },
    elements: [
      { id: 'companyLogo', type: 'logo', sectionId: 'header', label: 'Company Logo', visible: true, required: true, x: 9, y: 8, w: 25, h: 30, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'companyInfo', type: 'companyInfo', sectionId: 'header', label: 'Company Information', visible: true, required: true, x: 36, y: 8, w: 108, h: 30, fontSize: 9.2, align: 'left', padding: 1.2, border: false },
      { id: 'invoiceTitle', type: 'text', sectionId: 'header', label: 'Invoice Title', visible: true, required: true, x: 146, y: 8, w: 52, h: 13, fontSize: 24, align: 'right', padding: 1, border: false, text: 'INVOICE', italic: false, bold: true },
      { id: 'invoiceMeta', type: 'meta', sectionId: 'meta', label: 'Invoice Info Box', visible: true, required: true, x: 150, y: 22, w: 48, h: 24, fontSize: 9.1, align: 'left', padding: 0, border: true },
      { id: 'customerAddress', type: 'address', sectionId: 'address', label: 'Shipping & Billing Box', visible: true, required: true, x: 8, y: 49, w: 68, h: 40, fontSize: 9.4, align: 'left', padding: 2, border: true },
      { id: 'brandLogos', type: 'brandLogos', sectionId: 'brands', label: 'Brand Logos', visible: true, required: true, x: 82, y: 48, w: 116, h: 41, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'itemTable', type: 'items', sectionId: 'items', label: 'Item Table', visible: true, required: true, x: 8, y: 95, w: 190, h: 147, fontSize: 8.4, align: 'left', padding: 0, border: true },
      { id: 'paymentInstructions', type: 'terms', sectionId: 'terms', label: 'Payment Instructions', visible: true, required: true, x: 8, y: 244, w: 118, h: 20, fontSize: 7.4, align: 'left', padding: 1.8, border: true },
      { id: 'totals', type: 'totals', sectionId: 'totals', label: 'Totals Summary', visible: true, required: true, x: 126, y: 244, w: 72, h: 20, fontSize: 9.2, align: 'right', padding: 1.6, border: true },
      { id: 'thankYouFooter', type: 'footerText', sectionId: 'terms', label: 'Thank You Footer', visible: true, required: true, x: 8, y: 264, w: 118, h: 12, fontSize: 13.5, align: 'left', padding: 1.4, border: true, text: 'Thank You For Your Business', italic: true, bold: true },
      { id: 'signature', type: 'signature', sectionId: 'signature', label: 'Signature Box', visible: true, required: true, x: 126, y: 264, w: 72, h: 12, fontSize: 8.6, align: 'center', padding: 1.5, border: true },
    ],
  },
  {
    id: 'shahi-king-brand',
    name: 'Shahi King Signature',
    accentColor: '#9F6400',
    bodyFontSize: 8.4,
    fontFamily: 'Georgia',
    lineCount: 22,
    logoScale: 105,
    compactPrint: false,
    showBrandLogos: true,
    emphasizeTotals: true,
    pageMargins: { top: 7, right: 7, bottom: 8, left: 7 },
    grid: { enabled: true, snap: true, size: 2 },
    sections: { header: true, meta: true, address: true, brands: true, items: true, terms: true, totals: true, signature: true },
    elements: [
      { id: 'companyLogo', type: 'logo', sectionId: 'header', label: 'Company Logo', visible: true, required: true, x: 8, y: 8, w: 22, h: 26, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'companyInfo', type: 'companyInfo', sectionId: 'header', label: 'Company Information', visible: true, required: true, x: 32, y: 8, w: 102, h: 24, fontSize: 8.7, align: 'left', padding: 1.2, border: false },
      { id: 'invoiceTitle', type: 'text', sectionId: 'header', label: 'Invoice Title', visible: true, required: true, x: 140, y: 8, w: 58, h: 14, fontSize: 25, align: 'right', padding: 1, border: false, text: 'INVOICE', italic: false, bold: true },
      { id: 'invoiceMeta', type: 'meta', sectionId: 'meta', label: 'Invoice Info Box', visible: true, required: true, x: 148, y: 24, w: 50, h: 24, fontSize: 9.1, align: 'left', padding: 0, border: true },
      { id: 'customerAddress', type: 'address', sectionId: 'address', label: 'Shipping & Billing Box', visible: true, required: true, x: 8, y: 50, w: 72, h: 38, fontSize: 9.1, align: 'left', padding: 2, border: true },
      { id: 'brandLogos', type: 'brandLogos', sectionId: 'brands', label: 'Brand Logos', visible: true, required: true, x: 84, y: 48, w: 114, h: 42, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'itemTable', type: 'items', sectionId: 'items', label: 'Item Table', visible: true, required: true, x: 8, y: 95, w: 190, h: 147, fontSize: 8.4, align: 'left', padding: 0, border: true },
      { id: 'paymentInstructions', type: 'terms', sectionId: 'terms', label: 'Payment Instructions', visible: true, required: true, x: 8, y: 244, w: 120, h: 20, fontSize: 7.3, align: 'left', padding: 1.8, border: true },
      { id: 'totals', type: 'totals', sectionId: 'totals', label: 'Totals Summary', visible: true, required: true, x: 128, y: 244, w: 70, h: 20, fontSize: 9.2, align: 'right', padding: 1.6, border: true },
      { id: 'thankYouFooter', type: 'footerText', sectionId: 'terms', label: 'Thank You Footer', visible: true, required: true, x: 8, y: 264, w: 120, h: 12, fontSize: 13.3, align: 'left', padding: 1.4, border: true, text: 'Thank You For Your Business', italic: true, bold: true },
      { id: 'signature', type: 'signature', sectionId: 'signature', label: 'Signature Box', visible: true, required: true, x: 128, y: 264, w: 70, h: 12, fontSize: 8.6, align: 'center', padding: 1.5, border: true },
    ],
  },
  {
    id: 'ck-canada-wholesale',
    name: 'CK Canada Wholesale',
    accentColor: '#9A1F1F',
    bodyFontSize: 8.4,
    fontFamily: 'Georgia',
    lineCount: 22,
    logoScale: 108,
    compactPrint: false,
    showBrandLogos: true,
    emphasizeTotals: true,
    pageMargins: { top: 7, right: 7, bottom: 8, left: 7 },
    grid: { enabled: true, snap: true, size: 2 },
    sections: { header: true, meta: true, address: true, brands: true, items: true, terms: true, totals: true, signature: true },
    elements: [
      { id: 'companyLogo', type: 'logo', sectionId: 'header', label: 'Company Logo', visible: true, required: true, x: 8, y: 8, w: 26, h: 32, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'companyInfo', type: 'companyInfo', sectionId: 'header', label: 'Company Information', visible: true, required: true, x: 36, y: 8, w: 104, h: 30, fontSize: 9.2, align: 'left', padding: 1.2, border: false },
      { id: 'invoiceTitle', type: 'text', sectionId: 'header', label: 'Invoice Title', visible: true, required: true, x: 144, y: 8, w: 54, h: 14, fontSize: 24, align: 'right', padding: 1, border: false, text: 'INVOICE', italic: false, bold: true },
      { id: 'invoiceMeta', type: 'meta', sectionId: 'meta', label: 'Invoice Info Box', visible: true, required: true, x: 148, y: 24, w: 50, h: 24, fontSize: 9.1, align: 'left', padding: 0, border: true },
      { id: 'customerAddress', type: 'address', sectionId: 'address', label: 'Shipping & Billing Box', visible: true, required: true, x: 8, y: 50, w: 76, h: 39, fontSize: 9.2, align: 'left', padding: 2, border: true },
      { id: 'brandLogos', type: 'brandLogos', sectionId: 'brands', label: 'Brand Logos', visible: true, required: true, x: 88, y: 49, w: 110, h: 40, fontSize: 9, align: 'center', padding: 1, border: false },
      { id: 'itemTable', type: 'items', sectionId: 'items', label: 'Item Table', visible: true, required: true, x: 8, y: 95, w: 190, h: 147, fontSize: 8.4, align: 'left', padding: 0, border: true },
      { id: 'paymentInstructions', type: 'terms', sectionId: 'terms', label: 'Payment Instructions', visible: true, required: true, x: 8, y: 244, w: 122, h: 20, fontSize: 7.4, align: 'left', padding: 1.8, border: true },
      { id: 'totals', type: 'totals', sectionId: 'totals', label: 'Totals Summary', visible: true, required: true, x: 130, y: 244, w: 68, h: 20, fontSize: 9.2, align: 'right', padding: 1.6, border: true },
      { id: 'thankYouFooter', type: 'footerText', sectionId: 'terms', label: 'Thank You Footer', visible: true, required: true, x: 8, y: 264, w: 122, h: 12, fontSize: 13.3, align: 'left', padding: 1.4, border: true, text: 'Thank You For Your Business', italic: true, bold: true },
      { id: 'signature', type: 'signature', sectionId: 'signature', label: 'Signature Box', visible: true, required: true, x: 130, y: 264, w: 68, h: 12, fontSize: 8.6, align: 'center', padding: 1.5, border: true },
    ],
  },
];

export const COMPANY_TEMPLATE_DEFAULTS = {
  ckfrozen: 'ck-frozen-flagship',
  haor: 'haor-heritage',
  deshi: 'shahi-king-brand',
  ckcanada: 'ck-canada-wholesale',
};

export const INVOICE_CUSTOM_ELEMENT_TYPES = [
  { id: 'divider', label: 'Divider Line', type: 'divider' },
  { id: 'noteBlock', label: 'Note Block', type: 'note' },
  { id: 'extraLogo', label: 'Extra Logo Block', type: 'logo' },
  { id: 'textBlock', label: 'Text Block', type: 'text' },
];

const DEFAULT_PAGE_MARGINS = { top: 7, right: 7, bottom: 8, left: 7 };
const DEFAULT_GRID = { enabled: true, snap: true, size: 2 };

function roundToTenth(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getTemplateDefinition(templateId) {
  return INVOICE_TEMPLATE_LIBRARY.find((template) => template.id === templateId) || INVOICE_TEMPLATE_LIBRARY[0];
}

export function getDefaultTemplateIdForCompany(companyId) {
  return COMPANY_TEMPLATE_DEFAULTS[companyId] || 'ck-frozen-flagship';
}

export function createInvoiceLayoutFromTemplate(templateId, companyId = '') {
  const template = getTemplateDefinition(templateId || getDefaultTemplateIdForCompany(companyId));
  return {
    templateId: template.id,
    templateName: template.name,
    activeCompanyTemplateId: template.id,
    companyTemplates: { ...COMPANY_TEMPLATE_DEFAULTS },
    accentColor: template.accentColor,
    compactPrint: template.compactPrint,
    showBrandLogos: template.showBrandLogos,
    emphasizeTotals: template.emphasizeTotals,
    fontFamily: template.fontFamily,
    bodyFontSize: template.bodyFontSize,
    lineCount: template.lineCount,
    logoScale: template.logoScale,
    pageMargins: { ...DEFAULT_PAGE_MARGINS, ...(template.pageMargins || {}) },
    grid: { ...DEFAULT_GRID, ...(template.grid || {}) },
    sections: INVOICE_LAYOUT_SECTIONS.map((section) => ({
      id: section.id,
      visible: template.sections?.[section.id] !== false,
    })),
    elements: template.elements.map((element) => ({ ...element })),
    templates: INVOICE_TEMPLATE_LIBRARY.map(({ id, name }) => ({ id, name })),
  };
}

export const DEFAULT_INVOICE_LAYOUT = createInvoiceLayoutFromTemplate('ck-frozen-flagship', 'ckfrozen');

export function normalizeInvoiceElement(element, fallback) {
  const base = fallback || {};
  return {
    ...base,
    ...element,
    id: element?.id || base.id,
    type: element?.type || base.type || 'text',
    sectionId: element?.sectionId || base.sectionId || 'items',
    label: element?.label || base.label || 'Element',
    text: element?.text ?? base.text ?? '',
    visible: element?.visible !== false,
    required: Boolean(element?.required ?? base.required),
    x: clamp(roundToTenth(element?.x ?? base.x ?? 10), 0, 198),
    y: clamp(roundToTenth(element?.y ?? base.y ?? 10), 0, 287),
    w: clamp(roundToTenth(element?.w ?? base.w ?? 24), 6, 190),
    h: clamp(roundToTenth(element?.h ?? base.h ?? 12), 4, 277),
    align: element?.align || base.align || 'left',
    padding: clamp(roundToTenth(element?.padding ?? base.padding ?? 1), 0, 8),
    border: element?.border !== false,
    fontSize: clamp(roundToTenth(element?.fontSize ?? base.fontSize ?? 8), 6, 32),
    italic: Boolean(element?.italic ?? base.italic),
    bold: Boolean(element?.bold ?? base.bold),
  };
}

export function normalizeInvoiceElements(elements, companyId = '', templateId = '') {
  const defaultLayout = createInvoiceLayoutFromTemplate(templateId || getDefaultTemplateIdForCompany(companyId), companyId);
  const defaults = defaultLayout.elements;
  const sourceElements = Array.isArray(elements) ? elements : [];
  const normalizedDefaults = defaults.map((fallback) => {
    const found = sourceElements.find((entry) => entry?.id === fallback.id);
    return normalizeInvoiceElement(found, fallback);
  });
  const customElements = sourceElements
    .filter((entry) => entry?.id && !defaults.some((fallback) => fallback.id === entry.id))
    .map((entry, index) => normalizeInvoiceElement(entry, {
      id: entry.id || `custom-${index}`,
      label: entry.label || 'Custom Element',
      type: entry.type || 'text',
      sectionId: entry.sectionId || 'terms',
      x: 12,
      y: 220,
      w: 32,
      h: 12,
      visible: true,
      required: false,
    }));
  return [...normalizedDefaults, ...customElements];
}

export function normalizeInvoiceLayout(layout, companyId = '') {
  const defaultLayout = createInvoiceLayoutFromTemplate(
    layout?.activeCompanyTemplateId
      || layout?.templateId
      || getDefaultTemplateIdForCompany(companyId),
    companyId
  );
  const source = layout && typeof layout === 'object' ? layout : {};
  const sourceSections = Array.isArray(source.sections) ? source.sections : [];

  return {
    templateId: typeof source.templateId === 'string' && source.templateId ? source.templateId : defaultLayout.templateId,
    templateName: typeof source.templateName === 'string' && source.templateName ? source.templateName : defaultLayout.templateName,
    activeCompanyTemplateId: typeof source.activeCompanyTemplateId === 'string' && source.activeCompanyTemplateId
      ? source.activeCompanyTemplateId
      : defaultLayout.activeCompanyTemplateId,
    companyTemplates: { ...COMPANY_TEMPLATE_DEFAULTS, ...(source.companyTemplates || {}) },
    accentColor: typeof source.accentColor === 'string' && source.accentColor ? source.accentColor : defaultLayout.accentColor,
    compactPrint: source.compactPrint !== undefined ? Boolean(source.compactPrint) : defaultLayout.compactPrint,
    showBrandLogos: source.showBrandLogos !== undefined ? Boolean(source.showBrandLogos) : defaultLayout.showBrandLogos,
    emphasizeTotals: source.emphasizeTotals !== undefined ? Boolean(source.emphasizeTotals) : defaultLayout.emphasizeTotals,
    fontFamily: typeof source.fontFamily === 'string' && source.fontFamily ? source.fontFamily : defaultLayout.fontFamily,
    bodyFontSize: clamp(Number(source.bodyFontSize || defaultLayout.bodyFontSize), 6, 14),
    lineCount: clamp(Number(source.lineCount || defaultLayout.lineCount), 10, 40),
    logoScale: clamp(Number(source.logoScale || defaultLayout.logoScale), 40, 180),
    pageMargins: {
      ...DEFAULT_PAGE_MARGINS,
      ...(defaultLayout.pageMargins || {}),
      ...(source.pageMargins || {}),
    },
    grid: {
      ...DEFAULT_GRID,
      ...(defaultLayout.grid || {}),
      ...(source.grid || {}),
    },
    sections: INVOICE_LAYOUT_SECTIONS.map((section) => {
      const found = sourceSections.find((entry) => entry?.id === section.id);
      const fallback = defaultLayout.sections.find((entry) => entry.id === section.id);
      return {
        id: section.id,
        visible: found?.visible !== undefined ? found.visible !== false : fallback?.visible !== false,
      };
    }),
    elements: normalizeInvoiceElements(source.elements, companyId, source.activeCompanyTemplateId || source.templateId),
    templates: Array.isArray(source.templates) && source.templates.length ? source.templates : defaultLayout.templates,
  };
}

export function getInvoiceElement(layout, elementId) {
  return normalizeInvoiceLayout(layout).elements.find((element) => element.id === elementId);
}

export function isSectionVisible(layout, sectionId) {
  return normalizeInvoiceLayout(layout).sections.find((section) => section.id === sectionId)?.visible !== false;
}

export function moveInvoiceLayoutSection(layout, draggedId, targetId, companyId = '') {
  const normalized = normalizeInvoiceLayout(layout, companyId);
  const nextSections = [...normalized.sections];
  const draggedIndex = nextSections.findIndex((section) => section.id === draggedId);
  const targetIndex = nextSections.findIndex((section) => section.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return normalized;
  }
  const [dragged] = nextSections.splice(draggedIndex, 1);
  nextSections.splice(targetIndex, 0, dragged);
  return { ...normalized, sections: nextSections };
}

export function createCustomInvoiceElement(kind) {
  const preset = INVOICE_CUSTOM_ELEMENT_TYPES.find((entry) => entry.id === kind) || INVOICE_CUSTOM_ELEMENT_TYPES[0];
  const seed = Date.now().toString(36);
  const base = {
    id: `${preset.type}-${seed}`,
    type: preset.type,
    label: preset.label,
    sectionId: preset.type === 'divider' ? 'items' : 'terms',
    x: preset.type === 'divider' ? 14 : 20,
    y: preset.type === 'divider' ? 108 : 214,
    w: preset.type === 'divider' ? 110 : preset.type === 'logo' ? 30 : 48,
    h: preset.type === 'divider' ? 4 : preset.type === 'logo' ? 18 : 14,
    visible: true,
    required: false,
    align: preset.type === 'divider' ? 'left' : 'left',
    padding: preset.type === 'divider' ? 0 : 1.4,
    border: preset.type !== 'divider',
    fontSize: preset.type === 'note' ? 7.6 : 8.4,
    italic: preset.type === 'note',
    bold: false,
    text: preset.type === 'note' ? 'Custom note' : preset.type === 'text' ? 'Custom text' : '',
  };
  return normalizeInvoiceElement(base);
}

export function duplicateInvoiceElement(element) {
  return normalizeInvoiceElement({
    ...element,
    id: `${element.id}-copy-${Date.now().toString(36)}`,
    label: `${element.label} Copy`,
    required: false,
    x: clamp(roundToTenth(Number(element.x || 0) + 4), 0, 198),
    y: clamp(roundToTenth(Number(element.y || 0) + 4), 0, 287),
  });
}

export function applyTemplateToLayout(layout, templateId, companyId = '') {
  const normalized = normalizeInvoiceLayout(layout, companyId);
  const fresh = createInvoiceLayoutFromTemplate(templateId, companyId);
  return {
    ...fresh,
    companyTemplates: { ...normalized.companyTemplates },
  };
}
