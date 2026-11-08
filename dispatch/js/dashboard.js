/* Competition Team monitor (folder kept as dispatch/): sees requests of ALL teams, shows the TEAM NAME first, and the dispatcher only
 * claims a request and hands it out (remotely) to a member. They never go to rooms: room details only exist on Tech Ops / Logistics requests. */
(function () {
  var Store = window.TechOpsStore, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  var SEEN_KEY = "dispatch_seen_v1";
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var TEAMS = [["Competition", "Competition Team"], ["TechOps", "Tech Ops"], ["Logistics", "Logistics"]];
  var NAME = { TechOps: "Tech Ops", Logistics: "Logistics", Competition: "Competition Team" };
  var S = { user: null, me: "", data: null, filter: "unassigned", team: "all", text: "", seen: jget(SEEN_KEY, []), first: true, alertsOn: false, busy: {}, sig: "" };

  var FILTERS = [["unassigned", "Unclaimed"], ["mine", "Mine"], ["handed", "Handed out"], ["Resolved", "Done"], ["all", "All"]];
  var EMPTY = { unassigned: "No unclaimed requests. All quiet.", mine: "You have nothing to hand out.", handed: "Nothing handed out right now.", Resolved: "Nothing completed yet.", all: "No requests yet." };
  function teamOf(r) { return r.team === "Logistics" ? "Logistics" : r.team === "Competition" ? "Competition" : "TechOps"; }
  /* Competition requests are remote: no floor / room, so the place line is only built when a room exists. */
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
  function matchTeam(r) { return S.team === "all" || teamOf(r) === S.team; }

  function members() {
    var cfg = (window.TECHOPS_CONFIG || {}).DISPATCH_MEMBERS || {};
    TEAMS.forEach(function (t) {
      var names = (cfg[t[0]] || []).slice();
      ((S.data && S.data.reports) || []).forEach(function (r) { if (teamOf(r) === t[0] && r.assigned && r.assigned !== r.handedBy && names.indexOf(r.assigned) < 0 && r.handedBy) names.push(r.assigned); });
      var dl = $("dl-" + t[0]);
      if (dl) dl.innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
    });
  }

  /* ---------------------------------------------------------------- data + alarm */
  function load() {
    return Store.loadAll().then(function (d) {
      S.data = d;
      detectNew();
      var sig = JSON.stringify([d.reports, d.meta.online, S.filter, S.team]);
      renderHeader();
      if (sig === S.sig) return;
      S.sig = sig;
      members();
      render();
    });
  }
  function unclaimed(team) { return S.data.reports.filter(function (r) { return isUnassigned(r) && (!team || teamOf(r) === team); }).length; }

  function detectNew() {
    var d = S.data;
    var fresh = d.reports.filter(function (r) { return r.status === "New" && S.seen.indexOf(r.id) < 0; });
    if (!S.first && fresh.length) {
      fresh.slice(0, 3).forEach(function (r) {
        var msg = r.issue + (whereOf(r) ? " · " + whereOf(r) : "") + (r.reporter ? " · " + r.reporter : "");
        TO.toast("NEW " + NAME[teamOf(r)] + " request!", msg, "bad", function () { S.filter = "unassigned"; S.sig = ""; render(); });
        notifyDesktop("NEW " + NAME[teamOf(r)] + " request", msg);
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
    al.hidden = !open;
    if (open) al.textContent = "🚨 " + open + " unclaimed request" + (open > 1 ? "s" : "") + " · Competition " + unclaimed("Competition") + " · Tech Ops " + unclaimed("TechOps") + " · Logistics " + unclaimed("Logistics");
  }
  function notifyDesktop(title, body) {
    try { if (S.alertsOn && "Notification" in window && Notification.permission === "granted") new Notification(title, { body: body, icon: "../assets/favicon.png" }); } catch (e) {}
  }
  function enableAlerts() {
    S.alertsOn = true; TO.beep();
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
    $("alerts-btn").textContent = "Alarm on"; $("alerts-btn").disabled = true;
    TO.toast("Alarm on", "You will hear a sound when a new request arrives. Keep this page open.", "ok");
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
  }

  function render() {
    var d = S.data; if (!d) return;
    $("stats").innerHTML = TEAMS.map(function (t) {
      var n = unclaimed(t[0]);
      return '<button class="dp-tile' + (S.team === t[0] ? " on" : "") + '" data-team="' + t[0] + '"><span><span class="team-tag t-' + t[0] + '">' + t[1] + "</span><small>unclaimed requests · tap to filter</small></span><span class=\"n\">" + n + "</span></button>";
    }).join("");
    $("issue-filters").innerHTML = FILTERS.map(function (f) {
      var n = d.reports.filter(function (r) { return matchTeam(r) && matchFilter(r, f[0]); }).length;
      return '<button class="chip' + (S.filter === f[0] ? " on" : "") + '" data-if="' + f[0] + '">' + f[1] + " (" + n + ")</button>";
    }).join("") + (S.team !== "all" ? '<button class="chip" data-team="all">Show both teams ✕</button>' : "");

    var q = S.text.toLowerCase();
    var rows = d.reports.filter(function (r) {
      return matchTeam(r) && matchFilter(r, S.filter) && (!q || (r.issue + " " + r.details + " " + r.id + " " + r.assigned + " " + r.handedBy + " " + r.reporter + " " + r.room + " " + NAME[teamOf(r)]).toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });

    if (!rows.length) { $("cards").innerHTML = '<div class="empty-board">' + esc(q ? "No requests match your search." : EMPTY[S.filter] || EMPTY.all) + "</div>"; return; }
    $("cards").innerHTML = rows.map(card).join("");
  }

  function card(r) {
    var t = teamOf(r), free = isUnassigned(r), mine = isMine(r), done = r.status === "Resolved";
    var where = whereOf(r);
    var who = "";
    if (done) who = '<span class="dp-who">✓ Done' + (r.assigned ? " · " + esc(r.assigned) : "") + "</span>";
    else if (r.handedBy) who = '<span class="dp-who">➡️ Handed to <b>' + esc(r.assigned) + "</b> by " + esc(r.handedBy === S.me ? "you" : r.handedBy) + "</span>";
    else if (r.assigned) who = '<span class="dp-who">Claimed by <b>' + esc(r.assigned === S.me ? "you" : r.assigned) + "</b></span>";
    var actions = "";
    if (free) actions = '<button class="btn small primary" data-claim="' + esc(r.id) + '">Claim</button>';
    else if (mine && !done) {
      actions = '<input id="ho-' + esc(r.id) + '" list="dl-' + t + '" maxlength="60" placeholder="Hand out to… (' + NAME[t] + ' member)" aria-label="Member name">' +
        '<button class="btn small primary" data-handout="' + esc(r.id) + '">Hand out</button>' +
        '<button class="btn small" data-discord="' + esc(r.id) + '">Copy for Discord</button>' +
        '<button class="btn small ok" data-resolve="' + esc(r.id) + '">Done</button>';
    } else if (!done) actions = '<button class="btn small" data-discord="' + esc(r.id) + '">Copy for Discord</button>';
    return '<div class="dp-card' + (free ? " is-new" : done ? " is-done" : "") + '">' +
      '<span class="team-tag t-' + t + '">' + NAME[t] + "</span>" +
      '<div class="dp-req">' + esc(r.issue) + "</div>" +
      (r.details ? '<div class="dp-det">' + esc(r.details) + "</div>" : "") +
      '<div class="dp-meta">' + (where ? esc(where) + " · " : "") + esc(TO.ago(Store.parseStamp(r.ts))) + (r.reporter ? " · " + esc(r.reporter) : "") + " · " + esc(r.id) + "</div>" +
      (who ? "<div>" + who + "</div>" : "") +
      '<div class="dp-actions">' + actions + "</div></div>";
  }

  function discordText(r) {
    var t = NAME[teamOf(r)];
    return "🚨 **" + t.toUpperCase() + "** — " + r.issue + "\n" +
      (whereOf(r) ? "📍 " + whereOf(r) + "\n" : "") +
      (r.details ? "📝 " + r.details + "\n" : "") +
      (r.reporter ? "👤 From: " + r.reporter + "\n" : "") +
      (r.assigned && r.handedBy ? "➡️ Assigned to: " + r.assigned + "\n" : "") +
      "🆔 " + r.id;
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
      .then(function () { delete S.busy[id]; S.sig = ""; return load(); });
  }

  /* ---------------------------------------------------------------- sign in */
  function showLoginError(m) { var e = $("login-error"); e.textContent = m || ""; e.hidden = !m; }
  function applyUser(user) {
    S.user = user || null; S.me = user ? user.name : "";
    if (!user) {
      $("login-screen").hidden = false; $("main").hidden = true; $("bell").hidden = true;
      var ln = $("login-note");
      if (!Store.isLive()) { ln.hidden = false; ln.innerHTML = "Preview mode Competition Team codes: <b>CT-001</b>, <b>CT-002</b>."; }
      var inp = $("login-code"); inp.value = ""; setTimeout(function () { inp.focus(); }, 120);
      return;
    }
    if (user.team !== "Competition" && user.team !== "Dispatch") {   /* "Dispatch" = old team value, still accepted */
      if (user.team === "TechOps") { location.replace("../techops/index.html"); return; }
      if (user.team === "Logistics") { location.replace("../logistics/index.html"); return; }
      Store.logout().then(function () { applyUser(null); showLoginError("This dashboard is for the Competition Team. Your code opens the Maps page from the Overview."); });
      return;
    }
    $("login-screen").hidden = true; $("main").hidden = false; $("bell").hidden = false;
    $("user-name").textContent = user.name;
    $("user-team").textContent = "Competition Team · " + user.code;
    $("user-avatar").textContent = TO.initials(user.name);
    S.first = true; S.sig = "";
    Store.start().then(load);
  }

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
  $("bell").onclick = function () { S.filter = "unassigned"; S.team = "all"; S.sig = ""; render(); };
  $("issue-search").oninput = function () { S.text = this.value; render(); };
  document.addEventListener("click", function (e) {
    var tm = e.target.closest("[data-team]");
    if (tm) { S.team = S.team === tm.dataset.team ? "all" : tm.dataset.team; S.sig = ""; render(); return; }
    var f = e.target.closest("[data-if]");
    if (f) { S.filter = f.dataset.if; S.sig = ""; render(); return; }
    var c = e.target.closest("[data-claim]"); if (c) { act(c, c.dataset.claim, "claim"); return; }
    var h = e.target.closest("[data-handout]"); if (h) { act(h, h.dataset.handout, "handout"); return; }
    var r = e.target.closest("[data-resolve]"); if (r) { act(r, r.dataset.resolve, "resolve"); return; }
    var dc = e.target.closest("[data-discord]");
    if (dc) { var rep = S.data.reports.filter(function (x) { return x.id === dc.dataset.discord; })[0]; if (rep) copy(discordText(rep)); }
  });
  Store.onChange(function () { if (S.user) load(); });
  setInterval(function () { if (S.user && S.data) { S.sig = ""; render(); } }, 60000);

  Store.restore().then(applyUser);
})();
