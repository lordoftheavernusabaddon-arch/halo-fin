const CONFIG = {
  SPREADSHEET_ID: '1LvzHkxa-ggWXZHjQtcStm5NeJYERMcj9bRrekCFIBvI',
  DRIVE_FOLDER_ID: '1tu6tI0nE3DreXG4UM4C2deZp8hYOCw2o',
  SHEETS: ['Hutang Vendor', 'Transaksi Rutin']
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Pusat Kendali Ame')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPortalData() {
  try {
    const items = CONFIG.SHEETS.reduce((all, sheetName) => all.concat(getSheetRows_(sheetName)), []);
    return { ok: true, items: items, generatedAt: new Date().toISOString() };
  } catch (error) { return { ok: false, message: error.message, items: [] }; }
}

function getSheetRows_(sheetName) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map((row, index) => {
    const raw = {}; headers.forEach((header, i) => raw[header] = row[i]);
    return { id: sheetName + '-' + (index + 2), row: index + 2, sheet: sheetName,
      title: String(value_(raw, ['vendor','nama vendor','deskripsi','keterangan','nama']) || sheetName),
      date: normalizeDate_(value_(raw, ['tanggal','jatuh tempo','due date','tanggal pembayaran','periode'])),
      amount: normalizeAmount_(value_(raw, ['nominal','jumlah','amount','total','nilai'])),
      status: normalizeStatus_(value_(raw, ['status pembayaran','status','payment status'])),
      category: String(value_(raw, ['kategori','jenis','tipe']) || (sheetName === 'Hutang Vendor' ? 'Hutang vendor' : 'Transaksi rutin')),
      notes: String(value_(raw, ['catatan','notes','keterangan']) || ''),
      attachments: String(value_(raw, ['lampiran','attachment','link file','spk','invoice']) || '')
    };
  }).filter(item => item.date);
}

function value_(obj, aliases) { const key = Object.keys(obj).find(k => aliases.some(a => k.toLowerCase().trim() === a)); return key ? obj[key] : ''; }
function normalizeDate_(value) { if (!value) return ''; const date = value instanceof Date ? value : new Date(value); return isNaN(date.getTime()) ? '' : Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function normalizeAmount_(value) { if (typeof value === 'number') return value; return Number(String(value || '').replace(/[^0-9,-]/g, '').replace(',', '.')) || 0; }
function normalizeStatus_(value) { const s = String(value || 'pending').toLowerCase(); return s.includes('lunas') || s.includes('paid') || s.includes('selesai') ? 'paid' : s.includes('overdue') || s.includes('terlambat') ? 'overdue' : 'pending'; }
function ensureColumn_(sheet, name) { const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String); const found = headers.findIndex(h => h.toLowerCase() === name.toLowerCase()); if (found >= 0) return found + 1; const col = sheet.getLastColumn() + 1; sheet.getRange(1, col).setValue(name); return col; }

function updatePaymentStatus(payload) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(payload.sheet); const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String); const col = headers.findIndex(h => /status/i.test(h)) + 1; if (!col) throw new Error('Kolom status tidak ditemukan'); sheet.getRange(Number(payload.row), col).setValue(payload.status); return getPortalData(); }
  finally { lock.releaseLock(); }
}

function uploadAttachment(payload) {
  if (!payload || !payload.data || payload.data.length > 12 * 1024 * 1024) throw new Error('File kosong atau melebihi batas 12MB');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { const blob = Utilities.newBlob(Utilities.base64Decode(payload.data), payload.mimeType || 'application/octet-stream', payload.name); const file = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID).createFile(blob); const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(payload.sheet); const col = ensureColumn_(sheet, payload.type || 'Lampiran'); sheet.getRange(Number(payload.row), col).setValue(file.getUrl()); return { ok: true, url: file.getUrl(), name: file.getName() }; }
  finally { lock.releaseLock(); }
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }
