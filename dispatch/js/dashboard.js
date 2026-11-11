/* Competition Team monitor (folder kept as dispatch/): sees requests of ALL teams, shows the TEAM NAME first,
 * allows claiming/handing out requests remotely, and links physical room requests directly to Venue Maps routing.
 * Strict RBAC: only Competition / Dispatch (or Admin) roles may enter; unauthorized roles are strictly blocked without redirecting. */
(function () {
  var Store = window.TechOpsStore, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  var SEEN_KEY = "dispatch_seen_v1";
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var S = { user: null, me: "", data: null, filter: "unassigned", text: "", seen: jget(SEEN_KEY, []), first: true, alertsOn: false, busy: {}, sig: "" };

  var FILTERS = [["unassigned", "Unclaimed"], ["mine", "Mine"], ["handed", "Handed out"], ["Resolved", "Done"], ["all", "All"]];
  var EMPTY = { unassigned: "No unclaimed Competition Team requests. All quiet.", mine: "You have nothing to hand out.", handed: "Nothing handed out right now.", Resolved: "Nothing completed yet.", all: "No Competition Team requests yet." };
  function isCompetition(r) { return r && r.team === "Competition"; }
  function whereOf(r) { return r.room ? (r.floorName || Store.FLOOR_NAMES[r.floor] || "") + " · " + r.room : ""; }
  function isUnassigned(r) { return r.status !== "Resolved" && !r.assigned; }
  function isMine(r) { return r.status !== "Resolved" && !!S.me && (r.assigned === S.me || r.handedBy === S.me); }
  function isHanded(r) { return r.status !== "Resolved" && !!r.handedBy; }
  function matchFilter(r, f) {
    if (f === "all") return true;
    if (f === "unassigned") return isUnassigned(r);
    if (f === "mine") return isMine(r);
    if (f === "handed") return isHanded(r);
    return r.status === f;
  }

  function members() {
    var cfg = (window.TECHOPS_CONFIG || {}).DISPATCH_MEMBERS || {};
    var names = (cfg.Competition || []).slice();
    ((S.data && S.data.reports) || []).forEach(function (r) {
      if (isCompetition(r) && r.assigned && r.assigned !== r.handedBy && names.indexOf(r.assigned) < 0 && r.handedBy) names.push(r.assigned);
    });
    var dl = $("dl-Competition");
    if (dl) dl.innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
  }

  /* ---------------------------------------------------------------- data + alarm */
  function load() {
    return Store.loadAll().then(function (d) {
      /* Strict role isolation: Competition Team ONLY sees requests categorized for Competition */
      d.reports = (d.reports || []).filter(isCompetition);
      S.data = d;
      detectNew();
      var sig = JSON.stringify([d.reports, d.meta.online, S.filter]);
      renderHeader();
      if (sig === S.sig) return;
      S.sig = sig;
      members();
      render();
    });
  }
  function unclaimed() { return S.data.reports.filter(isUnassigned).length; }

  function detectNew() {
    var d = S.data;
    var fresh = d.reports.filter(function (r) { return r.status === "New" && S.seen.indexOf(r.id) < 0; });
    if (!S.first && fresh.length) {
      fresh.slice(0, 3).forEach(function (r) {
        var msg = r.issue + (whereOf(r) ? " · " + whereOf(r) : "") + (r.reporter ? " · " + r.reporter : "");
        TO.toast("NEW Competition Team request!", msg, "bad", function () { S.filter = "unassigned"; S.sig = ""; render(); });
        notifyDesktop("NEW Competition Team request", msg);
      });
      TO.beep();
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    }
    d.reports.forEach(function (r) { if (S.seen.indexOf(r.id) < 0) S.seen.push(r.id); });
    jset(SEEN_KEY, S.seen.slice(-500));
    S.first = false;

    var open = unclaimed();
    var c = $("bell-count"); c.textContent = open; c.hidden = !open;
    document.title = (open ? "(" + open + ") " : "") + "Competition Team · NASA Space Apps Cairo";
    var al = $("alarm");
    if (al) {
      al.hidden = !open;
      if (open) al.textContent = "" + open + " unclaimed Competition Team request" + (open > 1 ? "s" : "");
    }
  }
  function notifyDesktop(title, body) {
    try { if (S.alertsOn && "Notification" in window && Notification.permission === "granted") new Notification(title, { body: body, icon: "../assets/favicon.png" }); } catch (e) {}
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
    var isLive = m.live, isOnline = m.online, isSynced = m.synced;
    pill.className = "pill-status " + (!isOnline ? "demo" : isLive ? (isSynced ? "live" : "demo") : "demo");
    $("status-text").textContent = !isOnline ? "Offline" : isLive ? (isSynced ? "Live" : "Connecting…") : "Local preview";
    var note = $("demo-note"), bits = [];
    if (!m.online) bits.push("Could not load data from Firebase: " + (m.error || "unknown error") + ".");
    if (!m.live) bits.push("Local preview: Firebase is not configured, so requests are stored in this browser only.");
    note.hidden = !bits.length;
    note.innerHTML = esc(bits.join(" ")) + (!m.live ? ' <button class="btn small" id="reset-demo">Reset preview data</button>' : "");
    var rb = $("reset-demo"); if (rb) rb.onclick = function () { Store.resetDemo(); S.sig = ""; load(); };
    var mine = S.data.reports.filter(isMine).length, open = unclaimed();
    if ($("greeting")) $("greeting").textContent = "Hi " + (S.user ? S.user.name.split(" ")[0] : "") + " · " + open + " unclaimed" + (mine ? " · " + mine + " yours" : "");
  }

  function render() {
    var d = S.data; if (!d) return;
    $("issue-filters").innerHTML = FILTERS.map(function (f) {
      var n = d.reports.filter(function (r) { return matchFilter(r, f[0]); }).length;
      return '<button class="chip' + (S.filter === f[0] ? " on" : "") + '" data-if="' + f[0] + '">' + f[1] + " (" + n + ")</button>";
    }).join("");

    var q = S.text.toLowerCase();
    var rows = d.reports.filter(function (r) {
      return matchFilter(r, S.filter) && (!q || (r.issue + " " + r.details + " " + r.id + " " + r.assigned + " " + r.handedBy + " " + r.reporter + " " + r.room).toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });

    if (!rows.length) { $("cards").innerHTML = '<div class="req-empty">' + esc(q ? "No requests match your search." : EMPTY[S.filter] || EMPTY.all) + "</div>"; return; }
    $("cards").innerHTML = rows.map(card).join("");
  }

  
  /* Direct navigation: clicking Show Route takes volunteer directly to Maps */

  function card(r) {
    var free = isUnassigned(r), mine = isMine(r), done = r.status === "Resolved";
    var floorLabel = r.floorName || Store.FLOOR_NAMES[r.floor] || "";
    var routeUrl = TO.routeHref(r, "../maps.html");

    var who = "";
    if (done) who = "Done" + (r.assigned ? " · <b>" + esc(r.assigned) + "</b>" : "");
    else if (r.handedBy) who = "Handed to <b>" + esc(r.assigned) + "</b> by " + esc(r.handedBy === S.me ? "you" : r.handedBy);
    else if (r.assigned) who = "Claimed by <b>" + esc(r.assigned === S.me ? "you" : r.assigned) + "</b>";
    else who = "Unclaimed — awaiting Competition Team";

    var routeBtn = routeUrl
      ? '<a class="btn small route-btn" href="' + esc(routeUrl) + '">Show Route</a>'
      : '<button type="button" class="btn small route-btn is-disabled" disabled title="Remote Discord/online request — no physical room assigned">Show Route</button>';

    var actions = "";
    if (free) {
      actions = '<button class="btn small primary claim-btn" data-claim="' + esc(r.id) + '">Claim</button>' +
        routeBtn +
        '<button class="btn small" data-discord="' + esc(r.id) + '">Copy for Discord</button>';
    } else if (mine && !done) {
      actions = '<input id="ho-' + esc(r.id) + '" list="dl-Competition" maxlength="60" placeholder="Hand out to… (Competition Team member)" aria-label="Member name">' +
        '<button class="btn small primary" data-handout="' + esc(r.id) + '">Hand out</button>' +
        '<button class="btn small ok resolve-btn" data-resolve="' + esc(r.id) + '">Done</button>' +
        routeBtn +
        '<button class="btn small" data-discord="' + esc(r.id) + '">Copy for Discord</button>';
    } else if (!done) {
      actions = routeBtn + '<button class="btn small" data-discord="' + esc(r.id) + '">Copy for Discord</button>';
    } else {
      actions = routeBtn;
    }

    return '<article class="req-card' + (free ? " is-new" : mine ? " is-mine" : done ? " is-done" : "") + '">' +
      '<div class="req-card-head">' +
        '<div class="req-card-badges">' +
          '<span class="team-pill t-Competition">Competition Team</span>' +
          '<span class="badge ' + TO.statusClass(r.status) + '">' + esc(done ? "Done" : r.status) + "</span>" +
        "</div>" +
        '<span class="req-card-id" title="' + esc(r.ts) + '">' + esc(TO.ago(Store.parseStamp(r.ts))) + " · " + esc(r.id) + "</span>" +
      "</div>" +
      '<div class="req-card-title">' + esc(r.issue) + "</div>" +
      (r.room
        ? '<div class="req-card-loc"><b>' + esc(r.room) + "</b>" + (floorLabel ? " · " + esc(floorLabel) : "") + "</div>"
        : '<div class="req-card-loc is-remote">Remote · Discord / Online</div>') +
      '<div class="req-card-desc">' + esc(r.details || "—") +
        (r.reporter ? '<span class="req-from">From: ' + esc(r.reporter) + "</span>" : "") +
      "</div>" +
      '<div class="req-card-who">' + who + "</div>" +
      '<div class="req-card-actions">' + actions + "</div>" +
    "</article>";
  }

  function discordText(r) {
    return "**[COMPETITION DESK]** — " + r.issue + "\n" +
      (whereOf(r) ? "Location: " + whereOf(r) + "\n" : "") +
      (r.details ? "Details: " + r.details + "\n" : "") +
      (r.reporter ? "From: " + r.reporter + "\n" : "") +
      (r.assigned && r.handedBy ? "Assigned to: " + r.assigned + "\n" : "") +
      "ID: " + r.id;
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { TO.toast("Copied", "Paste it in Discord.", "ok"); });
    prompt("Copy this message for Discord:", text); return Promise.resolve();
  }

  function act(btn, id, kind) {
    if (S.busy[id]) return;
    var p, label = btn.textContent;
    if (kind === "handout") {
      var inp = $("ho-" + id), name = inp ? inp.value.trim() : "";
      if (!name) { TO.toast("Pick a member", "Type or choose who should take this request.", "bad"); return; }
      p = Store.handOutReport(id, name);
    } else p = kind === "claim" ? Store.claimReport(id) : Store.resolveReport(id);
    S.busy[id] = true; btn.disabled = true; btn.textContent = "Saving…";
    p.then(function () {
      TO.toast(kind === "claim" ? "Request claimed" : kind === "handout" ? "Handed out" : "Request done", id + (kind === "claim" ? " is yours. Hand it out to a member." : kind === "handout" ? " was handed out." : " marked as done."), "ok");
    }).catch(function () { btn.disabled = false; btn.textContent = label; })
      .then(function () { delete S.busy[id]; S.sig = ""; });
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
      if (ln) ln.hidden = true;
      var inp = $("login-code"); inp.value = ""; setTimeout(function () { try { inp.focus(); } catch (e) {} }, 120);
      return;
    }

    populateUserChrome(user);

    /* STRICT RBAC: Never redirect to another dashboard. Strictly block unauthorized roles. */
    if (!Store.canAccess(user, "competition")) {
      S.user = null; S.me = "";
      authEls.forEach(function (el) { el.hidden = true; });
      $("login-screen").hidden = true;
      $("main").hidden = true;
      $("bell").hidden = true;
      $("access-denied").hidden = false;
      $("status-pill").className = "pill-status demo";
      $("status-text").textContent = "Restricted";
      $("denied-msg").innerHTML = "Signed in as <b>" + esc(user.name) + "</b> (" + esc(Store.teamDisplayName(user)) + " · " + esc(user.code) + "). Your assigned role does not have permission to access the <b>Competition Team</b> module.";
      return;
    }

    authEls.forEach(function (el) { el.hidden = false; });
    $("login-screen").hidden = true;
    $("access-denied").hidden = true;
    $("main").hidden = false;
    $("bell").hidden = false;
    S.first = true; S.sig = "";
    if (window.NasaTutorial && !Store.isTutorialCompleted("competition")) {
      startCompetitionTutorial(false);
    } else {
      /* Cache-first instant 0ms initial render; sync with Firebase in background */
      load();
      Store.start().catch(function () {});
    }
  }

  function startCompetitionTutorial(isManual) {
    if (window.TO && window.TO.closeMobileDrawer) window.TO.closeMobileDrawer();
    Store.enterTutorialMode("competition");
    S.sig = "";
    load().then(function () {
      if (window.NasaTutorial) {
        window.NasaTutorial.start("competition", function () {
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

  TO.initTheme();
  TO.bindMobileDrawer();

  $("login-form").onsubmit = function (e) {
    e.preventDefault();
    var code = ($("login-code").value || "").trim();
    if (!code) { showLoginError("Please enter your volunteer code."); return; }
    var btn = $("login-btn"); btn.disabled = true; btn.textContent = "Signing in…"; showLoginError("");
    Store.login(code).then(function (u) {
      btn.disabled = false; btn.textContent = "Sign in";
      if (!Store.canAccess(u, "competition")) {
        var teamLabel = Store.teamDisplayName(u);
        return Store.logout().then(function () {
          applyUser(null);
          showLoginError("Access denied: code " + u.code + " belongs to " + teamLabel + " and is not authorized to open the Competition Team panel.");
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
  if ($("tutorial-btn")) $("tutorial-btn").onclick = function () { startCompetitionTutorial(true); };
  if ($("mobile-tutorial-btn")) $("mobile-tutorial-btn").onclick = function () { startCompetitionTutorial(true); };
  $("bell").onclick = function () { S.filter = "unassigned"; S.sig = ""; render(); };
  $("issue-search").oninput = function () { S.text = this.value; render(); };
  document.addEventListener("click", function (e) {
    var f = e.target.closest("[data-if]");
    if (f) { S.filter = f.dataset.if; S.sig = ""; render(); return; }
    var c = e.target.closest("[data-claim]"); if (c) { act(c, c.dataset.claim, "claim"); return; }
    var h = e.target.closest("[data-handout]"); if (h) { act(h, h.dataset.handout, "handout"); return; }
    var r = e.target.closest("[data-resolve]"); if (r) { act(r, r.dataset.resolve, "resolve"); return; }
    var dc = e.target.closest("[data-discord]");
    if (dc && S.data) { var row = S.data.reports.filter(function (x) { return x.id === dc.dataset.discord; })[0]; if (row) copy(discordText(row)); }
  });
  Store.onChange(function () { if (S.user) load(); });
  setInterval(function () { if (S.user && S.data) render(); }, 60000);

  var fast = Store.peekUser ? Store.peekUser() : null;
  if (fast) applyUser(fast);
  else Store.restore().then(applyUser);
})();
