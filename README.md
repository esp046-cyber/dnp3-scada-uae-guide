# DNP3 UAE SCADA Guide

An offline-capable Progressive Web App for SCADA engineers working on DNP3 systems in Dubai and the UAE. It has 100+ searchable field tips, an IIN decoder, a hex frame inspector with CRC checks, bookmarks and a field checklist. No build tools are needed.

## Files
`index.html`, `style.css`, `script.js`, `manifest.json`, `service-worker.js`, `offline.html`, icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.ico`, `icon.svg`), `assets/og-image.png`, `config/scada-dnp3-presets.json`, `docs/DNP3_UAE_FIELD_MANUAL.md`, `robots.txt`, `sitemap.xml`, `browserconfig.xml`, `LICENSE`, `.gitignore`.

## Publish from an iPhone
1. In the Files app, long-press the downloaded zip and tap **Uncompress**.
2. In Safari open **github.com** and sign in. Tap the menu, then **Request Desktop Website** if buttons are hard to reach.
3. Tap **+ > New repository**. Name it `dnp3-uae-scada-guide`, choose **Public**, then **Create repository**.
4. Tap **uploading an existing file**. Tap **choose your files**, then **Choose Files**, and select every file in the top folder of the unzipped project (include `index.html`, `.png`, `.json`, `.xml`, `.txt`, `.js`, `.css`, `LICENSE` and `README.md`). Add `.gitignore` too if the picker shows hidden files. Tap **Commit changes**.
5. Subfolders: Safari cannot upload folders. Tap **Add file > Create new file**, type `assets/placeholder.txt` in the name box (the slash makes a folder), add any text, and commit. Then open the `assets` folder in the repo, tap **Add file > Upload files** and upload `og-image.png`. Repeat for `config/scada-dnp3-presets.json` and `docs/DNP3_UAE_FIELD_MANUAL.md`, and `assets/icons/icon.svg` if you want it.
6. Go to **Settings > Pages**. Under **Build and deployment** choose **Deploy from a branch**, select branch `main` and folder `/ (root)`, then **Save**.
7. After a minute your site is at `https://YOUR-USERNAME.github.io/dnp3-uae-scada-guide/`.
8. Replace `YOUR-USERNAME` with your GitHub username in `index.html` (four places), `sitemap.xml` and `robots.txt`. Open each file in the repo, tap the pencil icon, edit and commit.

## Install on iPhone
Open the site in Safari, tap **Share > Add to Home Screen**. Open it once online so the service worker can cache everything, then it works offline.

## Updating
Change any file and commit. In `service-worker.js` raise the `CACHE` version (for example `dnp3-scada-uae-v1.0.1`) so devices drop the old cache.

## Disclaimer
Engineering reference only. Always follow the utility's procedures, permit-to-work rules and vendor manuals.

Licensed under the MIT License.
