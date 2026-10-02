(() => {
  const KEY = 'rankTrackerState';
  const defaults = { domain: '', keywords: [], results: {}, updatedAt: null };
  function normalizeDomain(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
      return url.hostname.toLowerCase().replace(/^www\./, '');
    } catch { return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; }
  }
  function normalizeKeywords(value) {
    const lines = Array.isArray(value) ? value : String(value || '').split(/[\r\n,;]+/);
    const seen = new Set();
    return lines.map(item => String(item).trim().replace(/\s+/g, ' ')).filter(item => {
      const key = item.toLocaleLowerCase('fa');
      if (!item || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function load() {
    return new Promise(resolve => chrome.storage.local.get(KEY, data => {
      const stored = data && data[KEY] ? data[KEY] : {};
      resolve({ ...defaults, ...stored, domain: normalizeDomain(stored.domain), keywords: normalizeKeywords(stored.keywords), results: stored.results || {} });
    }));
  }
  function save(state) {
    const next = { ...state, domain: normalizeDomain(state.domain), keywords: normalizeKeywords(state.keywords), updatedAt: new Date().toISOString() };
    return new Promise(resolve => chrome.storage.local.set({ [KEY]: next }, () => resolve(next)));
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
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && input[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  window.RankTracker = { load, save, normalizeDomain, normalizeKeywords, faNumber, escapeHtml, csvCell, parseCsv };
})();
