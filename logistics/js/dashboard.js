/* Logistics dashboard: requests from the participant QR help form.
 * Strict RBAC: only Logistics (or Admin) volunteer roles may enter; unauthorized roles are strictly blocked without redirecting. */
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
      /* Strict role isolation: Logistics ONLY sees requests categorized for Logistics */
      d.reports = (d.reports || []).filter(function (r) { return r && r.team === "Logistics"; });
      S.data = d;
      detectNew();
      var sig = JSON.stringify([d.reports, d.meta.online]);
      if (sig === S.sig) { renderHeader(); return; }
      S.sig = sig;
      renderHeader();
      renderIssues();
    });
  }

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
    if ($("alerts-btn")) { $("alerts-btn").textContent = "Alerts on"; $("alerts-btn").disabled = true; }
    if ($("mobile-alerts-btn")) { $("mobile-alerts-btn").textContent = "Alerts on"; $("mobile-alerts-btn").disabled = true; }
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

  function renderCard(r) {
    var when = Store.parseStamp(r.ts), mine = isMine(r), free = isUnassigned(r), done = r.status === "Resolved";
    var floorLabel = r.floorName || Store.FLOOR_NAMES[r.floor] || "";
    var routeUrl = TO.routeHref(r, "../maps.html");

    var who = done ? "✓ Done" + (r.assigned ? " · <b>" + esc(r.assigned) + "</b>" : "")
      : r.handedBy ? "➡️ Handed to <b>" + esc(mine ? "You" : r.assigned) + "</b> by " + esc(r.handedBy)
      : r.assigned ? '<span class="assignee' + (mine ? " me" : "") + '">' + (mine ? "Assigned to <b>You</b>" : "Assigned to <b>" + esc(r.assigned) + "</b>") + "</span>"
      : "Unclaimed — awaiting volunteer";

    var primaryBtn = free
      ? '<button class="btn small primary claim-btn" data-claim="' + esc(r.id) + '">Claim</button>'
      : mine ? '<button class="btn small ok resolve-btn" data-resolve="' + esc(r.id) + '">Mark as Done</button>' : "";

    var routeBtn = routeUrl
      ? '<a class="btn small route-btn" href="' + esc(routeUrl) + '">🗺️ Show Route</a>'
      : '<button type="button" class="btn small route-btn is-disabled" disabled title="No room specified">🗺️ Show Route</button>';

    return '<article class="req-card' + (free ? " is-new" : mine ? " is-mine" : done ? " is-done" : "") + '">' +
      '<div class="req-card-head">' +
        '<div class="req-card-badges">' +
          '<span class="team-pill t-Logistics">Logistics</span>' +
          '<span class="badge ' + TO.statusClass(r.status) + '">' + esc(done ? "Done" : r.status) + "</span>" +
        "</div>" +
        '<span class="req-card-id" title="' + esc(r.ts) + '">' + esc(TO.ago(when)) + " · " + esc(r.id) + "</span>" +
      "</div>" +
      '<div class="req-card-title">' + esc(r.issue) + "</div>" +
      (r.room
        ? '<div class="req-card-loc">📍 <b>' + esc(r.room) + "</b>" + (floorLabel ? " · " + esc(floorLabel) : "") + "</div>"
        : '<div class="req-card-loc is-remote">🌐 Location not specified</div>') +
      '<div class="req-card-desc">' + esc(r.details || "—") +
        (r.reporter ? '<span class="req-from">From: ' + esc(r.reporter) + "</span>" : "") +
      "</div>" +
      '<div class="req-card-who">' + who + "</div>" +
      '<div class="req-card-actions">' + primaryBtn + routeBtn + "</div>" +
    "</article>";
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
      $("issue-rows").innerHTML = '<div class="req-empty">' + esc(q ? "No requests match your search." : EMPTY[S.filter] || EMPTY.all) + "</div>";
      return;
    }
    $("issue-rows").innerHTML = rows.map(renderCard).join("");
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

  /* ---------------------------------------------------------------- sign in & strict RBAC */
  function showLoginError(m) { var e = $("login-error"); e.textContent = m || ""; e.hidden = !m; }

  function populateUserChrome(user) {
    var chip = $("user-chip"), mobUser = $("mobile-user"), mobOut = $("mobile-logout-btn");
    if (!user) {
      if (chip) chip.hidden = true;
      if (mobUser) mobUser.hidden = true;
      if (mobOut) mobOut.hidden = true;
      return;
    }
    var roleText = Store.teamDisplayName(user) + " · " + user.code;
    if (chip) {
      chip.hidden = false;
      $("user-name").textContent = user.name;
      $("user-team").textContent = roleText;
      $("user-avatar").textContent = TO.initials(user.name);
    }
    if (mobUser) {
      mobUser.hidden = false;
      $("mobile-user-name").textContent = user.name;
      $("mobile-user-team").textContent = roleText;
      $("mobile-user-avatar").textContent = TO.initials(user.name);
    }
    if (mobOut) mobOut.hidden = false;
  }

  function applyUser(user) {
    S.user = user || null; S.me = user ? user.name : "";
    var authEls = document.querySelectorAll(".auth-only");

    if (!user) {
      populateUserChrome(null);
      authEls.forEach(function (el) { el.hidden = true; });
      $("login-screen").hidden = false;
      $("access-denied").hidden = true;
      $("main").hidden = true;
      $("bell").hidden = true;
      $("status-pill").className = "pill-status demo";
      $("status-text").textContent = Store.isLive() ? "Sign in required" : "Local preview";
      var ln = $("login-note");
      if (!Store.isLive()) { ln.hidden = false; ln.innerHTML = "Preview mode Logistics codes: <b>LG-001</b>, <b>LG-002</b>, <b>LG-003</b>."; }
      var inp = $("login-code"); inp.value = ""; setTimeout(function () { try { inp.focus(); } catch (e) {} }, 120);
      return;
    }

    populateUserChrome(user);

    /* STRICT RBAC: Never redirect to another dashboard. Strictly block unauthorized roles. */
    if (!Store.canAccess(user, "logistics")) {
      S.user = null; S.me = "";
      authEls.forEach(function (el) { el.hidden = true; });
      $("login-screen").hidden = true;
      $("main").hidden = true;
      $("bell").hidden = true;
      $("access-denied").hidden = false;
      $("status-pill").className = "pill-status demo";
      $("status-text").textContent = "Restricted";
      $("denied-msg").innerHTML = "Signed in as <b>" + esc(user.name) + "</b> (" + esc(Store.teamDisplayName(user)) + " · " + esc(user.code) + "). Your assigned role does not have permission to access the <b>Logistics</b> module.";
      return;
    }

    authEls.forEach(function (el) { el.hidden = false; });
    $("login-screen").hidden = true;
    $("access-denied").hidden = true;
    $("main").hidden = false;
    $("bell").hidden = false;
    S.first = true; S.sig = "";
    if (window.NasaTutorial && !Store.isTutorialCompleted("logistics")) {
      startLogisticsTutorial(false);
    } else {
      Store.start().then(function () {
        return load();
      });
    }
  }

  function startLogisticsTutorial(isManual) {
    if (window.TO && window.TO.closeMobileDrawer) window.TO.closeMobileDrawer();
    Store.enterTutorialMode("logistics");
    S.sig = "";
    load().then(function () {
      if (window.NasaTutorial) {
        window.NasaTutorial.start("logistics", function () {
          Store.start().then(function () {
            S.sig = "";
            load();
          });
        });
      }
    });
  }

  function doLogout() {
    Store.logout().then(function () { S.data = null; applyUser(null); });
  }

  /* ---------------------------------------------------------------- boot */
  TO.initTheme();
  TO.bindMobileDrawer();

  $("login-form").onsubmit = function (e) {
    e.preventDefault();
    var code = ($("login-code").value || "").trim();
    if (!code) { showLoginError("Please enter your volunteer code."); return; }
    var btn = $("login-btn"); btn.disabled = true; btn.textContent = "Signing in…"; showLoginError("");
    Store.login(code).then(function (u) {
      btn.disabled = false; btn.textContent = "Sign in";
      if (!Store.canAccess(u, "logistics")) {
        var teamLabel = Store.teamDisplayName(u);
        return Store.logout().then(function () {
          applyUser(null);
          showLoginError("Access denied: code " + u.code + " belongs to " + teamLabel + " and is not authorized to open the Logistics panel.");
        });
      }
      applyUser(u);
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = "Sign in";
      showLoginError(err && err.message ? err.message : "Invalid volunteer code.");
    });
  };
  $("logout-btn").onclick = doLogout;
  if ($("mobile-logout-btn")) $("mobile-logout-btn").onclick = doLogout;
  if ($("denied-logout-btn")) $("denied-logout-btn").onclick = doLogout;
  $("alerts-btn").onclick = enableAlerts;
  if ($("mobile-alerts-btn")) $("mobile-alerts-btn").onclick = enableAlerts;
  if ($("tutorial-btn")) $("tutorial-btn").onclick = function () { startLogisticsTutorial(true); };
  if ($("mobile-tutorial-btn")) $("mobile-tutorial-btn").onclick = function () { startLogisticsTutorial(true); };
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

  var fast = Store.peekUser ? Store.peekUser() : null;
  if (fast) applyUser(fast);
  else Store.restore().then(applyUser);
})();
