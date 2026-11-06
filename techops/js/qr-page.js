/* Printable QR sheet: one code per room */
(function () {
  var D = window.TechOpsData, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  TO.initTheme();
  var q = new URLSearchParams(location.search), only = (q.get("room") || "").toUpperCase(), floor = "";

  $("base").value = TO.baseUrl();
  $("save-base").onclick = function () { try { localStorage.setItem("techops_base_url", $("base").value.trim()); } catch (e) {} draw(); };
  $("reset-base").onclick = function () { try { localStorage.removeItem("techops_base_url"); } catch (e) {} $("base").value = TO.baseUrl(); draw(); };
  $("print").onclick = function () { window.print(); };

  $("floor-filter").innerHTML = '<button class="chip on" data-f="">All floors</button>' + D.FLOORS.map(function (f) { return '<button class="chip" data-f="' + f.id + '">' + f.name + "</button>"; }).join("");
  $("floor-filter").onclick = function (e) {
    var b = e.target.closest("[data-f]"); if (!b) return;
    floor = b.dataset.f; only = "";
    this.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c === b); });
    draw();
  };

  function draw() {
    var h = "";
    D.FLOORS.forEach(function (f) {
      if (floor && f.id !== floor) return;
      f.rooms.forEach(function (r) {
        if (only && r.code !== only) return;
        h += '<div class="card qr-card"><div class="qr-box">' + TO.qrSvg(TO.reportUrl(f.id, r.code), 4) + '</div><div class="code">' + esc(r.code) + '</div><div class="meta">' + esc(f.name) + '</div><div class="meta" style="margin-top:4px">Scan to report a TechOps issue</div></div>';
      });
    });
    $("grid").innerHTML = h || '<div class="empty">No rooms.</div>';
  }
  draw();
})();
