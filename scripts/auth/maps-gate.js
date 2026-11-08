/* Code gate & unified header session controller for Venue Maps.
 * Any valid volunteer code opens Maps (common volunteer code or any Logistics / Competition / Tech Ops code).
 * If the volunteer is already authenticated in this browser tab, Maps unlocks synchronously in 0ms with zero gate flash. */
(function () {
  var Store = window.TechOpsStore;
  var $ = function (id) { return document.getElementById(id); };
  if (!Store) return;

  var unlocked = false;
  window.MapsGate = { isUnlocked: function () { return unlocked; } };

  function initials(name) {
    if (window.TO && TO.initials) return TO.initials(name);
    var p = String(name || "").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
  }

  function renderHeaderUser(user) {
    var chip = $("user-chip");
    var wsBtn = $("team-workspace-btn");
    var wsLbl = $("team-workspace-label");
    var mWsBtn = $("mobile-team-workspace-btn");
    if (!user) {
      if (chip) chip.hidden = true;
      if (wsBtn) wsBtn.hidden = true;
      if (mWsBtn) mWsBtn.hidden = true;
      return;
    }
    var teamSub = Store.teamDisplayName(user) + " · " + user.code;
    var ini = initials(user.name);
    if (chip) {
      chip.hidden = false;
      if ($("user-name")) $("user-name").textContent = user.name;
      if ($("user-team")) $("user-team").textContent = teamSub;
      if ($("user-avatar")) $("user-avatar").textContent = ini;
    }
    if ($("mobile-user-name")) $("mobile-user-name").textContent = user.name;
    if ($("mobile-user-team")) $("mobile-user-team").textContent = teamSub;
    if ($("mobile-user-avatar")) $("mobile-user-avatar").textContent = ini;
    var ws = Store.workspaceFor ? Store.workspaceFor(user) : null;
    if (wsBtn && wsLbl) {
      if (ws) {
        wsBtn.href = ws.path;
        wsLbl.textContent = ws.label;
        wsBtn.hidden = false;
      } else {
        wsBtn.hidden = true;
      }
    }
    if (mWsBtn) {
      if (ws) {
        mWsBtn.href = ws.path;
        mWsBtn.textContent = ws.label;
        mWsBtn.hidden = false;
      } else {
        mWsBtn.hidden = true;
      }
    }
  }

  function unlock(user) {
    var wasUnlocked = unlocked;
    unlocked = true;
    if ($("gate")) $("gate").hidden = true;
    document.body.classList.remove("locked");
    renderHeaderUser(user || Store.currentUser());
    if (!wasUnlocked) {
      document.dispatchEvent(new Event("maps:unlocked"));
    }
  }

  function lock() {
    unlocked = false;
    renderHeaderUser(null);
    if ($("gate")) $("gate").hidden = false;
    document.body.classList.add("locked");
    if ($("gate-code")) {
      $("gate-code").value = "";
      setTimeout(function () { try { $("gate-code").focus(); } catch (e) {} }, 80);
    }
  }

  function showErr(m) {
    var e = $("gate-err");
    if (!e) return;
    e.textContent = m || "";
    e.hidden = !m;
  }

  if ($("gate-form")) {
    $("gate-form").onsubmit = function (ev) {
      ev.preventDefault();
      var code = ($("gate-code").value || "").trim();
      if (!code) { showErr("Please enter your volunteer code."); return; }
      var btn = $("gate-btn");
      btn.disabled = true;
      btn.textContent = "Checking…";
      showErr("");
      Store.login(code).then(function (u) {
        btn.disabled = false;
        btn.textContent = "Open Maps";
        if (!Store.canAccess(u, "maps")) {
          showErr("Tech Ops has its own built-in Floor Maps & Routing inside the Tech Ops workspace.");
          return;
        }
        unlock(u);
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = "Open Maps";
        showErr(err && err.message ? err.message : "That code was not recognised.");
      });
    };
  }

  function doSignout() {
    var drawer = $("mobile-drawer");
    if (drawer) drawer.hidden = true;
    Store.logout().then(function () {
      lock();
    });
  }

  if ($("maps-signout")) {
    $("maps-signout").onclick = doSignout;
  }
  if ($("mobile-signout-btn")) {
    $("mobile-signout-btn").onclick = doSignout;
  }

  /* Mobile drawer wiring */
  var mToggle = $("mobile-menu-toggle");
  var mClose = $("mobile-menu-close");
  var mDrawer = $("mobile-drawer");
  function closeDrawer() {
    if (mDrawer) mDrawer.hidden = true;
    if (mToggle) mToggle.setAttribute("aria-expanded", "false");
  }
  if (mToggle && mDrawer) {
    mToggle.onclick = function () {
      var open = mDrawer.hidden;
      mDrawer.hidden = !open;
      mToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    mDrawer.onclick = function (e) {
      if (e.target === mDrawer) closeDrawer();
    };
  }
  if (mClose) mClose.onclick = closeDrawer;
  if ($("mobile-dir-btn")) {
    $("mobile-dir-btn").onclick = function () {
      closeDrawer();
      if ($("dirb")) $("dirb").click();
    };
  }
  if ($("mobile-theme-btn")) {
    $("mobile-theme-btn").onclick = function () {
      if ($("theme-toggle")) $("theme-toggle").click();
    };
  }

  /* 0ms synchronous fast-path for active volunteer sessions: prevents any gate prompt flash */
  var cachedUser = Store.peekUser ? Store.peekUser() : null;
  if (cachedUser) {
    if (Store.canAccess(cachedUser, "maps")) {
      unlock(cachedUser);
    } else {
      lock();
      showErr("Tech Ops has its own built-in Floor Maps & Routing inside the Tech Ops workspace.");
    }
  }

  Store.restore().then(function (user) {
    if (user) {
      if (Store.canAccess(user, "maps")) unlock(user);
      else {
        lock();
        showErr("Tech Ops has its own built-in Floor Maps & Routing inside the Tech Ops workspace.");
      }
    } else if (!unlocked) lock();
  }, function () {
    if (!unlocked) lock();
  });
})();
