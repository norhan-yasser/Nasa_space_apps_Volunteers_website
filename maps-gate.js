/* Code gate for the Venue Maps page.
 * Any valid volunteer code opens it (the common code, or a Logistics / Tech Ops code).
 * Codes live in the Firestore `volunteers` collection, so the common code can be changed without editing this site. */
(function () {
  var Store = window.TechOpsStore;
  var $ = function (id) { return document.getElementById(id); };
  if (!Store) return;

  var unlocked = false;
  window.MapsGate = { isUnlocked: function () { return unlocked; } };
  function unlock() {
    unlocked = true;
    $("gate").hidden = true;
    document.body.classList.remove("locked");
    $("maps-signout").hidden = false;
    document.dispatchEvent(new Event("maps:unlocked"));   /* map data is only fetched after this */
  }
  function lock() {
    if (unlocked) { location.reload(); return; }          /* drop anything that was already loaded */
    $("gate").hidden = false;
    document.body.classList.add("locked");
    $("maps-signout").hidden = true;
    $("gate-code").value = "";
    setTimeout(function () { $("gate-code").focus(); }, 100);
  }
  function showErr(m) { var e = $("gate-err"); e.textContent = m || ""; e.hidden = !m; }

  $("gate-form").onsubmit = function (ev) {
    ev.preventDefault();
    var code = ($("gate-code").value || "").trim();
    if (!code) { showErr("Please enter the volunteer code."); return; }
    var btn = $("gate-btn"); btn.disabled = true; btn.textContent = "Checking…"; showErr("");
    Store.login(code).then(function () {
      btn.disabled = false; btn.textContent = "Open Maps"; unlock();
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = "Open Maps";
      showErr(err && err.message ? err.message : "That code was not recognised.");
    });
  };
  $("maps-signout").onclick = function () { Store.logout().then(lock); };

  Store.restore().then(function (user) { if (user) unlock(); else lock(); }, lock);
})();
