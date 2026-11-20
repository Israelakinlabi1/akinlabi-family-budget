# Akinlabi Family Budget

A phone budgeting app for Israel and Kehinde. Type or speak what you bought ("Walmart today, rice, eggs, milk and motor oil, total 64.30"), check it, and save. Each entry is labelled with who added it. Entries sync between both phones through a Google Sheet in our own Google account.

- No Claude or other AI service. Sorting into categories happens on the phone.
- Works offline. Entries wait on the phone and sync when the internet is back.
- Voice uses the phone's own speech recognition. If the Speak button doesn't work, the microphone key on the keyboard always does.
- The money data lives only in our Google Sheet, not in this repository.

## One-time setup (about 10 minutes, on a computer)

1. Create a new Google Sheet named **Akinlabi Family Budget**.
2. In the sheet, open **Extensions > Apps Script**. Delete what is there and paste everything from [`apps-script/Code.gs`](apps-script/Code.gs).
3. On line 14, change `'CHANGE-ME'` to your own family code (a phrase only the two of you know, such as `'Akin-Home-2026'`). Click **Save**.
4. Click **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then **Authorize access** and choose your Google account.
   - Google may say "Google hasn't verified this app". This is your own script: click **Advanced**, then **Go to … (unsafe)**, then **Allow**.
5. Copy the **Web app URL** (it ends in `/exec`).

## On each phone

1. Open the app link in **Safari** (iPhone) or **Chrome** (Android).
2. Tap your name.
3. Paste the Web app URL and type the family code, then tap **Connect**.
4. Add it to the home screen:
   - iPhone: Share button, then **Add to Home Screen**.
   - Android: ⋮ menu, then **Add to Home screen** or **Install app**.

## Changing the script later

If you edit `Code.gs`, use **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**. That keeps the same URL.

## Files

- `index.html`, `app.js`: the app screens and logic
- `parse.js`: turns a sentence into entries (stores, categories, amounts, dates, spoken numbers)
- `sw.js`, `manifest.webmanifest`, `icons/`: let it install on the home screen and open offline
- `apps-script/Code.gs`: the sync service that lives in your Google Sheet

Names are set at the top of `app.js` (`PEOPLE`).
