const { load, faNumber, escapeHtml } = window.RankTracker;
const list = document.getElementById('keyword-list');

function relativeDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(date);
}
function openOptions() { chrome.runtime.openOptionsPage(); }
document.getElementById('open-options').addEventListener('click', openOptions);
document.getElementById('empty-options').addEventListener('click', openOptions);
document.getElementById('add-keyword').addEventListener('click', openOptions);

load().then(state => {
  document.getElementById('site-label').textContent = state.domain || 'دامنه تنظیم نشده';
  document.getElementById('keyword-count').textContent = faNumber(state.keywords.length);
  document.getElementById('ranked-count').textContent = faNumber(state.keywords.filter(k => Number.isFinite(Number(state.results[k]?.rank)) && Number(state.results[k]?.rank) > 0).length);
  document.getElementById('updated-at').textContent = relativeDate(state.updatedAt);
  document.getElementById('empty-state').classList.toggle('hidden', state.keywords.length > 0);
  if (!state.keywords.length) return;
  list.innerHTML = state.keywords.slice(0, 7).map(keyword => {
    const result = state.results[keyword] || {};
    const rank = Number(result.rank);
    const rankText = Number.isFinite(rank) && rank > 0 ? `رتبه ${faNumber(rank)}` : 'ثبت نشده';
    return `<article class="keyword-row"><div class="keyword-info"><strong title="${escapeHtml(keyword)}">${escapeHtml(keyword)}</strong><span>${escapeHtml(result.checkedAt ? relativeDate(result.checkedAt) : 'بدون نتیجه')}</span></div><span class="rank-badge ${rank > 0 ? 'has-rank' : ''}">${rankText}</span></article>`;
  }).join('');
  if (state.keywords.length > 7) list.insertAdjacentHTML('beforeend', `<button class="view-all" id="view-all">مشاهده‌ی همه‌ی ${faNumber(state.keywords.length)} عبارت ←</button>`);
  document.getElementById('view-all')?.addEventListener('click', openOptions);
});
