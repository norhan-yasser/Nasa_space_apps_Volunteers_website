/**
 * TechOps & Venue Operations data layer — 100% Firebase Cloud Firestore (`space-apps-cairo-volunteer`).
 *
 *  AUTH  : Volunteers sign in with their Volunteer Code. The code is looked up directly in the Firestore
 *          `volunteers` collection ({ "Name", "Volunteer Code", "Team" }); the app reads `Team` from there
 *          to pick the workspace and enforce access control.
 *  DATA  : Dynamic collections (`wifi`, `volunteers`, `inventory`, `reports`, `meetups`) are streamed and mutated
 *          live from Firebase Firestore with `onSnapshot`.
 *          Venue rooms are completely detached from Firestore and streamed directly from the live Google Sheet
 *          backend (published CSV) to preserve Firestore quota.
 */
(function () {
  var FB = window.TECHOPS_FIREBASE || {}, D = window.TechOpsData;
  var LIVE = !!(FB.apiKey && FB.projectId);
  var SDK_PRIMARY = "https://www.gstatic.com/firebasejs/10.12.2/";
  var SDK_FALLBACK = "https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.2/";
  var COLS = ["wifi", "volunteers", "inventory", "meetups"]; // "rooms" and "reports" migrated to Google Sheet
  var KEYFIELD = { rooms: "code", wifi: "id", volunteers: "code", team: "name", inventory: "id", reports: "id", meetups: "id" };
  var NUMERIC = { capacity: 1, x: 1, y: 1, mbps: 1, latency: 1, qty: 1 };
  var FLOOR_NAMES = { B: "Basement", G: "Ground Floor", F: "First Floor", S: "Second Floor" };
  var FLOOR_SHORT = { B: "Basement", G: "Ground", F: "First", S: "Second" };
  var TYPE_LABEL = {
    "chairs": "Classroom",
    "cr": "Classroom",
    "classroom": "Classroom",
    "small lecture": "Small Lecture Hall",
    "slh": "Small Lecture Hall",
    "small lecture hall": "Small Lecture Hall",
    "bring your device": "Bring Your Own Device",
    "byod": "Bring Your Own Device",
    "bring your own device": "Bring Your Own Device",
    "lecture": "Lecture Hall",
    "lh": "Lecture Hall",
    "lecture hall": "Lecture Hall",
    "outer stage": "Outer Stage",
    "stage": "Outer Stage",
    "prayer room": "Prayer Room",
    "cafeteria": "Cafeteria",
    "break area": "Break Area"
  };
  var SESSION_KEY = "techops_volunteer_code", SESSION_SEEN = "techops_session_seen", SESSION_USER = "techops_volunteer_user";
  var GRACE = Number((window.TECHOPS_CONFIG || {}).SESSION_GRACE_MS) || (24 * 60 * 60 * 1000);

  /* Live Google Sheet CSV URL for Venue Rooms */
  var ROOMS_SHEET_URL = (window.TECHOPS_CONFIG && window.TECHOPS_CONFIG.ROOMS_SHEET_URL) || "https://docs.google.com/spreadsheets/d/1DS0NdFr91kCVAOi_YTrd_suV2DnEadu_U5qTyhPJ4Iw/export?format=csv";
  var ROOMS_CACHE_KEY = "techops_rooms_sheet_cache_v1";

  /* Purge any legacy local/static cache keys so only live data is ever used */
  try {
    localStorage.removeItem("techops_local_db_v1");
    localStorage.removeItem("techops_firestore_cache_v2");
    localStorage.removeItem("rooms_fb_v2");
    localStorage.removeItem("rooms");
  } catch (e) {}

  /* ---------------------------------------------------------------- Google Sheet Rooms Parser & Cache */
  function parseCsv(text) {
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"') {
          if (next === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ""; }
        else if (c === '\r') { /* ignore */ }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
        else { field += c; }
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  var roomsLoadingPromise = null;
  function fetchRoomsFromSheet(forceRefresh) {
    if (!forceRefresh && cache.rooms && cache.rooms.length) {
      ready["rooms"] = true;
      checkReady();
      return Promise.resolve(cache.rooms);
    }
    if (!forceRefresh) {
      try {
        var cachedRaw = sessionStorage.getItem(ROOMS_CACHE_KEY);
        if (cachedRaw) {
          var parsedCached = JSON.parse(cachedRaw);
          if (Array.isArray(parsedCached) && parsedCached.length) {
            cache.rooms = parsedCached;
            ready["rooms"] = true;
            checkReady();
            return Promise.resolve(cache.rooms);
          }
        }
      } catch (e) {}
    }

    if (roomsLoadingPromise && !forceRefresh) return roomsLoadingPromise;

    var url = (window.TECHOPS_CONFIG && window.TECHOPS_CONFIG.ROOMS_SHEET_URL) || ROOMS_SHEET_URL;
    roomsLoadingPromise = fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " fetching rooms sheet");
        return res.text();
      })
      .then(function (csvText) {
        var table = parseCsv(csvText);
        if (!table || table.length < 2) throw new Error("Empty or invalid rooms CSV");
        var headers = table[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
        var colMap = {};
        headers.forEach(function (h, idx) {
          if (h === "room code" || h === "code" || h === "room id" || h === "id") colMap.code = idx;
          else if (h === "floor") colMap.floor = idx;
          else if (h === "floor code") colMap.floorCode = idx;
          else if (h === "wing") colMap.wing = idx;
          else if (h === "room no." || h === "room no" || h === "room number" || h === "number") colMap.num = idx;
          else if (h === "room type" || h === "space type" || h === "type") colMap.type = idx;
          else if (h === "physical capacity" || h === "capacity") colMap.capacity = idx;
          else if (h === "assigned capacity" || h === "cap") colMap.cap = idx;
          else if (h === "room use / function" || h === "function" || h === "use" || h === "assignment type") colMap.use = idx;
          else if (h === "notes") colMap.notes = idx;
          else if (h === "team names" || h === "teams") colMap.teams = idx;
          else if (h === "challenges" || h === "challenge") colMap.chal = idx;
          else if (h === "team leaders" || h === "leaders" || h === "lead manager") colMap.resp = idx;
          else if (h === "leader phones" || h === "phones") colMap.phones = idx;
          else if (h === "x") colMap.x = idx;
          else if (h === "y") colMap.y = idx;
        });

        var parsedRooms = [];
        for (var r = 1; r < table.length; r++) {
          var row = table[r];
          if (!row || !row.length) continue;
          var code = String(colMap.code !== undefined ? row[colMap.code] : (row[0] || "")).trim();
          if (!code) continue;

          var flName = String(colMap.floor !== undefined ? row[colMap.floor] : "").trim();
          var flCode = String(colMap.floorCode !== undefined ? row[colMap.floorCode] : "").trim();
          var fl = flCode || floorId(flName) || "G";

          var wing = String(colMap.wing !== undefined ? row[colMap.wing] : "").trim();
          var num = String(colMap.num !== undefined ? row[colMap.num] : "").trim();
          var rtype = String(colMap.type !== undefined ? row[colMap.type] : "").trim();
          var pcap = colMap.capacity !== undefined ? row[colMap.capacity] : "";
          var acap = colMap.cap !== undefined ? row[colMap.cap] : "";
          var use = String(colMap.use !== undefined ? row[colMap.use] : "").trim();
          var notes = String(colMap.notes !== undefined ? row[colMap.notes] : "").trim();
          var teamsStr = String(colMap.teams !== undefined ? row[colMap.teams] : "").trim();
          var chal = String(colMap.chal !== undefined ? row[colMap.chal] : "").trim();
          var resp = String(colMap.resp !== undefined ? row[colMap.resp] : "").trim();
          var phones = String(colMap.phones !== undefined ? row[colMap.phones] : "").trim();
          var xVal = colMap.x !== undefined ? row[colMap.x] : "";
          var yVal = colMap.y !== undefined ? row[colMap.y] : "";

          var isVol = (use && use.toLowerCase() === "volunteers");
          var capValNum = acap ? Number(acap) : (pcap ? Number(pcap) : 0);
          parsedRooms.push({
            code: code,
            name: use && use !== "Participants" ? use : code,
            floor: fl,
            floorName: FLOOR_NAMES[fl] || flName,
            wing: wing,
            roomNo: num,
            type: rtype,
            capacity: pcap ? Number(pcap) : 0,
            cap: capValNum,
            mode: use,
            zone: use,
            assigned: use === "Unassigned" ? "" : use,
            resp: resp,
            notes: notes,
            vteam: isVol ? notes : "",
            vcap: isVol ? capValNum : 0,
            chal: chal,
            teams: teamsStr ? teamsStr.split(/[\n;,]/).map(function (s) { return s.trim(); }).filter(Boolean) : [],
            phones: phones,
            x: xVal ? Number(xVal) : undefined,
            y: yVal ? Number(yVal) : undefined
          });
        }

        cache.rooms = parsedRooms;
        ready["rooms"] = true;
        try {
          sessionStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(parsedRooms));
        } catch (e) {}
        checkReady();
        emit();
        roomsLoadingPromise = null;
        return cache.rooms;
      })
      .catch(function (err) {
        console.warn("Failed to fetch rooms from Google Sheet, falling back to seed/data:", err);
        var fallbackRooms = (window.TechOpsSeed && window.TechOpsSeed.rooms) || [];
        if (Array.isArray(fallbackRooms) && fallbackRooms.length) {
          cache.rooms = fallbackRooms.slice();
        } else if (D && D.FLOORS) {
          var synth = [];
          D.FLOORS.forEach(function (fl) {
            fl.rooms.forEach(function (r) {
              synth.push({ code: r.code, floor: fl.id, floorName: fl.name, type: "Classroom", x: r.cx, y: r.cy });
            });
          });
          cache.rooms = synth;
        }
        ready["rooms"] = true;
        checkReady();
        emit();
        roomsLoadingPromise = null;
        return cache.rooms;
      });

    return roomsLoadingPromise;
  }

  var REPORTS_CACHE_KEY = "techops_requests_sheet_cache_v1";
  var reportsLoadingPromise = null;
  var REQUESTS_API_URL = (window.TECHOPS_CONFIG && window.TECHOPS_CONFIG.REQUESTS_API_URL) || "";
  var REQUESTS_SHEET_CSV_URL = (window.TECHOPS_CONFIG && window.TECHOPS_CONFIG.REQUESTS_SHEET_CSV_URL) || "https://docs.google.com/spreadsheets/d/1DS0NdFr91kCVAOi_YTrd_suV2DnEadu_U5qTyhPJ4Iw/gviz/tq?tqx=out:csv&sheet=Requests";

  function sendRequestsApi(payload) {
    var apiUrl = (window.TECHOPS_CONFIG && window.TECHOPS_CONFIG.REQUESTS_API_URL) || REQUESTS_API_URL;
    if (!apiUrl || apiUrl.indexOf("YOUR_DEPLOYED_APP_ID") !== -1 || apiUrl.indexOf("placeholder") !== -1) {
      console.log("[Requests Backend] Local queue mode (configure REQUESTS_API_URL with your deployed Apps Script):", payload);
      return Promise.resolve({ ok: true, offline: true });
    }
    return fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    }).then(function (res) {
      return res.json().catch(function () { return { ok: true }; });
    }).catch(function (err) {
      console.warn("[Requests Backend] Sync error (stored locally):", err);
      return { ok: false, error: err };
    });
  }

  function fetchReportsFromSheet(forceRefresh) {
    if (!forceRefresh && cache.reports && cache.reports.length) {
      ready["reports"] = true;
      checkReady();
      return Promise.resolve(cache.reports);
    }
    if (!forceRefresh) {
      try {
        var cachedRaw = sessionStorage.getItem(REPORTS_CACHE_KEY) || localStorage.getItem(REPORTS_CACHE_KEY);
        if (cachedRaw) {
          var parsedCached = JSON.parse(cachedRaw);
          if (Array.isArray(parsedCached) && parsedCached.length) {
            cache.reports = parsedCached;
            ready["reports"] = true;
            checkReady();
            return Promise.resolve(cache.reports);
          }
        }
      } catch (e) {}
    }

    if (reportsLoadingPromise && !forceRefresh) return reportsLoadingPromise;

    var apiUrl = (window.TECHOPS_CONFIG && window.TECHOPS_CONFIG.REQUESTS_API_URL) || REQUESTS_API_URL;
    var csvUrl = (window.TECHOPS_CONFIG && window.TECHOPS_CONFIG.REQUESTS_SHEET_CSV_URL) || REQUESTS_SHEET_CSV_URL;

    var p;
    if (apiUrl && apiUrl.indexOf("YOUR_DEPLOYED_APP_ID") === -1 && apiUrl.indexOf("placeholder") === -1) {
      p = fetch(apiUrl + "?team=all&status=all")
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (json) {
          if (json && (json.data || json.reports)) {
            var rawList = json.data || json.reports || [];
            return rawList.map(normaliseReport);
          }
          throw new Error("Invalid API response format");
        })
        .catch(function (err) {
          console.warn("API GET failed, falling back to Google Sheet Requests CSV:", err);
          return fetchCsvReports(csvUrl);
        });
    } else {
      p = fetchCsvReports(csvUrl);
    }

    reportsLoadingPromise = p.then(function (list) {
      cache.reports = list;
      ready["reports"] = true;
      try {
        sessionStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(list));
        localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(list));
      } catch (e) {}
      checkReady();
      emit();
      reportsLoadingPromise = null;
      return cache.reports;
    }).catch(function (err) {
      console.warn("Failed to fetch reports from Sheet/API:", err);
      ready["reports"] = true;
      checkReady();
      reportsLoadingPromise = null;
      return cache.reports || [];
    });

    return reportsLoadingPromise;
  }

  function fetchCsvReports(csvUrl) {
    return fetch(csvUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " fetching requests CSV");
        return res.text();
      })
      .then(function (csvText) {
        var table = parseCsv(csvText);
        if (!table || table.length < 2) return [];
        var headers = table[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
        var colMap = {};
        headers.forEach(function (h, idx) {
          if (h === "taskid" || h === "task id" || h === "id" || h === "reportid") colMap.id = idx;
          else if (h === "timestamp" || h === "ts" || h === "time" || h === "date") colMap.ts = idx;
          else if (h === "teamassigned" || h === "team" || h === "team assigned") colMap.team = idx;
          else if (h === "floor") colMap.floor = idx;
          else if (h === "room") colMap.room = idx;
          else if (h === "issuedescription" || h === "issue" || h === "description") colMap.issue = idx;
          else if (h === "status") colMap.status = idx;
          else if (h === "claimedby" || h === "assigned" || h === "claimed by") colMap.claimedBy = idx;
          else if (h === "wifidata" || h === "wifi" || h === "wifi data") colMap.wifi = idx;
          else if (h === "details" || h === "note" || h === "notes") colMap.details = idx;
          else if (h === "reporter") colMap.reporter = idx;
          else if (h === "claimedat" || h === "claimed at") colMap.claimedAt = idx;
          else if (h === "resolvedat" || h === "resolved at") colMap.resolvedAt = idx;
          else if (h === "handedby" || h === "handed by") colMap.handedBy = idx;
        });

        var parsed = [];
        for (var r = 1; r < table.length; r++) {
          var row = table[r];
          if (!row || !row.length) continue;
          var taskId = String(colMap.id !== undefined ? row[colMap.id] : (row[0] || "")).trim();
          if (!taskId) continue;

          var item = {
            TaskID: taskId,
            Timestamp: colMap.ts !== undefined ? row[colMap.ts] : "",
            TeamAssigned: colMap.team !== undefined ? row[colMap.team] : "",
            Floor: colMap.floor !== undefined ? row[colMap.floor] : "",
            Room: colMap.room !== undefined ? row[colMap.room] : "",
            IssueDescription: colMap.issue !== undefined ? row[colMap.issue] : "",
            Status: colMap.status !== undefined ? row[colMap.status] : "New",
            ClaimedBy: colMap.claimedBy !== undefined ? row[colMap.claimedBy] : "",
            WifiData: colMap.wifi !== undefined ? row[colMap.wifi] : "",
            Details: colMap.details !== undefined ? row[colMap.details] : "",
            Reporter: colMap.reporter !== undefined ? row[colMap.reporter] : "",
            ClaimedAt: colMap.claimedAt !== undefined ? row[colMap.claimedAt] : "",
            ResolvedAt: colMap.resolvedAt !== undefined ? row[colMap.resolvedAt] : "",
            HandedBy: colMap.handedBy !== undefined ? row[colMap.handedBy] : ""
          };
          parsed.push(normaliseReport(item));
        }
        return parsed;
      });
  }


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
    var s = String(name || "").trim().toLowerCase();
    if (!s) return "";
    if (s === "b" || s.indexOf("basement") === 0) return "B";
    if (s === "g" || s.indexOf("ground") === 0) return "G";
    if (s === "f" || s.indexOf("first") === 0) return "F";
    if (s === "s" || s.indexOf("second") === 0) return "S";
    for (var id in FLOOR_NAMES) if (FLOOR_NAMES[id].toLowerCase() === s) return id;
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

  /* ---------------------------------------------------------------- live state (backed strictly by Firestore) */
  var cache = { rooms: [], wifi: [], volunteers: [], inventory: [], reports: [], meetups: [] };
  var ready = {}, listeners = [], user = null, started = false, lastError = null;
  var emitT = 0, readyResolve, readyP = new Promise(function (r) { readyResolve = r; });

  function emit() { clearTimeout(emitT); emitT = setTimeout(function () { listeners.forEach(function (f) { f({ kind: "data" }); }); }, 25); }
  function checkReady() {
    var critical = (TEAM === "TechOps" || TEAM === "Logistics") ? COLS : ["reports"];
    if (critical.every(function (c) { return ready[c]; }) && ready["rooms"]) {
      if (readyResolve) readyResolve();
    }
  }

  function findCacheReport(id) {
    if (!cache.reports) return null;
    return cache.reports.filter(function (r) { return r && (r.id === id || r._id === id); })[0] || null;
  }

  /* ---------------------------------------------------------------- Firebase Firestore backend */
  var fb = { db: null, auth: null, unsubs: [], boot: null };
  function loadScript(name) {
    if (window.firebase && window.firebase.app) {
      if (name === "firebase-app-compat") return Promise.resolve();
      if (name === "firebase-auth-compat" && window.firebase.auth) return Promise.resolve();
      if (name === "firebase-firestore-compat" && window.firebase.firestore) return Promise.resolve();
    }
    return new Promise(function (res, rej) {
      var primary = SDK_PRIMARY + name + ".js";
      var fallback = SDK_FALLBACK + name + ".min.js";
      var s = document.createElement("script");
      s.src = primary;
      s.onload = res;
      s.onerror = function () {
        console.warn("Primary Firebase CDN failed for " + name + ", trying fallback CDN...");
        var fbScript = document.createElement("script");
        fbScript.src = fallback;
        fbScript.onload = res;
        fbScript.onerror = function () {
          rej(fail("sdk", "Could not load the Firebase SDK. Check your internet connection or ad-blocker."));
        };
        document.head.appendChild(fbScript);
      };
      document.head.appendChild(s);
    });
  }
  fb.init = function () {
    if (!LIVE) return Promise.resolve();
    if (fb.boot) return fb.boot;
    fb.boot = loadScript("firebase-app-compat")
      .then(function () { return Promise.all([loadScript("firebase-auth-compat"), loadScript("firebase-firestore-compat")]); })
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp({ apiKey: FB.apiKey, projectId: FB.projectId, appId: FB.appId });
        fb.auth = firebase.auth();
        fb.db = firebase.firestore();
      }).catch(function (err) {
        fb.boot = null;
        throw err;
      });
    return fb.boot;
  };
  fb.authUser = function () {
    if (!LIVE) return Promise.resolve(null);
    return fb.init().then(function () {
      return new Promise(function (res) {
        try {
          var off = fb.auth.onAuthStateChanged(function (u) { off(); res(u); }, function () { res(null); });
        } catch (e) {
          res(null);
        }
      });
    });
  };
  fb.signedIn = function () {
    if (!LIVE) return Promise.resolve({ uid: "demo-user" });
    return fb.authUser().then(function (u) {
      if (u) return u;
      return fb.auth.signInAnonymously().then(function (r) { return r.user; });
    }).catch(function (err) {
      /* If opened via file:// or if Anonymous Auth is restricted by browser environment,
         still allow direct Firestore queries against space-apps-cairo-volunteer. */
      if (fb.db) return null;
      throw err;
    });
  };
  fb.getVolunteer = function (code) {
    if (!LIVE) {
      var seed = (window.TechOpsSeed && window.TechOpsSeed.volunteers) ? window.TechOpsSeed.volunteers[code] : null;
      if (seed) return Promise.resolve(Object.assign({ "Volunteer Code": code }, seed));
      if (code === "TO-001" || code === "TO-002") return Promise.resolve({ "Volunteer Code": code, Name: code === "TO-001" ? "Mohamed Khairy" : "Tech Volunteer", Team: "TechOps", Role: "TechOps" });
      if (code === "LG-001" || code === "LG-002") return Promise.resolve({ "Volunteer Code": code, Name: "Logistics Volunteer", Team: "Logistics", Role: "Logistics" });
      if (code === "CT-001") return Promise.resolve({ "Volunteer Code": "CT-001", Name: "Competition Lead", Team: "Competition", Role: "Competition" });
      if (code === "CT-002") return Promise.resolve({ "Volunteer Code": "CT-002", Name: "Competition Volunteer", Team: "Competition", Role: "Competition" });
      if (code === "NSAC-2026") return Promise.resolve({ "Volunteer Code": "NSAC-2026", Name: "General Volunteer", Team: "Volunteer", Role: "Volunteer" });
      return Promise.reject(fail("invalid", "We couldn't find that volunteer code in Firebase. Check it and try again."));
    }
    return fb.signedIn().then(function () {
      return fb.db.collection("volunteers").doc(code).get();
    }).then(function (d) {
      if (d && d.exists) {
        return Object.assign({ "Volunteer Code": d.id }, d.data());
      }
      /* Fallback query in case a volunteer document was created with an auto-generated ID in Firebase Console */
      return fb.db.collection("volunteers").where("Volunteer Code", "==", code).limit(1).get().then(function (snap) {
        if (snap && !snap.empty) {
          var doc = snap.docs[0];
          return Object.assign({ "Volunteer Code": code }, doc.data());
        }
        return fb.db.collection("volunteers").where("code", "==", code).limit(1).get().then(function (snap2) {
          if (snap2 && !snap2.empty) {
            var doc2 = snap2.docs[0];
            return Object.assign({ "Volunteer Code": code }, doc2.data());
          }
          return null;
        });
      });
    });
  };
  fb.bindSession = function (code) {
    if (!LIVE) return Promise.resolve();
    return fb.signedIn().then(function (u) {
      if (!u || !u.uid) return Promise.resolve();
      return fb.db.collection("sessions").doc(u.uid).set({ code: code, at: stamp() }).catch(function () {});
    });
  };
  fb.start = function () {
    fb.stop();
    fetchRoomsFromSheet();
    if (!LIVE) {
      COLS.forEach(function (col) {
        if (!cache[col] || !cache[col].length) {
          var s = window.TechOpsSeed && window.TechOpsSeed[col];
          if (s) {
            cache[col] = Array.isArray(s) ? s.slice() : Object.keys(s).map(function (k) { var x = Object.assign({}, s[k]); x._id = k; if (!x.id) x.id = k; return x; });
          } else {
            cache[col] = [];
          }
        }
        ready[col] = true;
      });
      checkReady();
      emit();
      return Promise.resolve();
    }
    var prep = (user && user.code) ? fb.bindSession(user.code) : fb.signedIn();
    return prep.then(function () {
      COLS.forEach(function (col) {
        var ref = fb.db.collection(col);
        if (col === "reports") ref = ref.where("team", "==", TEAM);
        fb.unsubs.push(ref.onSnapshot(function (snap) {
          lastError = null;
          cache[col] = snap.docs.map(function (d) { var o = d.data(); o._id = d.id; return o; });
          ready[col] = true; checkReady(); emit();
        }, function (err) {
          lastError = err;
          ready[col] = true; checkReady(); emit();
        }));
      });
    });
  };
  fb.set = function (col, id, obj) {
    if (!LIVE) {
      var arr = cache[col] = cache[col] || [];
      var found = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id || arr[i]._id === id) {
          Object.assign(arr[i], obj);
          found = true;
          break;
        }
      }
      if (!found) {
        var copy = Object.assign({ id: id, _id: id }, obj);
        arr.push(copy);
      }
      emit();
      return Promise.resolve();
    }
    return fb.signedIn().then(function () {
      return fb.db.collection(col).doc(id).set(obj, { merge: true });
    });
  };
  fb.update = function (col, id, fields) {
    if (!LIVE) {
      var arr = cache[col] = cache[col] || [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id || arr[i]._id === id) {
          Object.assign(arr[i], fields);
          break;
        }
      }
      emit();
      return Promise.resolve();
    }
    return fb.signedIn().then(function () {
      return fb.db.collection(col).doc(id).update(fields);
    });
  };
  /* Transactional: two volunteers can never claim the same task. */
  fb.mutateReport = function (id, fn) {
    if (!LIVE) {
      var r = findCacheReport(id);
      if (!r) throw fail("missing", "This task no longer exists.");
      var updated = fn(r);
      Object.assign(r, updated);
      emit();
      return Promise.resolve();
    }
    return fb.signedIn().then(function () {
      var ref = fb.db.collection("reports").doc(id);
      return fb.db.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) {
          if (!snap.exists) {
            var localMatch = findCacheReport(id);
            if (localMatch) return;
            throw fail("missing", "This task no longer exists.");
          }
          tx.update(ref, fn(snap.data()));
        });
      });
    });
  };
  fb.stop = function () { fb.unsubs.forEach(function (u) { u(); }); fb.unsubs = []; };
  fb.signOut = function () {
    if (!LIVE) return Promise.resolve();
    return fb.init().then(function () { return fb.auth.signOut().catch(function () {}); });
  };

  function backend() { return fb; }

  /* ---------------------------------------------------------------- normalise */
  function normaliseRoom(r) {
    var code = String(r.code || r._id || "").trim();
    var fl = r.floor || floorId(r.floorName || r.Floor) || "G";
    var flName = FLOOR_NAMES[fl] || r.floorName || "";
    var rawType = String(r.type || r["Room Type"] || r.roomType || "").trim();
    var displayType = TYPE_LABEL[rawType.toLowerCase()] || rawType || "Classroom";
    var teamsList = Array.isArray(r.teams)
      ? r.teams.map(function (s) { return String(s || "").trim(); }).filter(Boolean)
      : (r.teams ? String(r.teams).split(/[\n;,]/).map(function (s) { return s.trim(); }).filter(Boolean) : []);
    var capVal = r.cap !== undefined && r.cap !== ""
      ? Number(r.cap)
      : (r.capacity !== undefined && r.capacity !== "" ? Number(r.capacity) : 0);
    var rawMode = String(r.mode || r.zone || r.assigned || r.use || "Unassigned").trim();
    var normMode = /^participants$/i.test(rawMode)
      ? "Participants"
      : /^volunteers$/i.test(rawMode)
        ? "Volunteers"
        : /^judges?$/i.test(rawMode)
          ? "Judges"
          : /^mentors?$/i.test(rawMode)
            ? "Mentors"
            : /^vips?$/i.test(rawMode)
              ? "VIPs"
              : (rawMode || "Unassigned");
    var rawAccess = String(r.access || "").trim().toLowerCase();
    var normAccess = (rawAccess === "no" || rawAccess === "restricted" || r.type === "X") ? "no" : "ok";
    var vteamVal = normMode === "Volunteers" ? (r.notes || r.vteam || "") : (r.vteam || "");
    var vcapVal = normMode === "Volunteers" ? (capVal || (r.vcap !== undefined && r.vcap !== "" ? Number(r.vcap) : 0)) : (r.vcap !== undefined && r.vcap !== "" ? Number(r.vcap) : 0);

    var geo = null;
    if (D && D.FLOORS) {
      for (var fi = 0; fi < D.FLOORS.length; fi++) {
        var match = D.FLOORS[fi].rooms.filter(function (gr) { return gr.code === code; })[0];
        if (match) { geo = match; break; }
      }
    }

    var cx = (geo && geo.cx) || (r.x ? Number(r.x) : 0) || (r.cx ? Number(r.cx) : 0);
    var cy = (geo && geo.cy) || (r.y ? Number(r.y) : 0) || (r.cy ? Number(r.cy) : 0);
    var pts = (geo && geo.pts) || r.pts || [];
    var bb = (geo && geo.bb) || r.bb || null;

    return {
      id: code,
      _id: code,
      code: code,
      name: r.name || (r.use && r.use !== normMode ? r.use : code),
      label: r.label || code,
      floor: fl,
      floorName: flName,
      wing: r.wing || "",
      roomNo: r.roomNo || "",
      type: displayType,
      capacity: capVal,
      cap: capVal,
      mode: normMode,
      zone: normMode,
      assigned: normMode === "Unassigned" ? "" : normMode,
      resp: (fl === "F" ? "martina" : (fl === "S" ? "Alii Eldeen" : "")),
      access: normAccess,
      chal: r.chal || r.challenges || "",
      teams: teamsList,
      vteam: vteamVal,
      vcap: vcapVal,
      notes: r.notes || "",
      phones: r.phones || "",
      x: cx,
      y: cy,
      cx: cx,
      cy: cy,
      pts: pts,
      bb: bb
    };
  }
  
  function normaliseReport(raw) {
    var id = String(raw.TaskID || raw.taskId || raw.id || raw._id || "").trim();
    var ts = String(raw.Timestamp || raw.timestamp || raw.ts || "").trim();
    var team = String(raw.TeamAssigned || raw.teamAssigned || raw.team || "TechOps").trim();
    var fl = String(raw.Floor || raw.floor || "").trim();
    var flCode = fl.length === 1 ? fl.toUpperCase() : (floorId(fl) || "");
    var flName = FLOOR_NAMES[flCode] || fl || "";
    var room = String(raw.Room || raw.room || "").trim();
    var issue = String(raw.IssueDescription || raw.issueDescription || raw.issue || "").trim();
    var statusRaw = String(raw.Status || raw.status || "New").trim();
    var status = (/^done$|^resolved$/i.test(statusRaw)) ? "Resolved" : (/^in progress$|^claimed$/i.test(statusRaw) ? "In Progress" : "New");
    var assigned = String(raw.ClaimedBy || raw.claimedBy || raw.assigned || "").trim();
    var wifi = String(raw.WifiData || raw.wifiData || raw.wifi || "").trim();
    var details = String(raw.Details || raw.details || "").trim();
    var reporter = String(raw.Reporter || raw.reporter || "").trim();
    var claimedAt = String(raw.ClaimedAt || raw.claimedAt || "").trim();
    var resolvedAt = String(raw.ResolvedAt || raw.resolvedAt || "").trim();
    var handedBy = String(raw.HandedBy || raw.handedBy || "").trim();

    return {
      id: id,
      _id: id,
      taskId: id,
      ts: ts,
      timestamp: ts,
      team: team,
      teamAssigned: team,
      floor: flCode,
      floorName: flName,
      room: room,
      issue: issue,
      issueDescription: issue,
      details: details,
      status: status,
      assigned: assigned,
      claimedBy: assigned,
      wifi: wifi,
      wifiData: wifi,
      reporter: reporter,
      claimedAt: claimedAt,
      resolvedAt: resolvedAt,
      handedBy: handedBy
    };
  }

  function normaliseVolunteer(v) {
    var code = String(v["Volunteer Code"] || v.code || v._id || "").trim();
    var name = String(v.Name || v.name || "").trim();
    var team = String(v.Team || v.team || "Volunteers").trim();
    var role = String(v.Role || v.role || team).trim();
    var status = String(v.status || "Off duty").trim();
    var fl = v.floor || floorId(v.floorName) || "";
    var flName = FLOOR_NAMES[fl] || v.floorName || "";
    var room = String(v.room || "").trim();
    var updated = v.updated || "";
    var lastSeen = Number(v.lastSeen) || (v.lastSeen ? Date.parse(v.lastSeen) : 0) || 0;
    return {
      code: code,
      name: name,
      team: team,
      role: role,
      status: status,
      floor: fl,
      floorName: flName,
      room: room,
      updated: updated,
      lastSeen: lastSeen
    };
  }
  function normalise(col, docs) {
    var key = KEYFIELD[col];
    return docs.map(function (raw) {
      var o;
      if (col === "rooms") o = normaliseRoom(raw);
      else if (col === "volunteers") o = normaliseVolunteer(raw);
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
      { id: "TUT-TO-02", ts: stamp(), floor: "F", floorName: "First Floor", room: "C133", issue: "Need TechOps assistance", details: "[Training Ticket] Projector HDMI resolution is not detected by presenter laptop.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Judges Panel 1", team: "TechOps" },
      { id: "TUT-TO-03", ts: stamp(), floor: "F", floorName: "First Floor", room: "C139", issue: "Electricity / Power problem", details: "[Training Ticket] Outlet tripped at back desk, requesting power extension strip.", status: "In Progress", assigned: "Mohamed Khairy", claimedAt: stamp(), resolvedAt: "", reporter: "Team Nova", team: "TechOps" },

      { id: "TUT-LG-01", ts: stamp(), floor: "S", floorName: "Second Floor", room: "B231", issue: "Help request", details: "[Training Ticket] Lost participant badge, requesting replacement lanyard and badge.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Team Vega", team: "Logistics" },
      { id: "TUT-LG-02", ts: stamp(), floor: "F", floorName: "First Floor", room: "A113", issue: "Prayer request", details: "[Training Ticket] Nearest direction to Women prayer hall.", status: "New", assigned: "", claimedAt: "", resolvedAt: "", reporter: "Participant Sarah", team: "Logistics" },
      { id: "TUT-LG-03", ts: stamp(), floor: "G", floorName: "Ground Floor", room: "B016", issue: "Go to a place", details: "[Training Ticket] Guidance escort from entrance to main auditorium.", status: "In Progress", assigned: "Norhan Yasser", claimedAt: stamp(), resolvedAt: "", reporter: "Guest Speaker", team: "Logistics" },

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
    emit();
  }

  /* ---------------------------------------------------------------- real-time read */
  function start() {
    setInterval(function () { if (started && !document.hidden) fetchReportsFromSheet(true); }, 7500);
    if (started) return readyP;
    started = true;
    fb.start().catch(function (e) {
      lastError = e;
      COLS.forEach(function (c) { ready[c] = true; });
      checkReady();
      emit();
    });
    setTimeout(readyResolve, 5000);
    return readyP;
  }
  function loadAll() {
    if (!started) start();
    return Promise.all([fetchRoomsFromSheet(), fetchReportsFromSheet()]).then(function (results) {
      var roomsList = results[0];
      var reportsList = results[1];
      var critical = (TEAM === "TechOps" || TEAM === "Logistics") ? COLS : [];
      var isSynced = critical.every(function (c) { return ready[c]; });
      var p = (_tutorialMode || isSynced) ? Promise.resolve() : Promise.race([readyP.catch(function () {}), new Promise(function(res){ setTimeout(res, 300); })]);
      return p.then(function () {
        var geo = {};
        if (D && D.ALL) D.ALL.forEach(function (g) { geo[g.code] = 1; });
        var nowSynced = critical.every(function (c) { return ready[c]; });
        var out = { meta: { live: LIVE, online: !lastError, synced: nowSynced, error: lastError ? friendly(lastError) : "", fetchedAt: new Date(), user: user } };
        COLS.forEach(function (c) { out[c] = normalise(c, cache[c] || []); });
        out.rooms = (roomsList || cache.rooms || []).map(normaliseRoom);
        out.reports = (reportsList || cache.reports || []).map(normaliseReport);
        out.team = out.volunteers || [];
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
        /* allRooms = every room document from Google Sheet (Maps also needs STAGE, PR-F, PR-M, etc.); rooms = only the ones that have geometry */
        out.allRooms = out.rooms.slice();
        if (D && D.ALL) out.rooms = out.rooms.filter(function (r) { return geo[r.code]; });
      if (out.wifi) {
        var validRoomMap = {};
        (out.allRooms || []).forEach(function (r) { if (r && r.code) validRoomMap[r.code] = r; });
        out.wifi = out.wifi.filter(function (w) {
          if (!w) return false;
          var rc = w.room || (w.id ? w.id.replace(/^WF-/, "") : "");
          var matched = validRoomMap[rc];
          if (!matched) return false;
          // Strictly only include tested Wi-Fi readings
          if (w.tested !== true && w.tested !== "true") return false;
          w.room = rc;
          if (!w.floor && matched.floor) w.floor = matched.floor;
          if (!w.floorName && matched.floorName) w.floorName = matched.floorName;
          if (!w.x && matched.cx) w.x = matched.cx;
          if (!w.y && matched.cy) w.y = matched.cy;
          return true;
        });
      }
      return out;
    });
  });
}

  /* ---------------------------------------------------------------- auth & RBAC */
  function normalizeCode(c) { return String(c || "").trim().toUpperCase().replace(/\s+/g, ""); }
  function toUser(v, fallbackCode) {
    if (!v) return null;
    var name = v.Name || v.name || "";
    if (!name) return null;
    var code = String(v["Volunteer Code"] || v.code || v.volunteerCode || fallbackCode || "");
    var team = String(v.Team || v.team || "Volunteers");
    var role = String(v.Role || v.role || (team.toLowerCase() === "admin" ? "Admin" : team));
    return { name: String(name), code: code, team: team, role: role };
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
  function setVolunteerOffline(code) {
    if (!code) return;
    var nowStr = stamp();
    var patch = { status: "Off duty", lastSeen: 0, updated: nowStr };
    if (user && user.code === code) {
      user.status = "Off duty";
      user.lastSeen = 0;
      saveSessionUser(code, user);
    }
    if (cache.volunteers) {
      for (var i = 0; i < cache.volunteers.length; i++) {
        var v = cache.volunteers[i];
        if (v.code === code || v._id === code || v["Volunteer Code"] === code) {
          v.status = "Off duty";
          v.lastSeen = 0;
          v.updated = nowStr;
          break;
        }
      }
      emit();
    }
    try {
      if (LIVE && fb.set) {
        fb.set("volunteers", code, patch).catch(function () {});
      }
    } catch (e) {}
    try {
      var proj = (window.NASA_FIREBASE_CONFIG && window.NASA_FIREBASE_CONFIG.projectId) || "space-apps-cairo-volunteer";
      var url = "https://firestore.googleapis.com/v1/projects/" + proj + "/databases/(default)/documents/volunteers/" + encodeURIComponent(code) + "?updateMask.fieldPaths=status&updateMask.fieldPaths=lastSeen&updateMask.fieldPaths=updated";
      var body = JSON.stringify({
        fields: {
          status: { stringValue: "Off duty" },
          lastSeen: { integerValue: "0" },
          updated: { stringValue: nowStr }
        }
      });
      if (window.fetch) {
        window.fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: body
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function setVolunteerOnline(code, floor, room) {
    if (!code) return;
    var nowMs = Date.now();
    var nowStr = stamp();
    var patch = {
      status: "Available",
      lastSeen: nowMs,
      updated: nowStr
    };
    if (floor) { patch.floor = floor; patch.floorName = FLOOR_NAMES[floor] || ""; }
    if (room) patch.room = room;
    if (user && user.code === code) {
      user.status = "Available";
      user.lastSeen = nowMs;
      if (floor) { user.floor = floor; user.floorName = FLOOR_NAMES[floor] || ""; }
      if (room) user.room = room;
      saveSessionUser(code, user);
    }
    if (cache.volunteers) {
      for (var i = 0; i < cache.volunteers.length; i++) {
        var v = cache.volunteers[i];
        if (v.code === code || v._id === code || v["Volunteer Code"] === code) {
          Object.assign(v, patch);
          break;
        }
      }
      emit();
    }
    try {
      if (LIVE && fb.set) {
        fb.set("volunteers", code, patch).catch(function () {});
      }
    } catch (e) {}
  }

  function sendPresenceHeartbeat() {
    if (!user || !user.code || !LIVE || document.hidden) return;
    var s = (user.status || "").toLowerCase().trim();
    if (s !== "available" && s !== "online") return;
    var nowMs = Date.now();
    var nowStr = stamp();
    var patch = { lastSeen: nowMs, updated: nowStr };
    try {
      if (LIVE && fb.set) {
        fb.set("volunteers", user.code, patch).catch(function () {});
      }
    } catch (e) {}
  }

  function login(code) {
    code = normalizeCode(code);
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return Promise.reject(fail("invalid", "That volunteer code is not valid."));
    return fb.getVolunteer(code).then(function (v) {
      var u = toUser(v, code);
      if (!u) throw fail("invalid", "We couldn't find that volunteer code in Firebase. Check it and try again.");
      var prevTeam = TEAM;
      user = u;
      setTeam(u);
      saveSessionUser(code, u);
      if (started && prevTeam !== TEAM) {
        ready.reports = false;
        fb.start().catch(function () {});
      }
      return fb.bindSession(code).then(function () {
        setVolunteerOnline(code, u.floor, u.room);
        return u;
      });
    }).catch(function (err) {
      var cached = peekUser();
      if (cached && cached.code === code) {
        user = cached;
        setTeam(cached);
        return user;
      }
      var pfx = (code[0] || "").toUpperCase();
      var tm = pfx === "T" ? "TechOps" : (pfx === "L" ? "Logistics" : (pfx === "C" ? "Competition" : "Volunteers"));
      var fbUser = { code: code, name: (cached && cached.name) || code, team: tm, role: tm, status: "Available" };
      user = fbUser;
      setTeam(fbUser);
      saveSessionUser(code, fbUser);
      return fbUser;
    });
  }
  function restore() {
    var code = sget(SESSION_KEY);
    if (!code) { clearSessionStorage(); return Promise.resolve(null); }
    if (!sessionFresh()) { clearSessionStorage(); fb.signOut().catch(function () {}); return Promise.resolve(null); }
    var cached = peekUser();
    /* Always verify against Firestore `volunteers` collection in the background/foreground */
    return fb.getVolunteer(code).then(function (v) {
      var prevTeam = TEAM;
      user = toUser(v, code);
      setTeam(user);
      if (!user) {
        clearSessionStorage();
        return null;
      }
      saveSessionUser(code, user);
      if (started && prevTeam !== TEAM) {
        ready.reports = false;
        fb.start().catch(function () {});
      }
      return fb.bindSession(code).then(function () {
        setVolunteerOnline(code, user.floor, user.room);
        return user;
      });
    }, function () {
      if (cached) {
        user = cached;
        setTeam(cached);
      }
      return cached || null;
    });
  }
  function logout() {
    var exitingCode = user ? user.code : sget(SESSION_KEY);
    if (exitingCode && LIVE) {
      setVolunteerOffline(exitingCode);
    }
    user = null; clearSessionStorage(); TEAM = "TechOps";
    started = false; ready = {};
    if (LIVE) {
      cache = { rooms: [], wifi: [], volunteers: [], inventory: [], reports: [], meetups: [] };
      readyP = new Promise(function (r) { readyResolve = r; });
      fb.stop();
      return fb.signOut().catch(function () {});
    }
    return Promise.resolve();
  }

  /* ---------------------------------------------------------------- writes (strictly to Firebase Firestore) */
  function guard(p) {
    return p.catch(function (e) { if (window.TO) TO.toast("Couldn't save", friendly(e), "bad"); throw e; });
  }
  function update(name, keyValue, fields) {
    return guard(backend().update(name, keyValue, withFloorNames(Object.assign({}, fields))));
  }
  function recordWifiReading(data) {
    if (!data || !data.room) return Promise.reject(fail("bad_data", "Room is required"));
    var roomCode = String(data.room).trim().toUpperCase();
    var floorId = String(data.floor || "").trim().toUpperCase();

    var geo = null;
    if (D && D.FLOORS) {
      for (var i = 0; i < D.FLOORS.length; i++) {
        var match = D.FLOORS[i].rooms.filter(function (r) { return r.code === roomCode; })[0];
        if (match) { geo = match; if (!floorId) floorId = D.FLOORS[i].id; break; }
      }
    }
    var x = geo ? geo.cx : (Number(data.x) || 0);
    var y = geo ? geo.cy : (Number(data.y) || 0);
    var floorName = FLOOR_NAMES[floorId] || data.floorName || "";
    var docId = "WF-" + roomCode;
    var nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

    var wifiDoc = {
      id: docId,
      room: roomCode,
      floor: floorId,
      floorName: floorName,
      label: "Room " + roomCode,
      x: x,
      y: y,
      mbps: Math.max(1, Math.round(Number(data.mbps) || 0)),
      latency: Math.max(1, Math.round(Number(data.latency) || 0)),
      tested: true,
      updated: nowStr
    };

    if (cache.wifi) {
      var idx = -1;
      for (var j = 0; j < cache.wifi.length; j++) {
        if (cache.wifi[j].id === docId || cache.wifi[j].room === roomCode) { idx = j; break; }
      }
      if (idx >= 0) cache.wifi[idx] = Object.assign({}, cache.wifi[idx], wifiDoc);
      else cache.wifi.push(wifiDoc);
      emit();
    }

    return backend().set("wifi", docId, wifiDoc).then(function () {
      return wifiDoc;
    });
  }

  function addReport(d) {
    var prefix = d.team === "Logistics" ? "LGR" : (d.team === "Competition" ? "CMP" : "RPT");
    var teamName = d.team === "Logistics" || d.team === "Competition" ? d.team : "TechOps";
    var obj = withFloorNames({
      id: newId(prefix),
      taskId: newId(prefix),
      ts: stamp(),
      timestamp: stamp(),
      floor: d.floor || "",
      room: d.room || "",
      issue: clip(d.issue, 80),
      issueDescription: clip(d.issue, 80),
      details: clip(d.details, 500),
      status: "New",
      assigned: "",
      claimedBy: "",
      wifiData: d.wifiData || d.wifi || "",
      claimedAt: "",
      resolvedAt: "",
      reporter: clip(d.reporter, 60),
      team: teamName,
      teamAssigned: teamName
    });

    if (!cache.reports) cache.reports = [];
    cache.reports.unshift(obj);
    try {
      sessionStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
      localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
    } catch (e) {}
    emit();

    sendRequestsApi({
      action: "create",
      id: obj.id,
      taskId: obj.id,
      team: obj.team,
      teamAssigned: obj.team,
      floor: obj.floor,
      room: obj.room,
      issue: obj.issue,
      issueDescription: obj.issue,
      details: obj.details,
      reporter: obj.reporter,
      wifiData: obj.wifiData,
      status: "Open"
    });

    return Promise.resolve({ id: obj.id, demo: false });
  }
  function addMeetup(d) {
    var obj = withFloorNames({
      id: newId("MTG"), ts: stamp(), by: d.by, target: d.target, byFloor: d.byFloor, byRoom: d.byRoom,
      targetFloor: d.targetFloor || "", targetRoom: d.targetRoom || "", meetAt: d.meetAt || "", note: clip(d.note, 300), status: d.status || "Pending",
      byCode: d.byCode || (user ? user.code : ""), targetCode: d.targetCode || ""
    });
    return guard(backend().set("meetups", obj.id, obj)).then(function () { return { id: obj.id, demo: false }; });
  }
  function updateVolunteerLocation(d) {
    if (!user || !user.code) return Promise.reject(fail("auth", "Sign in first."));
    var targetCode = (d && d.code) ? d.code : user.code;
    var fl = (d && d.floor) || "";
    var flName = FLOOR_NAMES[fl] || (d && d.floorName) || "";
    var rm = (d && d.room) || "";
    var st = (d && d.status) || "Available";
    var nowMs = Date.now();
    var nowStr = stamp();
    var patch = {
      floor: fl,
      floorName: flName,
      room: rm,
      status: st,
      lastSeen: (st === "Off duty" || st === "Offline") ? 0 : nowMs,
      updated: nowStr
    };
    if (user && user.code === targetCode) {
      user.floor = fl;
      user.floorName = flName;
      user.room = rm;
      user.status = st;
      user.lastSeen = patch.lastSeen;
      saveSessionUser(user.code, user);
    }
    if (cache.volunteers) {
      for (var i = 0; i < cache.volunteers.length; i++) {
        var v = cache.volunteers[i];
        if (v.code === targetCode || v._id === targetCode || v["Volunteer Code"] === targetCode) {
          Object.assign(v, patch);
          break;
        }
      }
      emit();
    }
    return guard(backend().set("volunteers", targetCode, patch)).then(function () {
      return patch;
    });
  }
  /* One-click claim: assigns the task to the signed-in volunteer and moves it to "In Progress". */
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
    if (target) {
      if (target.status === "Resolved") return Promise.reject(fail("claimed", "This task is already resolved."));
      if (target.assigned && target.assigned !== user.name) return Promise.reject(fail("claimed", "Already claimed by " + target.assigned + "."));
      target.assigned = user.name;
      target.claimedBy = user.name;
      target.status = "In Progress";
      target.claimedAt = stamp();
      try {
        sessionStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
        localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
      } catch (e) {}
      emit();
    }

    sendRequestsApi({
      action: "claim",
      id: id,
      taskId: id,
      user: user.name,
      claimedBy: user.name,
      status: "In Progress"
    });

    return Promise.resolve({ id: id, status: "In Progress", assigned: user.name });
  }
  /* One-click resolve: only the volunteer who claimed the task can resolve it. */
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
    if (target) {
      if (target.assigned && target.assigned !== user.name && target.handedBy !== user.name) {
        return Promise.reject(fail("claimed", "Only " + (target.assigned || "the assignee") + " can resolve this task."));
      }
      target.status = "Resolved";
      target.resolvedAt = stamp();
      target.assigned = target.assigned || user.name;
      try {
        sessionStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
        localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
      } catch (e) {}
      emit();
    }

    sendRequestsApi({
      action: "resolve",
      id: id,
      taskId: id,
      user: user.name,
      status: "Done"
    });

    return Promise.resolve({ id: id, status: "Resolved", resolvedAt: stamp() });
  }
  /* Keep the session alive only while the site is actually open on screen; coming back after being away too long locks again. */
  function expireIfStale() {
    if (sget(SESSION_KEY) && !sessionFresh()) { logout().then(function () { try { location.reload(); } catch (e) {} }); return true; }
    return false;
  }
  function handleExit() {
    markSeen();
    var code = user ? user.code : sget(SESSION_KEY);
    if (code) {
      setVolunteerOffline(code);
    }
  }
  try {
    setInterval(function () {
      if (!document.hidden) {
        markSeen();
        sendPresenceHeartbeat();
      }
    }, 45000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !expireIfStale()) {
        markSeen();
        sendPresenceHeartbeat();
      }
    });
    window.addEventListener("pageshow", function () {
      if (!expireIfStale()) {
        markSeen();
        sendPresenceHeartbeat();
      }
    });
    window.addEventListener("pagehide", handleExit);
    window.addEventListener("beforeunload", handleExit);
  } catch (e) {}
  /* Dispatch only: pass a request you claimed to a Tech Ops / Logistics member. */
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
    if (target) {
      if (target.status === "Resolved") return Promise.reject(fail("claimed", "This task is already resolved."));
      if (target.assigned !== user.name && target.handedBy !== user.name) return Promise.reject(fail("claimed", "Claim this request first."));
      target.assigned = member;
      target.handedBy = user.name;
      target.handedAt = stamp();
      try {
        sessionStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
        localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(cache.reports));
      } catch (e) {}
      emit();
    }

    sendRequestsApi({
      action: "handout",
      id: id,
      taskId: id,
      user: user.name,
      assigned: member,
      member: member
    });

    return Promise.resolve({ id: id, assigned: member, handedBy: user.name });
  }
  function resetDemo() {
    if (!LIVE) {
      cache = { rooms: [], wifi: [], volunteers: [], inventory: [], reports: [], meetups: [] };
      ready = {};
      started = false;
      readyP = new Promise(function (r) { readyResolve = r; });
    }
  }
  function onChange(cb) { listeners.push(cb); }

  window.TechOpsStore = {
    FLOOR_NAMES: FLOOR_NAMES, isLive: function () { return LIVE; }, floorId: floorId, stamp: stamp, parseStamp: parseStamp, friendly: friendly,
    login: login, restore: restore, peekUser: peekUser, logout: logout, currentUser: function () { return user; }, sessionGraceMs: GRACE,
    canAccess: canAccess, teamDisplayName: teamDisplayName, workspaceFor: workspaceFor,
    start: start, loadAll: loadAll, onChange: onChange,
    data: { get rooms() { return cache.rooms; }, get reports() { return cache.reports; } },
    rooms: function () { return cache.rooms; },
    reports: function () { return cache.reports; },
    refreshRooms: function () { return fetchRoomsFromSheet(true); },
    fetchRoomsFromSheet: fetchRoomsFromSheet,
    fetchReportsFromSheet: fetchReportsFromSheet,
    refreshReports: function () { return fetchReportsFromSheet(true); },
    recordWifiReading: recordWifiReading, addReport: addReport, addMeetup: addMeetup, update: update, updateVolunteerLocation: updateVolunteerLocation,
    setVolunteerOffline: setVolunteerOffline, setVolunteerOnline: setVolunteerOnline,
    claimReport: claimReport, resolveReport: resolveReport, handOutReport: handOutReport, resetDemo: resetDemo,
    isTutorialCompleted: isTutorialCompleted, setTutorialCompleted: setTutorialCompleted,
    isTutorialMode: isTutorialMode, enterTutorialMode: enterTutorialMode, exitTutorialMode: exitTutorialMode
  };
  window.Store = window.TechOpsStore;
})();
