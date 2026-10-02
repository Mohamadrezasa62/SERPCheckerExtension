# SERP Checker Extension

A lightweight Google Chrome extension for organizing the keywords you want to track and recording their search rankings. Keep a keyword list for your website, add rank observations and notes, and import or export your data as a CSV file.

> **Current version:** This first milestone is a local keyword and rank tracker. It does not automatically search Google or collect live SERP rankings. Enter rank observations manually. Search Console or another permitted ranking data source can be added in a later milestone.

## Features

- Save your website domain and target keywords locally in Chrome.
- Add keywords one per line; duplicate entries are removed automatically.
- Record a rank and an optional note for each keyword.
- Import keywords and rank observations from CSV.
- Export your keyword list, domain, ranks, notes, and observation dates to CSV.
- Use the extension UI in Persian with right-to-left layout.
- No application server or JavaScript runtime library is required.

Your project data is stored in Chrome's local extension storage and is not sent to a SERP service. The interface may request Google Fonts for its typeface; system fonts are used if they are unavailable.

## Install in Chrome

This project is not packaged in the Chrome Web Store. Load it locally as an unpacked extension:

1. Download or clone this repository to your computer.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project folder containing `manifest.json`.
6. Pin the extension from Chrome's Extensions menu if you want it readily available in the toolbar.

## How to use

1. Select the **SERP Checker** icon in the Chrome toolbar.
2. Choose the gear icon or **Add** to open project settings.
3. Enter your website domain, such as `example.com` or `example.ir`.
4. Add your target keywords in the keyword box, one phrase per line.
5. Select **Save changes**.
6. In **Record ranks**, enter a rank for each keyword and an optional note, such as the device, location, or check context. Select **Save changes** to store your edits.
7. Open the extension popup to see a summary of your keyword list and saved ranks.

Ranks in this milestone are user-entered observations. The extension does not open Google result pages or perform automated searches.

## Import and export CSV

From project settings, select **Import CSV** and choose a `.csv` file. A header row is supported. Column names can be in English or Persian:

```csv
keyword,domain,rank,note
best running shoes,example.com,8,Mobile check
خرید کفش,example.com,12,بررسی دستی
```

The importer also accepts a simple CSV without a header, with the keyword in the first column. When a header is present, recognized columns include `keyword` / `عبارت`, `domain` / `دامنه`, `rank` / `رتبه`, and `note` / `یادداشت`.

Select **Export CSV** to download the current keyword list, domain, rank, note, and rank observation timestamp.

## Privacy

- Keyword lists and rank observations are stored with `chrome.storage.local` on the current Chrome profile.
- The extension does not currently contact Google Search or send your project data to an external ranking service.
- The manifest requests only Chrome's `storage` permission.

## Project files

- `manifest.json` — Chrome Manifest V3 configuration.
- `popup.html`, `popup.js` — toolbar popup and keyword summary.
- `options.html`, `options.js` — domain, keyword, rank, and CSV settings.
- `common.js` — local storage, input normalization, and CSV helpers.
- `styles.css` — Persian right-to-left interface styles.

## Roadmap

- Connect an authorized ranking data source, such as Google Search Console, for search performance data.
- Compare observations across dates and show ranking trends.
- Add optional location and device dimensions when supported by the selected data source.

Google Search Console reports search performance data such as clicks, impressions, click-through rate, and average position. Average position is not the same as a live, location-specific rank for a single search. The data source and metric should be clearly identified in any future automatic ranking feature.
