(() => {
  const KEY = 'rankTrackerState';
  const defaults = { domain: '', keywords: [], results: {}, updatedAt: null };
  function normalizeDomain(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !url.hostname.includes('.')) return '';
      return url.hostname.toLowerCase().replace(/^www\./, '');
    } catch { return ''; }
  }
  function normalizeKeywords(value) {
    const lines = Array.isArray(value) ? value : String(value || '').split(/\r?\n|\r/);
    const seen = new Set();
    return lines.map(item => String(item).trim().replace(/\s+/g, ' ')).filter(item => {
      const key = item.toLocaleLowerCase('fa');
      if (!item || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function load() {
    return new Promise((resolve, reject) => chrome.storage.local.get(KEY, data => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      const stored = data && data[KEY] ? data[KEY] : {};
      resolve({ ...defaults, ...stored, domain: normalizeDomain(stored.domain), keywords: normalizeKeywords(stored.keywords), results: stored.results || {} });
    }));
  }
  function save(state) {
    const next = { ...state, domain: normalizeDomain(state.domain), keywords: normalizeKeywords(state.keywords), updatedAt: new Date().toISOString() };
    return new Promise((resolve, reject) => chrome.storage.local.set({ [KEY]: next }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(next);
    }));
  }
  function faNumber(value) { return new Intl.NumberFormat('fa-IR').format(value); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function csvCell(value) { const text = String(value ?? ''); return `"${text.replace(/"/g, '""')}"`; }
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    const input = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quoted && ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"' && (quoted || cell === '')) quoted = !quoted;
      else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && input[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read the selected file.'));
      reader.readAsText(file);
    });
  }
  window.RankTracker = { load, save, normalizeDomain, normalizeKeywords, faNumber, escapeHtml, csvCell, parseCsv, readFileText };
})();
