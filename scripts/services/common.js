/* Shared helpers: theme, escaping, toasts, time formatting, status styling, map route links, mobile drawer */
(function () {
  var THEME_KEY = "techops_theme";

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var label = t === "dark" ? "Light" : "Dark";
    var b = document.getElementById("theme-toggle");
    if (b && b.querySelector(".btn-text")) b.querySelector(".btn-text").textContent = label;
    var mb = document.getElementById("mobile-theme-text");
    if (mb) mb.textContent = label;
  }
  function toggleTheme() {
    var n = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, n); localStorage.setItem("nasa_theme", n); } catch (e) {}
    applyTheme(n);
    document.dispatchEvent(new CustomEvent("techops-theme"));
  }
  function initTheme() {
    var t = "dark";
    try { t = localStorage.getItem(THEME_KEY) || localStorage.getItem("nasa_theme") || "dark"; } catch (e) {}
    applyTheme(t);
    var b = document.getElementById("theme-toggle");
    if (b) b.addEventListener("click", toggleTheme);
    var mb = document.getElementById("mobile-theme-toggle");
    if (mb) mb.addEventListener("click", toggleTheme);
  }

  function toast(title, body, kind, onClick, ms) {
    var box = document.getElementById("toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; box.className = "toasts"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    var t = document.createElement("div");
    t.className = "toast " + (kind || "");
    t.innerHTML = "<b>" + esc(title) + "</b><span>" + esc(body || "") + "</span>";
    function close() { if (t.parentNode) t.parentNode.removeChild(t); }
    t.addEventListener("click", function () { if (onClick) onClick(); close(); });
    box.appendChild(t);
    setTimeout(close, ms || 7000);
  }

  var audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.frequency.setValueAtTime(660, audioCtx.currentTime + 0.12); o.stop(audioCtx.currentTime + 0.26);
    } catch (e) {}
  }

  function ago(d) {
    if (!d) return "";
    var s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return Math.floor(s / 86400) + " d ago";
  }
  function statusClass(s) {
    return { "New": "b-new", "Acknowledged": "b-ack", "In progress": "b-prog", "In Progress": "b-prog", "Resolved": "b-done" }[s] || "b-other";
  }
  function issueClass(i) {
    i = String(i || "").toLowerCase();
    if (i.indexOf("internet") >= 0 || i.indexOf("wi-fi") >= 0) return "b-net";
    if (i.indexOf("power") >= 0 || i.indexOf("electric") >= 0) return "b-power";
    if (i.indexOf("assist") >= 0) return "b-help";
    if (i.indexOf("go to") >= 0) return "b-net";
    if (i.indexOf("prayer") >= 0) return "b-power";
    if (i.indexOf("help request") >= 0) return "b-help";
    if (i.indexOf("discord") >= 0 || i.indexOf("submission") >= 0 || i.indexOf("competition") >= 0) return "b-help";
    return "b-other";
  }
  function initials(n) {
    var p = String(n).replace(/^eng\.?\s*/i, "").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
  }
  function speedColor(m) {
    var S = [[5, [255, 45, 45]], [15, [255, 122, 26]], [28, [255, 210, 63]], [45, [183, 227, 74]], [70, [34, 224, 122]]];
    if (m <= S[0][0]) return "rgb(" + S[0][1].join(",") + ")";
    for (var i = 1; i < S.length; i++) {
      if (m <= S[i][0]) {
        var a = S[i - 1], b = S[i], t = (m - a[0]) / (b[0] - a[0]);
        return "rgb(" + a[1].map(function (v, k) { return Math.round(v + (b[1][k] - v) * t); }).join(",") + ")";
      }
    }
    return "rgb(" + S[S.length - 1][1].join(",") + ")";
  }
  function speedLabel(m) { return m >= 45 ? "Good" : m >= 28 ? "Fair" : m >= 15 ? "Weak" : "Poor"; }
  function qrSvg(text, cell) {
    var qr = qrcode(0, "M"); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: cell || 4, margin: (cell || 4) * 2 });
  }
  function baseUrl() {
    var cfg = window.TECHOPS_CONFIG.PUBLIC_BASE_URL;
    var saved = ""; try { saved = localStorage.getItem("techops_base_url") || ""; } catch (e) {}
    var b = saved || cfg || (location.origin + location.pathname.replace(/[^\/]*$/, ""));
    return b.replace(/\/?$/, "/");
  }
  function reportUrl(floor, room) {
    var cfg = (window.TECHOPS_CONFIG || {}).REQUEST_BASE_URL;
    var b = (cfg || (location.origin + location.pathname.replace(/[^\/]*$/, "") + "../request/")).replace(/\/?$/, "/");
    return b + "form.html?floor=" + encodeURIComponent(floor) + "&room=" + encodeURIComponent(room);
  }

  /* Resolve optimal { from, to } map routing endpoints for any volunteer request */
  function routeTarget(r) {
    if (!r || !r.room) return null;
    var rm = String(r.room || "").trim().toUpperCase();
    if (!rm) return null;
    var details = String(r.details || "");
    var issue = String(r.issue || "");

    /* "Go to a place" request: route from participant's current room to their chosen destination */
    var placeMatch = details.match(/Wants to go to:\s*(Main Entrance|[A-Z0-9_-]+)/i);
    if (placeMatch) {
      var rawDest = placeMatch[1].trim().toUpperCase();
      var dest = rawDest === "MAIN ENTRANCE" ? "ENTRANCE" : rawDest;
      if (dest && dest !== rm) return { from: rm, to: dest };
    }

    /* "Prayer" request: route from participant's current room to Men's (PR-M) or Women's (PR-F) Prayer Room */
    var prayerMatch = details.match(/Prayer area:\s*(Men|Women)/i);
    if (prayerMatch || /prayer/i.test(issue)) {
      var gender = prayerMatch ? prayerMatch[1].toLowerCase() : (/women|female/i.test(details) ? "women" : "men");
      var prCode = gender === "women" ? "PR-F" : "PR-M";
      if (prCode !== rm) return { from: rm, to: prCode };
    }

    /* Standard room assistance request: route from ENTRANCE to the participant's room */
    return { from: rm === "ENTRANCE" ? "C026" : "ENTRANCE", to: rm };
  }

  function routeHref(r, mapsPage) {
    var rt = routeTarget(r);
    if (!rt) return "";
    var base = mapsPage || "../maps.html";
    return base + "?from=" + encodeURIComponent(rt.from) + "&to=" + encodeURIComponent(rt.to);
  }

  function bindMobileDrawer() {
    var mToggle = document.getElementById("mobile-menu-toggle");
    var mDrawer = document.getElementById("mobile-drawer");
    var mClose = document.getElementById("mobile-menu-close");
    if (!mToggle || !mDrawer || mToggle.__bound) return;
    mToggle.__bound = true;
    function setDrawer(open) {
      mDrawer.hidden = !open;
      mToggle.setAttribute("aria-expanded", String(open));
      mToggle.classList.toggle("is-open", open);
    }
    mToggle.onclick = function (e) {
      e.stopPropagation();
      setDrawer(mDrawer.hidden);
    };
    if (mClose) {
      mClose.onclick = function (e) {
        e.stopPropagation();
        setDrawer(false);
      };
    }
    mDrawer.addEventListener("click", function (e) {
      if (e.target === mDrawer) setDrawer(false);
    });
    document.addEventListener("click", function (e) {
      if (!mDrawer.hidden && !mDrawer.contains(e.target) && !mToggle.contains(e.target)) {
        setDrawer(false);
      }
    });
    mDrawer.querySelectorAll("a, button:not(#mobile-alerts-btn):not(#mobile-theme-toggle)").forEach(function (el) {
      el.addEventListener("click", function () {
        setDrawer(false);
      });
    });
  }

  window.TO = {
    esc: esc, initTheme: initTheme, toast: toast, beep: beep, ago: ago, statusClass: statusClass, issueClass: issueClass,
    initials: initials, speedColor: speedColor, speedLabel: speedLabel, qrSvg: qrSvg, baseUrl: baseUrl, reportUrl: reportUrl,
    routeTarget: routeTarget, routeHref: routeHref, bindMobileDrawer: bindMobileDrawer
  };
})();
