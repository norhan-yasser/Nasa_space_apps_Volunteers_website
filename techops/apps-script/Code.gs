/**
 * TechOps prototype - Google Apps Script write endpoint.
 *
 * Install: open the TechOps Google Sheet -> Extensions -> Apps Script -> paste this file ->
 * Deploy -> New deployment -> type "Web app" -> Execute as: Me, Who has access: Anyone ->
 * copy the Web app URL into techops/js/config.js (APPS_SCRIPT_URL).
 *
 * The website sends JSON as text/plain, so no CORS preflight is needed.
 * Supported actions:
 *   { action: "addRow",    tab: "Reports", row: { "Header": value, ... } }
 *   { action: "updateRow", tab: "Reports", keyHeader: "Report ID", key: "RPT-1", fields: { "Status": "Resolved" } }
 *
 * Only the tabs listed in ALLOWED can be written, and only to columns that already exist
 * in the header row. There is no login: anyone who knows the URL can send reports.
 */
var ALLOWED = ['Reports', 'Meetups', 'Inventory', 'Team', 'WiFi', 'Rooms'];
var TEXT_HEADERS = ['Timestamp', 'Resolved At', 'Last Updated'];   // stored as plain text, not dates

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var req = JSON.parse(e.postData.contents);
    if (ALLOWED.indexOf(req.tab) < 0) return out_({ ok: false, error: 'tab not allowed' });
    var sheet = SpreadsheetApp.getActive().getSheetByName(req.tab);
    if (!sheet) return out_({ ok: false, error: 'tab not found' });
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (req.action === 'addRow') {
      var row = headers.map(function (h) { return clean_(h, req.row[h], true); });
      var target = sheet.getLastRow() + 1;
      sheet.getRange(target, 1, 1, headers.length).setNumberFormat('@');   // keep text exactly as typed
      sheet.getRange(target, 1, 1, headers.length).setValues([row]);
      return out_({ ok: true });
    }

    if (req.action === 'updateRow') {
      var keyCol = headers.indexOf(req.keyHeader);
      if (keyCol < 0) return out_({ ok: false, error: 'key column not found' });
      var values = sheet.getRange(1, keyCol + 1, sheet.getLastRow(), 1).getValues();
      var rowIdx = -1;
      for (var i = 1; i < values.length; i++) { if (String(values[i][0]) === String(req.key)) { rowIdx = i + 1; break; } }
      if (rowIdx < 0) return out_({ ok: false, error: 'row not found' });
      Object.keys(req.fields).forEach(function (h) {
        var c = headers.indexOf(h);
        if (c < 0) return;
        var cell = sheet.getRange(rowIdx, c + 1);
        if (TEXT_HEADERS.indexOf(h) >= 0) cell.setNumberFormat('@');
        cell.setValue(clean_(h, req.fields[h], TEXT_HEADERS.indexOf(h) >= 0));
      });
      // stamp the resolution time automatically
      if (req.tab === 'Reports' && req.fields['Status'] === 'Resolved') {
        var rc = headers.indexOf('Resolved At');
        if (rc >= 0) { var rcell = sheet.getRange(rowIdx, rc + 1); rcell.setNumberFormat('@'); rcell.setValue(now_()); }
      }
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet() { return out_({ ok: true, service: 'TechOps prototype endpoint' }); }

function clean_(header, value, isTextCell) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return value;
  var s = String(value).slice(0, 500);
  // neutralise spreadsheet formulas coming from the public form
  return !isTextCell && /^[=+\-@]/.test(s) && isNaN(Number(s)) ? "'" + s : s;
}
function now_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
