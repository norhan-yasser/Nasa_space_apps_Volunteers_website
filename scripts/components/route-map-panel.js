/**
 * NASA Space Apps Cairo - Route Map Panel
 * Instant embedded route and floor map inspector for volunteer tickets.
 */
(function () {
  function getD() { return window.TechOpsData || {}; }

  function findRoom(code) {
    if (!code) return null;
    var D = getD();
    if (D.ALL && D.ALL.length) {
      for (var i = 0; i < D.ALL.length; i++) {
        if (D.ALL[i].code && D.ALL[i].code.toUpperCase() === code.toUpperCase()) {
          return D.ALL[i];
        }
      }
    }
    return null;
  }

  function RouteMapPanel() {
    this.panelEl = null;
    this.backdropEl = null;
    this.stageEl = null;
    this.imgEl = null;
    this.svgEl = null;
    this.titleEl = null;
    this.subEl = null;
    this.floorEl = null;
    this.fullLinkEl = null;
    this.currentRoom = null;
    this.currentFloor = "G";
    this.V = { k: 1, x: 0, y: 0 };
    this._ptrs = {};
    this._last = null;
    this._pinch = 0;
  }

  var P = RouteMapPanel.prototype;

  P._buildDOM = function () {
    if (this.panelEl) return;

    var backdrop = document.createElement("div");
    backdrop.id = "route-map-backdrop";
    backdrop.className = "route-map-backdrop";
    backdrop.hidden = true;

    var panel = document.createElement("div");
    panel.id = "route-map-panel";
    panel.className = "route-map-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Venue Route Map");

    panel.innerHTML =
      '<div class="route-map-header">' +
        '<div class="route-map-header-info">' +
          '<span class="route-map-badge">Venue Route</span>' +
          '<h3 class="route-map-title" id="route-map-title">Room Directions</h3>' +
          '<p class="route-map-sub" id="route-map-sub">Walking path from Operations Desk</p>' +
        '</div>' +
        '<button class="route-map-close-btn" id="route-map-close" aria-label="Close route map" type="button">✕</button>' +
      '</div>' +
      '<div class="route-map-viewport">' +
        '<div class="route-map-stage" id="route-map-stage">' +
          '<img class="route-map-img" id="route-map-img" alt="Floor Map Blueprint">' +
          '<svg class="route-map-svg" id="route-map-svg" viewBox="0 0 1673 940"></svg>' +
        '</div>' +
        '<div class="route-map-zoom-controls">' +
          '<button class="route-zoom-btn" data-z="in" title="Zoom in" type="button">+</button>' +
          '<button class="route-zoom-btn" data-z="out" title="Zoom out" type="button">-</button>' +
          '<button class="route-zoom-btn" data-z="reset" title="Reset view" type="button">↺</button>' +
        '</div>' +
      '</div>' +
      '<div class="route-map-footer">' +
        '<div class="route-map-floor-indicator" id="route-map-floor-indicator">Floor: Ground Floor</div>' +
        '<a class="route-map-full-link" id="route-map-full-link" href="../maps.html" target="_blank">Open Full Venue Map →</a>' +
      '</div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    this.backdropEl = backdrop;
    this.panelEl = panel;
    this.stageEl = panel.querySelector("#route-map-stage");
    this.imgEl = panel.querySelector("#route-map-img");
    this.svgEl = panel.querySelector("#route-map-svg");
    this.titleEl = panel.querySelector("#route-map-title");
    this.subEl = panel.querySelector("#route-map-sub");
    this.floorEl = panel.querySelector("#route-map-floor-indicator");
    this.fullLinkEl = panel.querySelector("#route-map-full-link");

    var self = this;
    backdrop.addEventListener("click", function () { self.close(); });
    panel.querySelector("#route-map-close").addEventListener("click", function () { self.close(); });

    panel.querySelector(".route-map-zoom-controls").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var z = b.dataset.z;
      if (z === "in") self._zoom(1.3);
      else if (z === "out") self._zoom(1 / 1.3);
      else self._fit();
    });

    this._bindTouchDrag();
  };

  P._bindTouchDrag = function () {
    var self = this;
    var vp = this.panelEl.querySelector(".route-map-viewport");

    vp.addEventListener("wheel", function (e) {
      e.preventDefault();
      var f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      self._zoom(f);
    }, { passive: false });

    vp.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".route-map-zoom-controls")) return;
      self._ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      self._last = { x: e.clientX, y: e.clientY };
      self.stageEl.classList.add("is-dragging");
    });

    window.addEventListener("pointermove", function (e) {
      if (!self._ptrs[e.pointerId]) return;
      self._ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(self._ptrs);
      if (ids.length === 2) {
        var a = self._ptrs[ids[0]], b = self._ptrs[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (self._pinch) {
          self._zoom(d / self._pinch);
        }
        self._pinch = d;
      } else if (self._last) {
        var dx = e.clientX - self._last.x, dy = e.clientY - self._last.y;
        self.V.x += dx;
        self.V.y += dy;
        self._last = { x: e.clientX, y: e.clientY };
        self._applyTransform();
      }
    });

    function end(e) {
      delete self._ptrs[e.pointerId];
      self._pinch = 0;
      if (!Object.keys(self._ptrs).length) {
        self._last = null;
        if (self.stageEl) self.stageEl.classList.remove("is-dragging");
      }
    }
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  P._zoom = function (factor) {
    var vp = this.panelEl.querySelector(".route-map-viewport");
    var cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
    var nextK = Math.max(0.3, Math.min(3.5, this.V.k * factor));
    this.V.x = cx - (cx - this.V.x) * (nextK / this.V.k);
    this.V.y = cy - (cy - this.V.y) * (nextK / this.V.k);
    this.V.k = nextK;
    this._applyTransform();
  };

  P._applyTransform = function () {
    if (!this.stageEl) return;
    this.stageEl.style.transform = "translate(" + this.V.x + "px," + this.V.y + "px) scale(" + this.V.k + ")";
  };

  P._fit = function () {
    var vp = this.panelEl.querySelector(".route-map-viewport");
    var cw = vp.clientWidth || 360, ch = vp.clientHeight || 300;
    var k = Math.min(cw / 1673, ch / 940) * 1.1;
    this.V = {
      k: k,
      x: (cw - 1673 * k) / 2,
      y: (ch - 940 * k) / 2
    };
    this._applyTransform();
  };

  P.open = function (opts) {
    opts = opts || {};
    this._buildDOM();

    var roomCode = (opts.room || "").trim().toUpperCase();
    var rObj = findRoom(roomCode);
    var floor = opts.floor || (rObj ? rObj.floor : "G");

    this.currentRoom = roomCode;
    this.currentFloor = floor;

    var floorNames = { B: "Basement", G: "Ground Floor", F: "First Floor", S: "Second Floor" };
    var fName = floorNames[floor] || "Ground Floor";

    this.titleEl.textContent = roomCode ? "Room " + roomCode + " · " + fName : "Venue Floor Blueprint";
    this.subEl.textContent = opts.details || (roomCode ? "Fastest walking path to destination" : "Interactive venue blueprint");
    this.floorEl.textContent = "Floor: " + fName;

    var isSub = typeof location !== "undefined" && /\/(techops|logistics|dispatch|request|tests)\//i.test(location.pathname);
    var fullHref = (isSub ? "../" : "") + "maps.html?from=CO26" + (roomCode ? "&to=" + encodeURIComponent(roomCode) : "");
    this.fullLinkEl.href = fullHref;

    // Load Floor Image
    var imgDir = (isSub ? "../" : "") + "assets/floors/";
    var floorFiles = { B: "0.png", G: "1.png", F: "2.png", S: "3.png" };
    this.imgEl.src = imgDir + (floorFiles[floor] || "1.png");

    this._drawRoute(roomCode, rObj);

    this.backdropEl.hidden = false;
    this.panelEl.hidden = false;
    this.backdropEl.classList.add("is-open");
    this.panelEl.classList.add("is-open");
    this._centerRoom(rObj);
  };

  P._drawRoute = function (roomCode, rObj) {
    var svg = this.svgEl;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var cx = 800, cy = 375;
    var ox = 620, oy = 320; // Default Entrance / Ops desk

    if (rObj) {
      cx = rObj.cx || 800;
      cy = rObj.cy || 375;

      // Draw Room Polygon
      if (rObj.pts && rObj.pts.length) {
        var ptsStr = rObj.pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
        var poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", ptsStr);
        poly.setAttribute("fill", "rgba(59, 130, 246, 0.4)");
        poly.setAttribute("stroke", "#3b82f6");
        poly.setAttribute("stroke-width", "4");
        poly.setAttribute("stroke-dasharray", "8 4");
        svg.appendChild(poly);
      }

      // Draw Dotted Walking Route
      var path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      var midX = (ox + cx) / 2;
      var routePts = ox + "," + oy + " " + midX + "," + oy + " " + midX + "," + cy + " " + cx + "," + cy;
      path.setAttribute("points", routePts);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#60a5fa");
      path.setAttribute("stroke-width", "5");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-dasharray", "8 6");
      svg.appendChild(path);

      // Origin Pin (Operations Desk / Entrance)
      var pinOrigin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pinOrigin.setAttribute("cx", ox);
      pinOrigin.setAttribute("cy", oy);
      pinOrigin.setAttribute("r", "9");
      pinOrigin.setAttribute("fill", "#10b981");
      pinOrigin.setAttribute("stroke", "#ffffff");
      pinOrigin.setAttribute("stroke-width", "3");
      svg.appendChild(pinOrigin);

      // Destination Pin (Room)
      var pinDest = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pinDest.setAttribute("cx", cx);
      pinDest.setAttribute("cy", cy);
      pinDest.setAttribute("r", "12");
      pinDest.setAttribute("fill", "#ef4444");
      pinDest.setAttribute("stroke", "#ffffff");
      pinDest.setAttribute("stroke-width", "3");
      svg.appendChild(pinDest);

      // Room Text Label
      var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", cx);
      label.setAttribute("y", cy - 18);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "#ffffff");
      label.setAttribute("font-family", "system-ui, sans-serif");
      label.setAttribute("font-weight", "bold");
      label.setAttribute("font-size", "22");
      label.setAttribute("stroke", "#020617");
      label.setAttribute("stroke-width", "4");
      label.setAttribute("paint-order", "stroke fill");
      label.textContent = roomCode;
      svg.appendChild(label);
    }
  };

  P._centerRoom = function (rObj) {
    var vp = this.panelEl.querySelector(".route-map-viewport");
    var cw = vp.clientWidth || 360, ch = vp.clientHeight || 300;

    if (!rObj) {
      this._fit();
      return;
    }

    var cx = rObj.cx || 800, cy = rObj.cy || 375;
    var k = 0.95;
    this.V = {
      k: k,
      x: cw / 2 - cx * k,
      y: ch / 2 - cy * k
    };
    this._applyTransform();
  };

  P.close = function () {
    if (!this.panelEl) return;
    this.backdropEl.classList.remove("is-open");
    this.panelEl.classList.remove("is-open");
    var self = this;
    setTimeout(function () {
      if (self.backdropEl) self.backdropEl.hidden = true;
      if (self.panelEl) self.panelEl.hidden = true;
    }, 280);
  };

  window.RouteMapPanel = new RouteMapPanel();
})();
