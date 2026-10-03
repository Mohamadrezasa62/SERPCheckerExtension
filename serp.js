(() => {
  const ENDPOINT = 'https://google.serper.dev/search';

  function matchesDomain(link, domain) {
    try {
      const url = new URL(link);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      return (url.protocol === 'https:' || url.protocol === 'http:') && (host === domain || host.endsWith(`.${domain}`));
    } catch { return false; }
  }

  async function checkKeyword({ keyword, domain, apiKey, country, language, fetchImpl = fetch }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: keyword, gl: country, hl: language, num: 100 }),
        signal: controller.signal
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('کلید API معتبر نیست یا دسترسی ندارد.');
      if (response.status === 429) throw new Error('محدودیت درخواست یا اعتبار API تمام شده است.');
      throw new Error(`خطای سرویس SERP (${response.status})`);
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error('پاسخ سرویس SERP معتبر نیست.'); }
    if (!Array.isArray(payload.organic)) throw new Error('نتایج ارگانیک در پاسخ سرویس موجود نیست.');
    const organic = payload.organic;
    const match = organic.filter(item => matchesDomain(item.link, domain))
      .sort((a, b) => Number(a.position) - Number(b.position))[0];
    const checkedAt = new Date().toISOString();
    if (!match) return { status: 'not_found', checkedAt, searchedCount: organic.length };
    const position = Number(match.position);
    if (!Number.isInteger(position) || position < 1) throw new Error('جایگاه نتیجه در پاسخ سرویس معتبر نیست.');
    return { status: 'found', rank: position, url: match.link, checkedAt, searchedCount: organic.length };
  }

  window.SerpChecker = { matchesDomain, checkKeyword };
})();
