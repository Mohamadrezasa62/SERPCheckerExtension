import assert from 'node:assert/strict';

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9229';
async function connect(url) {
  const target = await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then(r => r.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let id = 0;
  let onEvent = () => {};
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method) onEvent(message);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id); pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    }
  };
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id; pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  await send('Runtime.enable');
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  return { evaluate, send, errors, reload: () => send('Page.reload'), setEventHandler: handler => { onEvent = handler; }, close: () => socket.close() };
}
async function waitFor(page, expression) {
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${expression}`);
}

const extensions = await connect('chrome://extensions');
await waitFor(extensions, `document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-item-list')?.shadowRoot?.querySelector('extensions-item')?.id`);
const extensionId = await extensions.evaluate(`document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item').id`);
extensions.close();

const options = await connect(`chrome-extension://${extensionId}/options.html`);
await waitFor(options, `window.SerpChecker && document.querySelector('#api-key') && typeof state !== 'undefined' && state`);
await options.evaluate(`chrome.storage.local.clear()`);
await options.reload();
await waitFor(options, `window.SerpChecker && typeof state !== 'undefined' && state`);

let calls = 0;
options.setEventHandler(message => {
  if (message.method !== 'Fetch.requestPaused') return;
  calls++;
  const badKey = Object.entries(message.params.request.headers).some(([name, value]) => name.toLowerCase() === 'x-api-key' && value === 'bad-key');
  if (badKey) {
    options.send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 401,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from('{}').toString('base64') }).catch(console.error);
    return;
  }
  const keyword = JSON.parse(message.params.request.postData).q;
  const organic = keyword === 'missing keyword' ? [
    { link: 'https://other.example/page', position: 1 }
  ] : [
    { link: 'https://unrelated.example/page', position: 1 },
    { link: 'https://www.example.ir/page', position: keyword === 'first keyword' ? 7 : 4 }
  ];
  const body = Buffer.from(JSON.stringify({ organic })).toString('base64');
  options.send('Fetch.fulfillRequest', {
    requestId: message.params.requestId, responseCode: 200,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body
  }).catch(error => { throw error; });
});
await options.send('Fetch.enable', { patterns: [{ urlPattern: 'https://google.serper.dev/*' }] });
await options.evaluate(`(() => {
  const set = (selector, value) => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  set('#domain', 'https://www.example.ir/path');
  set('#keywords', 'first keyword\\nmissing keyword');
  set('#api-key', 'test-key');
  document.querySelector('#save-settings').click();
})()`);
await waitFor(options, `document.querySelector('#save-status').textContent.includes('۲ از ۲') && !document.querySelector('#save-settings').disabled`);
assert.equal(calls, 2);
const saved = await options.evaluate(`chrome.storage.local.get('rankTrackerState').then(data => data.rankTrackerState)`);
assert.equal(saved.domain, 'example.ir');
assert.equal(saved.results['first keyword'].rank, 7);
assert.equal(saved.results['first keyword'].status, 'found');
assert.equal(saved.results['missing keyword'].status, 'not_found');

const popup = await connect(`chrome-extension://${extensionId}/popup.html`);
await waitFor(popup, `document.querySelector('#site-label')?.textContent === 'example.ir'`);
assert.equal(await popup.evaluate(`document.querySelectorAll('.keyword-row').length`), 2);
assert.match(await popup.evaluate(`document.querySelector('#ranked-count').textContent`), /۱/);
assert.match(await popup.evaluate(`document.querySelector('.keyword-list').textContent`), /پیدا نشد/);

await options.evaluate(`(() => {
  const input = document.querySelector('#keywords');
  input.value += '\\nthird keyword'; input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#save-settings').click();
})()`);
await waitFor(options, `document.querySelector('#save-status').textContent.includes('۳ از ۳') && !document.querySelector('#save-settings').disabled`);
assert.equal(calls, 5);
assert.equal(await options.evaluate(`chrome.storage.local.get('rankTrackerState').then(data => data.rankTrackerState.results['third keyword'].rank)`), 4);

await options.evaluate(`(() => {
  const create = URL.createObjectURL;
  URL.createObjectURL = blob => { window.exportedCsv = blob.text(); return create.call(URL, blob); };
  document.querySelector('#export-csv').click();
})()`);
const exported = await options.evaluate(`window.exportedCsv`);
assert.match(exported, /"first keyword","example.ir","7","found"/);
assert.match(exported, /"missing keyword","example.ir","","not_found"/);

await options.evaluate(`(() => {
  const input = document.querySelector('#csv-file');
  const file = new File(['plain one\\nplain two\\n'], 'plain.csv', { type: 'text/csv' });
  const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await waitFor(options, `document.querySelectorAll('.result-row').length === 5`);
assert.equal(await options.evaluate(`document.querySelectorAll('.result-row').length`), 5);
assert.equal(await options.evaluate(`window.SerpChecker.matchesDomain('https://example.ir.evil.test/page', 'example.ir')`), false);
assert.equal(await options.evaluate(`window.SerpChecker.matchesDomain('https://blog.example.ir/page', 'example.ir')`), true);
await options.evaluate(`(() => {
  const input = document.querySelector('#api-key'); input.value = 'bad-key';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#save-settings').click();
})()`);
await waitFor(options, `document.querySelector('#save-status').textContent.includes('۱ از ۵') && !document.querySelector('#save-settings').disabled`);
assert.equal(calls, 6);
assert.equal(await options.evaluate(`chrome.storage.local.get('rankTrackerState').then(data => data.rankTrackerState.results['first keyword'].status)`), 'error');
assert.deepEqual(options.errors, []);
assert.deepEqual(popup.errors, []);
options.close(); popup.close();
console.log(`Automatic ranking browser checks passed for extension ${extensionId}`);
