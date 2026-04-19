// Centralized export helpers for reports.
// CSV is RFC-4180 style, quote fields that contain comma/quote/newline.

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCSV(rows, headers) {
  if (!rows || !rows.length) return '';
  const cols = headers && headers.length ? headers : Object.keys(rows[0]);
  const headerLine = cols.map(escapeCsvField).join(',');
  const body = rows
    .map((r) => cols.map((c) => escapeCsvField(typeof r[c] === 'number' ? r[c] : r[c] ?? '')).join(','))
    .join('\n');
  return `${headerLine}\n${body}`;
}

export function downloadCSV(filename, rows, headers) {
  const csv = rowsToCSV(rows, headers);
  const bom = '\uFEFF'; // Excel UTF-8
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function printReport() {
  window.print();
}

export function fmtDate(d) {
  try { return d ? new Date(d).toISOString().slice(0, 10) : ''; } catch { return d || ''; }
}

export function money(v) {
  return Number(v || 0).toFixed(2);
}
