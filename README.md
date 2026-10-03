# SERP Checker Extension

A lightweight Chrome extension that checks where your website appears for a list of keywords and saves the results. Version 0.2 uses the [Serper Google Search API](https://serper.dev/) to retrieve organic search results. You supply your own Serper API key.

## What it does

- Checks keywords automatically when you select **Save and check ranks**.
- Finds the highest organic position whose result URL is on your domain or one of its subdomains.
- Saves each keyword's position, matching URL, check time, and status in Chrome local storage.
- Shows progress and results in a Persian right-to-left interface.
- Imports keyword lists from CSV and exports the saved results to CSV.
- Lets you choose the search country and language. The default is Iran and Persian.

The position comes from Serper's returned organic results. It can differ from what a person sees on Google because search results vary by location, device, time, and provider coverage. A “not found” result means the domain was absent from the **returned organic results**; the extension reports how many results were checked. It does not mean the site has no Google ranking at all.

## Install in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. If a previous version is already loaded, select its **Reload** button.

## How to use

1. Create a Serper account and copy its API key from [serper.dev](https://serper.dev/).
2. Open the extension and select the gear icon or **Add** to open settings.
3. Enter your website domain, for example `example.ir`.
4. Enter the API key. Choose the search country and language.
5. Add one keyword phrase per line, or import a CSV file.
6. Select **Save and check ranks**. Keep the settings page open while the checks run.
7. Read the saved positions in settings or the popup. Select **Export CSV** to download the results.

The extension requests one search at a time and saves each result as it arrives. If the API rejects the key or reaches a request limit, the run stops and displays the error. Selecting **Save and check ranks** again starts a new run for the current list.

## CSV

The importer accepts one keyword per line, or a CSV with a `keyword`, `عبارت`, or `کلمه کلیدی` column. A `domain` or `دامنه` column can fill an empty domain field. Example:

```csv
keyword,domain
خرید کفش,example.ir
best running shoes,example.ir
```

The export contains `keyword`, `domain`, `rank`, `status`, `url`, and `checked_at`. Existing manually entered ranks from version 0.1 can still be displayed until the next automatic check replaces them.

## Privacy and API use

- The extension sends each keyword, country, and language to Serper to request a search result. The API key is sent to Serper in the `X-API-KEY` request header.
- The key, domain, keywords, and results are stored in `chrome.storage.local` in your Chrome profile. Chrome local extension storage is not encrypted by this extension.
- The extension requests access only to `https://google.serper.dev/*` and Chrome's `storage` permission.
- Serper may meter or charge for API calls under your account. Each run requests one search per keyword until completion or a blocking API error.

## Browser smoke check

On Windows with Chrome installed, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-smoke.ps1
```

The script loads the extension in an isolated headless Chrome profile and uses mocked Serper responses. It checks saving, domain matching, found and missing positions, popup display, CSV import/export, and API authentication errors. It does not use real API credits. Pass `-ChromePath` if Chrome is installed elsewhere.

## Project files

- `manifest.json` — Manifest V3 configuration and permissions.
- `popup.html`, `popup.js` — toolbar summary.
- `options.html`, `options.js` — settings, progress, and results.
- `common.js` — local storage and CSV helpers.
- `serp.js` — Serper request and domain matching.
- `styles.css` — Persian interface styles.
