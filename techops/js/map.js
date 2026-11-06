/**
 * FloorMap: pan/zoom floor plan with
 *  - "zones" layer  : rooms coloured by who they are for (Participants, Volunteers, VIPs, Judges, Mentors)
 *  - "heat" layer   : glowing Wi-Fi quality overlay (green = good, yellow/orange/red = weak)
 *  - issue pins     : pulsing markers on rooms with open TechOps reports
 *  - highlight()    : ring two rooms and join them (meetup preview)
 */
(function () {
  var D = window.TechOpsData, NS = "http://www.w3.org/2000/svg";

  function FloorMap(el, opts) {
    this.el = el; this.opts = opts || {};
    this.floorId = "G"; this.layer = "zones"; this.pins = true;
    this.zoneFilter = null; this.selected = null; this.hl = null;
    this.rooms = {}; this.wifi = []; this.openIssues = {};
    this.V = { k: 1, x: 0, y: 0 };
    this._build();
  }
  var P = FloorMap.prototype;

  P._build = function () {
    var self = this, el = this.el;
    el.innerHTML =
      '<div class="stage"><img class="plan" alt="Floor plan" draggable="false"><svg viewBox="0 0 ' + D.W + " " + D.H + '"></svg></div>' +
      '<div class="map-zoom"><button class="btn" data-z="in" aria-label="Zoom in">+</button><button class="btn" data-z="out" aria-label="Zoom out">&minus;</button><button class="btn" data-z="fit" aria-label="Reset view" title="Reset view">&#8634;</button></div>' +
      '<div class="map-tip"></div>';
    this.stage = el.querySelector(".stage");
    this.img = el.querySelector("img.plan");
    this.svg = el.querySelector("svg");
    this.tip = el.querySelector(".map-tip");

    el.querySelector(".map-zoom").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.z === "fit") self.fit(); else self.zoomAt(b.dataset.z === "in" ? 1.3 : 1 / 1.3, el.clientWidth / 2, el.clientHeight / 2);
    });
    el.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = el.getBoundingClientRect();
      self.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    var ptrs = {}, last = null, pinch = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".map-zoom")) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      self._moved = 0;
      last = { x: e.clientX, y: e.clientY };
      el.classList.add("drag");
    });
    window.addEventListener("pointermove", function (e) {
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(ptrs);
      if (ids.length === 2) {
        var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) { var r = el.getBoundingClientRect(); self.zoomAt(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
        pinch = d; self._moved = 99;
      } else if (last) {
        var dx = e.clientX - last.x, dy = e.clientY - last.y;
        self._moved += Math.abs(dx) + Math.abs(dy);
        self.V.x += dx; self.V.y += dy; last = { x: e.clientX, y: e.clientY };
        self._apply();
      }
    });
    function up(e) { delete ptrs[e.pointerId]; pinch = 0; if (!Object.keys(ptrs).length) { last = null; el.classList.remove("drag"); } }
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);

    this.svg.addEventListener("click", function (e) {
      if (self._moved > 6) return;
      var t = e.target.closest("[data-code]");
      if (!t || !self.opts.onSelect) return;
      var code = t.dataset.code;
      if (code.indexOf("wf:") === 0) { var id = code.slice(3); if (!/^WF-[A-Z]\d/.test(id)) return; code = id.slice(3); }
      self.opts.onSelect(code);
    });
    this.svg.addEventListener("mousemove", function (e) {
      var t = e.target.closest("[data-code]");
      if (!t || !self.opts.tipHtml) { self.tip.style.display = "none"; return; }
      var r = el.getBoundingClientRect();
      self.tip.innerHTML = self.opts.tipHtml(t.dataset.code);
      self.tip.style.display = "block";
      var x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + 250 > r.width) x = e.clientX - r.left - 254;
      if (y + 90 > r.height) y = e.clientY - r.top - 80;
      self.tip.style.left = x + "px"; self.tip.style.top = y + "px";
    });
    this.svg.addEventListener("mouseleave", function () { self.tip.style.display = "none"; });
    window.addEventListener("resize", function () { if (el.offsetParent) self.fit(); });
  };

  P._apply = function () {
    this.stage.style.transform = "translate(" + this.V.x + "px," + this.V.y + "px) scale(" + this.V.k + ")";
  };
  P.fit = function () {
    var cw = this.el.clientWidth, ch = this.el.clientHeight;
    if (!cw || !ch) return;
    var k = Math.min(cw / D.W, ch / D.H) * 0.98;
    this.V = { k: k, x: (cw - D.W * k) / 2, y: (ch - D.H * k) / 2 };
    this._apply();
  };
  P.zoomAt = function (f, px, py) {
    var k = Math.max(0.25, Math.min(5, this.V.k * f)); f = k / this.V.k;
    this.V.x = px - (px - this.V.x) * f; this.V.y = py - (py - this.V.y) * f; this.V.k = k;
    this._apply();
  };
  P.focus = function (code, zoom) {
    var r = this.rooms[code] && this._geo(code); if (!r) return;
    var cw = this.el.clientWidth, ch = this.el.clientHeight, k = zoom || Math.max(this.V.k, 1.3);
    this.V = { k: k, x: cw / 2 - r.cx * k, y: ch / 2 - r.cy * k };
    this.stage.style.transition = "transform .45s ease"; this._apply();
    var s = this.stage; setTimeout(function () { s.style.transition = ""; }, 480);
  };
  P._geo = function (code) {
    var f = D.FLOORS.filter(function (x) { return x.id === this.floorId; }, this)[0];
    return f && f.rooms.filter(function (r) { return r.code === code; })[0];
  };
  P.floorDef = function () { return D.FLOORS.filter(function (f) { return f.id === this.floorId; }, this)[0]; };

  /* data: { rooms: {code: roomRow}, wifi: [..], reports: [..] } */
  P.setData = function (data) {
    this.rooms = data.rooms || {}; this.wifi = data.wifi || [];
    this.openIssues = {};
    var self = this;
    (data.reports || []).forEach(function (r) {
      if (r.status === "Resolved") return;
      var k = r.floor + ":" + r.room;
      (self.openIssues[k] = self.openIssues[k] || []).push(r);
    });
    this.render();
  };
  P.setFloor = function (id, keepView) {
    this.floorId = id; this.selected = null; this.hl = null;
    this.img.src = this.floorDef().img;
    this.render();
    if (!keepView) this.fit();
  };
  P.setLayer = function (l) { this.layer = l; this.el.classList.toggle("heat", l === "heat"); this.render(); };
  P.setPins = function (v) { this.pins = v; this.render(); };
  P.setZoneFilter = function (z) { this.zoneFilter = z; this.render(); };
  P.select = function (code) { this.selected = code; this.render(); };
  P.highlight = function (hl) { this.hl = hl; this.render(); };

  function pts(r) { return r.pts.map(function (p) { return p.join(","); }).join(" "); }

  P.render = function () {
    var f = this.floorDef(), self = this, h = "", defs = "";
    var heat = this.layer === "heat";
    if (!this.img.getAttribute("src")) this.img.src = f.img;
    this.el.classList.toggle("heat", heat);

    if (heat) {
      var pointsHere = this.wifi.filter(function (w) { return w.floor === f.id; });
      var glows = "";
      pointsHere.forEach(function (w, i) {
        var c = TO.speedColor(w.mbps), isRoom = /^WF-[A-Z]\d/.test(w.id);
        var rad = isRoom ? 105 : 150;
        defs += '<radialGradient id="hg' + i + '"><stop offset="0" stop-color="' + c + '" stop-opacity=".95"/><stop offset=".35" stop-color="' + c + '" stop-opacity=".6"/><stop offset=".7" stop-color="' + c + '" stop-opacity=".18"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>';
        glows += '<circle class="heat-glow" cx="' + w.x + '" cy="' + w.y + '" r="' + rad + '" fill="url(#hg' + i + ')"/>';
      });
      h += "<defs>" + defs + "</defs>" + '<g style="mix-blend-mode:normal">' + glows + "</g>";
    }

    /* room outlines (clickable) */
    f.rooms.forEach(function (r) {
      var row = self.rooms[r.code] || {}, z = D.ZONES[row.zone], col = z ? z.color : "#64748b";
      var dim = self.zoneFilter && row.zone !== self.zoneFilter;
      var sel = self.selected === r.code;
      if (heat) {
        h += '<polygon class="rm' + (sel ? " sel" : "") + '" data-code="' + r.code + '" points="' + pts(r) + '" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.55)" stroke-width="2.5"/>';
      } else {
        h += '<polygon class="rm' + (sel ? " sel" : "") + (dim ? " dim" : "") + '" data-code="' + r.code + '" points="' + pts(r) + '" fill="' + col + '" fill-opacity=".85" stroke="' + col + '" stroke-width="3"/>';
        h += '<text x="' + r.cx + '" y="' + (r.cy + 6) + '" text-anchor="middle" font-size="17" font-weight="800" fill="#fff" stroke="rgba(0,0,0,.65)" stroke-width="4" paint-order="stroke" pointer-events="none" opacity="' + (dim ? .25 : 1) + '">' + r.code + "</text>";
      }
    });

    if (heat) {
      this.wifi.filter(function (w) { return w.floor === f.id; }).forEach(function (w) {
        h += '<g data-code="wf:' + w.id + '" style="cursor:pointer"><circle cx="' + w.x + '" cy="' + w.y + '" r="22" fill="transparent"/><circle cx="' + w.x + '" cy="' + w.y + '" r="6" fill="#fff" stroke="rgba(0,0,0,.6)" stroke-width="2"/></g>';
        h += '<text class="heat-tag" x="' + w.x + '" y="' + (w.y + 30) + '">' + w.mbps + "</text>";
      });
      /* AP / hall points have no room code: give them a tooltip hit-area */
    }

    /* issue pins */
    if (this.pins) {
      Object.keys(this.openIssues).forEach(function (k) {
        var p = k.split(":"); if (p[0] !== f.id) return;
        var geo = f.rooms.filter(function (r) { return r.code === p[1]; })[0]; if (!geo) return;
        var n = self.openIssues[k].length, x = geo.cx, y = geo.cy - 26;
        h += '<g class="pin" data-code="' + geo.code + '"><circle class="ring" cx="' + x + '" cy="' + y + '" r="14"/><circle cx="' + x + '" cy="' + y + '" r="15" fill="#ef4444" stroke="#fff" stroke-width="3"/><text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" font-size="17" font-weight="800" fill="#fff" pointer-events="none">' + (n > 1 ? n : "!") + "</text></g>";
      });
    }

    /* meetup highlight */
    if (this.hl) {
      var A = this.hl.a && this.hl.a.floor === f.id ? this._pt(this.hl.a.room) : null;
      var B = this.hl.b && this.hl.b.floor === f.id ? this._pt(this.hl.b.room) : null;
      if (A && B) h += '<line x1="' + A.cx + '" y1="' + A.cy + '" x2="' + B.cx + '" y2="' + B.cy + '" stroke="#fb9746" stroke-width="5" stroke-dasharray="14 10" stroke-linecap="round" pointer-events="none"/>';
      [[A, this.hl.a && this.hl.a.label || "YOU"], [B, this.hl.b && this.hl.b.label || "THEM"]].forEach(function (p) {
        if (!p[0]) return;
        h += '<g pointer-events="none"><circle cx="' + p[0].cx + '" cy="' + p[0].cy + '" r="22" fill="none" stroke="#fb9746" stroke-width="5"/><rect x="' + (p[0].cx - 30) + '" y="' + (p[0].cy - 58) + '" width="60" height="24" rx="12" fill="#fb9746"/><text x="' + p[0].cx + '" y="' + (p[0].cy - 41) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#1a0f05">' + p[1] + "</text></g>";
      });
    }
    this.svg.innerHTML = h;
  };
  P._pt = function (code) { return this._geo(code); };

  window.FloorMap = FloorMap;
})();
