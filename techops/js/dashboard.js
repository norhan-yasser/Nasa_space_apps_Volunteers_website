/* TechOps dashboard */
(function () {
  var C = window.TECHOPS_CONFIG, D = window.TechOpsData, Store = window.TechOpsStore, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  var ME_KEY = "techops_me", SEEN_KEY = "techops_seen_reports", SEEN_MEET = "techops_seen_meetups";

  var S = {
    data: null, tab: "issues", floor: "G", layer: "zones", selected: null, pins: true, zone: null,
    issueFilter: "open", issueText: "", first: true,
    seen: jget(SEEN_KEY, []), seenMeet: jget(SEEN_MEET, []), me: lget(ME_KEY) || "", alertsOn: false
  };
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return ""; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var map;

  /* ------------------------------------------------------------ loading */
  function load() {
    return Store.loadAll().then(function (d) {
      S.data = d;
      d.roomMap = {}; d.rooms.forEach(function (r) { d.roomMap[r.code] = r; });
      detectNew();
      var sig = JSON.stringify([d.rooms, d.wifi, d.team, d.inventory, d.reports, d.meetups, d.meta.sheetOk]);
      if (sig === S.sig) { renderHeader(); return; }   /* nothing changed: keep open dropdowns / scroll position */
      S.sig = sig;
      renderAll();
    });
  }
  function detectNew() {
    var d = S.data, fresh = d.reports.filter(function (r) { return r.status === "New" && S.seen.indexOf(r.id) < 0; });
    if (!S.first) {
      fresh.slice(0, 3).forEach(function (r) {
        var msg = r.issue + " · " + Store.FLOOR_NAMES[r.floor] + " · " + r.room;
        TO.toast("New issue reported", msg, "bad", function () { gotoIssueOnMap(r); });
        notifyDesktop("New TechOps issue", msg);
      });
      if (fresh.length) TO.beep();
    }
    d.reports.forEach(function (r) { if (S.seen.indexOf(r.id) < 0) S.seen.push(r.id); });
    lset(SEEN_KEY, JSON.stringify(S.seen.slice(-500)));

    /* meetup requests addressed to me */
    d.meetups.forEach(function (m) {
      if (S.seenMeet.indexOf(m.id) >= 0) return;
      S.seenMeet.push(m.id);
      if (!S.first && S.me && m.target === S.me && m.status === "Pending") {
        TO.toast("Meetup request", m.by + " wants to meet at " + m.meetAt, "", function () { setTab("team"); });
        notifyDesktop("TechOps meetup request", m.by + " wants to meet at " + m.meetAt);
        TO.beep();
      }
    });
    lset(SEEN_MEET, JSON.stringify(S.seenMeet.slice(-300)));
    S.first = false;
  }
  function notifyDesktop(title, body) {
    try { if (S.alertsOn && "Notification" in window && Notification.permission === "granted") new Notification(title, { body: body, icon: "../assets/favicon.png" }); } catch (e) {}
  }

  /* ------------------------------------------------------------ chrome */
  function renderHeader() {
    var d = S.data, m = d.meta;
    var pill = $("status-pill");
    pill.className = "pill-status " + (m.sheetOk ? "live" : "demo");
    $("status-text").textContent = m.sheetOk ? "Live from Google Sheet" : "Demo data";
    pill.title = m.sheetOk ? "Reading the TechOps sheet. Updated " + m.fetchedAt.toLocaleTimeString() : "Could not read: " + m.failed.join(", ") + ". Showing bundled dummy data.";
    var note = $("demo-note"), bits = [];
    if (!m.sheetOk) bits.push("The TechOps sheet could not be read (is it shared as \u201CAnyone with the link can view\u201D?). Showing the bundled dummy data.");
    if (!m.live) bits.push("Write mode is DEMO: new reports, meetups and edits are stored in this browser only, not in the Google Sheet. Deploy apps-script/Code.gs and set APPS_SCRIPT_URL in js/config.js to enable sheet writes.");
    note.hidden = !bits.length;
    note.innerHTML = esc(bits.join(" ")) + (!m.live ? ' <button class="btn small" id="reset-demo">Reset demo changes</button>' : "");
    var rb = $("reset-demo"); if (rb) rb.onclick = function () { Store.resetDemo(); load(); };

    var sel = $("me"), cur = S.me;
    sel.innerHTML = '<option value="">Not selected</option>' + d.team.map(function (t) { return '<option value="' + esc(t.name) + '"' + (t.name === cur ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("");
    var open = d.reports.filter(function (r) { return r.status === "New"; }).length;
    var bc = $("bell-count"); bc.hidden = !open; bc.textContent = open;
    $("n-issues").textContent = d.reports.filter(function (r) { return r.status !== "Resolved"; }).length;
    $("n-issues").className = "n" + (open ? " hot" : "");
    var pending = S.me ? d.meetups.filter(function (m) { return m.target === S.me && m.status === "Pending"; }).length : 0;
    $("n-meet").hidden = !pending; $("n-meet").textContent = pending; $("n-meet").className = "n hot";
    document.title = (open ? "(" + open + ") " : "") + "TechOps Dashboard · NASA Space Apps Cairo";
  }
  function renderBanners() {
    var d = S.data, h = "";
    if (S.me) {
      d.meetups.filter(function (m) { return m.target === S.me && (m.status === "Pending" || m.status === "On the way"); }).forEach(function (m) {
        h += '<div class="banner"><div style="flex:1;min-width:220px"><b>' + esc(m.by) + "</b> asks you to meet at <b>" + esc(m.meetAt) + "</b> (" + esc(m.meetAt === m.byRoom ? m.byFloorName : m.targetFloorName) + ")" +
          '<div class="muted" style="font-size:12.5px">They are in ' + esc(m.byRoom) + " (" + esc(m.byFloorName) + ")" + (m.note ? " · " + esc(m.note) : "") + "</div></div>" +
          (m.status === "Pending" ? '<button class="btn accent" data-meet="' + esc(m.id) + '" data-st="On the way">On my way</button>' : '<span class="badge b-prog">On the way</span>') +
          '<button class="btn" data-meet="' + esc(m.id) + '" data-st="Done">' + (m.status === "Pending" ? "Decline / done" : "Mark done") + "</button></div>";
      });
    }
    $("banners").innerHTML = h;
  }
  function renderAll() {
    renderHeader(); renderBanners(); renderIssues(); renderMaps(); renderTeam(); renderInventory();
  }

  function setTab(t) {
    S.tab = t;
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); b.setAttribute("aria-selected", b.dataset.tab === t); });
    ["issues", "maps", "team", "inventory"].forEach(function (n) { $("tab-" + n).hidden = n !== t; });
    if (t === "maps") { map.fit(); }
  }

  /* ------------------------------------------------------------ issues */
  var FILTERS = [["open", "Open"], ["New", "New"], ["Resolved", "Resolved"], ["all", "All"]];
  function renderIssues() {
    var d = S.data;
    $("issue-filters").innerHTML = FILTERS.map(function (f) {
      var n = d.reports.filter(function (r) { return matchFilter(r, f[0]); }).length;
      return '<button class="chip' + (S.issueFilter === f[0] ? " on" : "") + '" data-if="' + f[0] + '">' + f[1] + " (" + n + ")</button>";
    }).join("");
    var q = S.issueText.toLowerCase();
    var rows = d.reports.filter(function (r) {
      return matchFilter(r, S.issueFilter) && (!q || (r.room + " " + r.details + " " + r.issue + " " + r.id + " " + r.assigned).toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });
    if (!rows.length) { $("issue-rows").innerHTML = '<tr><td colspan="7" class="empty">No issues in this view.</td></tr>'; return; }
    var names = d.team.map(function (t) { return t.name; });
    $("issue-rows").innerHTML = rows.map(function (r) {
      var when = Store.parseStamp(r.ts);
      return '<tr class="' + (r.status === "New" ? "is-new" : "") + '">' +
        '<td><select data-st="' + esc(r.id) + '" aria-label="Status of ' + esc(r.id) + '">' + D.STATUSES.map(function (s) { return "<option" + (s === r.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></td>" +
        '<td title="' + esc(r.ts) + '">' + esc(TO.ago(when)) + '<div class="muted" style="font-size:11.5px">' + esc(r.id) + "</div></td>" +
        "<td><b>" + esc(r.room) + '</b><div class="muted" style="font-size:12px">' + esc(r.floorName) + "</div></td>" +
        '<td><span class="badge ' + TO.issueClass(r.issue) + '">' + esc(r.issue) + "</span></td>" +
        '<td style="max-width:300px">' + esc(r.details || "—") + "</td>" +
        '<td><select data-as="' + esc(r.id) + '" aria-label="Assign ' + esc(r.id) + '"><option value="">Unassigned</option>' + names.map(function (n) { return "<option" + (n === r.assigned ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></td>" +
        '<td><button class="btn small" data-map="' + esc(r.id) + '">Show on map</button></td></tr>';
    }).join("");
  }
  function matchFilter(r, f) {
    if (f === "all") return true;
    if (f === "open") return r.status !== "Resolved";
    return r.status === f;
  }
  function gotoIssueOnMap(r) {
    setTab("maps"); S.floor = r.floor; map.setFloor(r.floor); renderMapChrome(); selectRoom(r.room, true);
  }

  /* ------------------------------------------------------------ maps */
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
    S.selected = code; map.select(code); renderSide();
    if (focus) map.focus(code);
  }
  function wifiFor(code) { return S.data.wifi.filter(function (w) { return w.id === "WF-" + code; })[0]; }
  function renderSide() {
    var d = S.data, side = $("side");
    if (S.selected && d.roomMap[S.selected]) {
      var r = d.roomMap[S.selected], w = wifiFor(r.code), z = D.ZONES[r.zone] || {};
      var iss = d.reports.filter(function (x) { return x.room === r.code && x.floor === r.floor && x.status !== "Resolved"; });
      var url = TO.reportUrl(r.floor, r.code);
      side.innerHTML = '<h3>Room ' + esc(r.code) + '</h3><div class="sub"><span class="badge" style="background:' + (z.color || "#64748b") + '33;border-color:' + (z.color || "#64748b") + ';color:var(--ink-bright)">' + esc(r.zone) + "</span> " + esc(r.floorName) + "</div>" +
        '<dl class="kv"><dt>Space</dt><dd>' + esc(r.type) + "</dd><dt>Capacity</dt><dd>" + esc(r.capacity) + "</dd><dt>Assigned to</dt><dd>" + esc(r.assigned || "—") + "</dd>" +
        "<dt>Wi-Fi</dt><dd>" + (w ? '<b style="color:' + TO.speedColor(w.mbps) + '">' + w.mbps + " Mbps</b> · " + w.latency + " ms · " + TO.speedLabel(w.mbps) : "No reading") + "</dd></dl>" +
        "<b>Open issues (" + iss.length + ")</b>" + (iss.length ? iss.map(function (x) { return '<div class="mini-issue"><span class="badge ' + TO.issueClass(x.issue) + '">' + esc(x.issue) + '</span> <span class="badge ' + TO.statusClass(x.status) + '">' + esc(x.status) + '</span><div class="muted" style="margin-top:4px">' + esc(x.details || "") + "</div></div>"; }).join("") : '<div class="muted" style="font-size:13px;margin-top:4px">None.</div>') +
        '<div style="margin-top:14px"><b>Room QR code</b><div class="muted" style="font-size:12px;margin-bottom:6px">Scan to report a problem from this room.</div><div class="qr-box">' + TO.qrSvg(url, 4) + '</div></div>' +
        '<div class="row" style="margin-top:12px"><a class="btn small" href="' + esc(url) + '" target="_blank" rel="noopener">Open form</a><a class="btn small" href="qr-codes.html?room=' + esc(r.code) + '">Print QR</a><button class="btn small ghost" id="side-clear">Clear</button></div>';
      var c = $("side-clear"); if (c) c.onclick = function () { S.selected = null; map.select(null); renderSide(); };
      return;
    }
    var rooms = d.rooms.filter(function (r) { return r.floor === S.floor; });
    var w = d.wifi.filter(function (x) { return x.floor === S.floor; });
    var avg = w.length ? Math.round(w.reduce(function (a, b) { return a + b.mbps; }, 0) / w.length) : 0;
    var weak = w.filter(function (x) { return x.mbps < 15; });
    var open = d.reports.filter(function (r) { return r.floor === S.floor && r.status !== "Resolved"; }).length;
    var zc = {}; rooms.forEach(function (r) { zc[r.zone] = (zc[r.zone] || 0) + 1; });
    side.innerHTML = "<h3>" + esc(Store.FLOOR_NAMES[S.floor]) + '</h3><div class="sub">Select a room on the map.</div>' +
      '<dl class="kv"><dt>Rooms</dt><dd>' + rooms.length + "</dd><dt>Open issues</dt><dd>" + open + "</dd><dt>Avg Wi-Fi</dt><dd>" + (avg ? '<b style="color:' + TO.speedColor(avg) + '">' + avg + " Mbps</b>" : "—") + "</dd>" +
      "<dt>Weak spots</dt><dd>" + (weak.length ? esc(weak.map(function (x) { return x.label.replace("Room ", ""); }).join(", ")) : "None") + "</dd></dl>" +
      "<b>Rooms by zone</b>" + Object.keys(D.ZONES).map(function (z) { return '<div class="row" style="margin-top:6px;gap:8px"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + D.ZONES[z].color + '"></span><span style="flex:1">' + z + "</span><b>" + (zc[z] || 0) + "</b></div>"; }).join("");
  }
  function tipHtml(code) {
    var d = S.data;
    if (code.indexOf("wf:") === 0) {
      var w = d.wifi.filter(function (x) { return x.id === code.slice(3); })[0];
      return w ? "<b>" + esc(w.label) + '</b><br><span style="color:' + TO.speedColor(w.mbps) + '">' + w.mbps + " Mbps</span> · " + w.latency + " ms · " + TO.speedLabel(w.mbps) : "";
    }
    var r = d.roomMap[code]; if (!r) return "<b>" + esc(code) + "</b>";
    var wf = wifiFor(code), n = d.reports.filter(function (x) { return x.room === code && x.floor === r.floor && x.status !== "Resolved"; }).length;
    return "<b>" + esc(code) + "</b> · " + esc(r.zone) + "<br>" + esc(r.assigned || "") + (wf ? '<br>Wi-Fi <span style="color:' + TO.speedColor(wf.mbps) + '">' + wf.mbps + " Mbps</span>" : "") + (n ? "<br>" + n + " open issue" + (n > 1 ? "s" : "") : "");
  }

  /* ------------------------------------------------------------ team */
  function stClass(s) { s = (s || "").toLowerCase(); return s.indexOf("avail") >= 0 ? "st-available" : s.indexOf("busy") >= 0 ? "st-busy" : s.indexOf("task") >= 0 ? "st-task" : "st-off"; }
  function renderTeam() {
    var d = S.data;
    $("team-grid").innerHTML = d.team.map(function (t, i) {
      return '<button class="card member" data-member="' + i + '" aria-label="Request a meetup with ' + esc(t.name) + '"><div class="row" style="flex-wrap:nowrap;gap:12px"><div class="avatar">' + esc(TO.initials(t.name)) + '</div><div><div class="name">' + esc(t.name) + '</div><div class="role">' + esc(t.role) + "</div></div></div>" +
        '<div class="status ' + stClass(t.status) + '"><i></i>' + esc(t.status) + '</div><div class="loc">&#9679; ' + esc(t.floorName) + " · Room " + esc(t.room) + '</div><div class="muted" style="font-size:12px">' + esc(t.focus) + '</div><span class="btn small primary" style="align-self:flex-start">Request meetup</span></button>';
    }).join("");

    var my = $("my-status"), meMember = S.me && d.team.filter(function (t) { return t.name === S.me; })[0];
    if (meMember) {
      my.hidden = false;
      my.innerHTML = '<div class="row"><b>My location &amp; status</b><span class="muted" style="font-size:12.5px">Keeps your teammates informed.</span><span class="sp"></span>' +
        '<select id="ms-floor" aria-label="My floor">' + floorOpts(meMember.floor) + '</select><select id="ms-room" aria-label="My room">' + roomOpts(meMember.floor, meMember.room) + '</select>' +
        '<select id="ms-status" aria-label="My status">' + ["Available", "Busy", "On a task", "Off duty"].map(function (s) { return "<option" + (s === meMember.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select><button class="btn primary small" id="ms-save">Update</button></div>';
      $("ms-floor").onchange = function () { $("ms-room").innerHTML = roomOpts($("ms-floor").value, ""); };
      $("ms-save").onclick = function () {
        Store.update("team", meMember.name, { floor: $("ms-floor").value, floorName: Store.FLOOR_NAMES[$("ms-floor").value], room: $("ms-room").value, status: $("ms-status").value });
        TO.toast("Updated", "Your location and status were saved.", "ok"); load();
      };
    } else my.hidden = true;

    var list = d.meetups.slice().sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });
    $("meet-rows").innerHTML = list.length ? list.map(function (m) {
      var cls = m.status === "Done" ? "b-done" : m.status === "On the way" ? "b-prog" : "b-ack";
      var canAct = S.me && m.target === S.me && m.status !== "Done";
      return '<div class="meet-item"><span class="badge ' + cls + '">' + esc(m.status) + '</span><div style="flex:1;min-width:230px"><b>' + esc(m.by) + "</b> &rarr; <b>" + esc(m.target) + '</b><div class="muted" style="font-size:12.5px">Meet at ' + esc(m.meetAt) + " · requester in " + esc(m.byRoom) + " (" + esc(m.byFloorName) + "), " + esc(m.target) + " in " + esc(m.targetRoom) + " (" + esc(m.targetFloorName) + ")" + (m.note ? " · " + esc(m.note) : "") + '</div></div><span class="muted" style="font-size:12px">' + esc(TO.ago(Store.parseStamp(m.ts))) + "</span>" +
        (canAct ? (m.status === "Pending" ? '<button class="btn small accent" data-meet="' + esc(m.id) + '" data-st="On the way">On my way</button>' : "") + '<button class="btn small" data-meet="' + esc(m.id) + '" data-st="Done">Done</button>' : "") + "</div>";
    }).join("") : '<div class="empty">No meetup requests yet.</div>';
  }
  function floorOpts(sel) { return D.FLOORS.map(function (f) { return '<option value="' + f.id + '"' + (f.id === sel ? " selected" : "") + ">" + f.name + "</option>"; }).join(""); }
  function roomOpts(floor, sel) {
    var list = S.data.rooms.filter(function (r) { return r.floor === floor; }).map(function (r) { return r.code; });
    if (sel && list.indexOf(sel) < 0) list.unshift(sel);
    return '<option value="">Select room…</option>' + list.map(function (c) { return '<option' + (c === sel ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
  }

  var meetMap = null;
  function openMeet(member) {
    var d = S.data, meM = S.me && d.team.filter(function (t) { return t.name === S.me; })[0];
    var ov = document.createElement("div"); ov.className = "backdrop";
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Request meetup"><div class="mh"><div class="avatar" style="width:40px;height:40px;font-size:15px">' + esc(TO.initials(member.name)) + '</div><h3>Meet ' + esc(member.name) + '</h3><button class="x" aria-label="Close">&times;</button></div><div class="mb" id="meet-body"></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); document.removeEventListener("keydown", esc_); }
    function esc_(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", esc_);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".x").onclick = close;

    var body = ov.querySelector("#meet-body");
    body.innerHTML =
      '<label class="lbl" for="mt-by">Who is asking?</label><select id="mt-by" style="width:100%"><option value="">Select your name…</option>' + d.team.filter(function (t) { return t.name !== member.name; }).map(function (t) { return "<option" + (t.name === S.me ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + "</select>" +
      '<div class="two" style="margin-top:12px"><div class="col"><h4>Your current location</h4><label class="lbl" for="mt-bf">Floor</label><select id="mt-bf" style="width:100%">' + floorOpts(meM ? meM.floor : "F") + '</select><label class="lbl" for="mt-br">Room</label><select id="mt-br" style="width:100%">' + roomOpts(meM ? meM.floor : "F", meM ? meM.room : "") + "</select></div>" +
      '<div class="col"><h4>' + esc(member.name.split(" ")[0]) + "'s current location</h4><label class=\"lbl\" for=\"mt-tf\">Floor</label><select id=\"mt-tf\" style=\"width:100%\">" + floorOpts(member.floor) + '</select><label class="lbl" for="mt-tr">Room</label><select id="mt-tr" style="width:100%">' + roomOpts(member.floor, member.room) + "</select></div></div>" +
      '<label class="lbl">Where should you meet?</label><div class="radio-row"><label><input type="radio" name="mt-at" value="me" checked> At my room</label><label><input type="radio" name="mt-at" value="them"> At their room</label></div>' +
      '<label class="lbl" for="mt-note">Message (optional)</label><textarea id="mt-note" maxlength="300" placeholder="e.g. Bring a spare HDMI cable"></textarea>' +
      '<div class="note" id="mt-hint"></div><p id="mt-err" style="color:var(--bad);font-size:13px;margin-top:8px" hidden></p>' +
      '<div class="mf" style="padding:14px 0 0"><a class="btn" href="tel:' + esc(member.phone.replace(/\s/g, "")) + '">Call ' + esc(member.phone) + '</a><button class="btn primary" id="mt-send">Send request</button></div>';

    var f = function (id) { return body.querySelector("#" + id); };
    function hint() {
      var a = f("mt-bf").value, b = f("mt-tf").value;
      f("mt-hint").textContent = a === b ? "Same floor (" + Store.FLOOR_NAMES[a] + "): a direct walk." : "Different floors: " + Store.FLOOR_NAMES[a] + " \u2192 " + Store.FLOOR_NAMES[b] + ". Use the stairs.";
    }
    f("mt-bf").onchange = function () { f("mt-br").innerHTML = roomOpts(f("mt-bf").value, ""); hint(); };
    f("mt-tf").onchange = function () { f("mt-tr").innerHTML = roomOpts(f("mt-tf").value, ""); hint(); };
    hint();
    f("mt-send").onclick = function () {
      var by = f("mt-by").value, br = f("mt-br").value, tr = f("mt-tr").value, err = f("mt-err");
      if (!by || !br || !tr) { err.hidden = false; err.textContent = "Please select your name, your room and their room."; return; }
      var at = body.querySelector("input[name=mt-at]:checked").value;
      var rec = { by: by, target: member.name, byFloor: f("mt-bf").value, byRoom: br, targetFloor: f("mt-tf").value, targetRoom: tr, meetAt: at === "me" ? br : tr, note: f("mt-note").value };
      f("mt-send").disabled = true;
      Store.addMeetup(rec).then(function () {
        S.me = by; lset(ME_KEY, by);
        showMeetResult(body, rec, member); load();
      });
    };
  }
  function showMeetResult(body, rec, member) {
    var meetFloor = rec.meetAt === rec.byRoom && rec.meetAt !== rec.targetRoom ? rec.byFloor : rec.meetAt === rec.targetRoom ? rec.targetFloor : rec.byFloor;
    if (rec.byRoom === rec.targetRoom) meetFloor = rec.byFloor;
    var atMine = rec.meetAt === rec.byRoom && rec.byFloor === meetFloor;
    body.innerHTML = '<div class="success" style="padding-bottom:10px"><div class="tick">&#10003;</div><h3>Request sent to ' + esc(member.name) + '</h3><p class="muted" style="margin-top:6px">' + esc(member.name.split(" ")[0]) + " will see it on the TechOps dashboard" + (TechOpsStore.isLive() ? "." : " (demo mode: only in this browser).") + '</p><p style="margin-top:12px">Meet at <b>' + esc(rec.meetAt) + "</b> &middot; " + esc(Store.FLOOR_NAMES[meetFloor]) + "</p>" +
      '<p class="muted" style="font-size:13px">' + (rec.byFloor === rec.targetFloor ? "Both of you are on the same floor." : esc(Store.FLOOR_NAMES[rec.byFloor]) + " \u2192 " + esc(Store.FLOOR_NAMES[rec.targetFloor]) + ": use the stairs.") + "</p></div>" +
      '<div class="map" id="meet-map" style="height:260px;min-height:0"></div><div class="mf" style="padding:14px 0 0"><button class="btn primary" id="mt-done">Close</button></div>';
    var mm = new FloorMap(body.querySelector("#meet-map"), {});
    mm.setData(mapData()); mm.pins = false; mm.layer = "zones";
    mm.setFloor(meetFloor);
    var A = { floor: rec.byFloor, room: rec.byRoom, label: "YOU" }, B = { floor: rec.targetFloor, room: rec.targetRoom, label: member.name.split(" ")[0].toUpperCase() };
    mm.highlight({ a: A, b: B });
    setTimeout(function () { mm.fit(); mm.focus(rec.meetAt, 0.85); }, 30);
    body.querySelector("#mt-done").onclick = function () { body.closest(".backdrop").remove(); };
  }

  /* ------------------------------------------------------------ inventory */
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
      return "<tr><td>" + esc(r.id) + "</td><td><b>" + esc(r.item) + '</b><div class="muted" style="font-size:12px">' + esc(r.category) + '</div></td><td class="num">' + r.qty + "</td>" +
        '<td><select data-holder="' + esc(r.id) + '" aria-label="Holder of ' + esc(r.id) + '">' + names.map(function (n) { return "<option" + (n === r.holder ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></td>" +
        "<td>" + (lent ? "<b>" + esc(r.team) + "</b><div class=\"muted\" style=\"font-size:12px\">Room " + esc(r.room) + " &middot; " + esc(r.floorName) + "</div>" : '<span class="muted">—</span>') + "</td>" +
        '<td><span class="badge ' + (lent ? "b-power" : "b-done") + '">' + esc(r.status) + "</span></td>" +
        "<td>" + (lent ? '<button class="btn small" data-return="' + esc(r.id) + '">Mark returned</button>' : '<button class="btn small" data-lend="' + esc(r.id) + '">Lend out…</button>') + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty">No items match.</td></tr>';
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
      Store.update("inventory", item.id, { team: t, room: r, floor: q("#ln-f").value, floorName: Store.FLOOR_NAMES[q("#ln-f").value], status: "Lent out", updated: Store.stamp() }); close(); load();
    };
  }

  /* ------------------------------------------------------------ events */
  function bind() {
    document.querySelector(".tabs").addEventListener("click", function (e) { var b = e.target.closest(".tab"); if (b) setTab(b.dataset.tab); });
    $("bell").onclick = function () { setTab("issues"); S.issueFilter = "New"; renderIssues(); };
    $("me").onchange = function () { S.me = this.value; lset(ME_KEY, S.me); renderHeader(); renderBanners(); renderTeam(); };
    $("alerts-btn").onclick = function () {
      S.alertsOn = true; TO.beep();
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
      this.textContent = "Alerts on"; this.disabled = true;
      TO.toast("Alerts enabled", "You will hear a sound and get a notification for new issues.", "ok");
    };
    document.addEventListener("click", function (e) {
      var t;
      if ((t = e.target.closest("[data-if]"))) { S.issueFilter = t.dataset.if; renderIssues(); }
      else if ((t = e.target.closest("[data-map]"))) { var r = S.data.reports.filter(function (x) { return x.id === t.dataset.map; })[0]; if (r) gotoIssueOnMap(r); }
      else if ((t = e.target.closest("[data-floor]"))) { S.floor = t.dataset.floor; S.selected = null; map.setFloor(S.floor); renderMapChrome(); renderSide(); }
      else if ((t = e.target.closest("[data-layer]"))) { S.layer = t.dataset.layer; map.setLayer(S.layer); renderMapChrome(); }
      else if ((t = e.target.closest("[data-zone]"))) { S.zone = S.zone === t.dataset.zone ? null : t.dataset.zone; map.setZoneFilter(S.zone); renderMapChrome(); }
      else if ((t = e.target.closest("[data-member]"))) { openMeet(S.data.team[+t.dataset.member]); }
      else if ((t = e.target.closest("[data-meet]"))) { Store.update("meetups", t.dataset.meet, { status: t.dataset.st }); load(); }
      else if ((t = e.target.closest("[data-return]"))) { Store.update("inventory", t.dataset.return, { team: "", room: "", floor: "", floorName: "", status: "With member", updated: Store.stamp() }); load(); }
      else if ((t = e.target.closest("[data-lend]"))) { openLend(S.data.inventory.filter(function (x) { return x.id === t.dataset.lend; })[0]); }
    });
    $("pins-chip").onclick = function () { S.pins = !S.pins; map.setPins(S.pins); renderMapChrome(); };
    $("issue-search").oninput = function () { S.issueText = this.value; renderIssues(); };
    ["inv-search", "inv-cat", "inv-holder", "inv-status"].forEach(function (id) { $(id).addEventListener("input", renderInventory); });
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (t.dataset.st && t.tagName === "SELECT") {
        var f = { status: t.value };
        if (t.value === "Resolved") f.resolvedAt = Store.stamp();
        Store.update("reports", t.dataset.st, f); load();
      } else if (t.dataset.as !== undefined && t.tagName === "SELECT") {
        var rep = S.data.reports.filter(function (x) { return x.id === t.dataset.as; })[0], f2 = { assigned: t.value };
        if (t.value && rep && rep.status === "New") f2.status = "Acknowledged";
        Store.update("reports", t.dataset.as, f2); load();
      } else if (t.dataset.holder) { Store.update("inventory", t.dataset.holder, { holder: t.value, updated: Store.stamp() }); load(); }
    });
    Store.onChange(function () { load(); });
    document.addEventListener("techops-theme", function () { map.render(); });
  }

  /* ------------------------------------------------------------ boot */
  TO.initTheme();
  map = new FloorMap($("map"), { onSelect: function (c) { selectRoom(c, false); }, tipHtml: tipHtml });
  map.setFloor("G");
  bind();
  load().then(function () {
    var q = new URLSearchParams(location.search);
    if (q.get("floor") && D.FLOORS.some(function (f) { return f.id === q.get("floor"); })) { S.floor = q.get("floor"); map.setFloor(S.floor); }
    if (q.get("layer") === "heat") { S.layer = "heat"; map.setLayer("heat"); }
    if (q.get("room")) { S.selected = q.get("room"); map.select(S.selected); }
    renderMapChrome(); renderSide();
    if (q.get("tab")) setTab(q.get("tab"));
    setTimeout(function () { map.fit(); }, 60);
  });
  setInterval(load, C.POLL_MS);
})();
