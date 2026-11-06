/**
 * TechOps data layer.
 *
 * READ  : the TechOps Google Sheet is read through Google's public "gviz" JSONP endpoint
 *         (works on file://, localhost and GitHub Pages; the sheet must be shared as
 *         "Anyone with the link can view"). If the sheet is not reachable, bundled dummy
 *         data (js/sample-data.js) is used and the UI shows "Demo data".
 * WRITE : rows are sent to a Google Apps Script web app (CONFIG.APPS_SCRIPT_URL).
 *         Without that URL the app runs in DEMO mode: writes stay in this browser only
 *         (localStorage) and are announced to other tabs through BroadcastChannel.
 */
(function () {
  var C = window.TECHOPS_CONFIG;
  var KEYS = { pending: "techops_pending_v1", edits: "techops_edits_v1" };

  /* tab -> key field + [jsKey, sheetHeader] pairs */
  var SCHEMA = {
    rooms: { tab: C.TABS.rooms, key: "code", cols: [["code", "Room Code"], ["floorName", "Floor"], ["zone", "Zone"], ["type", "Space Type"], ["capacity", "Capacity"], ["assigned", "Assigned To"], ["contact", "Room Contact"]] },
    wifi: { tab: C.TABS.wifi, key: "id", cols: [["id", "Point ID"], ["floorName", "Floor"], ["label", "Label"], ["x", "X"], ["y", "Y"], ["mbps", "Speed Mbps"], ["latency", "Latency ms"], ["updated", "Last Updated"]] },
    team: { tab: C.TABS.team, key: "name", cols: [["name", "Name"], ["role", "Role"], ["phone", "Phone"], ["floorName", "Current Floor"], ["room", "Current Room"], ["status", "Status"], ["focus", "Focus Area"]] },
    inventory: { tab: C.TABS.inventory, key: "id", cols: [["id", "Item ID"], ["item", "Item"], ["category", "Category"], ["qty", "Quantity"], ["holder", "Held By"], ["team", "Lent To Team"], ["room", "Lent To Room"], ["floorName", "Lent To Floor"], ["status", "Status"], ["updated", "Last Updated"]] },
    reports: { tab: C.TABS.reports, key: "id", cols: [["id", "Report ID"], ["ts", "Timestamp"], ["floorName", "Floor"], ["room", "Room"], ["issue", "Issue Type"], ["details", "Details"], ["status", "Status"], ["assigned", "Assigned To"], ["resolvedAt", "Resolved At"], ["reporter", "Reporter"]] },
    meetups: { tab: C.TABS.meetups, key: "id", cols: [["id", "Request ID"], ["ts", "Timestamp"], ["by", "Requested By"], ["target", "Target Member"], ["byFloorName", "Requester Floor"], ["byRoom", "Requester Room"], ["targetFloorName", "Target Floor"], ["targetRoom", "Target Room"], ["meetAt", "Meet At"], ["note", "Note"], ["status", "Status"]] }
  };
  var NUMERIC = { capacity: 1, x: 1, y: 1, mbps: 1, latency: 1, qty: 1 };
  var FLOOR_NAMES = { G: "Ground Floor", F: "First Floor", S: "Second Floor" };

  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function isLive() { return !!C.APPS_SCRIPT_URL; }

  function floorId(name) {
    for (var id in FLOOR_NAMES) if (FLOOR_NAMES[id].toLowerCase() === String(name || "").trim().toLowerCase()) return id;
    return "";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function parseStamp(s) {
    if (!s) return null;
    var d = new Date(String(s).replace(" ", "T"));
    return isNaN(d) ? null : d;
  }

  /* ---------------------------------------------------------------- READ (gviz JSONP) */
  var jsonpSeq = 0;
  function fetchTab(tab) {
    return new Promise(function (resolve, reject) {
      var cb = "__techops_cb_" + (++jsonpSeq) + "_" + Math.random().toString(36).slice(2, 7);
      var s = document.createElement("script");
      var done = false;
      function cleanup() { clearTimeout(timer); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
      var timer = setTimeout(function () { if (done) return; done = true; cleanup(); reject(new Error("timeout")); }, 9000);
      window[cb] = function (resp) {
        if (done) return; done = true; cleanup();
        if (!resp || resp.status === "error" || !resp.table) return reject(new Error("sheet error"));
        resolve(resp.table);
      };
      s.onerror = function () { if (done) return; done = true; cleanup(); reject(new Error("blocked")); };
      s.src = "https://docs.google.com/spreadsheets/d/" + C.SHEET_ID + "/gviz/tq?headers=1&sheet=" + encodeURIComponent(tab) +
        "&tqx=responseHandler:" + cb + "&_=" + Date.now();
      document.head.appendChild(s);
    });
  }
  function cellText(c) {
    if (!c || c.v === null || c.v === undefined) return "";
    if (typeof c.v === "string" && c.v.indexOf("Date(") === 0) {
      var m = c.v.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/);
      if (m) return m[1] + "-" + pad(+m[2] + 1) + "-" + pad(+m[3]) + " " + pad(+(m[4] || 0)) + ":" + pad(+(m[5] || 0)) + ":" + pad(+(m[6] || 0));
    }
    return c.v;
  }
  function tableToObjects(table) {
    var heads = table.cols.map(function (c) { return (c.label || "").trim(); });
    return table.rows.map(function (r) {
      var o = {};
      heads.forEach(function (h, i) { o[h] = cellText(r.c && r.c[i]); });
      return o;
    });
  }

  /* ---------------------------------------------------------------- normalise */
  function normalise(name, rawRows) {
    var sc = SCHEMA[name];
    return rawRows.map(function (raw) {
      var o = {};
      sc.cols.forEach(function (p) {
        var v = raw[p[1]];
        if (v === undefined || v === null) v = "";
        if (NUMERIC[p[0]]) v = v === "" ? 0 : Number(v);
        else v = String(v).trim();
        o[p[0]] = v;
      });
      if ("floorName" in o) o.floor = floorId(o.floorName);
      if ("byFloorName" in o) o.byFloor = floorId(o.byFloorName);
      if ("targetFloorName" in o) o.targetFloor = floorId(o.targetFloorName);
      return o;
    }).filter(function (o) { return o[sc.key] !== ""; });
  }
  function toSheetRow(name, obj) {
    var row = {};
    SCHEMA[name].cols.forEach(function (p) { if (obj[p[0]] !== undefined) row[p[1]] = obj[p[0]]; });
    return row;
  }
  function withFloorNames(obj) {
    if (obj.floor) obj.floorName = FLOOR_NAMES[obj.floor];
    if (obj.byFloor) obj.byFloorName = FLOOR_NAMES[obj.byFloor];
    if (obj.targetFloor) obj.targetFloorName = FLOOR_NAMES[obj.targetFloor];
    return obj;
  }

  /* ---------------------------------------------------------------- local overlay */
  function overlay(name, rows, sheetOk) {
    var sc = SCHEMA[name], key = sc.key;
    var pend = jget(KEYS.pending, {})[name] || [];
    var edits = jget(KEYS.edits, {});
    var tabEdits = edits[name] || {};
    var have = {};
    rows.forEach(function (r) { have[r[key]] = r; });

    /* edits: apply to existing rows; in live mode drop an edit once the sheet reflects it */
    var changedEdits = false;
    Object.keys(tabEdits).forEach(function (k) {
      var r = have[k];
      if (!r) return;
      var f = tabEdits[k], same = true;
      Object.keys(f).forEach(function (fk) { if (String(r[fk]) !== String(f[fk])) same = false; });
      if (isLive() && sheetOk && same) { delete tabEdits[k]; changedEdits = true; return; }
      Object.keys(f).forEach(function (fk) { r[fk] = f[fk]; });
      withFloorNames(r);
    });
    if (changedEdits) { edits[name] = tabEdits; jset(KEYS.edits, edits); }

    /* pending (locally created) rows */
    var stillPending = [];
    pend.forEach(function (p) {
      if (have[p[key]]) { if (isLive() && sheetOk) return; }  /* sheet now has it: forget the local copy */
      else rows.push(p);
      stillPending.push(p);
    });
    if (stillPending.length !== pend.length) {
      var all = jget(KEYS.pending, {}); all[name] = stillPending; jset(KEYS.pending, all);
    }
    /* edits for pending rows */
    rows.forEach(function (r) {
      var f = tabEdits[r[key]];
      if (f && !have[r[key]]) { Object.keys(f).forEach(function (fk) { r[fk] = f[fk]; }); withFloorNames(r); }
    });
    return rows;
  }

  /* ---------------------------------------------------------------- load */
  function loadAll() {
    var names = Object.keys(SCHEMA);
    var failed = [];
    var jobs = names.map(function (n) {
      return fetchTab(SCHEMA[n].tab).then(function (t) {
        return { name: n, rows: normalise(n, tableToObjects(t)), ok: true };
      }, function () {
        failed.push(SCHEMA[n].tab);
        var sample = (window.TECHOPS_SAMPLE && window.TECHOPS_SAMPLE[SCHEMA[n].tab]) || [];
        return { name: n, rows: normalise(n, sample), ok: false };
      });
    });
    return Promise.all(jobs).then(function (res) {
      var out = { meta: { sheetOk: failed.length === 0, failed: failed, live: isLive(), fetchedAt: new Date() } };
      res.forEach(function (r) { out[r.name] = overlay(r.name, r.rows, r.ok); });
      return out;
    });
  }

  /* ---------------------------------------------------------------- WRITE */
  var channel = ("BroadcastChannel" in window) ? new BroadcastChannel("techops_prototype") : null;
  var listeners = [];
  function notify(kind) {
    if (channel) channel.postMessage({ kind: kind, at: Date.now() });
  }
  function onChange(cb) {
    listeners.push(cb);
    if (channel) channel.onmessage = function (e) { listeners.forEach(function (f) { f(e.data); }); };
    window.addEventListener("storage", function (e) {
      if (e.key === KEYS.pending || e.key === KEYS.edits) listeners.forEach(function (f) { f({ kind: "storage" }); });
    });
  }
  function post(payload) {
    if (!isLive()) return Promise.resolve({ demo: true });
    return fetch(C.APPS_SCRIPT_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function () { return { ok: true }; }, function (err) { return { error: String(err) }; });
  }
  function addPending(name, obj) {
    var all = jget(KEYS.pending, {});
    (all[name] = all[name] || []).push(obj);
    jset(KEYS.pending, all);
  }
  function newId(prefix) {
    var d = new Date();
    return prefix + "-" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + Math.random().toString(36).slice(2, 4).toUpperCase();
  }
  function clip(s, n) { return String(s || "").slice(0, n); }

  function addRow(name, obj) {
    withFloorNames(obj);
    addPending(name, obj);
    notify(name);
    return post({ action: "addRow", tab: SCHEMA[name].tab, row: toSheetRow(name, obj) }).then(function (r) { r.id = obj[SCHEMA[name].key]; return r; });
  }
  function update(name, keyValue, fields) {
    var edits = jget(KEYS.edits, {});
    var t = edits[name] = edits[name] || {};
    t[keyValue] = Object.assign(t[keyValue] || {}, fields);
    jset(KEYS.edits, edits);
    /* also patch a locally pending row */
    var all = jget(KEYS.pending, {}), key = SCHEMA[name].key;
    (all[name] || []).forEach(function (p) { if (p[key] === keyValue) Object.assign(p, fields); });
    jset(KEYS.pending, all);
    notify(name);
    var sheetFields = {};
    var tmp = toSheetRow(name, fields);
    Object.keys(tmp).forEach(function (h) { sheetFields[h] = tmp[h]; });
    return post({ action: "updateRow", tab: SCHEMA[name].tab, keyHeader: SCHEMA[name].cols.filter(function (p) { return p[0] === key; })[0][1], key: keyValue, fields: sheetFields });
  }

  function addReport(d) {
    return addRow("reports", {
      id: newId("RPT"), ts: stamp(), floor: d.floor, room: d.room, issue: clip(d.issue, 80), details: clip(d.details, 500),
      status: "New", assigned: "", resolvedAt: "", reporter: clip(d.reporter, 60)
    });
  }
  function addMeetup(d) {
    return addRow("meetups", {
      id: newId("MTG"), ts: stamp(), by: d.by, target: d.target, byFloor: d.byFloor, byRoom: d.byRoom,
      targetFloor: d.targetFloor, targetRoom: d.targetRoom, meetAt: d.meetAt, note: clip(d.note, 300), status: "Pending"
    });
  }
  function resetDemo() { localStorage.removeItem(KEYS.pending); localStorage.removeItem(KEYS.edits); notify("reset"); }

  window.TechOpsStore = {
    SCHEMA: SCHEMA, FLOOR_NAMES: FLOOR_NAMES,
    isLive: isLive, floorId: floorId, stamp: stamp, parseStamp: parseStamp,
    loadAll: loadAll, addReport: addReport, addMeetup: addMeetup, update: update, onChange: onChange, resetDemo: resetDemo
  };
})();
