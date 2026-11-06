/* Universal Venue QR Code & Optional Room Sheet */
(function () {
  var D = window.TechOpsData, esc = TO.esc;
  var $ = function (id) { return document.getElementById(id); };
  TO.initTheme();

  var baseInput = $("base");
  var saved = "";
  try { saved = localStorage.getItem("techops_base_url") || ""; } catch (e) {}
  baseInput.value = saved || TO.baseUrl();

  $("save-base").onclick = function () {
    try { localStorage.setItem("techops_base_url", baseInput.value.trim()); } catch (e) {}
    drawAll();
    TO.toast("Saved", "Updated QR code target URL.", "ok");
  };

  $("reset-base").onclick = function () {
    try { localStorage.removeItem("techops_base_url"); } catch (e) {}
    baseInput.value = TO.baseUrl();
    drawAll();
    TO.toast("Reset", "Restored default URL.", "ok");
  };

  $("copy-link").onclick = function () {
    var url = getUniversalUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        TO.toast("Copied!", "Universal Report URL copied to clipboard.", "ok");
      });
    } else {
      prompt("Copy Universal Report URL:", url);
    }
  };

  $("print").onclick = function () { window.print(); };
  $("print-hero").onclick = function () { window.print(); };

  function getUniversalUrl() {
    var b = baseInput.value.trim() || TO.baseUrl();
    b = b.replace(/\/?$/, "/");
    return b + "report.html";
  }

  function drawUniversal() {
    var url = getUniversalUrl();
    var box = $("universal-qr-box");
    if (!box) return;
    box.innerHTML = TO.qrSvg(url, 6);
  }

  /* Optional room grid */
  var floor = "";
  var ff = $("floor-filter");
  if (ff) {
    ff.innerHTML = '<button class="chip on" data-f="">All floors</button>' + D.FLOORS.map(function (f) {
      return '<button class="chip" data-f="' + f.id + '">' + f.name + '</button>';
    }).join("");

    ff.onclick = function (e) {
      var b = e.target.closest("[data-f]");
      if (!b) return;
      floor = b.dataset.f;
      this.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c === b); });
      drawRooms();
    };
  }

  function drawRooms() {
    var grid = $("grid");
    if (!grid) return;
    var b = baseInput.value.trim() || TO.baseUrl();
    b = b.replace(/\/?$/, "/");

    var h = "";
    D.FLOORS.forEach(function (f) {
      if (floor && f.id !== floor) return;
      f.rooms.forEach(function (r) {
        var roomUrl = b + "report.html?floor=" + encodeURIComponent(f.id) + "&room=" + encodeURIComponent(r.code);
        h += '<div class="card qr-card">' +
          '<div class="qr-box">' + TO.qrSvg(roomUrl, 4) + '</div>' +
          '<div class="code">' + esc(r.code) + '</div>' +
          '<div class="meta">' + esc(f.name) + '</div>' +
          '<div class="meta" style="margin-top:4px">Scan to report an issue</div>' +
          '</div>';
      });
    });
    grid.innerHTML = h || '<div class="empty">No rooms found.</div>';
  }

  function drawAll() {
    drawUniversal();
    drawRooms();
  }

  drawAll();
})();
