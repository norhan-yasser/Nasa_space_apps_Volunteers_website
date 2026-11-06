/* Public report form (opened by scanning a room QR code: report.html?floor=F&room=C139) */
(function () {
  var D = window.TechOpsData, Store = window.TechOpsStore, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  TO.initTheme();

  var q = new URLSearchParams(location.search);
  var floorSel = $("floor"), roomSel = $("room");

  floorSel.innerHTML += D.FLOORS.map(function (f) { return '<option value="' + f.id + '">' + f.name + "</option>"; }).join("");
  function fillRooms(sel) {
    var f = D.FLOORS.filter(function (x) { return x.id === floorSel.value; })[0];
    roomSel.innerHTML = '<option value="">Select room…</option>' + (f ? f.rooms.map(function (r) { return "<option>" + r.code + "</option>"; }).join("") : "");
    if (sel) roomSel.value = sel;
  }
  floorSel.onchange = function () { fillRooms(); };

  /* pre-fill from the QR code (only accept known floors / rooms) */
  var qf = (q.get("floor") || "").toUpperCase(), qr = (q.get("room") || "").toUpperCase();
  if (D.FLOORS.some(function (f) { return f.id === qf; })) { floorSel.value = qf; fillRooms(); if (qr) roomSel.value = qr; if (roomSel.value !== qr) roomSel.value = ""; }

  $("issues").innerHTML = D.ISSUES.map(function (i, n) {
    return '<label class="issue-opt"><input type="radio" name="issue" value="' + i.id + '"' + (n === 0 ? "" : "") + '><span><span class="t">' + esc(i.label) + '</span><br><span class="h">' + esc(i.hint) + "</span></span></label>";
  }).join("");
  document.querySelectorAll("input[name=issue]").forEach(function (r) {
    r.onchange = function () { $("other-wrap").hidden = r.value !== "other" || !r.checked; if (r.value === "other") $("other").focus(); };
  });

  var lastSend = 0;
  $("f").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("err"); err.hidden = true;
    var floor = floorSel.value, room = roomSel.value, pick = document.querySelector("input[name=issue]:checked");
    if (!floor || !room) return fail("Please choose your floor and room.");
    if (!pick) return fail("Please choose what the problem is.");
    var issue = D.ISSUES.filter(function (i) { return i.id === pick.value; })[0].label;
    var details = $("details").value.trim();
    if (pick.value === "other") {
      var custom = $("other").value.trim();
      if (!custom) return fail("Please describe the issue.");
      issue = "Other"; details = custom + (details ? " — " + details : "");
    }
    if ($("website").value) return;                       /* honeypot: bots only */
    if (Date.now() - lastSend < 4000) return;
    lastSend = Date.now();
    var btn = $("send"); btn.disabled = true; btn.textContent = "Sending…";
    Store.addReport({ floor: floor, room: room, issue: issue, details: details, reporter: $("reporter").value.trim() }).then(function (res) {
      btn.disabled = false; btn.textContent = "Send report";
      $("form-card").hidden = true; $("done").hidden = false;
      $("done-id").textContent = res.id;
      $("done-msg").textContent = "TechOps has been alerted about " + issue.toLowerCase() + " in room " + room + " (" + Store.FLOOR_NAMES[floor] + "). Someone is on the way.";
      var demo = $("done-demo");
      demo.hidden = Store.isLive();
      demo.textContent = "Demo mode: this report is stored in this browser only and not in the Google Sheet yet.";
    });
    function noop() {}
  });
  function fail(m) { var e = $("err"); e.textContent = m; e.hidden = false; }
  $("again").onclick = function () {
    $("done").hidden = true; $("form-card").hidden = false;
    $("details").value = ""; $("other").value = ""; $("other-wrap").hidden = true;
    document.querySelectorAll("input[name=issue]").forEach(function (r) { r.checked = false; });
  };
})();
