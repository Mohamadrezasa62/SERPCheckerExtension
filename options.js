const { load, save, normalizeKeywords, normalizeDomain, faNumber, escapeHtml, csvCell, parseCsv, readFileText } = window.RankTracker;
const domainInput = document.getElementById('domain');
const keywordsInput = document.getElementById('keywords');
const editor = document.getElementById('result-editor');
const toast = document.getElementById('toast');
let state;
let toastTimer;
let ready = false;

function showToast(message) {
  toast.textContent = message; toast.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 2400);
}
function currentKeywords() { return normalizeKeywords(keywordsInput.value); }
function updateCount() {
  const count = currentKeywords().length;
  document.getElementById('keyword-total').textContent = `${faNumber(count)} عبارت`;
}
function renderEditor() {
  const keywords = currentKeywords();
  document.getElementById('no-results').classList.toggle('hidden', keywords.length > 0);
  editor.innerHTML = keywords.map((keyword, index) => {
    const result = state.results[keyword] || {};
    const rank = Number(result.rank);
    const rankValue = Number.isFinite(rank) && rank > 0 ? rank : '';
    const checked = result.checkedAt && !Number.isNaN(new Date(result.checkedAt).getTime()) ? new Intl.DateTimeFormat('fa-IR', { month:'short', day:'numeric' }).format(new Date(result.checkedAt)) : '—';
    return `<div class="result-row" data-keyword="${escapeHtml(keyword)}"><div class="result-keyword"><span class="row-index">${faNumber(index + 1)}</span><strong>${escapeHtml(keyword)}</strong></div><label><span>رتبه</span><input class="rank-input" type="number" min="1" max="1000" step="1" inputmode="numeric" placeholder="—" value="${rankValue}"></label><label class="note-label"><span>یادداشت</span><input class="note-input" type="text" maxlength="120" placeholder="مثلاً موبایل، تهران" value="${escapeHtml(result.note || '')}"></label><span class="checked-date">${escapeHtml(checked)}</span></div>`;
  }).join('');
}
function captureResults() {
  const results = {};
  editor.querySelectorAll('.result-row').forEach(row => {
    const keyword = row.dataset.keyword;
    const old = state.results[keyword] || {};
    const rawRank = row.querySelector('.rank-input').value.trim();
    const rank = rawRank ? Number(rawRank) : null;
    const note = row.querySelector('.note-input').value.trim();
    const rankChanged = (rank ?? null) !== (Number(old.rank) || null);
    results[keyword] = { ...(rank ? { rank } : {}), ...(note ? { note } : {}), ...(old.checkedAt ? { checkedAt: old.checkedAt } : {}) };
    if (rankChanged && rank) results[keyword].checkedAt = new Date().toISOString();
    if (rankChanged && !rank) delete results[keyword].checkedAt;
  });
  return results;
}
function refreshEditor() {
  if (!ready) return;
  state.results = { ...state.results, ...captureResults() };
  updateCount(); renderEditor();
  document.getElementById('save-status').textContent = 'تغییرات ذخیره‌نشده';
}

keywordsInput.addEventListener('input', refreshEditor);
domainInput.addEventListener('input', () => { document.getElementById('save-status').textContent = 'تغییرات ذخیره‌نشده'; });
editor.addEventListener('input', () => { document.getElementById('save-status').textContent = 'تغییرات ذخیره‌نشده'; });
document.getElementById('save-settings').addEventListener('click', async () => {
  if (!ready) return;
  const keywords = currentKeywords();
  const results = captureResults();
  const domain = normalizeDomain(domainInput.value);
  if (domainInput.value.trim() && !domain) { showToast('دامنه را به شکل example.ir وارد کن.'); domainInput.focus(); return; }
  if ([...editor.querySelectorAll('.rank-input')].some(input => input.value && (!input.validity.valid || !Number.isInteger(Number(input.value))))) { showToast('رتبه باید عدد صحیح بین ۱ تا ۱۰۰۰ باشد.'); return; }
  try { state = await save({ ...state, domain, keywords, results }); }
  catch { showToast('ذخیره انجام نشد. دوباره امتحان کن.'); return; }
  domainInput.value = state.domain;
  keywordsInput.value = state.keywords.join('\n');
  renderEditor(); updateCount();
  document.getElementById('save-status').textContent = `ذخیره شد · ${new Intl.DateTimeFormat('fa-IR', { hour:'2-digit', minute:'2-digit' }).format(new Date(state.updatedAt))}`;
  showToast('تغییرات ذخیره شد.');
});

