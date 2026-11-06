/* Shared helpers: theme, escaping, toasts, time formatting, status styling */
(function () {
  var THEME_KEY = "techops_theme";

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var b = document.getElementById("theme-toggle");
    if (b && b.querySelector(".btn-text")) b.querySelector(".btn-text").textContent = t === "dark" ? "Light" : "Dark";
    var mb = document.getElementById("mobile-theme-text");
    if (mb) mb.textContent = t === "dark" ? "Light Mode" : "Dark Mode";
  }
  function toggleTheme() {
    var n = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, n); } catch (e) {}
    applyTheme(n);
    document.dispatchEvent(new CustomEvent("techops-theme"));
  }
  function initTheme() {
    var t = "dark";
    try { t = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) {}
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
    return baseUrl() + "report.html?floor=" + encodeURIComponent(floor) + "&room=" + encodeURIComponent(room);
  }

  window.TO = {
    esc: esc, initTheme: initTheme, toast: toast, beep: beep, ago: ago, statusClass: statusClass, issueClass: issueClass,
    initials: initials, speedColor: speedColor, speedLabel: speedLabel, qrSvg: qrSvg, baseUrl: baseUrl, reportUrl: reportUrl
  };
})();
