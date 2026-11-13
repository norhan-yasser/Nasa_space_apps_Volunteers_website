/* ONE participant form (opened by the single QR code).
 * Each request type belongs to exactly one team (TechOpsData.REQUEST_TYPES). The team is looked up from that table,
 * never typed by the user, so a request lands in the Tech Ops dashboard OR the Logistics dashboard, never both. */
(function () {
  var D = window.TechOpsData, Store = window.TechOpsStore, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  TO.initTheme();

  var q = new URLSearchParams(location.search);
  var floorSel = $("floor"), roomSel = $("room"), destSel = $("dest");
  var TEAM_LABEL = D.TEAM_LABELS;

  floorSel.innerHTML = '<option value="">Select floor…</option>' + D.FLOORS.map(function (f) {
    return '<option value="' + f.id + '">' + esc(f.name) + "</option>";
  }).join("");

  var liveRoomsByFloor = null;
  function getFloorRooms(floorId) {
    if (liveRoomsByFloor && liveRoomsByFloor[floorId] && liveRoomsByFloor[floorId].length) {
      return liveRoomsByFloor[floorId];
    }
    var f = D.FLOORS.filter(function (x) { return x.id === floorId; })[0];
    return f ? f.rooms : [];
  }

  function fillRooms(sel) {
    var curSel = sel !== undefined ? sel : roomSel.value;
    if (!floorSel.value) { roomSel.innerHTML = '<option value="">First select a floor…</option>'; return; }
    var list = getFloorRooms(floorSel.value);
    roomSel.innerHTML = '<option value="">Select your room…</option>' + list.map(function (r) {
      var hasCustom = r.name && String(r.name).trim().toUpperCase() !== String(r.code).trim().toUpperCase();
      var lbl = r.code + (hasCustom ? " · " + r.name : "");
      return '<option value="' + esc(r.code) + '">' + esc(lbl) + "</option>";
    }).join("");
    if (curSel) roomSel.value = curSel;
  }

  function fillDestinations() {
    var curDest = destSel.value;
    destSel.innerHTML = '<option value="">Choose a place…</option><option value="ENTRANCE|Main Entrance">Main Entrance</option>' + D.FLOORS.map(function (f) {
      var list = getFloorRooms(f.id);
      return '<optgroup label="' + esc(f.name) + '">' + list.map(function (r) {
        var hasCustom = r.name && String(r.name).trim().toUpperCase() !== String(r.code).trim().toUpperCase();
        var lbl = r.code + (hasCustom ? " (" + r.name + ")" : "");
        return '<option value="' + esc(r.code + "|" + f.name) + '">' + esc(lbl) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
    if (curDest) destSel.value = curDest;
  }

  floorSel.onchange = function () { fillRooms(""); };
  var qf = (q.get("floor") || "").toUpperCase(), qr = (q.get("room") || "").toUpperCase();
  if (D.FLOORS.some(function (f) { return f.id === qf; })) { floorSel.value = qf; fillRooms(qr); }
  else if (qr) {
    for (var i = 0; i < D.FLOORS.length; i++) {
      if (D.FLOORS[i].rooms.some(function (r) { return r.code === qr; })) { floorSel.value = D.FLOORS[i].id; fillRooms(qr); break; }
    }
  }
  fillDestinations();

  function syncRoomsFromStore() {
    if (!Store || !Store.loadAll) return;
    Store.loadAll().then(function (data) {
      var rooms = data && (data.allRooms && data.allRooms.length ? data.allRooms : data.rooms);
      if (!rooms || !rooms.length) return;
      var byFl = { B: [], G: [], F: [], S: [] };
      rooms.forEach(function (r) {
        if (!r || !r.code || r.access === "no") return;
        var fId = (r.floor || "G").toUpperCase();
        if (byFl[fId]) byFl[fId].push(r);
      });
      liveRoomsByFloor = byFl;
      fillRooms();
      fillDestinations();
    }).catch(function () {});
  }
  if (Store) {
    if (Store.start) Store.start();
    syncRoomsFromStore();
    if (Store.onChange) Store.onChange(syncRoomsFromStore);
  }

  function card(name, value, icon, label, hint) {
    return '<label class="issue-opt"><input type="radio" name="' + name + '" value="' + esc(value) + '">' +
      '<div class="issue-opt-body"><div class="t">' + (icon ? '<span class="opt-icon">' + icon + "</span>" : "") + "<span>" + esc(label) + "</span></div>" +
      (hint ? '<div class="h">' + esc(hint) + "</div>" : "") + "</div>" +
      '<div class="issue-opt-radio" aria-hidden="true"><span class="radio-dot"></span></div></label>';
  }
  var TEAM_CARDS = [
    { id: "TechOps", icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>', label: "Tech Ops", hint: "Internet, power, equipment or any tech problem" },
    { id: "Logistics", icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>', label: "Logistics", hint: "Go to a place, prayer area or any other help" },
    { id: "Competition", icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"></path><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34"></path><path d="M14 14.66V17c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2.34"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>', label: "Competition Team", hint: "Discord issues, competition questions, submissions (remote help, no room needed)" }
  ];
  $("team-opts").innerHTML = TEAM_CARDS.map(function (t) { return card("team", t.id, t.icon, t.label, t.hint); }).join("");
  function pickedTeam() { var p = document.querySelector("input[name=team]:checked"); return p ? p.value : ""; }
  function typeCards(team) {
    return D.REQUEST_TYPES.filter(function (t) { return t.team === team; })
      .map(function (t) { return card("issue", t.id, t.icon, t.label, t.hint); }).join("");
  }
  $("issues-tech").innerHTML = typeCards("TechOps");
  $("issues-log").innerHTML = typeCards("Logistics");
  $("issues-comp").innerHTML = typeCards("Competition");
  $("prayer-opts").innerHTML = ["Men", "Women"].map(function (g) { return card("prayer", g, "", g, ""); }).join("");

  function picked() { var p = document.querySelector("input[name=issue]:checked"); return p ? p.value : ""; }
  function sync() {
    document.querySelectorAll(".issue-opt").forEach(function (lbl) {
      var inp = lbl.querySelector("input");
      lbl.classList.toggle("is-selected", !!(inp && inp.checked));
    });
    var tm = pickedTeam();
    $("rest").hidden = !tm;
    $("grp-TechOps").hidden = tm !== "TechOps";
    $("grp-Logistics").hidden = tm !== "Logistics";
    $("grp-Competition").hidden = tm !== "Competition";
    /* room details are only needed when a team has to come to you */
    $("loc-wrap").hidden = tm === "Competition";
    $("reporter-lbl").innerHTML = tm === "Competition" ? 'Your team name and Discord username <span style="color:var(--bad)">*</span>' : 'Your name or team <span style="font-weight:400;color:var(--mut)">(optional)</span>';
    $("reporter").placeholder = tm === "Competition" ? "e.g. Team Aurora · @omar" : "e.g. Team Aurora";
    var cur = picked();
    if (cur && D.teamFor(cur) !== tm) {            /* team changed: clear an option that belongs to the other team */
      document.querySelectorAll("input[name=issue]").forEach(function (r) { r.checked = false; });
      document.querySelectorAll(".issue-opt").forEach(function (lbl) { lbl.classList.remove("is-selected"); });
    }
    var v = picked();
    $("other-wrap").hidden = v !== "other" && v !== "comp-other";
    $("place-wrap").hidden = v !== "place";
    $("prayer-wrap").hidden = v !== "prayer";
    $("details-lbl").innerHTML = v === "log-help" ? 'What do you need? <span style="color:var(--bad)">*</span>' : 'More details <span style="font-weight:400;color:var(--mut)">(optional)</span>';
  }
  document.addEventListener("change", function (e) { if (e.target.name === "issue" || e.target.name === "prayer" || e.target.name === "team") { $("err-team").hidden = true; sync(); } });

  /* Lightweight, silent background Wi-Fi test: uses navigator.connection API if available, plus a micro-ping */
  function measureWifiSpeed() {
    return new Promise(function (resolve) {
      var nav = typeof navigator !== "undefined" ? navigator : {};
      var conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      var dl = (conn && typeof conn.downlink === "number") ? conn.downlink : 0;
      var rtt = (conn && typeof conn.rtt === "number") ? conn.rtt : 0;

      var start = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      var done = false;
      function finish(elapsed) {
        if (done) return;
        done = true;
        var latency = rtt ? Math.round((rtt + elapsed) / 2) : elapsed;
        var mbps = 0;
        if (dl > 0) {
          mbps = Math.round(dl * 10) / 10;
        } else {
          /* Fallback speed heuristic based on measured round-trip latency */
          if (latency < 45) mbps = 48;
          else if (latency < 90) mbps = 28;
          else if (latency < 160) mbps = 16;
          else if (latency < 320) mbps = 7;
          else mbps = 2;
        }
        resolve({
          mbps: Math.max(1, Math.round(mbps)),
          latency: Math.max(5, Math.round(latency)),
          tested: true
        });
      }

      var timer = setTimeout(function () {
        var elapsed = (typeof performance !== "undefined" && performance.now) ? (performance.now() - start) : (Date.now() - start);
        finish(Math.max(120, Math.round(elapsed)));
      }, 450);

      var pingUrl = (typeof location !== "undefined" ? (location.origin + location.pathname.replace(/[^\/]*$/, "../assets/favicon.png")) : "../assets/favicon.png") + "?_p=" + Date.now();
      fetch(pingUrl, { cache: "no-store", mode: "no-cors" }).then(function () {
        clearTimeout(timer);
        var elapsed = (typeof performance !== "undefined" && performance.now) ? (performance.now() - start) : (Date.now() - start);
        finish(Math.max(10, Math.round(elapsed)));
      }).catch(function () {
        clearTimeout(timer);
        var elapsed = (typeof performance !== "undefined" && performance.now) ? (performance.now() - start) : (Date.now() - start);
        finish(Math.max(140, Math.round(elapsed)));
      });
    });
  }

  function fail(m) { var e = $("err"); e.textContent = m; e.hidden = false; e.scrollIntoView({ behavior: "smooth", block: "center" }); }

  var lastSend = 0;
  $("f").addEventListener("submit", function (e) {
    e.preventDefault();
    $("err").hidden = true;
    var chosenTeam = pickedTeam();
    if (!chosenTeam) { var et = $("err-team"); et.textContent = "Please choose the team first (Tech Ops, Logistics or Competition Team)."; et.hidden = false; return; }
    var floor = floorSel.value, room = roomSel.value, id = picked();
    var remote = chosenTeam === "Competition";
    if (!remote && !floor) return fail("Please select the floor you are on.");
    if (!remote && !room) return fail("Please choose your room.");
    if (!id) return fail("Please choose what you need.");

    var type = D.REQUEST_TYPES.filter(function (t) { return t.id === id; })[0];
    var team = D.teamFor(id);                       /* decided by the table, not by the page */
    if (!type || !team || team !== chosenTeam) return fail("That option does not belong to " + TEAM_LABEL[chosenTeam] + ". Please choose again.");
    var issue = type.label, note = $("details").value.trim(), details = "";

    if (remote && !$("reporter").value.trim()) return fail("Please enter your team name and Discord username so the Competition Team can reach you.");

    if (id === "other" || id === "comp-other") {
      var custom = $("other").value.trim();
      if (!custom) return fail("Please describe the problem.");
      issue = "Other: " + custom; details = note;
    } else if (id === "place") {
      if (!destSel.value) return fail("Please choose where you want to go.");
      var dp = destSel.value.split("|");
      details = "Wants to go to: " + dp[0] + (dp[1] && dp[0] !== "ENTRANCE" ? " (" + dp[1] + ")" : "");
      if (note) details += ". " + note;
    } else if (id === "prayer") {
      var pr = document.querySelector("input[name=prayer]:checked");
      if (!pr) return fail("Please choose the prayer area (Men or Women).");
      details = "Prayer area: " + pr.value + (note ? ". " + note : "");
    } else if (id === "log-help") {
      if (!note) return fail("Please tell us what help you need.");
      details = note;
    } else { details = note; }

    if ($("website").value) return;                  /* honeypot */
    if (Date.now() - lastSend < 4000) return;
    lastSend = Date.now();

    var btn = $("send"); btn.disabled = true; btn.textContent = "Sending…";

    /* Trigger: IF user selects "Tech Ops", chooses Floor & Room, AND selects "Internet is lagging" */
    var isNetLagging = (chosenTeam === "TechOps" && !remote && floor && room && (id === "net" || issue.toLowerCase().indexOf("internet") !== -1));
    var wifiTestTask = isNetLagging ? measureWifiSpeed() : Promise.resolve(null);

    wifiTestTask.then(function (speed) {
      if (speed && Store && Store.recordWifiReading) {
        Store.recordWifiReading({
          room: room,
          floor: floor,
          mbps: speed.mbps,
          latency: speed.latency
        }).catch(function (err) {
          console.warn("Background Wi-Fi test sync failed:", err);
        });
        details = (details ? details + "\n" : "") + "[Auto Wi-Fi Test: " + speed.mbps + " Mbps, " + speed.latency + " ms latency]";
      }

      return Store.addReport({
        team: team,
        floor: remote ? "" : floor,
        room: remote ? "" : room,
        issue: issue,
        details: details,
        reporter: $("reporter").value.trim()
      });
    }).then(function (res) {
      btn.disabled = false; btn.textContent = "Send request";
      $("form-card").hidden = true; $("done").hidden = false;
      $("done-id").textContent = res.id;
      $("done-msg").textContent = remote
        ? "The " + TEAM_LABEL[team] + " has been alerted (" + issue.toLowerCase() + "). They will help you remotely, so please keep Discord open."
        : "The " + TEAM_LABEL[team] + " team has been alerted (" + issue.toLowerCase() + ", room " + room + ", " + Store.FLOOR_NAMES[floor] + "). A volunteer will come to you.";
      var demo = $("done-demo"); demo.hidden = true;
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = "Send request";
      fail("Could not send the request. Please try again: " + Store.friendly(err));
    });
  });

  $("again").onclick = function () {
    $("done").hidden = true; $("form-card").hidden = false;
    $("details").value = ""; $("other").value = ""; destSel.value = "";
    document.querySelectorAll("input[name=issue], input[name=prayer], input[name=team]").forEach(function (r) { r.checked = false; });
    sync();
  };
  sync();
})();
