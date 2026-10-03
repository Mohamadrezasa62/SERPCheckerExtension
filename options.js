const { load, save, normalizeKeywords, normalizeDomain, faNumber, escapeHtml, csvCell, parseCsv, readFileText } = window.RankTracker;
const { checkKeyword } = window.SerpChecker;
const domainInput = document.getElementById('domain');
const keywordsInput = document.getElementById('keywords');
const apiKeyInput = document.getElementById('api-key');
const countryInput = document.getElementById('country');
const languageInput = document.getElementById('language');
const editor = document.getElementById('result-editor');
const saveButton = document.getElementById('save-settings');
const statusLabel = document.getElementById('save-status');
const toast = document.getElementById('toast');
let state;
let running = false;
let toastTimer;

function showToast(message) {
  toast.textContent = message; toast.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}
function currentKeywords() { return normalizeKeywords(keywordsInput.value); }
function dateLabel(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date) : '—';
}
function updateCount() { document.getElementById('keyword-total').textContent = `${faNumber(currentKeywords().length)} عبارت`; }
function renderResults() {
  const keywords = currentKeywords();
  document.getElementById('no-results').classList.toggle('hidden', keywords.length > 0);
  editor.innerHTML = keywords.map((keyword, index) => {
    const result = state.results[keyword] || {};
    let label = 'بررسی نشده';
    if (result.status === 'checking') label = 'در حال بررسی…';
    else if (result.status === 'found') label = `رتبه ${faNumber(result.rank)}`;
    else if (result.status === 'not_found') label = `در ${faNumber(result.searchedCount || 0)} نتیجه‌ی بررسی‌شده پیدا نشد`;
    else if (result.status === 'error') label = result.error || 'خطا در بررسی';
    else if (result.status === 'interrupted') label = 'بررسی ناتمام؛ دوباره اجرا کن';
    else if (Number.isInteger(Number(result.rank)) && Number(result.rank) > 0) label = `رتبه‌ی قبلی: ${faNumber(result.rank)}`;
    const url = result.url && /^https?:\/\//.test(result.url) ? `<a href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">صفحه‌ی پیدا شده</a>` : '';
    return `<div class="result-row auto-result"><div class="result-keyword"><span class="row-index">${faNumber(index + 1)}</span><strong>${escapeHtml(keyword)}</strong></div><span class="result-status ${result.status === 'found' ? 'found' : ''}">${escapeHtml(label)}</span><span class="checked-date">${escapeHtml(dateLabel(result.checkedAt))}</span>${url}</div>`;
  }).join('');
}
function markDirty() { if (!running) statusLabel.textContent = 'تغییرات ذخیره‌نشده'; }
keywordsInput.addEventListener('input', () => { if (state) { updateCount(); renderResults(); markDirty(); } });
[domainInput, apiKeyInput, countryInput, languageInput].forEach(input => input.addEventListener('input', markDirty));

saveButton.addEventListener('click', async () => {
  if (running || !state) return;
  const domain = normalizeDomain(domainInput.value);
  const keywords = currentKeywords();
  const apiKey = apiKeyInput.value.trim();
  if (!domain) { showToast('یک دامنه‌ی معتبر مانند example.ir وارد کن.'); domainInput.focus(); return; }
  if (!keywords.length) { showToast('حداقل یک عبارت وارد کن.'); keywordsInput.focus(); return; }
  if (!apiKey) { showToast('برای بررسی خودکار، کلید Serper API را وارد کن.'); apiKeyInput.focus(); return; }
  const country = countryInput.value;
  const language = languageInput.value;
  const sameSearch = state.domain === domain && state.country === country && state.language === language;
  const results = Object.fromEntries(keywords.map(keyword => [keyword, sameSearch ? state.results[keyword] || {} : {}]));
  try { state = await save({ ...state, domain, keywords, apiKey, country, language, results }); }
  catch { showToast('ذخیره‌ی تنظیمات انجام نشد.'); return; }
  keywordsInput.value = keywords.join('\n'); domainInput.value = domain;
  running = true; saveButton.disabled = true; renderResults();
  let completed = 0;
  try {
    for (const keyword of keywords) {
      statusLabel.textContent = `بررسی ${faNumber(completed + 1)} از ${faNumber(keywords.length)}: ${keyword}`;
      state.results[keyword] = { ...state.results[keyword], status: 'checking' };
      renderResults();
      try { state.results[keyword] = await checkKeyword({ keyword, domain, apiKey, country, language }); }
      catch (error) { state.results[keyword] = { status: 'error', error: error.message || 'خطا در ارتباط با سرویس', checkedAt: new Date().toISOString() }; }
      completed++; state = await save(state); renderResults();
      const result = state.results[keyword];
      if (result.status === 'error' && /کلید API|محدودیت درخواست/.test(result.error)) { showToast(result.error); break; }
    }
    statusLabel.textContent = `بررسی ${faNumber(completed)} از ${faNumber(keywords.length)} عبارت انجام شد`;
  } catch { statusLabel.textContent = 'ذخیره‌ی نتیجه انجام نشد؛ دوباره تلاش کن.'; showToast('ذخیره‌ی نتیجه انجام نشد.'); }
  finally { running = false; saveButton.disabled = false; renderResults(); }
});

document.getElementById('export-csv').addEventListener('click', () => {
  if (!state) return;
  const keywords = currentKeywords();
  if (!keywords.length) { showToast('برای خروجی گرفتن، ابتدا عبارت اضافه کن.'); return; }
  const rows = [['keyword', 'domain', 'rank', 'status', 'url', 'checked_at'], ...keywords.map(keyword => {
    const result = state.results[keyword] || {};
    return [keyword, normalizeDomain(domainInput.value), result.rank || '', result.status || '', result.url || '', result.checkedAt || ''];
  })];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `serp-ranks-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('فایل CSV آماده شد.');
});

document.getElementById('import-csv').addEventListener('click', () => document.getElementById('csv-file').click());
document.getElementById('csv-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file || running || !state) return;
  try {
    const rows = parseCsv(await readFileText(file)).filter(row => row.some(cell => cell.trim()));
    if (!rows.length) throw new Error('فایل CSV خالی است.');
    const header = rows[0].map(cell => cell.trim().toLowerCase());
    const keywordIndex = header.findIndex(cell => ['keyword', 'عبارت', 'کلمه کلیدی'].includes(cell));
    const domainIndex = header.findIndex(cell => ['domain', 'دامنه'].includes(cell));
    const data = keywordIndex >= 0 ? rows.slice(1) : rows;
    const imported = data.map(row => String(row[keywordIndex >= 0 ? keywordIndex : 0] || '').trim()).filter(Boolean);
    if (!imported.length) throw new Error('عبارتی در فایل پیدا نشد.');
    keywordsInput.value = normalizeKeywords([...currentKeywords(), ...imported]).join('\n');
    if (!domainInput.value.trim() && domainIndex >= 0) domainInput.value = data.find(row => row[domainIndex])?.[domainIndex] || '';
    updateCount(); renderResults(); markDirty();
    showToast(`${faNumber(imported.length)} عبارت وارد شد. برای بررسی، ذخیره را بزن.`);
  } catch (error) { showToast(error.message || 'خواندن CSV انجام نشد.'); }
  finally { event.target.value = ''; }
});

load().then(loaded => {
  state = loaded; domainInput.value = state.domain; keywordsInput.value = state.keywords.join('\n');
  for (const result of Object.values(state.results)) if (result.status === 'checking') result.status = 'interrupted';
  apiKeyInput.value = state.apiKey || ''; countryInput.value = state.country || 'ir'; languageInput.value = state.language || 'fa';
  updateCount(); renderResults();
}).catch(() => showToast('خواندن داده‌ها انجام نشد. صفحه را دوباره باز کن.'));
