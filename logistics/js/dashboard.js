/* Logistics dashboard: requests from the participant QR help form.
 * Strict RBAC: only Logistics (or Admin) volunteer roles may enter; unauthorized roles are strictly blocked without redirecting. */
(function () {
  var Store = window.TechOpsStore, esc = TO.esc, D = window.TechOpsData;
  var $ = function (id) { return document.getElementById(id); };
  var SEEN_KEY = "logistics_seen_v1", SEEN_MEET = "logistics_seen_meetups";
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var S = {
    user: null, me: "", data: null, tab: "issues", filter: "unassigned", text: "",
    seen: jget(SEEN_KEY, []), seenMeetups: jget(SEEN_MEET, []), first: true,
    alertsOn: (function () { try { return localStorage.getItem("nasa_alerts_enabled") === "1"; } catch (e) { return false; } })(),
    busy: {}, sig: ""
  };

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
      var sig = JSON.stringify([
        d.reports,
        d.meta.online,
        (d.meetups || []).map(function (m) { return m.id + m.status; }).join(";"),
        (d.volunteers || []).map(function (v) { return v.code + v.status + v.room; }).join(";")
      ]);
      if (sig === S.sig) { renderHeader(); renderBanners(); return; }
      S.sig = sig;
      renderHeader();
      renderBanners();
      if (S.tab === "team") renderTeam();
      else renderIssues();
    });
  }

  function setTab(name) {
    S.tab = name || "issues";
    var issuesSec = $("tab-issues"), teamSec = $("tab-team");
    if (issuesSec) issuesSec.hidden = (S.tab !== "issues");
    if (teamSec) teamSec.hidden = (S.tab !== "team");

    document.querySelectorAll(".tabs .tab").forEach(function (b) {
      b.classList.toggle("on", b.dataset.tab === S.tab);
    });
    document.querySelectorAll(".mobile-nav .mobile-nav-btn").forEach(function (b) {
      b.classList.toggle("on", b.dataset.tab === S.tab);
    });

    if (S.tab === "team") renderTeam();
    else renderIssues();
  }

  function detectNew() {
    var d = S.data;
    var fresh = d.reports.filter(function (r) { return r.status === "New" && S.seen.indexOf(r.id) < 0; });
    if (!S.first && fresh.length) {
      fresh.slice(0, 3).forEach(function (r) {
        var msg = r.issue + " · " + (r.floorName || Store.FLOOR_NAMES[r.floor] || "") + " · " + r.room;
        TO.toast("New Logistics request!", msg, "bad", function () { setTab("issues"); S.filter = "unassigned"; renderIssues(); });
        notifyDesktop("New Logistics request", msg);
      });
      if (S.alertsOn) {
        TO.beep();
        try { if (navigator.vibrate) navigator.vibrate(200); } catch (e) {}
      }
    }
    d.reports.forEach(function (r) { if (S.seen.indexOf(r.id) < 0) S.seen.push(r.id); });
    jset(SEEN_KEY, S.seen.slice(-500));

    /* Meetup notifications for incoming pings and confirmations */
    if (d.meetups) {
      d.meetups.forEach(function (m) {
        var isTarget = (S.user && m.targetCode === S.user.code) || (S.me && m.target === S.me);
        var isBy = (S.user && m.byCode === S.user.code) || (S.me && m.by === S.me);
        if (isTarget && (m.status === "Pinged" || m.status === "Pending") && S.seenMeetups.indexOf(m.id + ":ping") < 0) {
          S.seenMeetups.push(m.id + ":ping");
          TO.toast("Location Ping from " + m.by, "They want to meet you! Click to confirm your room.", "bad", function () {
            setTab("team");
            openConfirmLocationModal(m);
          });
          notifyDesktop("Location Ping from " + m.by, "They want to meet you! Click to confirm your room.");
          if (S.alertsOn) {
            TO.beep();
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
          }
        }
        if (isBy && m.status === "Confirmed" && S.seenMeetups.indexOf(m.id + ":confirmed") < 0) {
          S.seenMeetups.push(m.id + ":confirmed");
          TO.toast("Meetup Confirmed with " + m.target, "Agreed to meet at Room " + m.meetAt + ".", "ok", function () {
            setTab("team");
          });
          notifyDesktop("Meetup Confirmed with " + m.target, "Agreed to meet at Room " + m.meetAt + ".");
          if (S.alertsOn && TO.chimeDone) TO.chimeDone();
        }
      });
      jset(SEEN_MEET, S.seenMeetups.slice(-200));
    }

    S.first = false;

    var open = d.reports.filter(isUnassigned).length;
    var c = $("bell-count");
    if (c) { c.textContent = open; c.hidden = !open; }
    document.title = (open ? "(" + open + ") " : "") + "Logistics Dashboard · NASA Space Apps Cairo";
  }

  function notifyDesktop(title, body) {
    try {
      if (S.alertsOn && "Notification" in window && Notification.permission === "granted") new Notification(title, { body: body, icon: "../assets/favicon.png" });
    } catch (e) {}
  }

  function syncAlertsUI() {
    var btn = $("alerts-btn"), mBtn = $("mobile-alerts-btn");
    if (btn) {
      btn.textContent = S.alertsOn ? "Alerts on" : "Enable alerts";
      btn.classList.toggle("is-active", !!S.alertsOn);
      btn.disabled = false;
      btn.title = S.alertsOn ? "Alerts are enabled. Click to mute sound and notifications." : "Sound and desktop notifications for new requests";
    }
    if (mBtn) {
      var sp = mBtn.querySelector("span") || mBtn;
      sp.textContent = S.alertsOn ? "Alerts on" : "Enable alerts";
      mBtn.classList.toggle("is-active", !!S.alertsOn);
      mBtn.disabled = false;
    }
  }

  function toggleAlerts() {
    S.alertsOn = !S.alertsOn;
    try { localStorage.setItem("nasa_alerts_enabled", S.alertsOn ? "1" : "0"); } catch (e) {}
    syncAlertsUI();
    if (S.alertsOn) {
      try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
      if (TO.chimeDone) TO.chimeDone();
      TO.toast("Alerts on", "You will hear a sound when a new request arrives. Keep this page open.", "ok");
    } else {
      TO.toast("Alerts muted", "Sound and notifications turned off.", "");
    }
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
    var mine = S.data.reports.filter(isMine).length, open = S.data.reports.filter(isUnassigned).length;
    $("greeting").textContent = "Hi " + (S.user ? S.user.name.split(" ")[0] : "") + " · " + open + " unclaimed" + (mine ? " · " + mine + " yours" : "");

    var nIssues = $("n-issues");
    if (nIssues) { nIssues.textContent = open + mine; nIssues.className = "n" + (open ? " hot" : ""); }
    var mbIssues = $("m-badge-issues");
    if (mbIssues) { mbIssues.hidden = !open; mbIssues.textContent = open; }

    var pendingCount = (S.user || S.me) ? (S.data.meetups || []).filter(function (m) {
      var isTarget = (S.user && m.targetCode === S.user.code) || (S.me && m.target === S.me);
      return isTarget && (m.status === "Pinged" || m.status === "Pending");
    }).length : 0;
    var nMeet = $("n-meet");
    if (nMeet) { nMeet.hidden = !pendingCount; nMeet.textContent = pendingCount; nMeet.className = "n hot"; }
    var mbTeam = $("m-badge-team");
    if (mbTeam) { mbTeam.hidden = !pendingCount; mbTeam.textContent = pendingCount; }
  }

  function renderBanners() {
    var d = S.data, h = "";
    if (S.user || S.me) {
      /* Pings awaiting my location confirmation */
      (d.meetups || []).filter(function (m) {
        var isTarget = (S.user && m.targetCode === S.user.code) || (S.me && m.target === S.me);
        return isTarget && (m.status === "Pinged" || m.status === "Pending");
      }).forEach(function (m) {
        h += '<div class="banner" style="border-color:var(--bad);background:rgba(239,68,68,0.14)">' +
          '<div style="flex:1;min-width:220px">' +
          '<b style="color:#ff8a8a">Location Ping from ' + esc(m.by) + '</b>' +
          '<div style="font-size:13px;margin-top:2px">They want to meet you! Please confirm your current room so we can guide you to each other.</div>' +
          (m.note ? '<div class="muted" style="font-size:12px;margin-top:2px">Note: ' + esc(m.note) + '</div>' : '') +
          '</div>' +
          '<button class="btn accent small" data-confirm-ping="' + esc(m.id) + '">Confirm Location &amp; Meet</button>' +
          '</div>';
      });

      /* Confirmed meetups ready for navigation */
      (d.meetups || []).filter(function (m) {
        var isTarget = (S.user && m.targetCode === S.user.code) || (S.me && m.target === S.me);
        var isBy = (S.user && m.byCode === S.user.code) || (S.me && m.by === S.me);
        return (isBy || isTarget) && (m.status === "Confirmed" || m.status === "On the way");
      }).forEach(function (m) {
        var isSender = (S.user && m.byCode === S.user.code) || (S.me && m.by === S.me);
        var other = isSender ? m.target : m.by;
        h += '<div class="banner" style="border-color:var(--ok);background:rgba(16,185,129,0.12)">' +
          '<div style="flex:1;min-width:220px">' +
          '<b style="color:#34d399">Meetup Confirmed with ' + esc(other) + '</b>' +
          '<div style="font-size:13px;margin-top:2px">Meeting point: <b>' + esc(m.meetAt) + '</b> (' + esc(m.targetFloorName || m.byFloorName) + ')</div>' +
          '</div>' +
          '<a class="btn primary small" href="../maps.html?to=' + encodeURIComponent(m.meetAt) + '">Show Walking Route</a>' +
          '<button class="btn small" data-meet="' + esc(m.id) + '" data-st="Done">Mark Done</button>' +
          '</div>';
      });
    }
    var bBox = $("banners");
    if (bBox) bBox.innerHTML = h;
  }

  function renderCard(r) {
    var when = Store.parseStamp(r.ts), mine = isMine(r), free = isUnassigned(r), done = r.status === "Resolved";
    var floorLabel = r.floorName || Store.FLOOR_NAMES[r.floor] || "";
    var routeUrl = TO.routeHref(r, "../maps.html");

    var who = done ? "✓ Done" + (r.assigned ? " · <b>" + esc(r.assigned) + "</b>" : "")
      : r.handedBy ? "Handed to <b>" + esc(mine ? "You" : r.assigned) + "</b> by " + esc(r.handedBy)
      : r.assigned ? '<span class="assignee' + (mine ? " me" : "") + '">' + (mine ? "Assigned to <b>You</b>" : "Assigned to <b>" + esc(r.assigned) + "</b>") + "</span>"
      : "Unclaimed — awaiting volunteer";

    var primaryBtn = free
      ? '<button class="btn small primary claim-btn" data-claim="' + esc(r.id) + '">Claim</button>'
      : mine ? '<button class="btn small ok resolve-btn" data-resolve="' + esc(r.id) + '">Mark as Done</button>' : "";

    var routeBtn = routeUrl
      ? '<a class="btn small route-btn" href="' + esc(routeUrl) + '">Show Route</a>'
      : '<button type="button" class="btn small route-btn is-disabled" disabled title="No room specified">Show Route</button>';

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
        ? '<div class="req-card-loc"><b>' + esc(r.room) + "</b>" + (floorLabel ? " · " + esc(floorLabel) : "") + "</div>"
        : '<div class="req-card-loc is-remote">Location not specified</div>') +
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

  /* ------------------------------------------------------------ Team & Ping System */
  function isOnlineVolunteer(t) {
    var s = (t.status || "").toLowerCase().trim();
    if (s !== "available" && s !== "online") return false;
    var isMe = (S.user && t.code === S.user.code) || (S.me && t.name === S.me);
    if (isMe) return true;
    if (t.lastSeen) {
      var seen = Number(t.lastSeen) || (Date.parse(t.lastSeen) || 0);
      if (seen > 0 && (Date.now() - seen) > 120000) return false;
    } else if (t.updated) {
      var updTime = Date.parse(t.updated.replace(" ", "T"));
      if (updTime && (Date.now() - updTime) > 180000) return false;
    } else {
      return false;
    }
    return true;
  }

  function renderMemberCard(t) {
    var isMe = (S.user && t.code === S.user.code) || (S.me && t.name === S.me);
    var teamPillClass = t.team === "TechOps" ? "t-TechOps" : t.team === "Logistics" ? "t-Logistics" : "t-Competition";
    var teamLabel = t.team === "TechOps" ? "Tech Ops" : t.team;
    var locText = (t.room ? "Room " + esc(t.room) : "No room set") + (t.floorName ? " · " + esc(t.floorName) : (t.floor ? " · " + esc(Store.FLOOR_NAMES[t.floor] || t.floor) : ""));
    return '<button class="card member" data-code="' + esc(t.code) + '" aria-label="Ping ' + esc(t.name) + '">' +
      '<div class="row" style="flex-wrap:nowrap;gap:12px;width:100%">' +
        '<div class="avatar">' + esc(TO.initials(t.name)) + '</div>' +
        '<div style="flex:1;min-width:0;text-align:left">' +
          '<div class="name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.name) + (isMe ? ' <span class="badge b-prog">You</span>' : '') + '</div>' +
          '<div class="role muted" style="font-size:12px">' + esc(t.role || teamLabel) + '</div>' +
        '</div>' +
        '<span class="team-pill ' + teamPillClass + '" style="font-size:10.5px;padding:2px 7px;align-self:flex-start">' + esc(teamLabel) + '</span>' +
      '</div>' +
      '<div class="status st-available" style="margin-top:6px"><i></i>' + esc(t.status || "Available") + '</div>' +
      '<div class="loc" style="font-size:12.5px;margin-top:2px">' + locText + '</div>' +
      '<span class="btn small primary" style="align-self:flex-start;margin-top:8px">' + (isMe ? 'Update My Location' : 'Ping for Meetup') + '</span>' +
    '</button>';
  }

  function renderTeam() {
    var d = S.data; if (!d) return;
    var vList = d.volunteers || d.team || [];
    var online = vList.filter(isOnlineVolunteer);
    var techOps = online.filter(function (t) { return t.team === "TechOps"; });
    var logistics = online.filter(function (t) { return t.team === "Logistics"; });
    var others = online.filter(function (t) { return t.team !== "TechOps" && t.team !== "Logistics"; });

    var gridHtml = "";

    gridHtml += '<div class="team-group-section" style="margin-bottom:24px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--line)">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span class="team-pill t-TechOps">⚡ Online TechOps</span>' +
          '<span class="muted" style="font-size:13px;font-weight:600">' + techOps.length + ' online</span>' +
        '</div>' +
      '</div>' +
      (techOps.length
        ? '<div class="team-grid">' + techOps.map(renderMemberCard).join("") + '</div>'
        : '<div class="empty" style="padding:16px;font-size:13px">No TechOps volunteers currently online.</div>') +
    '</div>';

    gridHtml += '<div class="team-group-section" style="margin-bottom:24px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--line)">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span class="team-pill t-Logistics">📦 Online Logistics</span>' +
          '<span class="muted" style="font-size:13px;font-weight:600">' + logistics.length + ' online</span>' +
        '</div>' +
      '</div>' +
      (logistics.length
        ? '<div class="team-grid">' + logistics.map(renderMemberCard).join("") + '</div>'
        : '<div class="empty" style="padding:16px;font-size:13px">No Logistics volunteers currently online.</div>') +
    '</div>';

    if (others.length) {
      gridHtml += '<div class="team-group-section" style="margin-bottom:24px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--line)">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span class="team-pill t-Competition">Online Volunteers</span>' +
            '<span class="muted" style="font-size:13px;font-weight:600">' + others.length + ' online</span>' +
          '</div>' +
        '</div>' +
        '<div class="team-grid">' + others.map(renderMemberCard).join("") + '</div>' +
      '</div>';
    }

    var tg = $("team-grid");
    if (tg) tg.innerHTML = gridHtml;

    /* My Location update card */
    var my = $("my-status");
    var meMember = (S.user && vList.filter(function (t) { return t.code === S.user.code; })[0]) ||
                   (S.me && vList.filter(function (t) { return t.name === S.me; })[0]);
    if (my && meMember) {
      my.hidden = false;
      var curSt = meMember.status || "Available";
      var statusColor = curSt === "Available" ? "var(--ok)" : curSt === "Busy" ? "var(--bad)" : curSt === "On a task" ? "var(--warn)" : "var(--mut)";
      
      my.innerHTML =
        '<div class="my-status-compact">' +
          '<div class="my-status-info">' +
            '<div class="my-status-avatar">' +
              esc(TO.initials(meMember.name)) +
              '<span class="my-status-dot" style="background:' + statusColor + '"></span>' +
            '</div>' +
            '<div class="my-status-details">' +
              '<div class="my-status-name">' + esc(meMember.name) + ' <span class="my-status-tag">You</span></div>' +
              '<div class="my-status-loc"><b>' + esc(meMember.room || "No room") + '</b> · ' + esc(meMember.floorName || Store.FLOOR_NAMES[meMember.floor] || "Floor") + ' · <span style="color:' + statusColor + ';font-weight:600">' + esc(curSt) + '</span></div>' +
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
              '<select id="ms-floor">' + floorOpts(meMember.floor || "F") + '</select>' +
            '</div>' +
            '<div>' +
              '<label for="ms-room">Room</label>' +
              '<select id="ms-room">' + roomOpts(meMember.floor || "F", meMember.room) + '</select>' +
            '</div>' +
            '<div>' +
              '<label for="ms-status">Live Status</label>' +
              '<select id="ms-status">' + ["Available", "Busy", "On a task", "Off duty"].map(function (s) { return "<option" + (s === curSt ? " selected" : "") + ">" + s + "</option>"; }).join("") + '</select>' +
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
        var fl = $("ms-floor").value, rm = $("ms-room").value, st = $("ms-status").value;
        Store.updateVolunteerLocation({
          code: meMember.code,
          floor: fl,
          floorName: Store.FLOOR_NAMES[fl] || "",
          room: rm,
          status: st
        }).then(function () {
          TO.toast("Location Saved", "Teammates can now navigate directly to your room.", "ok");
          load();
        });
      };
    } else if (my) my.hidden = true;

    /* Meetup History */
    var list = (d.meetups || []).slice().sort(function (a, b) { return (Store.parseStamp(b.ts) || 0) - (Store.parseStamp(a.ts) || 0); });
    var meetRows = $("meet-rows");
    if (meetRows) {
      meetRows.innerHTML = list.length ? list.map(function (m) {
        var cls = m.status === "Done" ? "b-done" : (m.status === "Confirmed" || m.status === "On the way") ? "b-prog" : "b-ack";
        var isTarget = (S.user && m.targetCode === S.user.code) || (S.me && m.target === S.me);
        var isBy = (S.user && m.byCode === S.user.code) || (S.me && m.by === S.me);
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
          (m.meetAt ? '<a class="btn small primary" href="../maps.html?to=' + encodeURIComponent(m.meetAt) + '">Route Here</a>' : '') +
          ((isBy || isTarget) && m.status !== "Done" ? '<button class="btn small" data-meet="' + esc(m.id) + '" data-st="Done">Done</button>' : '') +
          '</div>';
      }).join("") : '<div class="empty">No meetup requests or pings yet.</div>';
    }
  }

  function floorOpts(sel) {
    if (!D || !D.FLOORS) return "";
    return D.FLOORS.map(function (f) { return '<option value="' + f.id + '"' + (f.id === sel ? " selected" : "") + ">" + f.name + "</option>"; }).join("");
  }
  function roomOpts(floor, sel) {
    var list = (S.data && S.data.rooms ? S.data.rooms : []).filter(function (r) { return r.floor === floor; }).map(function (r) { return r.code; });
    if (sel && list.indexOf(sel) < 0) list.unshift(sel);
    return '<option value="">Select room…</option>' + list.map(function (c) { return '<option' + (c === sel ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
  }

  /* 1. SENDER: Ping a team member modal */
  function openPingModal(member) {
    var d = S.data;
    var vList = d.volunteers || d.team || [];
    var meM = (S.user && vList.filter(function (t) { return t.code === S.user.code; })[0]) ||
              (S.me && vList.filter(function (t) { return t.name === S.me; })[0]);
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
      : '<label class="lbl" for="pt-by">Who is pinging?</label><select id="pt-by" style="width:100%"><option value="">Select your name…</option>' + vList.filter(function (t) { return t.name !== member.name; }).map(function (t) { return "<option" + (t.name === S.me ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + '</select>';

    body.innerHTML =
      '<p class="muted" style="margin-bottom:12px">A ping notification will ask <b>' + esc(member.name) + '</b> to confirm their current room in case they moved. Once confirmed, you both get walking directions.</p>' +
      senderHtml +
      
      '<div class="two" style="margin-top:12px">' +
      '<div class="col"><h4>Your Current Spot</h4>' +
      '<label class="lbl" for="pt-bf">Floor</label><select id="pt-bf" style="width:100%">' + floorOpts(meM ? meM.floor : "F") + '</select>' +
      '<label class="lbl" for="pt-br">Room</label><select id="pt-br" style="width:100%">' + roomOpts(meM ? meM.floor : "F", meM ? meM.room : "") + '</select>' +
      '</div>' +
      '<div class="col"><h4>' + esc(member.name.split(" ")[0]) + '\'s Last Known Room</h4>' +
      '<div style="font-size:13px;padding-top:10px">Room: <b>' + esc(member.room || "Pending") + '</b></div>' +
      '<div class="muted" style="font-size:12px">' + esc(member.floorName || "Venue") + '</div>' +
      '<div class="muted" style="font-size:11.5px;margin-top:6px">They will confirm their actual room when responding.</div>' +
      '</div></div>' +

      '<label class="lbl" for="pt-note">Message / Reason (optional)</label>' +
      '<textarea id="pt-note" maxlength="300" placeholder="e.g. Need assistance with participant supplies; please bring badges"></textarea>' +
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
        byCode: S.user ? S.user.code : (meM ? meM.code : ""),
        target: member.name,
        targetCode: member.code,
        byFloor: f("pt-bf").value,
        byRoom: br,
        targetFloor: member.floor || "",
        targetRoom: member.room || "",
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
    var vList = d.volunteers || d.team || [];
    var meMember = (S.user && vList.filter(function (t) { return t.code === S.user.code; })[0]) ||
                   vList.filter(function (t) { return t.name === meetup.target; })[0] || {};
    var ov = document.createElement("div"); ov.className = "backdrop";
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Confirm Location">' +
      '<div class="mh"><h3>Confirm Your Room for Meetup</h3><button class="x" aria-label="Close">&times;</button></div>' +
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

      /* Update my live location in volunteers collection */
      Store.updateVolunteerLocation({
        code: meMember.code || (S.user ? S.user.code : ""),
        floor: fl,
        floorName: Store.FLOOR_NAMES[fl] || "",
        room: rm,
        status: "Available"
      });

      /* Update meetup record */
      Store.update("meetups", meetup.id, {
        targetFloor: fl,
        targetFloorName: Store.FLOOR_NAMES[fl] || "",
        targetRoom: rm,
        meetAt: meetAt,
        status: "Confirmed"
      }).then(function () {
        body.innerHTML = '<div class="success" style="padding-bottom:10px"><div class="tick">&#10003;</div>' +
          '<h3>Location Confirmed!</h3>' +
          '<p style="margin:8px 0">Meeting agreed at: <b style="color:var(--accent);font-size:16px">Room ' + esc(meetAt) + '</b></p>' +
          '<p class="muted" style="font-size:12.5px">' + esc(meetup.by) + ' has been alerted. Follow the walking route to meet.</p>' +
          '<div class="row" style="margin-top:16px;justify-content:center;gap:10px">' +
          '<a class="btn primary" id="cf-route-btn" href="../maps.html?to=' + encodeURIComponent(meetAt) + '">Open Route Map</a>' +
          '<button class="btn ghost" id="cf-close">Close</button>' +
          '</div></div>';

        body.querySelector("#cf-close").onclick = function () { ov.remove(); };
        load();
      });
    };
  }

  function taskAction(btn, id, kind) {
    if (S.busy[id]) return;
    S.busy[id] = true;
    var label = btn.textContent; btn.disabled = true; btn.textContent = kind === "claim" ? "Claiming…" : "Saving…";
    (kind === "claim" ? Store.claimReport(id) : Store.resolveReport(id)).then(function () {
      TO.toast(kind === "claim" ? "Request claimed" : "Request done", kind === "claim" ? id + " is now assigned to you." : id + " marked as done.", "ok");
      if (kind === "resolve" && TO.chimeDone) TO.chimeDone();
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
    var roleText = Store.teamDisplayName(user);
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
    if (!Store.canAccess(user, "logistics")) {
      S.user = null; S.me = "";
      authEls.forEach(function (el) { el.hidden = true; });
      $("login-screen").hidden = true;
      $("main").hidden = true;
      $("bell").hidden = true;
      $("access-denied").hidden = false;
      $("status-pill").className = "pill-status demo";
      $("status-text").textContent = "Restricted";
      $("denied-msg").innerHTML = "Signed in as <b>" + esc(user.name) + "</b> (" + esc(Store.teamDisplayName(user)) + "). Your assigned role does not have permission to access the <b>Logistics</b> module.";
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
      /* Cache-first instant 0ms initial render; sync with Firebase in background */
      load();
      Store.start().catch(function () {});
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
    var code = ($("login-code").value || "").trim().toUpperCase();
    if (!code) { showLoginError("Please enter your volunteer code."); return; }
    var btn = $("login-btn"); btn.disabled = true; btn.textContent = "Signing in…"; showLoginError("");
    Store.login(code).then(function (u) {
      btn.disabled = false; btn.textContent = "Sign in";
      if (!Store.canAccess(u, "logistics")) {
        var teamLabel = Store.teamDisplayName(u);
        return Store.logout().then(function () {
          applyUser(null);
          showLoginError("Access denied: your account belongs to " + teamLabel + " and is not authorized to open the Logistics panel.");
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
  syncAlertsUI();
  $("alerts-btn").onclick = toggleAlerts;
  if ($("mobile-alerts-btn")) $("mobile-alerts-btn").onclick = toggleAlerts;
  if ($("tutorial-btn")) $("tutorial-btn").onclick = function () { startLogisticsTutorial(true); };
  if ($("mobile-tutorial-btn")) $("mobile-tutorial-btn").onclick = function () { startLogisticsTutorial(true); };
  $("bell").onclick = function () { setTab("issues"); S.filter = "unassigned"; renderIssues(); };
  $("issue-search").oninput = function () { S.text = this.value; renderIssues(); };

  /* Tabs navigation */
  document.querySelectorAll(".tabs .tab").forEach(function (tab) {
    tab.onclick = function () { setTab(this.dataset.tab); };
  });
  var mobNav = document.querySelector(".mobile-nav");
  if (mobNav) {
    mobNav.addEventListener("click", function (e) {
      var b = e.target.closest(".mobile-nav-btn");
      if (b && b.dataset.tab) setTab(b.dataset.tab);
    });
  }

  document.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-if]"))) { S.filter = t.dataset.if; renderIssues(); return; }
    if ((t = e.target.closest("[data-claim]"))) { taskAction(t, t.dataset.claim, "claim"); return; }
    if ((t = e.target.closest("[data-resolve]"))) { taskAction(t, t.dataset.resolve, "resolve"); return; }
    if ((t = e.target.closest("[data-code]"))) {
      var vList = S.data ? (S.data.volunteers || S.data.team || []) : [];
      var code = t.dataset.code;
      var member = vList.filter(function (x) { return x.code === code; })[0];
      if (!member) return;
      var isMe = (S.user && member.code === S.user.code) || (S.me && member.name === S.me);
      if (isMe) {
        var ms = $("my-status");
        if (ms) {
          ms.scrollIntoView({ behavior: "smooth" });
          var ed = $("ms-editor"), btn = $("ms-toggle-edit");
          if (ed && ed.hidden) {
            ed.hidden = false;
            if (btn) { btn.setAttribute("aria-expanded", "true"); btn.querySelector("span").textContent = "Close"; }
          }
        }
      } else {
        openPingModal(member);
      }
      return;
    }
    if ((t = e.target.closest("[data-confirm-ping]"))) {
      var meetId = t.dataset.confirmPing;
      var m = S.data.meetups.filter(function (x) { return x.id === meetId; })[0];
      if (m) openConfirmLocationModal(m);
      return;
    }
    if ((t = e.target.closest("[data-meet]"))) {
      Store.update("meetups", t.dataset.meet, { status: t.dataset.st });
      load();
      return;
    }
  });

  Store.onChange(function () { if (S.user) load(); });
  setInterval(function () { if (S.user && S.data) renderIssues(); }, 60000);
  /* Automatically refresh online team presence every 30s so expired heartbeats cleanly drop */
  setInterval(function () { if (S.tab === "team") renderTeam(); }, 30000);

  var fast = Store.peekUser ? Store.peekUser() : null;
  if (fast) applyUser(fast);
  else Store.restore().then(applyUser);
})();
