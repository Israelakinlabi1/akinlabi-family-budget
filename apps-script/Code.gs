/**
 * Akinlabi Family Budget — sync service for your Google Sheet.
 *
 * 1. Change FAMILY_CODE below to your own secret phrase (letters and numbers).
 *    You and Kehinde type the same phrase into the app once.
 * 2. Deploy > New deployment > Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 3. Copy the Web app URL into the app's Settings.
 *
 * The app sends entries here; this script stores them in the "Entries" tab
 * and monthly limits in the "Limits" tab of this spreadsheet.
 */
const FAMILY_CODE = 'CHANGE-ME';

const HEAD = ['Date', 'Who', 'Type', 'Store', 'Category', 'Amount', 'Items', 'Note', 'ID', 'Created', 'Updated', 'Deleted'];
const C = { date: 0, who: 1, type: 2, store: 3, category: 4, amount: 5, items: 6, note: 7, id: 8, created: 9, updated: 10, deleted: 11 };

function doGet() {
  return out_({ ok: true, app: 'Akinlabi Family Budget', message: 'The sync service is running. Open the budget app to use it.' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_request' }); }
  if (FAMILY_CODE === 'CHANGE-ME') return out_({ ok: false, error: 'code_not_set' });
  if (String(req.code || '') !== FAMILY_CODE) return out_({ ok: false, error: 'wrong_code' });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out_({ ok: false, error: 'busy' });
  try {
    const sh = entriesSheet_();
    if (Array.isArray(req.changes) && req.changes.length) upsert_(sh, req.changes.slice(0, 500));
    if (req.limits && typeof req.limits === 'object') setLimits_(req.limits);
    return out_({ ok: true, entries: readAll_(sh), limits: getLimits_(), time: Date.now() });
  } catch (err) {
    return out_({ ok: false, error: 'server', detail: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function entriesSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Entries');
  if (!sh) {
    sh = ss.insertSheet('Entries', 0);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#eafaf2');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('$#,##0.00');
    sh.getRange('I:L').setFontColor('#9aa0a6');
    sh.setColumnWidth(7, 320);
  }
  return sh;
}

/* Text that a spreadsheet could read as a formula is stored as plain text. */
function txt_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max || 300);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function upsert_(sh, changes) {
  const last = sh.getLastRow();
  const ids = last > 1 ? sh.getRange(2, C.id + 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
  const upd = last > 1 ? sh.getRange(2, C.updated + 1, last - 1, 1).getValues().map(r => Number(r[0]) || 0) : [];
  const where = {};
  ids.forEach((id, i) => { if (id) where[id] = i; });
  const appends = [];
  changes.forEach(ch => {
    if (!ch || !/^[A-Za-z0-9_-]{6,64}$/.test(String(ch.id || ''))) return;
    const amount = Math.round(Number(ch.amount) * 100) / 100;
    if (!isFinite(amount)) return;
    const items = Array.isArray(ch.items)
      ? ch.items.map(i => (i && i.name ? i.name : '') + (i && i.amount != null && i.amount !== '' ? ' ' + Number(i.amount).toFixed(2) : '')).filter(Boolean).join(', ')
      : String(ch.items || '');
    const row = [
      /^\d{4}-\d{2}-\d{2}$/.test(ch.date) ? ch.date : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      txt_(ch.who, 40), ch.type === 'income' ? 'income' : 'expense', txt_(ch.store, 80), txt_(ch.category, 40),
      amount, txt_(items, 1000), txt_(ch.note, 300), String(ch.id),
      Number(ch.createdAt) || Date.now(), Number(ch.updatedAt) || Date.now(), ch.deleted ? 'yes' : ''
    ];
    if (ch.id in where) {
      const i = where[ch.id];
      if (row[C.updated] >= upd[i]) {
        sh.getRange(i + 2, 1, 1, 1).setNumberFormat('@');
        sh.getRange(i + 2, 1, 1, HEAD.length).setValues([row]);
        upd[i] = row[C.updated];
      }
    } else {
      where[ch.id] = -1;
      appends.push(row);
    }
  });
  if (appends.length) {
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appends.length, 1).setNumberFormat('@');
    sh.getRange(start, 1, appends.length, HEAD.length).setValues(appends);
  }
}

function readAll_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, last - 1, HEAD.length).getValues()
    .filter(r => r[C.id] && String(r[C.deleted]).toLowerCase() !== 'yes')
    .map(r => {
      const d = r[C.date] instanceof Date ? Utilities.formatDate(r[C.date], tz, 'yyyy-MM-dd') : String(r[C.date]).slice(0, 10);
      const items = String(r[C.items] || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
        const m = s.match(/^(.*?)\s+(\d+(?:\.\d{1,2})?)$/);
        return m ? { name: m[1], amount: Number(m[2]) } : { name: s, amount: null };
      });
      return {
        id: String(r[C.id]), date: d, who: String(r[C.who]), type: r[C.type] === 'income' ? 'income' : 'expense',
        store: String(r[C.store]).replace(/^'/, ''), category: String(r[C.category]), amount: Number(r[C.amount]) || 0,
        items: items, note: String(r[C.note]).replace(/^'/, ''), createdAt: Number(r[C.created]) || 0, updatedAt: Number(r[C.updated]) || 0
      };
    });
}

function limitsSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Limits');
  if (!sh) {
    sh = ss.insertSheet('Limits');
    sh.getRange(1, 1, 1, 2).setValues([['Category', 'Monthly limit']]).setFontWeight('bold').setBackground('#eafaf2');
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('$#,##0.00');
  }
  return sh;
}

function getLimits_() {
  const sh = limitsSheet_();
  const last = sh.getLastRow();
  const out = {};
  if (last > 1) sh.getRange(2, 1, last - 1, 2).getValues().forEach(r => { const n = Number(r[1]); if (r[0] && n > 0) out[String(r[0])] = n; });
  return out;
}

function setLimits_(limits) {
  const sh = limitsSheet_();
  const rows = Object.keys(limits).slice(0, 60).map(k => [txt_(k, 40), Math.round(Number(limits[k]) * 100) / 100]).filter(r => r[1] > 0);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
}
