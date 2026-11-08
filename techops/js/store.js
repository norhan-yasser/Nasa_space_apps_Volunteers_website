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
  /* Firebase Auth requires http/https; when opened directly via file://, run cleanly against bundled local data with zero console errors. */
  var IS_FILE = typeof location !== "undefined" && location.protocol === "file:";
  var LIVE = !!(FB.apiKey && FB.projectId && !IS_FILE);
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var COLS = ["rooms", "wifi", "team", "inventory", "reports", "meetups"];
  var KEYFIELD = { rooms: "code", wifi: "id", team: "name", inventory: "id", reports: "id", meetups: "id" };
  var NUMERIC = { capacity: 1, x: 1, y: 1, mbps: 1, latency: 1, qty: 1 };
  var FLOOR_NAMES = { B: "Basement", G: "Ground Floor", F: "First Floor", S: "Second Floor" };
  var TYPE_LABEL = { "chairs": "Classroom", "small lecture": "Small Lecture Hall", "bring your device": "Bring Your Own Device", "lecture": "Lecture Hall" };
  var SESSION_KEY = "techops_volunteer_code", SESSION_SEEN = "techops_session_seen", SESSION_USER = "techops_volunteer_user", LOCAL_KEY = "techops_local_db_v1";
  /* SECURITY: the volunteer login lives in sessionStorage (it dies with the tab, never survives a browser restart) and
   * also expires when the person was away from the site for longer than SESSION_GRACE_MS (default 5 min). */
  var GRACE = Number((window.TECHOPS_CONFIG || {}).SESSION_GRACE_MS) || (24 * 60 * 60 * 1000);
  function sget(k) {
    try {
      return sessionStorage.getItem(k) || localStorage.getItem(k) || "";
    } catch (e) {
      return "";
    }
  }
  function sset(k, v) {
    try {
      if (v) {
        sessionStorage.setItem(k, v);
        localStorage.setItem(k, v);
      } else {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      }
    } catch (e) {}
  }
  function clearSessionStorage() {
    sset(SESSION_KEY, "");
    sset(SESSION_SEEN, "");
    sset(SESSION_USER, "");
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_SEEN);
      sessionStorage.removeItem(SESSION_USER);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_SEEN);
      localStorage.removeItem(SESSION_USER);
    } catch (e) {}
  }
  function markSeen() { if (sget(SESSION_KEY)) sset(SESSION_SEEN, String(Date.now())); }
  function sessionFresh() { var t = Number(sget(SESSION_SEEN)) || 0; return !!t && Date.now() - t <= GRACE; }
  /* Which task queue this browser reads: "TechOps", "Logistics", or "Competition" (strictly isolated per role). */
  var TEAM = "TechOps";
  function setTeam(u) {
    if (u && (u.team === "Competition" || u.team === "Dispatch")) TEAM = "Competition";
    else if (u && u.team === "Logistics") TEAM = "Logistics";
    else TEAM = "TechOps";
  }

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
    if (c === "claimed" || c === "invalid" || c === "missing" || c === "sdk" || c === "forbidden") return e.message;
    if (c === "permission-denied") return "Your volunteer account is not allowed to do that.";
    if (c === "auth/operation-not-allowed") return "Anonymous sign-in is disabled in the Firebase console (Authentication > Sign-in method).";
    if (c === "unavailable" || c === "auth/network-request-failed") return "No connection to Firebase. Check your internet and try again.";
    return (e && e.message) || "Something went wrong.";
  }

  /* ---------------------------------------------------------------- shared state */
  var cache = {}, ready = {}, listeners = [], user = null, started = false, lastError = null;
  var emitT = 0, readyResolve, readyP = new Promise(function (r) { readyResolve = r; });
  var CACHE_KEY = "techops_firestore_cache_v2";

  function loadPersistedCache() {
    var raw = jget(CACHE_KEY, null);
    if (raw && typeof raw === "object") {
      COLS.forEach(function (c) {
        if (Array.isArray(raw[c]) && raw[c].length > 0) {
          cache[c] = raw[c];
        }
      });
    }
    var seed = window.TECHOPS_SEED || {};
    COLS.forEach(function (c) {
      if (!cache[c] || cache[c].length === 0) {
        if (seed[c]) {
          cache[c] = Object.keys(seed[c]).map(function (k) {
            var o = Object.assign({}, seed[c][k]);
            o._id = k;
            return o;
          });
        } else {
          cache[c] = [];
        }
      }
    });
  }

  function savePersistedCache() {
    try {
      jset(CACHE_KEY, cache);
    } catch (e) {}
  }

  /* Hydrate cache immediately on script execution for instantaneous 0ms initial render */
  loadPersistedCache();

  function emit() { clearTimeout(emitT); emitT = setTimeout(function () { listeners.forEach(function (f) { f({ kind: "data" }); }); }, 25); }
  function checkReady() {
    savePersistedCache();
    var critical = (TEAM === "TechOps") ? COLS : ["reports", "rooms"];
    if (critical.every(function (c) { return ready[c]; })) {
      if (readyResolve) readyResolve();
    }
  }

  function findCacheReport(id) {
    if (!cache.reports) return null;
    return cache.reports.filter(function (r) { return r && (r.id === id || r._id === id); })[0] || null;
  }

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
        /* Omit authDomain so Firebase Auth does not inject the OAuth /__/auth/iframe element (we only use Anonymous Auth). */
        if (!firebase.apps.length) firebase.initializeApp({ apiKey: FB.apiKey, projectId: FB.projectId, appId: FB.appId });
        fb.auth = firebase.auth(); fb.db = firebase.firestore();
        try {
          if (fb.db.enablePersistence) {
            fb.db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
          }
        } catch (e) {}
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
    var prep = (user && user.code) ? fb.bindSession(user.code) : fb.signedIn();
    return prep.then(function () {
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
      var seed = window.TECHOPS_SEED || {};
      if (!d) {
        d = JSON.parse(JSON.stringify(seed));
        jset(LOCAL_KEY, d);
      } else if (seed.volunteers) {
        /* Auto-sync new volunteers from seed into existing cached localStorage */
        d.volunteers = Object.assign({}, seed.volunteers, d.volunteers || {});
      }
      return d;
    },
    save: function (d) { jset(LOCAL_KEY, d); if (channel) channel.postMessage({ at: Date.now() }); },
    refresh: function () {
      var d = loc.db();
      COLS.forEach(function (c) {
        cache[c] = Object.keys(d[c] || {}).map(function (k) { var o = Object.assign({}, d[c][k]); o._id = k; return o; });
        ready[c] = true;
      });
      cache.reports = cache.reports.filter(function (r) { return (r.team || "TechOps") === TEAM; });
      checkReady();
    },
    getVolunteer: function (code) {
      var d = loc.db();
      var seedV = (window.TECHOPS_SEED && window.TECHOPS_SEED.volunteers) || {};
      return Promise.resolve((d.volunteers && d.volunteers[code]) || seedV[code] || null);
    },
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

  /* ---------------------------------------------------------------- Tutorial / Sandbox Mode */
  var TUTORIAL_KEY_PREFIX = "nasa_tutorial_done_";
  var _tutorialMode = false;
  var _tutorialRole = null;
  var _tutorialReports = null;

  function initTutorialReports() {
    return [
      { id: "TUT-TO-01", ts: stamp(), floor: "G", floorName: "Ground Floor", room: "C026", issue: "Internet is lagging", details: "[Training Ticket] Wi-Fi speed dropping intermittently for Team Aurora during presentation setup.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Team Aurora", team: "TechOps" },
      { id: "TUT-TO-02", ts: stamp(), floor: "F", floorName: "First Floor", room: "B133", issue: "Need TechOps assistance", details: "[Training Ticket] Projector HDMI resolution is not detected by presenter laptop.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Judges Panel 1", team: "TechOps" },
      { id: "TUT-TO-03", ts: stamp(), floor: "F", floorName: "First Floor", room: "C139", issue: "Electricity / Power problem", details: "[Training Ticket] Outlet tripped at back desk, requesting power extension strip.", status: "In Progress", assigned: "Mohamed Khairy", claimedAt: stamp(), resolvedAt: "", reporter: "Team Nova", team: "TechOps" },

      { id: "TUT-LG-01", ts: stamp(), floor: "S", floorName: "Second Floor", room: "C231", issue: "Help request", details: "[Training Ticket] Lost participant badge, requesting replacement lanyard and badge.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Team Vega", team: "Logistics" },
      { id: "TUT-LG-02", ts: stamp(), floor: "F", floorName: "First Floor", room: "H113", issue: "Prayer request", details: "[Training Ticket] Nearest direction to Women prayer hall.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Participant Sarah", team: "Logistics" },
      { id: "TUT-LG-03", ts: stamp(), floor: "G", floorName: "Ground Floor", room: "S016", issue: "Go to a place", details: "[Training Ticket] Guidance escort from entrance to main auditorium.", status: "In Progress", assigned: "Norhan Yasser", claimedAt: stamp(), resolvedAt: "", reporter: "Guest Speaker", team: "Logistics" },

      { id: "TUT-CMP-01", ts: stamp(), floor: "", floorName: "", room: "", issue: "Discord issue", details: "[Training Ticket] Discord server invite link expired for two teammates joining late.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Team Orion · @mariam_a", team: "Competition" },
      { id: "TUT-CMP-02", ts: stamp(), floor: "F", floorName: "First Floor", room: "B130", issue: "Judge & Room Inquiry", details: "[Training Ticket] Lead evaluator requested room guidance to mentor and judging lab B130.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Evaluation Desk", team: "Competition" },
      { id: "TUT-CMP-03", ts: stamp(), floor: "F", floorName: "First Floor", room: "B130", issue: "Competition question", details: "[Training Ticket] Can our 240-second demo include open-source NASA imagery?", status: "In Progress", assigned: "Competition Lead", claimedAt: stamp(), resolvedAt: "", reporter: "Team Horizon", team: "Competition" }
    ];
  }

  function isTutorialCompleted(roleOrCode) {
    try {
      var r = String(roleOrCode || (user && (user.role || user.team)) || "general").toLowerCase();
      return localStorage.getItem(TUTORIAL_KEY_PREFIX + r) === "true";
    } catch (e) {
      return false;
    }
  }

  function setTutorialCompleted(roleOrCode, val) {
    try {
      var r = String(roleOrCode || (user && (user.role || user.team)) || "general").toLowerCase();
      localStorage.setItem(TUTORIAL_KEY_PREFIX + r, val ? "true" : "false");
    } catch (e) {}
  }

  function isTutorialMode() {
    return _tutorialMode;
  }

  function enterTutorialMode(role) {
    _tutorialMode = true;
    _tutorialRole = role || (user && (user.role || user.team)) || "techops";
    _tutorialReports = initTutorialReports();
    COLS.forEach(function (c) { ready[c] = true; });
    if (readyResolve) readyResolve();
    emit();
  }

  function exitTutorialMode() {
    _tutorialMode = false;
    _tutorialRole = null;
    _tutorialReports = null;
    if (!LIVE) {
      loc.refresh();
      COLS.forEach(function (c) { ready[c] = true; });
      if (readyResolve) readyResolve();
    }
    emit();
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
    setTimeout(readyResolve, 4000);
    return readyP;
  }
  function loadAll() {
    /* Stale-while-revalidate / Cache-first: if in-memory/persisted cache exists, return immediately (0ms) */
    var hasData = COLS.some(function (c) { return cache[c] && cache[c].length > 0; });
    var p = (_tutorialMode || hasData) ? Promise.resolve() : readyP;
    return p.then(function () {
      var geo = {};
      if (D && D.ALL) D.ALL.forEach(function (g) { geo[g.code] = 1; });
      var isSynced = !LIVE || ((TEAM === "TechOps" ? COLS : ["reports", "rooms"]).every(function (c) { return ready[c]; }));
      var out = { meta: { live: LIVE, online: !lastError, synced: isSynced, error: lastError ? friendly(lastError) : "", fetchedAt: new Date(), user: user } };
      COLS.forEach(function (c) { out[c] = normalise(c, cache[c] || []); });
      if (_tutorialMode && _tutorialReports) {
        var tr = String(_tutorialRole || TEAM || (user && (user.role || user.team)) || "").toLowerCase();
        out.reports = _tutorialReports.filter(function (r) {
          if (tr.indexOf("logistics") >= 0) return r.team === "Logistics";
          if (tr.indexOf("comp") >= 0 || tr.indexOf("dispatch") >= 0) return r.team === "Competition";
          return r.team === "TechOps";
        });
      } else {
        out.reports = (out.reports || []).filter(function (r) { return (r.team || "TechOps") === TEAM; });
      }
      /* only rooms that exist on the floor plans can be drawn / routed to */
      if (D && D.ALL) out.rooms = out.rooms.filter(function (r) { return geo[r.code]; });
      /* Wi-Fi readings only count when the point is physically INSIDE a room: corridor / hall / outer-stage points are erased */
      if (D && D.roomAt) out.wifi = out.wifi.filter(function (w) { var g = D.roomAt(w.floor, w.x, w.y); if (g) w.room = g.code; return !!g; });
      return out;
    });
  }

  /* ---------------------------------------------------------------- auth & RBAC */
  function normalizeCode(c) { return String(c || "").trim().toUpperCase().replace(/\s+/g, ""); }
  function toUser(v) {
    if (!v || !v.Name) return null;
    var team = String(v.Team || "");
    var role = String(v.Role || (team.toLowerCase() === "admin" ? "Admin" : team));
    return { name: String(v.Name), code: String(v["Volunteer Code"] || ""), team: team, role: role };
  }
  function saveSessionUser(code, u) {
    sset(SESSION_KEY, code);
    sset(SESSION_USER, u ? JSON.stringify(u) : "");
    markSeen();
  }
  function peekUser() {
    var code = sget(SESSION_KEY);
    if (!code || !sessionFresh()) return null;
    if (user && user.code === code) { markSeen(); return user; }
    var raw = sget(SESSION_USER);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.name && parsed.code === code) {
        user = parsed;
        setTeam(user);
        markSeen();
        return user;
      }
    } catch (e) {}
    return null;
  }
  function canAccess(u, moduleId) {
    var who = u === undefined ? user : u;
    if (!who || !who.team) return false;
    var t = String(who.team || "").trim();
    var r = String(who.role || "").trim();
    if (t === "Admin" || r === "Admin") return true;
    var m = String(moduleId || "").trim().toLowerCase();
    if (m === "poster" || m === "overview") return true;
    /* Tech Ops has its own dedicated Maps & Route tab inside Tech Ops, so they do not use the external Maps module */
    if (m === "maps") return t !== "TechOps";
    if (m === "logistics") return t === "Logistics";
    if (m === "competition" || m === "dispatch") return t === "Competition" || t === "Dispatch";
    if (m === "techops") return t === "TechOps";
    return false;
  }
  function teamDisplayName(u) {
    var who = u === undefined ? user : u;
    var t = who && who.team ? String(who.team) : "";
    if (t === "TechOps") return "Tech Ops";
    if (t === "Competition" || t === "Dispatch") return "Competition Team";
    if (t === "Logistics") return "Logistics";
    if (t === "Volunteers") return "All Volunteers";
    return t || "Volunteer";
  }
  function workspaceFor(u) {
    var who = u === undefined ? user : u;
    if (!who || !who.team) return null;
    if (who.team === "Logistics") return { module: "logistics", label: "Logistics", path: "logistics/index.html" };
    if (who.team === "Competition" || who.team === "Dispatch") return { module: "competition", label: "Competition Team", path: "dispatch/index.html" };
    if (who.team === "TechOps") return { module: "techops", label: "Tech Ops", path: "techops/index.html" };
    return null;
  }
  function login(code) {
    code = normalizeCode(code);
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return Promise.reject(fail("invalid", "That volunteer code is not valid."));
    return backend().getVolunteer(code).then(function (v) {
      var u = toUser(v);
      if (!u) throw fail("invalid", "We couldn't find that volunteer code. Check it and try again.");
      return (LIVE ? fb.bindSession(code) : Promise.resolve()).then(function () { user = u; setTeam(u); saveSessionUser(code, u); return u; });
    });
  }
  function restore() {
    var code = sget(SESSION_KEY);
    if (!code) { clearSessionStorage(); return Promise.resolve(null); }
    if (!sessionFresh()) { clearSessionStorage(); if (LIVE) fb.signOut().catch(function () {}); return Promise.resolve(null); }
    var cached = peekUser();
    if (cached) {
      if (LIVE) fb.bindSession(code).catch(function () {});
      return Promise.resolve(cached);
    }
    var check = LIVE ? fb.getVolunteer(code) : loc.getVolunteer(code);
    return check.then(function (v) {
      user = toUser(v); setTeam(user);
      if (!user) {
        clearSessionStorage();
      } else {
        saveSessionUser(code, user);
        if (LIVE) fb.bindSession(code).catch(function () {});
      }
      return user;
    }, function () { return null; });
  }
  function logout() {
    user = null; clearSessionStorage(); TEAM = "TechOps";
    started = false; ready = {}; cache = {}; readyP = new Promise(function (r) { readyResolve = r; });
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
      id: newId(d.team === "Logistics" ? "LGR" : d.team === "Competition" ? "CMP" : "RPT"), ts: stamp(), floor: d.floor || "", room: d.room || "", issue: clip(d.issue, 80), details: clip(d.details, 500),
      status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: clip(d.reporter, 60), team: d.team === "Logistics" || d.team === "Competition" ? d.team : "TechOps"
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
  /* One-click claim: assigns the task to the signed-in volunteer and moves it to "In Progress".
   * Performs an instant optimistic update (<16ms) in local cache, then syncs with Firestore in the background. */
  function claimReport(id) {
    if (!user) return Promise.reject(fail("auth", "Sign in first."));
    if (String(id).indexOf("TUT-") === 0) {
      if (_tutorialReports) {
        var tr = _tutorialReports.filter(function (x) { return x.id === id; })[0];
        if (tr) { tr.assigned = user.name; tr.status = "In Progress"; tr.claimedAt = stamp(); }
      }
      emit();
      return Promise.resolve({ id: id, status: "In Progress", assigned: user.name });
    }
    if (_tutorialMode && _tutorialReports) {
      var r = _tutorialReports.filter(function (x) { return x.id === id; })[0];
      if (!r) return Promise.reject(fail("missing", "Training task not found."));
      if (r.status === "Resolved") return Promise.reject(fail("claimed", "This practice task is already resolved."));
      if (r.assigned && r.assigned !== user.name) return Promise.reject(fail("claimed", "Already claimed by " + r.assigned + "."));
      r.assigned = user.name;
      r.status = "In Progress";
      r.claimedAt = stamp();
      emit();
      return Promise.resolve({ id: r.id, status: r.status, assigned: r.assigned });
    }

    var target = findCacheReport(id);
    var backup = target ? Object.assign({}, target) : null;
    if (target) {
      if (target.status === "Resolved") return Promise.reject(fail("claimed", "This task is already resolved."));
      if (target.assigned && target.assigned !== user.name) return Promise.reject(fail("claimed", "Already claimed by " + target.assigned + "."));
      target.assigned = user.name;
      target.status = "In Progress";
      target.claimedAt = stamp();
      savePersistedCache();
      emit();
    }

    return guard(backend().mutateReport(id, function (r) {
      if (r.status === "Resolved") throw fail("claimed", "This task is already resolved.");
      if (r.assigned && r.assigned !== user.name) throw fail("claimed", "Already claimed by " + r.assigned + ".");
      return { assigned: user.name, status: "In Progress", claimedAt: stamp() };
    })).catch(function (err) {
      if (target && backup) {
        Object.assign(target, backup);
        savePersistedCache();
        emit();
      }
      throw err;
    });
  }
  /* One-click resolve: only the volunteer who claimed the task can resolve it.
   * Performs an instant optimistic update (<16ms) in local cache, then syncs with Firestore in the background. */
  function resolveReport(id) {
    if (!user) return Promise.reject(fail("auth", "Sign in first."));
    if (String(id).indexOf("TUT-") === 0) {
      if (_tutorialReports) {
        var tr = _tutorialReports.filter(function (x) { return x.id === id; })[0];
        if (tr) { tr.status = "Resolved"; tr.resolvedAt = stamp(); }
      }
      emit();
      return Promise.resolve({ id: id, status: "Resolved" });
    }
    if (_tutorialMode && _tutorialReports) {
      var r = _tutorialReports.filter(function (x) { return x.id === id; })[0];
      if (!r) return Promise.reject(fail("missing", "Training task not found."));
      r.status = "Resolved";
      r.resolvedAt = stamp();
      emit();
      return Promise.resolve({ id: r.id, status: r.status });
    }

    var target = findCacheReport(id);
    var backup = target ? Object.assign({}, target) : null;
    if (target) {
      if (target.assigned && target.assigned !== user.name && target.handedBy !== user.name) {
        return Promise.reject(fail("claimed", "Only " + (target.assigned || "the assignee") + " can resolve this task."));
      }
      target.status = "Resolved";
      target.resolvedAt = stamp();
      target.assigned = target.assigned || user.name;
      savePersistedCache();
      emit();
    }

    return guard(backend().mutateReport(id, function (r) {
      if (r.assigned && r.assigned !== user.name && r.handedBy !== user.name) {
        throw fail("claimed", "Only " + (r.assigned || "the assignee") + " can resolve this task.");
      }
      return { assigned: r.assigned || user.name, status: "Resolved", resolvedAt: stamp() };
    })).catch(function (err) {
      if (target && backup) {
        Object.assign(target, backup);
        savePersistedCache();
        emit();
      }
      throw err;
    });
  }
  /* Keep the session alive only while the site is actually open on screen; coming back after being away too long locks again. */
  function expireIfStale() {
    if (sget(SESSION_KEY) && !sessionFresh()) { logout().then(function () { try { location.reload(); } catch (e) {} }); return true; }
    return false;
  }
  try {
    setInterval(function () { if (!document.hidden) markSeen(); }, 15000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden && !expireIfStale()) markSeen(); });
    window.addEventListener("pageshow", function () { if (!expireIfStale()) markSeen(); });
    window.addEventListener("pagehide", markSeen);
  } catch (e) {}
  /* Dispatch only: pass a request you claimed to a Tech Ops / Logistics member (they then see it as theirs).
   * Performs an instant optimistic update (<16ms) in local cache, then syncs with Firestore in the background. */
  function handOutReport(id, member) {
    if (!user) return Promise.reject(fail("auth", "Sign in first."));
    member = clip(String(member || "").trim(), 60);
    if (!member) return Promise.reject(fail("invalid", "Choose who should take this request."));
    if (_tutorialMode && _tutorialReports) {
      var r = _tutorialReports.filter(function (x) { return x.id === id; })[0];
      if (!r) return Promise.reject(fail("missing", "Training task not found."));
      r.assigned = member;
      r.handedBy = user.name;
      r.handedAt = stamp();
      emit();
      return Promise.resolve({ id: r.id, assigned: r.assigned });
    }

    var target = findCacheReport(id);
    var backup = target ? Object.assign({}, target) : null;
    if (target) {
      if (target.status === "Resolved") return Promise.reject(fail("claimed", "This task is already resolved."));
      if (target.assigned !== user.name && target.handedBy !== user.name) return Promise.reject(fail("claimed", "Claim this request first."));
      target.assigned = member;
      target.handedBy = user.name;
      target.handedAt = stamp();
      savePersistedCache();
      emit();
    }

    return guard(backend().mutateReport(id, function (r) {
      if (r.status === "Resolved") throw fail("claimed", "This task is already resolved.");
      if (r.assigned !== user.name && r.handedBy !== user.name) throw fail("claimed", "Claim this request first.");
      return { assigned: member, handedBy: user.name, handedAt: stamp() };
    })).catch(function (err) {
      if (target && backup) {
        Object.assign(target, backup);
        savePersistedCache();
        emit();
      }
      throw err;
    });
  }
  function resetDemo() { if (LIVE) return; localStorage.removeItem(LOCAL_KEY); localStorage.removeItem(CACHE_KEY); loc.refresh(); emit(); }
  function onChange(cb) { listeners.push(cb); }

  window.TechOpsStore = {
    FLOOR_NAMES: FLOOR_NAMES, isLive: function () { return LIVE; }, floorId: floorId, stamp: stamp, parseStamp: parseStamp, friendly: friendly,
    login: login, restore: restore, peekUser: peekUser, logout: logout, currentUser: function () { return user; }, sessionGraceMs: GRACE,
    canAccess: canAccess, teamDisplayName: teamDisplayName, workspaceFor: workspaceFor,
    start: start, loadAll: loadAll, onChange: onChange,
    addReport: addReport, addMeetup: addMeetup, update: update, claimReport: claimReport, resolveReport: resolveReport, handOutReport: handOutReport, resetDemo: resetDemo,
    isTutorialCompleted: isTutorialCompleted, setTutorialCompleted: setTutorialCompleted,
    isTutorialMode: isTutorialMode, enterTutorialMode: enterTutorialMode, exitTutorialMode: exitTutorialMode
  };
})();
