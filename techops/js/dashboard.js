/* TechOps Operations Dashboard
 * Fastest Route Wayfinding, Universal QR Issue Alerting, Ping & Meetup Confirmation,
 * Wi-Fi Heatmap, and Mobile-first UX.
 */
(function () {
  var C = window.TECHOPS_CONFIG, D = window.TechOpsData, Store = window.TechOpsStore, Router = window.TechOpsRouter, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  var SEEN_KEY = "techops_seen_reports", SEEN_MEET = "techops_seen_meetups";

  var S = {
    data: null, tab: "issues", floor: "G", layer: "zones", selected: null, pins: true, zone: null,
    issueFilter: "unassigned", issueText: "", first: true,
    activeRoute: null, user: null, busy: {},
    seen: jget(SEEN_KEY, []), seenMeet: jget(SEEN_MEET, []), me: "", alertsOn: false
  };
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return ""; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var map;

  /* ------------------------------------------------------------ Data Loading */
  function load() {
    return Store.loadAll().then(function (d) {
      S.data = d;
      d.roomMap = {}; d.rooms.forEach(function (r) { d.roomMap[r.code] = r; });
      fillRoomDataList();
      detectNew();
      var sig = JSON.stringify([d.rooms, d.wifi, d.team, d.inventory, d.reports, d.meetups, d.meta.online]);
      if (sig === S.sig) { renderHeader(); return; }
      S.sig = sig;
      renderAll();
    });
  }

  function fillRoomDataList() {
    var dl = $("rooms-list");
    if (!dl || dl.children.length) return;
    var h = '<option value="ENTRANCE">Main Entrance (Ground Floor)</option>';
    D.FLOORS.forEach(function (f) {
      f.rooms.forEach(function (r) {
        h += '<option value="' + esc(r.code) + '">' + esc(r.code) + ' (' + esc(f.name) + ')</option>';
      });
    });
    dl.innerHTML = h;
  }

  function detectNew() {
    var d = S.data;
    var fresh = d.reports.filter(function (r) { return r.status === "New" && S.seen.indexOf(r.id) < 0; });
    if (!S.first) {
      fresh.slice(0, 3).forEach(function (r) {
        var msg = r.issue + " · " + Store.FLOOR_NAMES[r.floor] + " · " + r.room;
        TO.toast("New TechOps Issue!", msg, "bad", function () { gotoIssueOnMap(r); });
        notifyDesktop("New TechOps issue", msg);
      });
      if (fresh.length) TO.beep();
    }
    d.reports.forEach(function (r) { if (S.seen.indexOf(r.id) < 0) S.seen.push(r.id); });
    lset(SEEN_KEY, JSON.stringify(S.seen.slice(-500)));

    /* Meetup requests & Pings addressed to me */
    d.meetups.forEach(function (m) {
      if (S.seenMeet.indexOf(m.id) >= 0) return;
      S.seenMeet.push(m.id);
      if (!S.first && S.me && m.target === S.me && (m.status === "Pinged" || m.status === "Pending")) {
        TO.toast("Location Ping Received!", m.by + " wants to meet. Please confirm your current room.", "", function () {
          setTab("team");
          openConfirmLocationModal(m);
        });
        notifyDesktop("TechOps Location Ping", m.by + " wants to meet you! Please confirm your room.");
        TO.beep();
      }
    });
    lset(SEEN_MEET, JSON.stringify(S.seenMeet.slice(-300)));
    S.first = false;
  }

  function notifyDesktop(title, body) {
    try {
      if (S.alertsOn && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: "../assets/favicon.png" });
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------ Chrome & Navigation */
  function renderHeader() {
    var d = S.data, m = d.meta;
    var pill = $("status-pill");
    var state = !m.online ? "demo" : m.live ? "live" : "demo";
    var statusLabel = !m.online ? "Offline" : m.live ? "Live from Firebase" : "Local preview";
    var statusMobile = !m.online ? "Offline" : m.live ? "Live" : "Preview";
    pill.className = "pill-status " + state;
    $("status-text").innerHTML = '<span class="status-text-full">' + esc(statusLabel) + '</span><span class="status-text-mobile">' + esc(statusMobile) + '</span>';
    pill.title = !m.online ? (m.error || "Could not reach Firebase.") : m.live ? "Real-time connection to Firebase. Updated " + m.fetchedAt.toLocaleTimeString() : "Firebase is not configured: showing bundled dummy data stored in this browser.";

    var note = $("demo-note"), bits = [];
    if (!m.online) bits.push("Could not load data from Firebase: " + (m.error || "unknown error") + ".");
    if (!m.live) bits.push("Local preview: js/firebase-config.js is empty, so tasks, pings and inventory changes are stored in this browser only.");
    note.hidden = !bits.length;
    note.innerHTML = esc(bits.join(" ")) + (!m.live ? ' <button class="btn small" id="reset-demo">Reset preview data</button>' : "");
    var rb = $("reset-demo"); if (rb) rb.onclick = function () { Store.resetDemo(); load(); };

    var unassigned = d.reports.filter(isUnassigned).length;
    var mine = d.reports.filter(isMine).length;
    var bc = $("bell-count"); bc.hidden = !unassigned; bc.textContent = unassigned;
    $("n-issues").textContent = unassigned + mine;
    $("n-issues").className = "n" + (unassigned ? " hot" : "");
    $("greeting").textContent = unassigned + " unassigned · " + mine + " in your queue";

    var pendingCount = S.me ? d.meetups.filter(function (m) { return m.target === S.me && (m.status === "Pinged" || m.status === "Pending"); }).length : 0;
    $("n-meet").hidden = !pendingCount; $("n-meet").textContent = pendingCount; $("n-meet").className = "n hot";

    /* Mobile bottom bar badges */
    var mbIssues = $("m-badge-issues");
    if (mbIssues) { mbIssues.hidden = !unassigned; mbIssues.textContent = unassigned; }
    var mbTeam = $("m-badge-team");
    if (mbTeam) { mbTeam.hidden = !pendingCount; mbTeam.textContent = pendingCount; }

    document.title = (unassigned ? "(" + unassigned + ") " : "") + "TechOps Dashboard · NASA Space Apps Cairo";
  }

  function renderBanners() {
    var d = S.data, h = "";
    if (S.me) {
      /* Pings awaiting my location confirmation */
      d.meetups.filter(function (m) { return m.target === S.me && (m.status === "Pinged" || m.status === "Pending"); }).forEach(function (m) {
        h += '<div class="banner" style="border-color:var(--bad);background:rgba(239,68,68,0.14)">' +
          '<div style="flex:1;min-width:220px">' +
          '<b style="color:#ff8a8a">🔔 Location Ping from ' + esc(m.by) + '</b>' +
          '<div style="font-size:13px;margin-top:2px">They want to meet you! Please confirm your current room so we can guide you to each other.</div>' +
          (m.note ? '<div class="muted" style="font-size:12px;margin-top:2px">Note: ' + esc(m.note) + '</div>' : '') +
          '</div>' +
          '<button class="btn accent small" data-confirm-ping="' + esc(m.id) + '">Confirm Location &amp; Meet</button>' +
          '</div>';
      });

      /* Confirmed meetups ready for navigation */
      d.meetups.filter(function (m) { return (m.by === S.me || m.target === S.me) && (m.status === "Confirmed" || m.status === "On the way"); }).forEach(function (m) {
        var other = m.by === S.me ? m.target : m.by;
        var myRole = m.by === S.me ? "Requester" : "Recipient";
        h += '<div class="banner" style="border-color:var(--ok);background:rgba(16,185,129,0.12)">' +
          '<div style="flex:1;min-width:220px">' +
          '<b style="color:#34d399">📍 Meetup Confirmed with ' + esc(other) + '</b>' +
          '<div style="font-size:13px;margin-top:2px">Meeting point: <b>' + esc(m.meetAt) + '</b> (' + esc(m.targetFloorName || m.byFloorName) + ')</div>' +
          '</div>' +
          '<button class="btn primary small" data-route-to="' + esc(m.meetAt) + '">🗺️ Show Walking Route</button>' +
          '<button class="btn small" data-meet="' + esc(m.id) + '" data-st="Done">Mark Done</button>' +
          '</div>';
      });
    }
    $("banners").innerHTML = h;
  }

  function renderAll() {
    renderHeader(); renderBanners(); renderIssues(); renderMaps(); renderTeam(); renderInventory();
  }

  function setTab(t) {
    S.tab = t;
    /* Desktop tabs */
    document.querySelectorAll(".tabs .tab").forEach(function (b) {
      var on = b.dataset.tab === t;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on);
    });
    /* Mobile bottom navigation */
    document.querySelectorAll(".mobile-nav-btn").forEach(function (b) {
      var on = b.dataset.tab === t;
      b.classList.toggle("on", on);
    });
    ["issues", "maps", "team", "inventory"].forEach(function (n) { $("tab-" + n).hidden = n !== t; });
    if (t === "maps") {
      setTimeout(function () { map.fit(); }, 50);
    }
  }

  /* ------------------------------------------------------------ Issues Tab */
  var FILTERS = [["unassigned", "Unassigned"], ["mine", "My tasks"], ["Resolved", "Resolved"], ["all", "All"]];
  function isUnassigned(r) { return r.status !== "Resolved" && !r.assigned; }
  function isMine(r) { return r.status !== "Resolved" && !!S.me && r.assigned === S.me; }
  function matchFilter(r, f) {
    if (f === "all") return true;
    if (f === "unassigned") return isUnassigned(r);
    if (f === "mine") return isMine(r);
    return r.status === f;
  }
  var EMPTY = {
    unassigned: "All caught up. There are no unassigned tasks.",
    mine: "Nothing in your queue. Claim a task from Unassigned.",
    Resolved: "No resolved tasks yet.",
    all: "No tasks found."
  };

  function renderIssues() {
    var d = S.data;
    $("issue-filters").innerHTML = FILTERS.map(function (f) {
      var n = d.reports.filter(function (r) { return matchFilter(r, f[0]); }).length;
      return '<button class="chip' + (S.issueFilter === f[0] ? " on" : "") + '" data-if="' + f[0] + '">' + f[1] + " (" + n + ")</button>";
    }).join("");

    var q = S.issueText.toLowerCase();
    var rows = d.reports.filter(function (r) {
      return matchFilter(r, S.issueFilter) && (!q || (r.room + " " + r.details + " " + r.issue + " " + r.id + " " + r.assigned + " " + r.floorName).toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });

    if (!rows.length) {
      $("issue-rows").innerHTML = '<tr><td colspan="7" class="empty">' + esc(q ? "No tasks match your search." : EMPTY[S.issueFilter] || EMPTY.all) + '</td></tr>';
      return;
    }

    $("issue-rows").innerHTML = rows.map(function (r) {
      var when = Store.parseStamp(r.ts), mine = isMine(r), free = isUnassigned(r);
      var action = free
        ? '<button class="btn small primary claim-btn" data-claim="' + esc(r.id) + '">Claim</button>'
        : mine ? '<button class="btn small ok resolve-btn" data-resolve="' + esc(r.id) + '">Mark as Resolved</button>' : "";
      return '<tr class="' + (free ? "is-new" : mine ? "is-mine" : "") + '">' +
        '<td class="td-status"><span class="badge ' + TO.statusClass(r.status) + '">' + esc(r.status) + '</span></td>' +
        '<td class="td-meta" title="' + esc(r.ts) + '"><span class="issue-ago">' + esc(TO.ago(when)) + '</span><span class="muted issue-id">' + esc(r.id) + "</span></td>" +
        '<td class="td-room"><div><b class="issue-room-code">' + esc(r.room) + '</b> <span class="muted issue-floor">(' + esc(r.floorName) + ')</span></div><span class="badge ' + TO.issueClass(r.issue) + ' mobile-only-badge">' + esc(r.issue) + '</span></td>' +
        '<td class="td-badge desktop-only"><span class="badge ' + TO.issueClass(r.issue) + '">' + esc(r.issue) + "</span></td>" +
        '<td class="td-desc">' + esc(r.details || "—") + "</td>" +
        '<td class="td-assign">' + (r.assigned ? '<span class="assignee' + (mine ? " me" : "") + '">' + esc(mine ? "You" : r.assigned) + '</span>' : '<span class="muted">Unassigned</span>') + "</td>" +
        '<td class="td-action"><div class="action-stack">' + action + '<button class="btn small" data-route-to="' + esc(r.room) + '">Route Here</button></div></td></tr>';
    }).join("");
  }

  /* One-click claim / resolve: writes straight to Firebase; the real-time listener refreshes the list. */
  function taskAction(btn, id, kind) {
    if (S.busy[id]) return;
    S.busy[id] = true;
    var label = btn.textContent; btn.disabled = true; btn.textContent = kind === "claim" ? "Claiming…" : "Resolving…";
    var p = kind === "claim" ? Store.claimReport(id) : Store.resolveReport(id);
    p.then(function () {
      TO.toast(kind === "claim" ? "Task claimed" : "Task resolved", kind === "claim" ? id + " is now In Progress and assigned to you." : id + " marked as resolved.", "ok");
    }).catch(function () {
      btn.disabled = false; btn.textContent = label;
    }).then(function () { delete S.busy[id]; return load(); });
  }

  function gotoIssueOnMap(r) {
    setTab("maps");
    S.floor = r.floor;
    map.setFloor(r.floor);
    renderMapChrome();
    selectRoom(r.room, true);
    /* Pre-fill destination */
    $("rt-to").value = r.room;
  }

  /* ------------------------------------------------------------ Maps & Routing Engine */
  function mapData() {
    var d = S.data, rooms = {}; d.rooms.forEach(function (r) { rooms[r.code] = r; });
    return { rooms: rooms, wifi: d.wifi, reports: d.reports };
  }

  function renderMapChrome() {
    var d = S.data;
    $("floor-seg").innerHTML = D.FLOORS.map(function (f) {
      var n = d.reports.filter(function (r) { return r.floor === f.id && r.status !== "Resolved"; }).length;
      return '<button data-floor="' + f.id + '" class="' + (S.floor === f.id ? "on" : "") + '">' + f.name + (n ? " · " + n + " open" : "") + "</button>";
    }).join("");
    
    document.querySelectorAll("#layer-seg button").forEach(function (b) { b.classList.toggle("on", b.dataset.layer === S.layer); });
    $("pins-chip").classList.toggle("on", S.pins); $("pins-chip").setAttribute("aria-pressed", S.pins);
    $("heat-scale").hidden = S.layer !== "heat";
    
    var zones = Object.keys(D.ZONES), counts = {};
    d.rooms.forEach(function (r) { if (r.floor === S.floor) counts[r.zone] = (counts[r.zone] || 0) + 1; });
    $("zone-legend").innerHTML = S.layer === "zones" ? zones.map(function (z) {
      return '<button class="chip' + (S.zone && S.zone !== z ? " dim" : "") + '" data-zone="' + z + '"><span class="dot" style="background:' + D.ZONES[z].color + '"></span>' + z + " (" + (counts[z] || 0) + ")</button>";
    }).join("") : "";
  }

  function renderMaps() {
    renderMapChrome();
    map.setData(mapData());
    renderSide();
  }

  function selectRoom(code, focus) {
    S.selected = code;
    map.select(code);
    renderSide();
    if (focus) map.focus(code);
    if (window.innerWidth <= 768 && code) {
      openMapBottomSheet(code);
    }
  }

  function wifiFor(code) {
    return S.data.wifi.filter(function (w) { return w.id === "WF-" + code; })[0];
  }

  function myCurrentRoom() {
    var meMember = S.me && S.data.team.filter(function (t) { return t.name === S.me; })[0];
    return meMember ? meMember.room : "B133";
  }

  /* Plan and display fastest walking route between any two rooms */
  function planAndShowRoute(fromCode, toCode) {
    if (!Router) return;
    fromCode = (fromCode || "").trim();
    toCode = (toCode || "").trim();

    if (!fromCode) fromCode = myCurrentRoom() || "ENTRANCE";
    if (!toCode) {
      TO.toast("Destination required", "Please enter a destination room code.", "bad");
      return;
    }

    var locA = Router.loc(fromCode, S.floor);
    var locB = Router.loc(toCode, S.floor);

    if (!locA) {
      TO.toast("Origin not recognized", "Cannot find start location: " + fromCode, "bad");
      return;
    }
    if (!locB) {
      TO.toast("Destination not recognized", "Cannot find room: " + toCode, "bad");
      return;
    }

    try {
      var route = Router.planRoute(locA, locB);
      if (!route || !route.legs || !route.legs.length) {
        TO.toast("Route calculation failed", "Could not connect walking path between " + fromCode + " and " + toCode, "bad");
        return;
      }

      S.activeRoute = route;
      $("rt-from").value = fromCode;
      $("rt-to").value = toCode;

      /* Switch map to the origin floor first */
      var startFloor = route.legs[0].floor;
      if (S.floor !== startFloor) {
        S.floor = startFloor;
        map.setFloor(startFloor, true);
        renderMapChrome();
      }

      map.setRoute(route, true);
      renderRouteOutput(route, locA, locB);
      TO.toast("Fastest Route Found", route.summary, "ok");
    } catch (err) {
      TO.toast("Routing error", err.message, "bad");
    }
  }

  function clearActiveRoute() {
    S.activeRoute = null;
    map.clearRoute();
    var out = $("route-output");
    if (out) { out.hidden = true; out.innerHTML = ""; }
  }

  function renderRouteOutput(route, locA, locB) {
    var out = $("route-output");
    if (!out) return;
    out.hidden = false;

    var h = '<div class="route-panel">' +
      '<div class="route-summary">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
      esc(route.summary) +
      '</div>';

    h += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">';
    route.steps.forEach(function (st, idx) {
      var isCurrent = st.floor === S.floor;
      h += '<div class="route-step' + (isCurrent ? ' on' : '') + '" data-step-floor="' + st.floor + '" data-step-leg="' + st.legIdx + '">' +
        '<div class="route-step-num">' + (idx + 1) + '</div>' +
        '<div style="flex:1">' + esc(st.text) + ' <span class="muted" style="font-size:11px">(' + esc(Store.FLOOR_NAMES[st.floor]) + ')</span></div>' +
        '<button class="btn small" style="padding:2px 8px;font-size:11px">View Floor</button>' +
        '</div>';
    });
    h += '</div></div>';
    out.innerHTML = h;

    out.querySelectorAll(".route-step").forEach(function (el) {
      el.onclick = function () {
        var fl = el.dataset.stepFloor;
        var legIdx = +el.dataset.stepLeg;
        if (fl !== S.floor) {
          S.floor = fl;
          map.setFloor(fl, true);
          renderMapChrome();
        }
        if (route.legs[legIdx]) map.panToLeg(route.legs[legIdx]);
        renderRouteOutput(route, locA, locB);
      };
    });
  }

  function renderSide() {
    var d = S.data, side = $("side");
    if (S.selected && d.roomMap[S.selected]) {
      var r = d.roomMap[S.selected], w = wifiFor(r.code), z = D.ZONES[r.zone] || {};
      var iss = d.reports.filter(function (x) { return x.room === r.code && x.floor === r.floor && x.status !== "Resolved"; });
      var url = TO.reportUrl(r.floor, r.code);

      side.innerHTML = '<h3>Room ' + esc(r.code) + '</h3><div class="sub"><span class="badge" style="background:' + (z.color || "#64748b") + '33;border-color:' + (z.color || "#64748b") + ';color:var(--ink-bright)">' + esc(r.zone) + "</span> " + esc(r.floorName) + "</div>" +
        '<dl class="kv"><dt>Space</dt><dd>' + esc(r.type) + "</dd><dt>Capacity</dt><dd>" + esc(r.capacity) + "</dd><dt>Assigned to</dt><dd>" + esc(r.assigned || "—") + "</dd>" +
        "<dt>Wi-Fi</dt><dd>" + (w ? '<b style="color:' + TO.speedColor(w.mbps) + '">' + w.mbps + " Mbps</b> · " + w.latency + " ms · " + TO.speedLabel(w.mbps) : "No reading") + "</dd></dl>" +
        
        '<div class="row" style="margin:12px 0 14px;gap:8px">' +
        '<button class="btn primary small" id="side-route-here">📍 Fastest Route Here</button>' +
        '<button class="btn small" id="side-route-from">Route From Here</button>' +
        '</div>' +

        "<b>Open issues (" + iss.length + ")</b>" + (iss.length ? iss.map(function (x) {
          return '<div class="mini-issue"><span class="badge ' + TO.issueClass(x.issue) + '">' + esc(x.issue) + '</span> <span class="badge ' + TO.statusClass(x.status) + '">' + esc(x.status) + '</span><div class="muted" style="margin-top:4px">' + esc(x.details || "") + "</div></div>";
        }).join("") : '<div class="muted" style="font-size:13px;margin-top:4px">No open issues for this room.</div>') +
        
        '<div style="margin-top:14px"><b>Room QR code</b><div class="muted" style="font-size:12px;margin-bottom:6px">Scan to report an issue directly from this room.</div><div class="qr-box">' + TO.qrSvg(url, 4) + '</div></div>' +
        '<div class="row" style="margin-top:12px"><a class="btn small" href="' + esc(url) + '" target="_blank" rel="noopener">Open form</a><a class="btn small" href="qr-codes.html">Universal QR</a><button class="btn small ghost" id="side-clear">Clear</button></div>';

      var c = $("side-clear"); if (c) c.onclick = function () { S.selected = null; map.select(null); renderSide(); };
      var btnHere = $("side-route-here");
      if (btnHere) btnHere.onclick = function () {
        $("rt-to").value = r.code;
        var myRoom = myCurrentRoom();
        $("rt-from").value = myRoom;
        planAndShowRoute(myRoom, r.code);
      };
      var btnFrom = $("side-route-from");
      if (btnFrom) btnFrom.onclick = function () {
        $("rt-from").value = r.code;
        TO.toast("Origin set", "Now click destination or enter room in To field.", "ok");
      };
      return;
    }

    var rooms = d.rooms.filter(function (r) { return r.floor === S.floor; });
    var w = d.wifi.filter(function (x) { return x.floor === S.floor; });
    var avg = w.length ? Math.round(w.reduce(function (a, b) { return a + b.mbps; }, 0) / w.length) : 0;
    var weak = w.filter(function (x) { return x.mbps < 15; });
    var open = d.reports.filter(function (r) { return r.floor === S.floor && r.status !== "Resolved"; }).length;
    var zc = {}; rooms.forEach(function (r) { zc[r.zone] = (zc[r.zone] || 0) + 1; });
    
    side.innerHTML = "<h3>" + esc(Store.FLOOR_NAMES[S.floor]) + '</h3><div class="sub">Select any room on the blueprint or click directions.</div>' +
      '<dl class="kv"><dt>Rooms</dt><dd>' + rooms.length + "</dd><dt>Open issues</dt><dd>" + open + "</dd><dt>Avg Wi-Fi</dt><dd>" + (avg ? '<b style="color:' + TO.speedColor(avg) + '">' + avg + " Mbps</b>" : "—") + "</dd>" +
      "<dt>Weak spots</dt><dd>" + (weak.length ? esc(weak.map(function (x) { return x.label.replace("Room ", ""); }).join(", ")) : "None") + "</dd></dl>" +
      '<div class="row" style="margin:12px 0 10px"><button class="btn small primary" id="side-route-ent">Route from Main Entrance</button></div>' +
      "<b>Rooms by zone</b>" + Object.keys(D.ZONES).map(function (z) {
        return '<div class="row" style="margin-top:6px;gap:8px"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + D.ZONES[z].color + '"></span><span style="flex:1">' + z + "</span><b>" + (zc[z] || 0) + "</b></div>";
      }).join("");

    var rEnt = $("side-route-ent");
    if (rEnt) rEnt.onclick = function () {
      $("rt-from").value = "ENTRANCE";
      TO.toast("Start at Entrance", "Choose a destination room to view fastest route.", "ok");
    };
  }

  function openMapBottomSheet(code) {
    var sheet = $("map-bottom-sheet"), backdrop = $("map-sheet-backdrop");
    if (!sheet || !backdrop || !code) return;

    var d = S.data;
    var zEl = $("sheet-zone"), tEl = $("sheet-title"), mEl = $("sheet-meta"), bEl = $("sheet-body");
    var btnHere = $("sheet-btn-route-here"), btnFrom = $("sheet-btn-route-from");

    if (code.indexOf("wf:") === 0) {
      var wId = code.slice(3);
      var w = d.wifi.filter(function (x) { return x.id === wId; })[0];
      if (w) {
        zEl.textContent = "Wi-Fi Hotspot";
        zEl.style.color = TO.speedColor(w.mbps);
        tEl.textContent = w.label;
        mEl.textContent = (Store.FLOOR_NAMES[w.floor] || "Venue Floor") + " · Access Point Node";
        bEl.innerHTML =
          '<div style="display:flex;align-items:center;gap:14px;background:var(--card-2);padding:14px;border-radius:12px;margin-bottom:12px">' +
          '<div style="font-size:32px;font-weight:800;color:' + TO.speedColor(w.mbps) + '">' + w.mbps + '<span style="font-size:14px;font-weight:600;margin-left:4px">Mbps</span></div>' +
          '<div style="font-size:13px;color:var(--mut);line-height:1.4">Latency: <b style="color:var(--ink-bright)">' + w.latency + ' ms</b><br>Quality: <b style="color:' + TO.speedColor(w.mbps) + '">' + TO.speedLabel(w.mbps) + '</b></div>' +
          '</div>' +
          '<p class="muted" style="font-size:13px;margin:0">Monitored Wi-Fi access point node. Signal is measured regularly across the venue.</p>';
        btnHere.style.display = "none";
        btnFrom.style.display = "none";
      }
    } else if (code.indexOf("STAIR-") === 0) {
      var sk = code.replace("STAIR-", "");
      var sName = Router.SN[sk] || "Stairway";
      zEl.textContent = "Vertical Transit Node";
      zEl.style.color = "var(--accent)";
      tEl.textContent = sName;
      mEl.textContent = "Inter-Floor Staircase Connector";
      bEl.innerHTML = '<p class="muted" style="font-size:13.5px;margin:0">Direct walking staircase used by the wayfinding engine to calculate multi-floor routes.</p>';
      btnHere.style.display = "none";
      btnFrom.style.display = "none";
    } else {
      var r = d.roomMap[code];
      if (!r) return;
      var z = D.ZONES[r.zone] || {};
      var w = wifiFor(r.code);
      var iss = d.reports.filter(function (x) { return x.room === r.code && x.floor === r.floor && x.status !== "Resolved"; });
      var url = TO.reportUrl(r.floor, r.code);

      zEl.textContent = r.zone;
      zEl.style.color = z.color || "var(--accent)";
      tEl.textContent = "Room " + r.code;
      mEl.textContent = (r.floorName || Store.FLOOR_NAMES[r.floor]) + " · " + r.type + (r.capacity ? " (Cap. " + r.capacity + ")" : "");

      var wifiCard = w
        ? '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--card-2);padding:10px 14px;border-radius:10px;margin-bottom:12px">' +
          '<span style="font-size:13px;font-weight:600;color:var(--mut)">Wi-Fi Quality</span>' +
          '<span style="font-size:13.5px;font-weight:700;color:' + TO.speedColor(w.mbps) + '">' + w.mbps + ' Mbps · ' + TO.speedLabel(w.mbps) + '</span>' +
          '</div>'
        : '';

      var assignedRow = r.assigned
        ? '<div style="font-size:13px;color:var(--mut);margin-bottom:10px">Occupant / Challenge: <b style="color:var(--ink-bright)">' + esc(r.assigned) + '</b></div>'
        : '';

      var issueCard = iss.length
        ? '<div style="margin-bottom:12px"><b style="font-size:13px;display:block;margin-bottom:6px">Active Issues (' + iss.length + ')</b>' +
          iss.map(function (x) {
            return '<div style="padding:8px 10px;background:var(--card-2);border-radius:8px;margin-bottom:6px;font-size:12.5px"><span class="badge ' + TO.issueClass(x.issue) + '">' + esc(x.issue) + '</span> ' + esc(x.details || "") + '</div>';
          }).join("") + '</div>'
        : '<div class="muted" style="font-size:13px;margin-bottom:12px">No active issues reported.</div>';

      bEl.innerHTML = wifiCard + assignedRow + issueCard +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<a class="btn small" style="flex:1;justify-content:center;height:42px" href="' + esc(url) + '" target="_blank" rel="noopener">Direct Form</a>' +
        '<a class="btn small" style="flex:1;justify-content:center;height:42px" href="qr-codes.html">Universal QR</a>' +
        '</div>';

      btnHere.style.display = "flex";
      btnFrom.style.display = "flex";

      btnHere.onclick = function () {
        closeMapBottomSheet();
        $("rt-to").value = r.code;
        var myRoom = myCurrentRoom();
        $("rt-from").value = myRoom;
        planAndShowRoute(myRoom, r.code);
      };

      btnFrom.onclick = function () {
        closeMapBottomSheet();
        $("rt-from").value = r.code;
        TO.toast("Origin Set", "Origin set to Room " + r.code + ". Now pick a destination.", "ok");
      };
    }

    sheet.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add("is-open");
      backdrop.classList.add("is-open");
    });
  }

  function closeMapBottomSheet() {
    var sheet = $("map-bottom-sheet"), backdrop = $("map-sheet-backdrop");
    if (!sheet || !backdrop) return;
    sheet.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    setTimeout(function () {
      sheet.hidden = true;
      backdrop.hidden = true;
    }, 280);
  }

  function tipHtml(code) {
    var d = S.data;
    if (code.indexOf("wf:") === 0) {
      var w = d.wifi.filter(function (x) { return x.id === code.slice(3); })[0];
      return w ? "<b>" + esc(w.label) + '</b><br><span style="color:' + TO.speedColor(w.mbps) + '">' + w.mbps + " Mbps</span> · " + w.latency + " ms · " + TO.speedLabel(w.mbps) : "";
    }
    if (code.indexOf("STAIR-") === 0) {
      var sk = code.replace("STAIR-", "");
      return "<b>" + esc(Router.SN[sk] || "Stairway") + "</b><br><span class=\"muted\">Inter-floor transit node</span>";
    }
    var r = d.roomMap[code]; if (!r) return "<b>" + esc(code) + "</b>";
    var wf = wifiFor(code), n = d.reports.filter(function (x) { return x.room === code && x.floor === r.floor && x.status !== "Resolved"; }).length;
    return "<b>" + esc(code) + "</b> · " + esc(r.zone) + "<br>" + esc(r.assigned || "") + (wf ? '<br>Wi-Fi <span style="color:' + TO.speedColor(wf.mbps) + '">' + wf.mbps + " Mbps</span>" : "") + (n ? "<br>" + n + " open issue" + (n > 1 ? "s" : "") : "");
  }

  /* ------------------------------------------------------------ Team & Ping System */
  function stClass(s) {
    s = (s || "").toLowerCase();
    return s.indexOf("avail") >= 0 ? "st-available" : s.indexOf("busy") >= 0 ? "st-busy" : s.indexOf("task") >= 0 ? "st-task" : "st-off";
  }

  function renderTeam() {
    var d = S.data;
    $("team-grid").innerHTML = d.team.map(function (t, i) {
      var isMe = S.me && t.name === S.me;
      return '<button class="card member" data-member="' + i + '" aria-label="Ping ' + esc(t.name) + '">' +
        '<div class="row" style="flex-wrap:nowrap;gap:12px">' +
        '<div class="avatar">' + esc(TO.initials(t.name)) + '</div>' +
        '<div><div class="name">' + esc(t.name) + (isMe ? ' <span class="badge b-prog">You</span>' : '') + '</div><div class="role">' + esc(t.role) + '</div></div>' +
        '</div>' +
        '<div class="status ' + stClass(t.status) + '"><i></i>' + esc(t.status) + '</div>' +
        '<div class="loc">📍 ' + esc(t.floorName) + " · Room " + esc(t.room) + '</div>' +
        '<div class="muted" style="font-size:12px">' + esc(t.focus) + '</div>' +
        '<span class="btn small primary" style="align-self:flex-start">' + (isMe ? 'Update My Location' : 'Ping for Meetup') + '</span>' +
        '</button>';
    }).join("");

    /* My Location update card */
    var my = $("my-status"), meMember = S.me && d.team.filter(function (t) { return t.name === S.me; })[0];
    if (meMember) {
      my.hidden = false;
      var statusColor = meMember.status === "Available" ? "var(--ok)" : meMember.status === "Busy" ? "var(--bad)" : meMember.status === "On a task" ? "var(--warn)" : "var(--mut)";
      
      my.innerHTML =
        '<div class="my-status-compact">' +
          '<div class="my-status-info">' +
            '<div class="my-status-avatar">' +
              esc(TO.initials(meMember.name)) +
              '<span class="my-status-dot" style="background:' + statusColor + '"></span>' +
            '</div>' +
            '<div class="my-status-details">' +
              '<div class="my-status-name">' + esc(meMember.name) + ' <span class="my-status-tag">You</span></div>' +
              '<div class="my-status-loc"><b>' + esc(meMember.room || "No room") + '</b> · ' + esc(meMember.floorName || Store.FLOOR_NAMES[meMember.floor] || "Floor") + ' · <span style="color:' + statusColor + ';font-weight:600">' + esc(meMember.status) + '</span></div>' +
            '</div>' +
          '</div>' +
          '<button class="my-status-edit-btn" id="ms-toggle-edit" aria-expanded="false">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
            '<span>Update</span>' +
          '</button>' +
        '</div>' +
        '<div class="my-status-editor" id="ms-editor" hidden>' +
          '<div class="ms-grid">' +
            '<div>' +
              '<label for="ms-floor">Floor</label>' +
              '<select id="ms-floor">' + floorOpts(meMember.floor) + '</select>' +
            '</div>' +
            '<div>' +
              '<label for="ms-room">Room</label>' +
              '<select id="ms-room">' + roomOpts(meMember.floor, meMember.room) + '</select>' +
            '</div>' +
            '<div>' +
              '<label for="ms-status">Live Status</label>' +
              '<select id="ms-status">' + ["Available", "Busy", "On a task", "Off duty"].map(function (s) { return "<option" + (s === meMember.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select>' +
            '</div>' +
          '</div>' +
          '<div class="ms-actions">' +
            '<button class="btn ghost small" id="ms-cancel" style="min-height:42px">Cancel</button>' +
            '<button class="btn primary small" id="ms-save" style="min-height:42px">Save Location</button>' +
          '</div>' +
        '</div>';

      var toggleBtn = $("ms-toggle-edit"), editor = $("ms-editor");
      if (toggleBtn && editor) {
        toggleBtn.onclick = function () {
          var isHidden = editor.hidden;
          editor.hidden = !isHidden;
          toggleBtn.setAttribute("aria-expanded", String(isHidden));
          toggleBtn.querySelector("span").textContent = isHidden ? "Close" : "Update";
        };
      }
      var cancelBtn = $("ms-cancel");
      if (cancelBtn && editor && toggleBtn) {
        cancelBtn.onclick = function () {
          editor.hidden = true;
          toggleBtn.setAttribute("aria-expanded", "false");
          toggleBtn.querySelector("span").textContent = "Update";
        };
      }

      $("ms-floor").onchange = function () { $("ms-room").innerHTML = roomOpts($("ms-floor").value, ""); };
      $("ms-save").onclick = function () {
        Store.update("team", meMember.name, { floor: $("ms-floor").value, floorName: Store.FLOOR_NAMES[$("ms-floor").value], room: $("ms-room").value, status: $("ms-status").value });
        TO.toast("Location Saved", "Teammates can now navigate directly to your room.", "ok");
        load();
      };
    } else my.hidden = true;

    /* Meetup History */
    var list = d.meetups.slice().sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });
    $("meet-rows").innerHTML = list.length ? list.map(function (m) {
      var cls = m.status === "Done" ? "b-done" : (m.status === "Confirmed" || m.status === "On the way") ? "b-prog" : "b-ack";
      var isTarget = S.me && m.target === S.me;
      var canConfirm = isTarget && (m.status === "Pinged" || m.status === "Pending");
      return '<div class="meet-item">' +
        '<span class="badge ' + cls + '">' + esc(m.status) + '</span>' +
        '<div style="flex:1;min-width:230px">' +
        '<b>' + esc(m.by) + '</b> &rarr; <b>' + esc(m.target) + '</b>' +
        '<div class="muted" style="font-size:12.5px">' +
        (m.meetAt ? 'Meet at <b>' + esc(m.meetAt) + '</b> · ' : 'Location pending confirmation · ') +
        'Requester in ' + esc(m.byRoom) + ' (' + esc(m.byFloorName) + ')' +
        (m.targetRoom ? ', ' + esc(m.target) + ' in ' + esc(m.targetRoom) + ' (' + esc(m.targetFloorName) + ')' : '') +
        (m.note ? ' · Note: ' + esc(m.note) : '') +
        '</div>' +
        '</div>' +
        '<span class="muted" style="font-size:12px">' + esc(TO.ago(Store.parseStamp(m.ts))) + '</span>' +
        (canConfirm ? '<button class="btn small accent" data-confirm-ping="' + esc(m.id) + '">Confirm My Room</button>' : '') +
        (m.meetAt ? '<button class="btn small primary" data-route-to="' + esc(m.meetAt) + '">Route Here</button>' : '') +
        ((m.by === S.me || isTarget) && m.status !== "Done" ? '<button class="btn small" data-meet="' + esc(m.id) + '" data-st="Done">Done</button>' : '') +
        '</div>';
    }).join("") : '<div class="empty">No meetup requests or pings yet.</div>';
  }

  function floorOpts(sel) { return D.FLOORS.map(function (f) { return '<option value="' + f.id + '"' + (f.id === sel ? " selected" : "") + ">" + f.name + "</option>"; }).join(""); }
  function roomOpts(floor, sel) {
    var list = S.data.rooms.filter(function (r) { return r.floor === floor; }).map(function (r) { return r.code; });
    if (sel && list.indexOf(sel) < 0) list.unshift(sel);
    return '<option value="">Select room…</option>' + list.map(function (c) { return '<option' + (c === sel ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
  }

  /* 1. SENDER: Ping a team member modal */
  function openPingModal(member) {
    var d = S.data, meM = S.me && d.team.filter(function (t) { return t.name === S.me; })[0];
    var ov = document.createElement("div"); ov.className = "backdrop";
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Ping Member">' +
      '<div class="mh"><div class="avatar" style="width:40px;height:40px;font-size:15px">' + esc(TO.initials(member.name)) + '</div>' +
      '<h3>Ping ' + esc(member.name) + ' for Meetup</h3>' +
      '<button class="x" aria-label="Close">&times;</button></div>' +
      '<div class="mb" id="ping-body"></div></div>';
    document.body.appendChild(ov);

    function close() { ov.remove(); }
    ov.querySelector(".x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });

    var body = ov.querySelector("#ping-body");
    var senderHtml = S.me
      ? '<div style="margin-bottom:12px;font-size:13px">Pinging as: <b style="color:var(--ink-bright)">' + esc(S.me) + '</b></div><input type="hidden" id="pt-by" value="' + esc(S.me) + '">'
      : '<label class="lbl" for="pt-by">Who is pinging?</label><select id="pt-by" style="width:100%"><option value="">Select your name…</option>' + d.team.filter(function (t) { return t.name !== member.name; }).map(function (t) { return "<option" + (t.name === S.me ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + '</select>';

    body.innerHTML =
      '<p class="muted" style="margin-bottom:12px">A ping notification will ask <b>' + esc(member.name) + '</b> to confirm their current room in case they moved. Once confirmed, you both get walking directions.</p>' +
      senderHtml +
      
      '<div class="two" style="margin-top:12px">' +
      '<div class="col"><h4>Your Current Spot</h4>' +
      '<label class="lbl" for="pt-bf">Floor</label><select id="pt-bf" style="width:100%">' + floorOpts(meM ? meM.floor : "F") + '</select>' +
      '<label class="lbl" for="pt-br">Room</label><select id="pt-br" style="width:100%">' + roomOpts(meM ? meM.floor : "F", meM ? meM.room : "") + '</select>' +
      '</div>' +
      '<div class="col"><h4>' + esc(member.name.split(" ")[0]) + '\'s Last Known Room</h4>' +
      '<div style="font-size:13px;padding-top:10px">Room: <b>' + esc(member.room) + '</b></div>' +
      '<div class="muted" style="font-size:12px">' + esc(member.floorName) + '</div>' +
      '<div class="muted" style="font-size:11.5px;margin-top:6px">They will confirm their actual room when responding.</div>' +
      '</div></div>' +

      '<label class="lbl" for="pt-note">Message / Reason (optional)</label>' +
      '<textarea id="pt-note" maxlength="300" placeholder="e.g. Need assistance with Wi-Fi router; please bring power strip"></textarea>' +
      '<p id="pt-err" style="color:var(--bad);font-size:13px;margin-top:8px" hidden></p>' +
      '<div class="mf" style="padding:14px 0 0">' +
      '<button class="btn primary" id="pt-send" style="width:100%;padding:11px">Send Location Ping 🔔</button>' +
      '</div>';

    var f = function (id) { return body.querySelector("#" + id); };
    f("pt-bf").onchange = function () { f("pt-br").innerHTML = roomOpts(f("pt-bf").value, ""); };

    f("pt-send").onclick = function () {
      var by = f("pt-by").value, br = f("pt-br").value, err = f("pt-err");
      if (!by || !br) {
        err.hidden = false;
        err.textContent = "Please select your name and current room.";
        return;
      }
      f("pt-send").disabled = true;
      f("pt-send").textContent = "Sending Ping…";

      var rec = {
        by: by,
        target: member.name,
        byFloor: f("pt-bf").value,
        byRoom: br,
        targetFloor: member.floor,
        targetRoom: member.room,
        meetAt: br, // default preference
        note: f("pt-note").value.trim(),
        status: "Pinged"
      };

      Store.addMeetup(rec).then(function () {
        body.innerHTML = '<div class="success" style="padding-bottom:10px"><div class="tick">&#10003;</div>' +
          '<h3>Ping Sent to ' + esc(member.name) + '!</h3>' +
          '<p class="muted" style="margin-top:6px">They received a notification to confirm their current room. Once confirmed, you can click "Show Route" to walk straight to them.</p>' +
          '<button class="btn primary" id="pt-done" style="margin-top:16px">Done</button></div>';
        body.querySelector("#pt-done").onclick = function () { ov.remove(); };
        load();
      });
    };
  }

  /* 2. RECIPIENT: Confirm location and choose meeting point */
  function openConfirmLocationModal(meetup) {
    var d = S.data;
    var meMember = d.team.filter(function (t) { return t.name === meetup.target; })[0] || {};
    var ov = document.createElement("div"); ov.className = "backdrop";
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Confirm Location">' +
      '<div class="mh"><h3>📍 Confirm Your Room for Meetup</h3><button class="x" aria-label="Close">&times;</button></div>' +
      '<div class="mb" id="conf-body"></div></div>';
    document.body.appendChild(ov);

    function close() { ov.remove(); }
    ov.querySelector(".x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });

    var body = ov.querySelector("#conf-body");
    body.innerHTML =
      '<div style="background:var(--card-2);padding:12px;border-radius:10px;margin-bottom:14px;border:1px solid var(--line-strong)">' +
      '<b>' + esc(meetup.by) + '</b> pinged you for a meetup!' +
      (meetup.note ? '<div class="muted" style="font-size:12.5px;margin-top:4px">Reason: ' + esc(meetup.note) + '</div>' : '') +
      '<div class="muted" style="font-size:12px;margin-top:2px">Their current location: <b>Room ' + esc(meetup.byRoom) + '</b> (' + esc(meetup.byFloorName) + ')</div>' +
      '</div>' +

      '<label class="lbl" style="font-size:13.5px;color:var(--ink-bright)">Where are you right now?</label>' +
      '<div class="two">' +
      '<div><label class="lbl" for="cf-floor">Floor</label><select id="cf-floor" style="width:100%">' + floorOpts(meMember.floor || "F") + '</select></div>' +
      '<div><label class="lbl" for="cf-room">Room code</label><select id="cf-room" style="width:100%">' + roomOpts(meMember.floor || "F", meMember.room) + '</select></div>' +
      '</div>' +

      '<label class="lbl" style="margin-top:14px">Where should you meet?</label>' +
      '<div class="radio-row">' +
      '<label><input type="radio" name="cf-at" value="mine" checked> Meet at my current room</label>' +
      '<label><input type="radio" name="cf-at" value="theirs"> Meet at ' + esc(meetup.by.split(" ")[0]) + '\'s room (' + esc(meetup.byRoom) + ')</label>' +
      '</div>' +

      '<p id="cf-err" style="color:var(--bad);font-size:13px;margin-top:8px" hidden></p>' +
      '<div class="mf" style="padding:16px 0 0">' +
      '<button class="btn primary" id="cf-confirm" style="width:100%;padding:11px">Confirm Location &amp; Meet</button>' +
      '</div>';

    var q = function (id) { return body.querySelector("#" + id); };
    q("cf-floor").onchange = function () { q("cf-room").innerHTML = roomOpts(q("cf-floor").value, ""); };

    q("cf-confirm").onclick = function () {
      var fl = q("cf-floor").value, rm = q("cf-room").value, err = q("cf-err");
      if (!fl || !rm) {
        err.hidden = false;
        err.textContent = "Please select your current floor and room.";
        return;
      }
      q("cf-confirm").disabled = true;
      q("cf-confirm").textContent = "Confirming…";

      var atMine = body.querySelector("input[name=cf-at]:checked").value === "mine";
      var meetAt = atMine ? rm : meetup.byRoom;

      /* Update my live location in Team roster */
      Store.update("team", meetup.target, {
        floor: fl,
        floorName: Store.FLOOR_NAMES[fl],
        room: rm,
        status: "Available"
      });

      /* Update meetup record */
      Store.update("meetups", meetup.id, {
        targetFloor: fl,
        targetFloorName: Store.FLOOR_NAMES[fl],
        targetRoom: rm,
        meetAt: meetAt,
        status: "Confirmed"
      }).then(function () {
        body.innerHTML = '<div class="success" style="padding-bottom:10px"><div class="tick">&#10003;</div>' +
          '<h3>Location Confirmed!</h3>' +
          '<p style="margin:8px 0">Meeting agreed at: <b style="color:var(--accent);font-size:16px">Room ' + esc(meetAt) + '</b></p>' +
          '<p class="muted" style="font-size:12.5px">' + esc(meetup.by) + ' has been alerted. Follow the fastest route to get there.</p>' +
          '<div class="row" style="margin-top:16px;justify-content:center;gap:10px">' +
          '<button class="btn primary" id="cf-route-btn">🗺️ Open Walking Route</button>' +
          '<button class="btn ghost" id="cf-close">Close</button>' +
          '</div></div>';

        body.querySelector("#cf-close").onclick = function () { ov.remove(); };
        body.querySelector("#cf-route-btn").onclick = function () {
          ov.remove();
          setTab("maps");
          planAndShowRoute(rm, meetAt);
        };
        load();
      });
    };
  }

  /* ------------------------------------------------------------ Inventory Tab */
  function renderInventory() {
    var d = S.data, items = {};
    d.inventory.forEach(function (r) {
      var k = r.item; items[k] = items[k] || { total: 0, lent: 0, cat: r.category };
      items[k].total += r.qty; if (r.status === "Lent out") items[k].lent += r.qty;
    });

    $("inv-summary").innerHTML = Object.keys(items).map(function (k) {
      var it = items[k], own = it.total - it.lent;
      return '<div class="card inv-sum"><div class="t">' + esc(k) + '</div><div class="m">' + it.total + " total &middot; " + own + " in hand &middot; " + it.lent + ' lent</div><div class="bar"><span class="own" style="width:' + (own / it.total * 100) + '%"></span><span class="lent" style="width:' + (it.lent / it.total * 100) + '%"></span></div></div>';
    }).join("");

    var cats = uniq(d.inventory.map(function (r) { return r.category; })), holders = uniq(d.inventory.map(function (r) { return r.holder; }));
    fillSelect("inv-cat", "All categories", cats); fillSelect("inv-holder", "Anyone holding", holders);

    var q = $("inv-search").value.toLowerCase(), cat = $("inv-cat").value, h = $("inv-holder").value, st = $("inv-status").value;
    var rows = d.inventory.filter(function (r) {
      return (!cat || r.category === cat) && (!h || r.holder === h) && (!st || r.status === st) &&
        (!q || (r.item + " " + r.team + " " + r.room + " " + r.holder + " " + r.id).toLowerCase().indexOf(q) >= 0);
    });

    var names = d.team.map(function (t) { return t.name; });
    $("inv-rows").innerHTML = rows.length ? rows.map(function (r) {
      var lent = r.status === "Lent out";
      return "<tr>" +
        '<td class="td-inv-id"><span class="muted">' + esc(r.id) + "</span></td>" +
        '<td class="td-inv-item"><div><b>' + esc(r.item) + '</b><div class="muted" style="font-size:12px">' + esc(r.category) + '</div></div><span class="badge ' + (lent ? "b-power" : "b-done") + ' mobile-only-badge">' + esc(r.status) + '</span></td>' +
        '<td class="num td-inv-qty"><span class="mobile-only-lbl">Total Quantity: </span><b>' + r.qty + "</b></td>" +
        '<td class="td-inv-holder"><span class="mobile-only-lbl">Held by: </span><select data-holder="' + esc(r.id) + '" aria-label="Holder of ' + esc(r.id) + '">' + names.map(function (n) { return "<option" + (n === r.holder ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></td>" +
        '<td class="td-inv-lent">' + (lent ? '<span class="mobile-only-lbl">Lent to: </span><b>' + esc(r.team) + '</b> <span class="muted" style="font-size:12px">(Room ' + esc(r.room) + ' &middot; ' + esc(r.floorName) + ')</span>' : '<span class="muted">—</span>') + "</td>" +
        '<td class="td-inv-status desktop-only"><span class="badge ' + (lent ? "b-power" : "b-done") + '">' + esc(r.status) + "</span></td>" +
        '<td class="td-inv-action">' + (lent ? '<button class="btn small" data-return="' + esc(r.id) + '">Mark returned</button>' : '<button class="btn small primary" data-lend="' + esc(r.id) + '">Lend out…</button>') + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty">No items match this search.</td></tr>';
  }

  function uniq(a) { return a.filter(function (v, i) { return v && a.indexOf(v) === i; }).sort(); }
  function fillSelect(id, first, vals) {
    var el = $(id), cur = el.value;
    el.innerHTML = '<option value="">' + first + "</option>" + vals.map(function (v) { return "<option" + (v === cur ? " selected" : "") + ">" + esc(v) + "</option>"; }).join("");
  }

  function openLend(item) {
    var d = S.data;
    var ov = document.createElement("div"); ov.className = "backdrop";
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Lend item"><div class="mh"><h3>Lend ' + esc(item.item) + " (&times;" + item.qty + ')</h3><button class="x" aria-label="Close">&times;</button></div><div class="mb">' +
      '<label class="lbl" for="ln-team">Lent to team</label><input id="ln-team" list="ln-teams" placeholder="e.g. Team Vega" maxlength="60"><datalist id="ln-teams">' + uniq(d.rooms.reduce(function (a, r) { return a.concat(r.assigned.split(";").map(function (s) { return s.trim(); })); }, [])).map(function (t) { return '<option value="' + esc(t) + '">'; }).join("") + "</datalist>" +
      '<div class="two"><div><label class="lbl" for="ln-f">Floor</label><select id="ln-f" style="width:100%">' + floorOpts("F") + '</select></div><div><label class="lbl" for="ln-r">Room</label><select id="ln-r" style="width:100%">' + roomOpts("F", "") + '</select></div></div>' +
      '<p id="ln-err" style="color:var(--bad);font-size:13px;margin-top:8px" hidden>Enter a team and room.</p></div><div class="mf"><button class="btn" id="ln-cancel">Cancel</button><button class="btn primary" id="ln-ok">Save</button></div></div>';
    document.body.appendChild(ov);
    var q = function (s) { return ov.querySelector(s); };
    function close() { ov.remove(); }
    q(".x").onclick = close; q("#ln-cancel").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    q("#ln-f").onchange = function () { q("#ln-r").innerHTML = roomOpts(q("#ln-f").value, ""); };
    q("#ln-ok").onclick = function () {
      var t = q("#ln-team").value.trim(), r = q("#ln-r").value;
      if (!t || !r) { q("#ln-err").hidden = false; return; }
      Store.update("inventory", item.id, { team: t, room: r, floor: q("#ln-f").value, floorName: Store.FLOOR_NAMES[q("#ln-f").value], status: "Lent out", updated: Store.stamp() });
      close(); load();
    };
  }

  /* ------------------------------------------------------------ Event Listeners */
  function bind() {
    /* Desktop Tab clicks */
    document.querySelector(".tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (b) setTab(b.dataset.tab);
    });

    /* Mobile Bottom Navigation clicks */
    document.querySelector(".mobile-nav").addEventListener("click", function (e) {
      var b = e.target.closest(".mobile-nav-btn");
      if (b && b.dataset.tab) setTab(b.dataset.tab);
    });

    $("bell").onclick = function () { setTab("issues"); S.issueFilter = "unassigned"; renderIssues(); };

    var lf = $("login-form");
    if (lf) {
      lf.onsubmit = function (e) {
        e.preventDefault();
        var code = ($("login-code").value || "").trim().toUpperCase();
        if (!code) { showLoginError("Please enter your volunteer code."); return; }
        var btn = $("login-btn");
        btn.disabled = true; btn.textContent = "Signing in…";
        showLoginError("");
        Store.login(code).then(function (user) {
          btn.disabled = false; btn.textContent = "Sign in";
          applyUser(user);
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = "Sign in";
          showLoginError(err && err.message ? err.message : "Invalid volunteer code.");
        });
      };
    }
    function doLogout() {
      Store.logout().then(function () {
        applyUser(null);
      });
    }
    if ($("logout-btn")) $("logout-btn").onclick = doLogout;
    if ($("mobile-logout-btn")) $("mobile-logout-btn").onclick = doLogout;
    if ($("logistics-logout")) $("logistics-logout").onclick = doLogout;

    /* Mobile drawer toggle */
    var mToggle = $("mobile-menu-toggle");
    var mDrawer = $("mobile-drawer");
    if (mToggle && mDrawer) {
      mToggle.onclick = function (e) {
        e.stopPropagation();
        var willOpen = mDrawer.hidden;
        mDrawer.hidden = !willOpen;
        mToggle.setAttribute("aria-expanded", willOpen);
        mToggle.classList.toggle("is-open", willOpen);
      };
      document.addEventListener("click", function (e) {
        if (!mDrawer.hidden && !mDrawer.contains(e.target) && !mToggle.contains(e.target)) {
          mDrawer.hidden = true;
          mToggle.setAttribute("aria-expanded", "false");
          mToggle.classList.remove("is-open");
        }
      });
      mDrawer.querySelectorAll("a, button:not(#mobile-alerts-btn)").forEach(function (el) {
        el.addEventListener("click", function () {
          mDrawer.hidden = true;
          mToggle.setAttribute("aria-expanded", "false");
          mToggle.classList.remove("is-open");
        });
      });
    }

    function enableAlerts() {
      S.alertsOn = true; TO.beep();
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
      if ($("alerts-btn")) { $("alerts-btn").textContent = "Alerts on"; $("alerts-btn").disabled = true; }
      if ($("mobile-alerts-btn")) { $("mobile-alerts-btn").textContent = "🔔 Alerts On"; $("mobile-alerts-btn").disabled = true; }
      TO.toast("Alerts enabled", "Sound and notifications enabled for incoming issues.", "ok");
    }
    if ($("alerts-btn")) $("alerts-btn").onclick = enableAlerts;
    if ($("mobile-alerts-btn")) $("mobile-alerts-btn").onclick = enableAlerts;

    /* Routing UI */
    $("rt-calc").onclick = function () { planAndShowRoute($("rt-from").value, $("rt-to").value); };
    $("rt-clear").onclick = clearActiveRoute;
    $("rt-swap").onclick = function () {
      var tmp = $("rt-from").value;
      $("rt-from").value = $("rt-to").value;
      $("rt-to").value = tmp;
      if ($("rt-from").value && $("rt-to").value) planAndShowRoute($("rt-from").value, $("rt-to").value);
    };
    $("rt-my-room").onclick = function () {
      $("rt-from").value = myCurrentRoom();
      TO.toast("Origin set", "Start location set to your current room (" + $("rt-from").value + ").", "ok");
    };

    var sc = $("sheet-close"), sb = $("map-sheet-backdrop");
    if (sc) sc.onclick = closeMapBottomSheet;
    if (sb) sb.onclick = closeMapBottomSheet;

    /* Global dynamic click delegations */
    document.addEventListener("click", function (e) {
      var t;
      if ((t = e.target.closest("[data-if]"))) { S.issueFilter = t.dataset.if; renderIssues(); }
      else if ((t = e.target.closest("[data-claim]"))) { taskAction(t, t.dataset.claim, "claim"); }
      else if ((t = e.target.closest("[data-resolve]"))) { taskAction(t, t.dataset.resolve, "resolve"); }
      else if ((t = e.target.closest("[data-floor]"))) { S.floor = t.dataset.floor; S.selected = null; closeMapBottomSheet(); map.setFloor(S.floor); renderMapChrome(); renderSide(); }
      else if ((t = e.target.closest("[data-layer]"))) { S.layer = t.dataset.layer; map.setLayer(S.layer); renderMapChrome(); }
      else if ((t = e.target.closest("[data-zone]"))) { S.zone = S.zone === t.dataset.zone ? null : t.dataset.zone; map.setZoneFilter(S.zone); renderMapChrome(); }
      else if ((t = e.target.closest("[data-member]"))) {
        var idx = +t.dataset.member;
        var member = S.data.team[idx];
        if (member.name === S.me) {
          /* Self click: focus live location update */
          var ms = $("my-status");
          if (ms) {
            ms.scrollIntoView({ behavior: "smooth" });
            var ed = $("ms-editor"), btn = $("ms-toggle-edit");
            if (ed && ed.hidden) {
              ed.hidden = false;
              if (btn) {
                btn.setAttribute("aria-expanded", "true");
                btn.querySelector("span").textContent = "Close";
              }
            }
          }
        } else {
          openPingModal(member);
        }
      }
      else if ((t = e.target.closest("[data-confirm-ping]"))) {
        var meetId = t.dataset.confirmPing;
        var m = S.data.meetups.filter(function (x) { return x.id === meetId; })[0];
        if (m) openConfirmLocationModal(m);
      }
      else if ((t = e.target.closest("[data-route-to]"))) {
        var destRoom = t.dataset.routeTo;
        setTab("maps");
        $("rt-to").value = destRoom;
        var fromRoom = myCurrentRoom();
        $("rt-from").value = fromRoom;
        planAndShowRoute(fromRoom, destRoom);
      }
      else if ((t = e.target.closest("[data-meet]"))) {
        Store.update("meetups", t.dataset.meet, { status: t.dataset.st });
        load();
      }
      else if ((t = e.target.closest("[data-return]"))) {
        Store.update("inventory", t.dataset.return, { team: "", room: "", floor: "", floorName: "", status: "With member", updated: Store.stamp() });
        load();
      }
      else if ((t = e.target.closest("[data-lend]"))) {
        openLend(S.data.inventory.filter(function (x) { return x.id === t.dataset.lend; })[0]);
      }
    });

    $("pins-chip").onclick = function () { S.pins = !S.pins; map.setPins(S.pins); renderMapChrome(); };
    $("issue-search").oninput = function () { S.issueText = this.value; renderIssues(); };
    ["inv-search", "inv-cat", "inv-holder", "inv-status"].forEach(function (id) { $(id).addEventListener("input", renderInventory); });

    document.addEventListener("change", function (e) {
      var t = e.target;
      if (t.dataset.holder) {
        Store.update("inventory", t.dataset.holder, { holder: t.value, updated: Store.stamp() }); load();
      }
    });

    Store.onChange(function () { load(); });
    document.addEventListener("techops-theme", function () { map.render(); });
  }

  function showLoginError(msg) {
    var el = $("login-error");
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  var queryHandled = false;
  function handleQuery() {
    if (queryHandled) return;
    queryHandled = true;
    var q = new URLSearchParams(location.search);
    if (q.get("floor") && D.FLOORS.some(function (f) { return f.id === q.get("floor"); })) {
      S.floor = q.get("floor");
      map.setFloor(S.floor);
    }
    if (q.get("layer") === "heat") { S.layer = "heat"; map.setLayer("heat"); }
    if (q.get("room")) {
      S.selected = q.get("room");
      map.select(S.selected);
      $("rt-to").value = S.selected;
      if (window.innerWidth <= 768) {
        openMapBottomSheet(S.selected);
      }
    }
    renderMapChrome();
    renderSide();

    if (q.get("routeTo")) {
      setTab("maps");
      planAndShowRoute(q.get("routeFrom") || myCurrentRoom(), q.get("routeTo"));
    } else if (q.get("tab")) {
      setTab(q.get("tab"));
    }
    if (q.get("drawer") === "open") {
      var md = $("mobile-drawer"), mt = $("mobile-menu-toggle");
      if (md) md.hidden = false;
      if (mt) { mt.classList.add("is-open"); mt.setAttribute("aria-expanded", "true"); }
    }
    if (q.get("edit")) {
      var ed = $("ms-editor"), btn = $("ms-toggle-edit");
      if (ed) {
        ed.hidden = false;
        if (btn) {
          btn.setAttribute("aria-expanded", "true");
          btn.querySelector("span").textContent = "Close";
        }
      }
    }
    setTimeout(function () { map.fit(); }, 60);
  }

  function applyUser(user) {
    S.user = user || null;
    S.me = user ? user.name : "";
    var main = document.querySelector("main");
    var nav = document.querySelector(".mobile-nav");
    var chip = $("user-chip");
    var mobUser = $("mobile-user");
    var loginScreen = $("login-screen");
    var logisticsView = $("logistics-view");
    var bell = $("bell");
    var techOnly = document.querySelectorAll(".tech-only");

    if (!user) {
      if (loginScreen) loginScreen.hidden = false;
      if (logisticsView) logisticsView.hidden = true;
      if (main) main.hidden = true;
      if (nav) nav.hidden = true;
      if (chip) chip.hidden = true;
      if (mobUser) mobUser.hidden = true;
      if (bell) bell.hidden = true;
      techOnly.forEach(function (el) { el.hidden = true; });

      var ln = $("login-note");
      if (ln && !Store.isLive()) {
        ln.hidden = false;
        ln.innerHTML = 'Preview mode volunteer codes: <b>TO-001</b> (Mohamed Khairy), <b>TO-002</b> (Omar), <b>TO-003</b> (Lojine), or <b>LG-001</b> (Logistics).';
      }
      var inp = $("login-code");
      if (inp) { inp.value = ""; setTimeout(function () { inp.focus(); }, 120); }
      return;
    }

    if (chip) {
      chip.hidden = false;
      if ($("user-name")) $("user-name").textContent = user.name;
      if ($("user-team")) $("user-team").textContent = user.team + " · " + user.code;
      if ($("user-avatar")) $("user-avatar").textContent = user.initials || TO.initials(user.name);
    }
    if (mobUser) {
      mobUser.hidden = false;
      if ($("mobile-user-name")) $("mobile-user-name").textContent = user.name;
      if ($("mobile-user-team")) $("mobile-user-team").textContent = user.team + " · " + user.code;
      if ($("mobile-user-avatar")) $("mobile-user-avatar").textContent = user.initials || TO.initials(user.name);
    }

    if (user.team === "Logistics") {
      if (loginScreen) loginScreen.hidden = true;
      if (logisticsView) logisticsView.hidden = false;
      if (main) main.hidden = true;
      if (nav) nav.hidden = true;
      if (bell) bell.hidden = true;
      techOnly.forEach(function (el) { el.hidden = true; });
      if ($("logistics-msg")) {
        $("logistics-msg").textContent = "Welcome, " + user.name + " (" + user.code + "). Your Logistics workspace is being prepared by Norhan. Check back soon!";
      }
      return;
    }

    /* TechOps user */
    if (loginScreen) loginScreen.hidden = true;
    if (logisticsView) logisticsView.hidden = true;
    if (main) main.hidden = false;
    if (nav) nav.hidden = false;
    if (bell) bell.hidden = false;
    techOnly.forEach(function (el) { el.hidden = false; });

    Store.start().then(function () {
      return load();
    }).then(function () {
      handleQuery();
    });
  }

  /* ------------------------------------------------------------ Boot */
  TO.initTheme();
  map = new FloorMap($("map"), {
    onSelect: function (c) {
      if (!c) {
        closeMapBottomSheet();
        return;
      }
      if (c.indexOf("STAIR-") === 0) {
        var sk = c.replace("STAIR-", "");
        if (window.innerWidth <= 768) {
          openMapBottomSheet(c);
        } else {
          TO.toast(Router.SN[sk] || "Stairs", "Inter-floor staircase connecting Levels 0, 1, and 2.");
        }
        return;
      }
      selectRoom(c, false);
      /* Pre-fill destination field for route */
      if (!/^wf:/i.test(c)) $("rt-to").value = c;
    },
    tipHtml: tipHtml
  });

  map.setFloor("G");
  bind();

  Store.restore().then(function (user) {
    applyUser(user);
  });
})();
