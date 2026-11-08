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
  function fillRooms(sel) {
    var f = D.FLOORS.filter(function (x) { return x.id === floorSel.value; })[0];
    if (!f) { roomSel.innerHTML = '<option value="">First select a floor…</option>'; return; }
    roomSel.innerHTML = '<option value="">Select your room…</option>' + f.rooms.map(function (r) {
      return '<option value="' + esc(r.code) + '">' + esc(r.code) + "</option>";
    }).join("");
    if (sel) roomSel.value = sel;
  }
  floorSel.onchange = function () { fillRooms(); };
  var qf = (q.get("floor") || "").toUpperCase(), qr = (q.get("room") || "").toUpperCase();
  if (D.FLOORS.some(function (f) { return f.id === qf; })) { floorSel.value = qf; fillRooms(qr); }
  else if (qr) {
    for (var i = 0; i < D.FLOORS.length; i++) {
      if (D.FLOORS[i].rooms.some(function (r) { return r.code === qr; })) { floorSel.value = D.FLOORS[i].id; fillRooms(qr); break; }
    }
  }

  destSel.innerHTML = '<option value="">Choose a place…</option><option value="ENTRANCE|Main Entrance">Main Entrance</option>' + D.FLOORS.map(function (f) {
    return '<optgroup label="' + esc(f.name) + '">' + f.rooms.map(function (r) {
      return '<option value="' + esc(r.code + "|" + f.name) + '">' + esc(r.code) + "</option>";
    }).join("") + "</optgroup>";
  }).join("");

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
    Store.addReport({ team: team, floor: remote ? "" : floor, room: remote ? "" : room, issue: issue, details: details, reporter: $("reporter").value.trim() })
      .then(function (res) {
        btn.disabled = false; btn.textContent = "Send request";
        $("form-card").hidden = true; $("done").hidden = false;
        $("done-id").textContent = res.id;
        $("done-msg").textContent = remote
          ? "The " + TEAM_LABEL[team] + " has been alerted (" + issue.toLowerCase() + "). They will help you remotely, so please keep Discord open."
          : "The " + TEAM_LABEL[team] + " team has been alerted (" + issue.toLowerCase() + ", room " + room + ", " + Store.FLOOR_NAMES[floor] + "). A volunteer will come to you.";
        var demo = $("done-demo"); demo.hidden = Store.isLive();
        demo.textContent = "Local preview mode: Firebase is not configured yet, so this request is stored in this browser only.";
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
