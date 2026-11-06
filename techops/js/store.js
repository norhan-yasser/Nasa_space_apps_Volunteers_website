/**
 * TechOps data layer (Firebase).
 *
 *  AUTH  : volunteers sign in with their Volunteer Code. The code is the document id in the `volunteers`
 *          collection ({ "Name", "Volunteer Code", "Team" }); the app reads `Team` from there to pick the workspace.
 *          Firebase Anonymous Auth gives the browser an identity; `sessions/{uid}` links it to the code so the
 *          Firestore rules can tell who is a TechOps volunteer (see firebase/firestore.rules).
 *  DATA  : Firestore collections rooms, wifi, team, inventory, reports, meetups, streamed in real time
 *          with onSnapshot (reports are limited to team == "TechOps").
 *  LOCAL : when js/firebase-config.js is empty the same API runs against bundled DUMMY data kept in
 *          localStorage, so the UI can be previewed without a Firebase project.
 */
(function () {
  var FB = window.TECHOPS_FIREBASE || {}, D = window.TechOpsData;
  var LIVE = !!(FB.apiKey && FB.projectId);
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var COLS = ["rooms", "wifi", "team", "inventory", "reports", "meetups"];
  var KEYFIELD = { rooms: "code", wifi: "id", team: "name", inventory: "id", reports: "id", meetups: "id" };
  var NUMERIC = { capacity: 1, x: 1, y: 1, mbps: 1, latency: 1, qty: 1 };
  var FLOOR_NAMES = { G: "Ground Floor", F: "First Floor", S: "Second Floor" };
  var TYPE_LABEL = { "chairs": "Classroom", "small lecture": "Small Lecture Hall", "bring your device": "Bring Your Own Device", "lecture": "Lecture Hall" };
  var SESSION_KEY = "techops_volunteer_code", LOCAL_KEY = "techops_local_db_v1";
  var TEAM = "TechOps";

  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lget(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lset(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} }
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
  function floorId(name) {
    for (var id in FLOOR_NAMES) if (FLOOR_NAMES[id].toLowerCase() === String(name || "").trim().toLowerCase()) return id;
    return "";
  }
  function newId(prefix) {
    var d = new Date();
    return prefix + "-" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + Math.random().toString(36).slice(2, 4).toUpperCase();
  }
  function clip(s, n) { return String(s || "").slice(0, n); }
  function fail(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function friendly(e) {
    var c = e && e.code || "";
    if (c === "claimed" || c === "invalid" || c === "missing" || c === "sdk") return e.message;
    if (c === "permission-denied") return "Your volunteer account is not allowed to do that.";
    if (c === "auth/operation-not-allowed") return "Anonymous sign-in is disabled in the Firebase console (Authentication > Sign-in method).";
    if (c === "unavailable" || c === "auth/network-request-failed") return "No connection to Firebase. Check your internet and try again.";
    return (e && e.message) || "Something went wrong.";
  }

  /* ---------------------------------------------------------------- shared state */
  var cache = {}, ready = {}, listeners = [], user = null, started = false, lastError = null;
  var emitT = 0, readyResolve, readyP = new Promise(function (r) { readyResolve = r; });
  function emit() { clearTimeout(emitT); emitT = setTimeout(function () { listeners.forEach(function (f) { f({ kind: "data" }); }); }, 30); }
  function checkReady() { if (COLS.every(function (c) { return ready[c]; })) readyResolve(); }

  /* ---------------------------------------------------------------- Firebase backend */
  var fb = { db: null, auth: null, unsubs: [], boot: null };
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res;
      s.onerror = function () { rej(fail("sdk", "Could not load the Firebase SDK. Check your internet connection.")); };
      document.head.appendChild(s);
    });
  }
  fb.init = function () {
    if (fb.boot) return fb.boot;
    fb.boot = loadScript(SDK + "firebase-app-compat.js")
      .then(function () { return Promise.all([loadScript(SDK + "firebase-auth-compat.js"), loadScript(SDK + "firebase-firestore-compat.js")]); })
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(FB);
        fb.auth = firebase.auth(); fb.db = firebase.firestore();
      });
    return fb.boot;
  };
  fb.authUser = function () {
    return fb.init().then(function () {
      return new Promise(function (res) { var off = fb.auth.onAuthStateChanged(function (u) { off(); res(u); }); });
    });
  };
  fb.signedIn = function () {
    return fb.authUser().then(function (u) { return u || fb.auth.signInAnonymously().then(function (r) { return r.user; }); });
  };
  fb.getVolunteer = function (code) {
    return fb.signedIn().then(function () { return fb.db.collection("volunteers").doc(code).get(); })
      .then(function (d) { return d.exists ? d.data() : null; });
  };
  fb.bindSession = function (code) {
    return fb.signedIn().then(function (u) { return fb.db.collection("sessions").doc(u.uid).set({ code: code, at: stamp() }); });
  };
  fb.start = function () {
    return fb.signedIn().then(function () {
      COLS.forEach(function (col) {
        var ref = fb.db.collection(col);
        if (col === "reports") ref = ref.where("team", "==", TEAM);
        fb.unsubs.push(ref.onSnapshot(function (snap) {
          cache[col] = snap.docs.map(function (d) { var o = d.data(); o._id = d.id; return o; });
          ready[col] = true; checkReady(); emit();
        }, function (err) { lastError = err; ready[col] = true; checkReady(); emit(); }));
      });
    });
  };
  fb.set = function (col, id, obj) { return fb.signedIn().then(function () { return fb.db.collection(col).doc(id).set(obj); }); };
  fb.update = function (col, id, fields) { return fb.signedIn().then(function () { return fb.db.collection(col).doc(id).update(fields); }); };
  /* Transactional: two volunteers can never claim the same task. */
  fb.mutateReport = function (id, fn) {
    var ref = fb.db.collection("reports").doc(id);
    return fb.signedIn().then(function () {
      return fb.db.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) {
          if (!snap.exists) throw fail("missing", "This task no longer exists.");
          tx.update(ref, fn(snap.data()));
        });
      });
    });
  };
  fb.stop = function () { fb.unsubs.forEach(function (u) { u(); }); fb.unsubs = []; };
  fb.signOut = function () { return fb.init().then(function () { return fb.auth.signOut(); }); };

  /* ---------------------------------------------------------------- Local preview backend (dummy data) */
  var channel = ("BroadcastChannel" in window) ? new BroadcastChannel("techops_local") : null;
  var loc = {
    db: function () {
      var d = jget(LOCAL_KEY, null);
      if (!d) { d = JSON.parse(JSON.stringify(window.TECHOPS_SEED || {})); jset(LOCAL_KEY, d); }
      return d;
    },
    save: function (d) { jset(LOCAL_KEY, d); if (channel) channel.postMessage({ at: Date.now() }); },
    refresh: function () {
      var d = loc.db();
      COLS.forEach(function (c) {
        cache[c] = Object.keys(d[c] || {}).map(function (k) { var o = Object.assign({}, d[c][k]); o._id = k; return o; });
        ready[c] = true;
      });
      cache.reports = cache.reports.filter(function (r) { return r.team === TEAM; });
      checkReady();
    },
    getVolunteer: function (code) { return Promise.resolve(loc.db().volunteers[code] || null); },
    set: function (col, id, obj) { var d = loc.db(); (d[col] = d[col] || {})[id] = obj; loc.save(d); loc.refresh(); emit(); return Promise.resolve(); },
    update: function (col, id, fields) {
      var d = loc.db(); if (!d[col] || !d[col][id]) return Promise.reject(fail("missing", "Record not found."));
      Object.assign(d[col][id], fields); loc.save(d); loc.refresh(); emit(); return Promise.resolve();
    },
    mutateReport: function (id, fn) {
      var d = loc.db(), r = d.reports && d.reports[id];
      if (!r) return Promise.reject(fail("missing", "This task no longer exists."));
      try { Object.assign(r, fn(r)); } catch (e) { return Promise.reject(e); }
      loc.save(d); loc.refresh(); emit(); return Promise.resolve();
    }
  };
  function backend() { return LIVE ? fb : loc; }

  /* ---------------------------------------------------------------- normalise */
  function normaliseRoom(r) {
    var t = String(r["Room Type"] || "").trim();
    return {
      code: r.code || r._id, floor: r.floor || floorId(r.floorName),
      wing: r.Wing || "", roomNo: r["Room No."] || "", type: TYPE_LABEL[t.toLowerCase()] || t,
      capacity: Number(r["Assigned Capacity"]) || 0, physicalCapacity: Number(r["Physical Capacity"]) || 0,
      zone: r.zone || "", assigned: r["Room Use / Function"] || "", contact: ""
    };
  }
  function normalise(col, docs) {
    var key = KEYFIELD[col];
    return docs.map(function (raw) {
      var o;
      if (col === "rooms") o = normaliseRoom(raw);
      else {
        o = {};
        Object.keys(raw).forEach(function (k) { if (k !== "_id") o[k] = raw[k]; });
        Object.keys(NUMERIC).forEach(function (k) { if (k in o) o[k] = Number(o[k]) || 0; });
        if (!o[key]) o[key] = raw._id;
      }
      ["", "by", "target"].forEach(function (p) {
        var id = p ? p + "Floor" : "floor", nm = p ? p + "FloorName" : "floorName";
        if (o[id] || o[nm]) { o[id] = o[id] || floorId(o[nm]); o[nm] = FLOOR_NAMES[o[id]] || o[nm] || ""; }
      });
      return o;
    }).filter(function (o) { return o[key] !== "" && o[key] !== undefined; });
  }
  function withFloorNames(obj) {
    if (obj.floor) obj.floorName = FLOOR_NAMES[obj.floor];
    if (obj.byFloor) obj.byFloorName = FLOOR_NAMES[obj.byFloor];
    if (obj.targetFloor) obj.targetFloorName = FLOOR_NAMES[obj.targetFloor];
    return obj;
  }

  /* ---------------------------------------------------------------- real-time read */
  function start() {
    if (started) return readyP;
    started = true;
    if (LIVE) {
      fb.start().catch(function (e) { lastError = e; COLS.forEach(function (c) { ready[c] = true; }); checkReady(); emit(); });
    } else {
      loc.refresh();
      if (channel) channel.onmessage = function () { loc.refresh(); emit(); };
      window.addEventListener("storage", function (e) { if (e.key === LOCAL_KEY) { loc.refresh(); emit(); } });
    }
    setTimeout(readyResolve, 9000);
    return readyP;
  }
  function loadAll() {
    return readyP.then(function () {
      var geo = {};
      if (D && D.ALL) D.ALL.forEach(function (g) { geo[g.code] = 1; });
      var out = { meta: { live: LIVE, online: !lastError, error: lastError ? friendly(lastError) : "", fetchedAt: new Date(), user: user } };
      COLS.forEach(function (c) { out[c] = normalise(c, cache[c] || []); });
      /* only rooms that exist on the floor plans can be drawn / routed to */
      if (D && D.ALL) out.rooms = out.rooms.filter(function (r) { return geo[r.code]; });
      /* Wi-Fi readings only count when the point is physically INSIDE a room: corridor / hall / outer-stage points are erased */
      if (D && D.roomAt) out.wifi = out.wifi.filter(function (w) { var g = D.roomAt(w.floor, w.x, w.y); if (g) w.room = g.code; return !!g; });
      return out;
    });
  }

  /* ---------------------------------------------------------------- auth */
  function normalizeCode(c) { return String(c || "").trim().toUpperCase().replace(/\s+/g, ""); }
  function toUser(v) {
    if (!v || !v.Name) return null;
    var team = String(v.Team || "");
    var role = String(v.Role || (team.toLowerCase() === "admin" ? "Admin" : team));
    return { name: String(v.Name), code: String(v["Volunteer Code"] || ""), team: team, role: role };
  }
  function login(code) {
    code = normalizeCode(code);
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return Promise.reject(fail("invalid", "That volunteer code is not valid."));
    return backend().getVolunteer(code).then(function (v) {
      var u = toUser(v);
      if (!u) throw fail("invalid", "We couldn't find that volunteer code. Check it and try again.");
      return (LIVE ? fb.bindSession(code) : Promise.resolve()).then(function () { user = u; lset(SESSION_KEY, code); return u; });
    });
  }
  function restore() {
    var qCode = "";
    try { qCode = new URLSearchParams(location.search).get("auth") || ""; } catch (e) {}
    var code = qCode ? normalizeCode(qCode) : lget(SESSION_KEY);
    if (!code) return Promise.resolve(null);
    var check = LIVE ? fb.getVolunteer(code) : loc.getVolunteer(code);
    return check.then(function (v) {
      user = toUser(v);
      if (!user) {
        lset(SESSION_KEY, "");
      } else {
        lset(SESSION_KEY, code);
        if (LIVE) fb.bindSession(code).catch(function () {});
      }
      return user;
    }, function () { return null; });
  }
  function logout() {
    user = null; lset(SESSION_KEY, "");
    if (LIVE) { fb.stop(); return fb.signOut().catch(function () {}); }
    return Promise.resolve();
  }

  /* ---------------------------------------------------------------- writes */
  function guard(p) {
    return p.catch(function (e) { if (window.TO) TO.toast("Couldn't save", friendly(e), "bad"); throw e; });
  }
  function update(name, keyValue, fields) { return guard(backend().update(name, keyValue, withFloorNames(Object.assign({}, fields)))); }
  function addReport(d) {
    var obj = withFloorNames({
      id: newId("RPT"), ts: stamp(), floor: d.floor, room: d.room, issue: clip(d.issue, 80), details: clip(d.details, 500),
      status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: clip(d.reporter, 60), team: TEAM
    });
    return backend().set("reports", obj.id, obj).then(function () { return { id: obj.id, demo: !LIVE }; });
  }
  function addMeetup(d) {
    var obj = withFloorNames({
      id: newId("MTG"), ts: stamp(), by: d.by, target: d.target, byFloor: d.byFloor, byRoom: d.byRoom,
      targetFloor: d.targetFloor || "", targetRoom: d.targetRoom || "", meetAt: d.meetAt || "", note: clip(d.note, 300), status: d.status || "Pending"
    });
    return guard(backend().set("meetups", obj.id, obj)).then(function () { return { id: obj.id, demo: !LIVE }; });
  }
  /* One-click claim: assigns the task to the signed-in volunteer and moves it to "In Progress". */
  function claimReport(id) {
    if (!user) return Promise.reject(fail("auth", "Sign in first."));
    return guard(backend().mutateReport(id, function (r) {
      if (r.status === "Resolved") throw fail("claimed", "This task is already resolved.");
      if (r.assigned && r.assigned !== user.name) throw fail("claimed", "Already claimed by " + r.assigned + ".");
      return { assigned: user.name, status: "In Progress", claimedAt: stamp() };
    }));
  }
  /* One-click resolve: only the volunteer who claimed the task can resolve it. */
  function resolveReport(id) {
    if (!user) return Promise.reject(fail("auth", "Sign in first."));
    return guard(backend().mutateReport(id, function (r) {
      if (r.assigned !== user.name) throw fail("claimed", "Only " + (r.assigned || "the assignee") + " can resolve this task.");
      return { status: "Resolved", resolvedAt: stamp() };
    }));
  }
  function resetDemo() { if (LIVE) return; localStorage.removeItem(LOCAL_KEY); loc.refresh(); emit(); }
  function onChange(cb) { listeners.push(cb); }

  window.TechOpsStore = {
    FLOOR_NAMES: FLOOR_NAMES, isLive: function () { return LIVE; }, floorId: floorId, stamp: stamp, parseStamp: parseStamp, friendly: friendly,
    login: login, restore: restore, logout: logout, currentUser: function () { return user; },
    start: start, loadAll: loadAll, onChange: onChange,
    addReport: addReport, addMeetup: addMeetup, update: update, claimReport: claimReport, resolveReport: resolveReport, resetDemo: resetDemo
  };
})();
