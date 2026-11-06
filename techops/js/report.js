/* Public Universal Report Form (opened by scanning the Universal QR Code) */
(function () {
  var D = window.TechOpsData, Store = window.TechOpsStore, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  TO.initTheme();

  var q = new URLSearchParams(location.search);
  var floorSel = $("floor"), roomSel = $("room");

  floorSel.innerHTML = '<option value="">Select floor…</option>' + D.FLOORS.map(function (f) {
    return '<option value="' + f.id + '">' + f.name + "</option>";
  }).join("");

  function fillRooms(sel) {
    var f = D.FLOORS.filter(function (x) { return x.id === floorSel.value; })[0];
    if (!f) {
      roomSel.innerHTML = '<option value="">First select a floor…</option>';
      return;
    }
    roomSel.innerHTML = '<option value="">Select your room…</option>' + f.rooms.map(function (r) {
      return '<option value="' + r.code + '">' + r.code + " (" + (r.code[0] === "C" ? "Classroom" : r.code[0] === "S" ? "Lecture Hall" : r.code[0] === "B" ? "BYOD Room" : r.code[0] === "H" ? "Main Hall" : "Room") + ")</option>";
    }).join("");
    if (sel) roomSel.value = sel;
  }
  floorSel.onchange = function () { fillRooms(); };

  /* If opened with optional params (e.g. from an old room sticker or link) */
  var qf = (q.get("floor") || "").toUpperCase(), qr = (q.get("room") || "").toUpperCase();
  if (D.FLOORS.some(function (f) { return f.id === qf; })) {
    floorSel.value = qf;
    fillRooms(qr);
  } else if (qr) {
    /* Auto-detect floor from room code */
    for (var i = 0; i < D.FLOORS.length; i++) {
      if (D.FLOORS[i].rooms.some(function (r) { return r.code === qr; })) {
        floorSel.value = D.FLOORS[i].id;
        fillRooms(qr);
        break;
      }
    }
  }

  /* Render Issue options */
  $("issues").innerHTML = D.ISSUES.map(function (i) {
    var icon = i.id === "net" ? "📶" : i.id === "power" ? "⚡" : i.id === "help" ? "🛠️" : "💬";
    return '<label class="issue-opt" data-opt="' + i.id + '">' +
      '<input type="radio" name="issue" value="' + i.id + '">' +
      '<div class="issue-opt-body">' +
      '<div class="t"><span class="opt-icon">' + icon + '</span><span>' + esc(i.label) + '</span></div>' +
      '<div class="h">' + esc(i.hint) + '</div>' +
      '</div>' +
      '<div class="issue-opt-radio" aria-hidden="true"><span class="radio-dot"></span></div>' +
      '</label>';
  }).join("");

  function syncSelectedOpt() {
    document.querySelectorAll(".issue-opt").forEach(function (lbl) {
      var inp = lbl.querySelector("input[name=issue]");
      if (inp && inp.checked) {
        lbl.classList.add("is-selected");
      } else {
        lbl.classList.remove("is-selected");
      }
    });
  }

  document.querySelectorAll("input[name=issue]").forEach(function (r) {
    r.onchange = function () {
      syncSelectedOpt();
      $("other-wrap").hidden = r.value !== "other" || !r.checked;
      if (r.value === "other") $("other").focus();
    };
  });

  var lastSend = 0;
  $("f").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("err"); err.hidden = true;
    var floor = floorSel.value, room = roomSel.value, pick = document.querySelector("input[name=issue]:checked");

    if (!floor) return fail("Please select the floor you are currently on.");
    if (!room) return fail("Please choose your room number / code.");
    if (!pick) return fail("Please select what type of problem you are experiencing.");

    var issueObj = D.ISSUES.filter(function (i) { return i.id === pick.value; })[0];
    var issue = issueObj ? issueObj.label : "Other";
    var details = $("details").value.trim();

    if (pick.value === "other") {
      var custom = $("other").value.trim();
      if (!custom) return fail("Please describe the issue in the text field.");
      issue = "Other: " + custom;
    }

    if ($("website").value) return; /* honeypot anti-spam */

    if (Date.now() - lastSend < 4000) return;
    lastSend = Date.now();

    var btn = $("send"); btn.disabled = true; btn.textContent = "Transmitting to TechOps…";

    Store.addReport({
      floor: floor,
      room: room,
      issue: issue,
      details: details,
      reporter: $("reporter").value.trim()
    }).then(function (res) {
      btn.disabled = false; btn.textContent = "Send report";
      $("form-card").hidden = true; $("done").hidden = false;
      $("done-id").textContent = res.id;
      $("done-msg").textContent = "TechOps has been alerted about " + issue.toLowerCase() + " in Room " + room + " (" + Store.FLOOR_NAMES[floor] + "). A volunteer is on the way.";
      
      var demo = $("done-demo");
      demo.hidden = Store.isLive();
      demo.textContent = "Demo Mode: this report is stored in browser memory & local storage (will feed into Google Sheets once APPS_SCRIPT_URL is deployed).";
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = "Send report";
      fail("Failed to submit report. Please try again: " + err.message);
    });
  });

  function fail(m) {
    var e = $("err");
    e.textContent = m;
    e.hidden = false;
    e.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("again").onclick = function () {
    $("done").hidden = true; $("form-card").hidden = false;
    $("details").value = ""; $("other").value = ""; $("other-wrap").hidden = true;
    document.querySelectorAll("input[name=issue]").forEach(function (r) { r.checked = false; });
  };
})();