document.getElementById('export-csv').addEventListener('click', () => {
  if (!ready) return;
  const keywords = currentKeywords();
  if (!keywords.length) { showToast('برای خروجی گرفتن، ابتدا عبارت اضافه کن.'); return; }
  const results = { ...state.results, ...captureResults() };
  const rows = [['keyword', 'domain', 'rank', 'note', 'checked_at'], ...keywords.map(keyword => { const result = results[keyword] || {}; return [keyword, normalizeDomain(domainInput.value), result.rank || '', result.note || '', result.checkedAt || '']; })];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `rankban-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('فایل CSV آماده شد.');
});

document.getElementById('import-csv').addEventListener('click', () => document.getElementById('csv-file').click());
document.getElementById('csv-file').addEventListener('change', async event => {
  if (!ready) return;
  const file = event.target.files?.[0]; if (!file) return;
  let fileText;
  try { fileText = await readFileText(file); }
  catch { showToast('خواندن فایل انجام نشد. دوباره امتحان کن.'); event.target.value = ''; return; }
  const rows = parseCsv(fileText).filter(row => row.some(cell => cell.trim()));
  if (!rows.length) { showToast('فایل خالی است.'); return; }
  const header = rows[0].map(cell => cell.trim().toLowerCase());
  const hasHeader = header.some(cell => ['keyword', 'عبارت', 'کلمه کلیدی'].includes(cell));
  const start = hasHeader ? 1 : 0;
  const keywordIndex = hasHeader ? Math.max(0, header.findIndex(cell => ['keyword', 'عبارت', 'کلمه کلیدی'].includes(cell))) : 0;
  const domainIndex = hasHeader ? header.findIndex(cell => ['domain', 'دامنه'].includes(cell)) : -1;
  const foundRankIndex = hasHeader ? header.findIndex(cell => ['rank', 'رتبه'].includes(cell)) : 1;
  const foundNoteIndex = hasHeader ? header.findIndex(cell => ['note', 'یادداشت'].includes(cell)) : 2;
  const rankIndex = foundRankIndex >= 0 ? foundRankIndex : -1;
  const noteIndex = foundNoteIndex >= 0 ? foundNoteIndex : -1;
  const importedKeywords = [];
  const importedResults = {};
  const currentResults = { ...state.results, ...captureResults() };
  const timestampIndex = hasHeader ? header.indexOf('checked_at') : -1;
  rows.slice(start).forEach(row => {
    const keyword = String(row[keywordIndex] || '').trim(); if (!keyword) return;
    importedKeywords.push(keyword);
    const rankText = rankIndex >= 0 ? String(row[rankIndex] || '').trim() : '';
    const rank = Number(rankText.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))));
    const note = noteIndex >= 0 ? String(row[noteIndex] || '').trim() : '';
    const checkedAt = timestampIndex >= 0 && !Number.isNaN(Date.parse(row[timestampIndex])) ? row[timestampIndex] : new Date().toISOString();
    if (Number.isInteger(rank) && rank > 0 && rank <= 1000) importedResults[keyword] = { rank, ...(note ? { note } : {}), checkedAt };
    else if (note) importedResults[keyword] = { note };
    const domain = domainIndex >= 0 ? String(row[domainIndex] || '').trim() : '';
    if (!domainInput.value.trim() && domain) domainInput.value = domain;
  });
  const merged = normalizeKeywords([...currentKeywords(), ...importedKeywords]);
  const domain = normalizeDomain(domainInput.value);
  if (domainInput.value.trim() && !domain) { showToast('دامنه‌ی CSV معتبر نیست.'); event.target.value = ''; return; }
  const results = Object.fromEntries(merged.map(keyword => [keyword, importedResults[keyword] || currentResults[keyword] || {}]));
  try { state = await save({ ...state, domain, keywords: merged, results }); }
  catch { showToast('ذخیره‌ی CSV انجام نشد.'); event.target.value = ''; return; }
  domainInput.value = state.domain; keywordsInput.value = merged.join('\n');
  updateCount(); renderEditor(); showToast(`${faNumber(importedKeywords.length)} عبارت از CSV وارد شد.`); event.target.value = '';
});

load().then(loaded => {
  state = loaded; domainInput.value = state.domain; keywordsInput.value = state.keywords.join('\n');
  updateCount(); renderEditor(); ready = true;
}).catch(() => showToast('خواندن داده‌ها انجام نشد. صفحه را دوباره باز کن.'));
