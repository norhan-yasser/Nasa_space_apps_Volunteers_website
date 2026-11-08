/* Participant QR poster: ONE QR code for the whole venue -> request/form.html. Volunteers only (needs a volunteer code). */
(function () {
  var Store = window.TechOpsStore;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "request_base_url";
  TO.initTheme();

  function defaultBase() {
    var cfg = (window.TECHOPS_CONFIG || {}).REQUEST_BASE_URL;
    return (cfg || (location.origin + location.pathname.replace(/[^\/]*$/, ""))).replace(/\/?$/, "/");
  }
  function savedBase() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function currentBase() { return ($("base").value.trim() || defaultBase()).replace(/\/?$/, "/"); }
  function url() { return currentBase() + "form.html"; }
  function draw() { $("qr-box").innerHTML = TO.qrSvg(url(), 6); }

  function show() {
    $("gate").hidden = true; $("main").hidden = false;
    $("base").value = savedBase() || defaultBase();
    $("save-base").onclick = function () { try { localStorage.setItem(KEY, $("base").value.trim()); } catch (e) {} draw(); TO.toast("Saved", "Updated the QR code address.", "ok"); };
    $("reset-base").onclick = function () { try { localStorage.removeItem(KEY); } catch (e) {} $("base").value = defaultBase(); draw(); TO.toast("Reset", "Restored the default address.", "ok"); };
    $("copy-link").onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(url()).then(function () { TO.toast("Copied!", "Participant link copied.", "ok"); });
      else prompt("Copy the participant link:", url());
    };
    $("print-hero").onclick = function () { window.print(); };
    draw();
  }
  function err(m) { var e = $("gate-err"); e.textContent = m || ""; e.hidden = !m; }

  $("gate-form").onsubmit = function (ev) {
    ev.preventDefault();
    var code = $("gate-code").value.trim();
    if (!code) return err("Please enter your volunteer code.");
    var b = $("gate-btn"); b.disabled = true; b.textContent = "Checking…"; err("");
    Store.login(code).then(function () { b.disabled = false; b.textContent = "Open"; show(); })
      .catch(function (e) { b.disabled = false; b.textContent = "Open"; err(e && e.message ? e.message : "That code was not recognised."); });
  };
  var fast = Store.peekUser ? Store.peekUser() : null;
  if (fast) show();
  else Store.restore().then(function (u) {
    if (u) show();
    else { $("gate").hidden = false; setTimeout(function () { $("gate-code").focus(); }, 100); }
  }, function () { $("gate").hidden = false; });
})();
