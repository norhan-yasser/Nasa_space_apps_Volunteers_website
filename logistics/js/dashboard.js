/* Logistics dashboard: requests from the Logistics QR help form.
 * Simpler than Tech Ops: a volunteer only CLAIMS a request and marks it done.
 * Data layer is shared with Tech Ops (../techops/js/store.js); this team only sees `team == "Logistics"` requests. */
(function () {
  var Store = window.TechOpsStore, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  var SEEN_KEY = "logistics_seen_v1";
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var S = { user: null, me: "", data: null, filter: "unassigned", text: "", seen: jget(SEEN_KEY, []), first: true, alertsOn: false, busy: {}, sig: "" };

  var FILTERS = [["unassigned", "Unclaimed"], ["mine", "My requests"], ["Resolved", "Done"], ["all", "All"]];
  var EMPTY = { unassigned: "No unclaimed requests right now.", mine: "You have no claimed requests.", Resolved: "Nothing completed yet.", all: "No requests yet." };
  function isUnassigned(r) { return r.status !== "Resolved" && !r.assigned; }
  function isMine(r) { return r.status !== "Resolved" && !!S.me && r.assigned === S.me; }
  function matchFilter(r, f) {
    if (f === "all") return true;
    if (f === "unassigned") return isUnassigned(r);
    if (f === "mine") return isMine(r);
    return r.status === f;
  }

  /* ---------------------------------------------------------------- data */
  function load() {
    return Store.loadAll().then(function (d) {
      S.data = d;
      detectNew();
      var sig = JSON.stringify([d.reports, d.meta.online]);
      if (sig === S.sig) { renderHeader(); return; }
      S.sig = sig;
      renderHeader();
      renderIssues();
    });
  }

  /* Alert: toast + sound + bell counter + tab title + optional desktop notification */
  function detectNew() {
    var d = S.data;
    var fresh = d.reports.filter(function (r) { return r.status === "New" && S.seen.indexOf(r.id) < 0; });
    if (!S.first && fresh.length) {
      fresh.slice(0, 3).forEach(function (r) {
        var msg = r.issue + " · " + (r.floorName || Store.FLOOR_NAMES[r.floor] || "") + " · " + r.room;
        TO.toast("New Logistics request!", msg, "bad", function () { S.filter = "unassigned"; renderIssues(); });
        notifyDesktop("New Logistics request", msg);
      });
      TO.beep();
      try { if (navigator.vibrate) navigator.vibrate(200); } catch (e) {}
    }
    d.reports.forEach(function (r) { if (S.seen.indexOf(r.id) < 0) S.seen.push(r.id); });
    jset(SEEN_KEY, S.seen.slice(-500));
    S.first = false;

    var open = d.reports.filter(isUnassigned).length;
    var c = $("bell-count");
    c.textContent = open; c.hidden = !open;
    document.title = (open ? "(" + open + ") " : "") + "Logistics Dashboard · NASA Space Apps Cairo";
  }
  function notifyDesktop(title, body) {
    try {
      if (S.alertsOn && "Notification" in window && Notification.permission === "granted") new Notification(title, { body: body, icon: "../assets/favicon.png" });
    } catch (e) {}
  }
  function enableAlerts() {
    S.alertsOn = true; TO.beep();
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
    $("alerts-btn").textContent = "Alerts on"; $("alerts-btn").disabled = true;
    TO.toast("Alerts on", "You will hear a sound when a new request arrives. Keep this page open.", "ok");
  }

  /* ---------------------------------------------------------------- render */
  function renderHeader() {
    var m = S.data.meta, pill = $("status-pill");
    pill.className = "pill-status " + (!m.online ? "demo" : m.live ? "live" : "demo");
    $("status-text").textContent = !m.online ? "Offline" : m.live ? "Live" : "Local preview";
    var note = $("demo-note"), bits = [];
    if (!m.online) bits.push("Could not load data from Firebase: " + (m.error || "unknown error") + ".");
    if (!m.live) bits.push("Local preview: Firebase is not configured, so requests are stored in this browser only.");
    note.hidden = !bits.length;
    note.innerHTML = esc(bits.join(" ")) + (!m.live ? ' <button class="btn small" id="reset-demo">Reset preview data</button>' : "");
    var rb = $("reset-demo"); if (rb) rb.onclick = function () { Store.resetDemo(); S.sig = ""; load(); };
    var mine = S.data.reports.filter(isMine).length, open = S.data.reports.filter(isUnassigned).length;
    $("greeting").textContent = "Hi " + (S.user ? S.user.name.split(" ")[0] : "") + " · " + open + " unclaimed" + (mine ? " · " + mine + " yours" : "");
  }

  function renderIssues() {
    var d = S.data; if (!d) return;
    $("issue-filters").innerHTML = FILTERS.map(function (f) {
      var n = d.reports.filter(function (r) { return matchFilter(r, f[0]); }).length;
      return '<button class="chip' + (S.filter === f[0] ? " on" : "") + '" data-if="' + f[0] + '">' + f[1] + " (" + n + ")</button>";
    }).join("");

    var q = S.text.toLowerCase();
    var rows = d.reports.filter(function (r) {
      return matchFilter(r, S.filter) && (!q || (r.room + " " + r.details + " " + r.issue + " " + r.id + " " + r.assigned + " " + r.reporter + " " + r.floorName).toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });

    if (!rows.length) {
      $("issue-rows").innerHTML = '<tr><td colspan="7" class="empty">' + esc(q ? "No requests match your search." : EMPTY[S.filter] || EMPTY.all) + "</td></tr>";
      return;
    }
    $("issue-rows").innerHTML = rows.map(function (r) {
      var when = Store.parseStamp(r.ts), mine = isMine(r), free = isUnassigned(r);
      var action = free ? '<button class="btn small primary claim-btn" data-claim="' + esc(r.id) + '">Claim</button>'
        : mine ? '<button class="btn small ok resolve-btn" data-resolve="' + esc(r.id) + '">Mark as done</button>' : "";
      return '<tr class="' + (free ? "is-new" : mine ? "is-mine" : "") + '">' +
        '<td class="td-status"><span class="badge ' + TO.statusClass(r.status) + '">' + esc(r.status === "Resolved" ? "Done" : r.status) + "</span></td>" +
        '<td class="td-meta" title="' + esc(r.ts) + '"><span class="issue-ago">' + esc(TO.ago(when)) + '</span><span class="muted issue-id">' + esc(r.id) + "</span></td>" +
        '<td class="td-room"><div><b class="issue-room-code">' + esc(r.room) + '</b> <span class="muted issue-floor">(' + esc(r.floorName) + ')</span></div><span class="badge ' + TO.issueClass(r.issue) + ' mobile-only-badge">' + esc(r.issue) + "</span></td>" +
        '<td class="td-badge desktop-only"><span class="badge ' + TO.issueClass(r.issue) + '">' + esc(r.issue) + "</span></td>" +
        '<td class="td-desc">' + esc(r.details || "—") + (r.reporter ? '<span class="req-from">From: ' + esc(r.reporter) + "</span>" : "") + "</td>" +
        '<td class="td-assign">' + (r.assigned ? '<span class="assignee' + (mine ? " me" : "") + '">' + esc(mine ? "You" : r.assigned) + "</span>" : '<span class="muted">Unclaimed</span>') + "</td>" +
        '<td class="td-action"><div class="action-stack">' + action + "</div></td></tr>";
    }).join("");
  }

  function taskAction(btn, id, kind) {
    if (S.busy[id]) return;
    S.busy[id] = true;
    var label = btn.textContent; btn.disabled = true; btn.textContent = kind === "claim" ? "Claiming…" : "Saving…";
    (kind === "claim" ? Store.claimReport(id) : Store.resolveReport(id)).then(function () {
      TO.toast(kind === "claim" ? "Request claimed" : "Request done", kind === "claim" ? id + " is now assigned to you." : id + " marked as done.", "ok");
    }).catch(function () { btn.disabled = false; btn.textContent = label; })
      .then(function () { delete S.busy[id]; S.sig = ""; return load(); });
  }

  /* ---------------------------------------------------------------- sign in */
  function showLoginError(m) { var e = $("login-error"); e.textContent = m || ""; e.hidden = !m; }

  function applyUser(user) {
    S.user = user || null; S.me = user ? user.name : "";
    if (!user) {
      $("login-screen").hidden = false; $("main").hidden = true; $("bell").hidden = true;
      var ln = $("login-note");
      if (!Store.isLive()) { ln.hidden = false; ln.innerHTML = "Preview mode volunteer codes: <b>LG-001</b>, <b>LG-002</b>, <b>LG-003</b>."; }
      var inp = $("login-code"); inp.value = ""; setTimeout(function () { inp.focus(); }, 120);
      return;
    }
    if (user.team === "Dispatch" || user.team === "Competition") { location.replace("../dispatch/index.html"); return; }
    if (user.team !== "Logistics") {
      /* Tech Ops volunteers have their own dashboard; the common code only opens Maps */
      if (user.team === "TechOps") { location.replace("../techops/index.html"); return; }
      Store.logout().then(function () {
        applyUser(null);
        showLoginError("This dashboard is for the Logistics team. Your code opens the Maps page from the Overview.");
      });
      return;
    }
    $("login-screen").hidden = true; $("main").hidden = false; $("bell").hidden = false;
    $("user-name").textContent = user.name;
    $("user-team").textContent = user.team + " · " + user.code;
    $("user-avatar").textContent = TO.initials(user.name);
    S.first = true; S.sig = "";
    Store.start().then(load);
  }

  /* ---------------------------------------------------------------- boot */
  TO.initTheme();
  $("login-form").onsubmit = function (e) {
    e.preventDefault();
    var code = ($("login-code").value || "").trim();
    if (!code) { showLoginError("Please enter your volunteer code."); return; }
    var btn = $("login-btn"); btn.disabled = true; btn.textContent = "Signing in…"; showLoginError("");
    Store.login(code).then(function (u) { btn.disabled = false; btn.textContent = "Sign in"; applyUser(u); })
      .catch(function (err) { btn.disabled = false; btn.textContent = "Sign in"; showLoginError(err && err.message ? err.message : "Invalid volunteer code."); });
  };
  $("logout-btn").onclick = function () { Store.logout().then(function () { S.data = null; applyUser(null); }); };
  $("alerts-btn").onclick = enableAlerts;
  $("bell").onclick = function () { S.filter = "unassigned"; renderIssues(); };
  $("issue-search").oninput = function () { S.text = this.value; renderIssues(); };
  document.addEventListener("click", function (e) {
    var f = e.target.closest("[data-if]");
    if (f) { S.filter = f.dataset.if; renderIssues(); return; }
    var c = e.target.closest("[data-claim]");
    if (c) { taskAction(c, c.dataset.claim, "claim"); return; }
    var r = e.target.closest("[data-resolve]");
    if (r) taskAction(r, r.dataset.resolve, "resolve");
  });
  Store.onChange(function () { if (S.user) load(); });
  setInterval(function () { if (S.user && S.data) renderIssues(); }, 60000);

  Store.restore().then(applyUser);
})();
