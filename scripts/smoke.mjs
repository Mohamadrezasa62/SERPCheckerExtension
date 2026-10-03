import assert from 'node:assert/strict';

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9229';
async function connect(url) {
  const target = await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then(r => r.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let id = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
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
  return { evaluate, errors, reload: () => send('Page.reload'), close: () => socket.close() };
}
async function waitFor(page, expression) {
  for (let i = 0; i < 40; i++) {
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
await waitFor(options, `document.querySelector('#domain') && window.RankTracker && typeof ready !== 'undefined' && ready`);
await options.evaluate(`chrome.storage.local.clear()`);
await options.reload();
await waitFor(options, `document.querySelector('#domain') && window.RankTracker && typeof ready !== 'undefined' && ready`);
assert.equal(await options.evaluate(`document.querySelector('#domain').value`), '');
await options.evaluate(`(() => {
  const set = (selector, value) => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  set('#domain', 'https://www.example.ir/path');
  set('#keywords', 'first keyword\\nsecond keyword');
  set('.result-row:first-child .rank-input', '7');
  set('.result-row:first-child .note-input', 'desktop');
  document.querySelector('#save-settings').click();
})()`);
await waitFor(options, `document.querySelector('#save-status').textContent.includes('ذخیره شد')`);
assert.equal(await options.evaluate(`document.querySelectorAll('.result-row').length`), 2);
assert.equal(await options.evaluate(`document.querySelector('.rank-input').value`), '7');

const popup = await connect(`chrome-extension://${extensionId}/popup.html`);
await waitFor(popup, `document.querySelector('#site-label')?.textContent === 'example.ir'`);
assert.equal(await popup.evaluate(`document.querySelectorAll('.keyword-row').length`), 2);
assert.match(await popup.evaluate(`document.querySelector('#ranked-count').textContent`), /۱/);

await options.evaluate(`(() => {
  const input = document.querySelector('#keywords');
  input.value += '\\nthird keyword'; input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('.result-row:last-child .rank-input').value = '12';
  document.querySelector('#save-settings').click();
})()`);
await waitFor(options, `document.querySelector('#save-status').textContent.includes('ذخیره شد')`);
assert.equal(await options.evaluate(`document.querySelectorAll('.result-row').length`), 3);
assert.equal(await options.evaluate(`document.querySelector('.result-row:last-child .rank-input').value`), '12');

await options.evaluate(`(() => {
  const input = document.querySelector('#csv-file');
  const file = new File(['keyword,rank,note\\n"quoted, keyword",4,"mobile, Tehran"\\n'], 'sample.csv', { type: 'text/csv' });
  const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await waitFor(options, `document.querySelectorAll('.result-row').length === 4`);
assert.equal(await options.evaluate(`[...document.querySelectorAll('.result-row')].find(row => row.dataset.keyword === 'quoted, keyword')?.querySelector('.rank-input').value`), '4');
await options.evaluate(`(() => {
  const create = URL.createObjectURL;
  URL.createObjectURL = blob => { window.exportedCsv = blob.text(); return create.call(URL, blob); };
  document.querySelector('#export-csv').click();
})()`);
const exported = await options.evaluate(`window.exportedCsv`);
assert.match(exported, /"quoted, keyword","example.ir","4","mobile, Tehran"/);
assert.match(exported, /"first keyword","example.ir","7","desktop"/);
await options.evaluate(`(() => {
  const input = document.querySelector('#csv-file');
  const file = new File(['plain one\\nplain two\\n'], 'plain.csv', { type: 'text/csv' });
  const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await waitFor(options, `document.querySelectorAll('.result-row').length === 6`);
assert.equal(await options.evaluate(`document.querySelectorAll('.result-row').length`), 6);
assert.deepEqual(options.errors, []);
assert.deepEqual(popup.errors, []);
options.close(); popup.close();
console.log(`Browser smoke checks passed for extension ${extensionId}`);
