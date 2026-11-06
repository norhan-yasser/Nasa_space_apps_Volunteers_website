/**
 * Operations Root Portal Gateway
 * Manages role-based routing from the start page:
 * - TechOps: redirects to techops/index.html
 * - Logistics: redirects to logistics.html
 * - Admin: opens the Admin Master Command Center with monitor metrics & cross-dashboard launch
 */
(function () {
  var Store = window.TechOpsStore, D = window.TechOpsData;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  var S = { user: null, allData: null };

  function initTheme() {
    var saved = localStorage.getItem("techops_theme") || localStorage.getItem("nasa_theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    var tb = $("theme-toggle");
    if (tb) {
      tb.onclick = function () {
        var cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
        var next = cur === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("techops_theme", next);
          localStorage.setItem("nasa_theme", next);
        } catch (e) {}
      };
    }
  }

  function showErr(msg) {
    var el = $("portal-err");
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function renderRoster(filterText) {
    var tbody = $("roster-rows");
    if (!tbody) return;
    var vols = (window.TECHOPS_SEED && window.TECHOPS_SEED.volunteers) || {};
    var q = (filterText || "").toLowerCase().trim();
    var list = Object.keys(vols).map(function (k) { return vols[k]; });
    var rows = list.filter(function (v) {
      return !q || (v.Name + " " + v["Volunteer Code"] + " " + v.Team).toLowerCase().indexOf(q) >= 0;
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:14px;color:var(--mut)">No volunteers match search.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (v) {
      var code = v["Volunteer Code"], team = v.Team;
      var teamClass = team === "TechOps" ? "b-tech" : team === "Logistics" ? "b-log" : "b-adm";
      return '<tr>' +
        '<td><b><code>' + esc(code) + '</code></b></td>' +
        '<td>' + esc(v.Name) + '</td>' +
        '<td><span class="portal-badge ' + teamClass + '">' + esc(team) + '</span></td>' +
        '<td><button type="button" class="portal-btn-sm" data-code="' + esc(code) + '">Sign in</button></td>' +
        '</tr>';
    }).join("");
  }

  function renderAdminStats(data) {
    if (!data) return;
    var reports = data.reports || [];
    var unassigned = reports.filter(function (r) { return r.status !== "Resolved" && !r.assigned; }).length;
    var inProg = reports.filter(function (r) { return r.status === "In Progress" || r.status === "Acknowledged"; }).length;
    var resolved = reports.filter(function (r) { return r.status === "Resolved"; }).length;

    var statIssues = $("stat-issues");
    var statIssuesSub = $("stat-issues-sub");
    if (statIssues) statIssues.textContent = unassigned + inProg;
    if (statIssuesSub) statIssuesSub.textContent = unassigned + " unassigned · " + inProg + " in progress · " + resolved + " done";

    var wifi = data.wifi || [];
    var avgSpeed = wifi.length ? Math.round(wifi.reduce(function (a, b) { return a + (b.mbps || 0); }, 0) / wifi.length) : 0;
    var statWifi = $("stat-wifi");
    var statWifiSub = $("stat-wifi-sub");
    if (statWifi) statWifi.textContent = avgSpeed + " Mbps";
    if (statWifiSub) statWifiSub.textContent = wifi.length + " room points · Good coverage";

    var statRooms = $("stat-rooms");
    if (statRooms) statRooms.textContent = data.rooms ? data.rooms.length : 60;
  }

  function applyUser(user, autoRedirect) {
    S.user = user;
    var loginBox = $("login-box");
    var userBox = $("user-box");
    var adminBox = $("admin-box");
    var userChip = $("portal-user-chip");

    if (!user) {
      if (loginBox) loginBox.hidden = false;
      if (userBox) userBox.hidden = true;
      if (adminBox) adminBox.hidden = true;
      if (userChip) userChip.hidden = true;
      return;
    }

    /* Update user chip */
    if (userChip) {
      userChip.hidden = false;
      if ($("portal-name")) $("portal-name").textContent = user.name;
      if ($("portal-role")) $("portal-role").textContent = user.team + " · " + user.code;
      if ($("portal-avatar")) $("portal-avatar").textContent = (user.name || "?").slice(0, 2).toUpperCase();
    }

    var isTech = user.team === "TechOps";
    var isLog = user.team === "Logistics";
    var isAdmin = user.team === "Admin" || user.role === "Admin" || user.code === "ADMIN" || user.code === "ADM-001";

    if (isAdmin) {
      if (loginBox) loginBox.hidden = true;
      if (userBox) userBox.hidden = true;
      if (adminBox) adminBox.hidden = false;
      if ($("admin-greeting")) {
        $("admin-greeting").textContent = "Welcome, " + user.name + " (" + user.code + "). You have full administrative oversight across venue logistics, technical operations, and volunteer communications.";
      }
      Store.start().then(function () {
        return Store.loadAll();
      }).then(function (data) {
        S.allData = data;
        renderAdminStats(data);
        renderRoster("");
      });
      return;
    }

    /* If regular volunteer signed in freshly, immediately redirect to their target workspace */
    if (autoRedirect) {
      if (isTech) {
        location.href = "techops/index.html";
        return;
      }
      if (isLog) {
        location.href = "logistics.html";
        return;
      }
    }

    /* Otherwise show welcome card */
    if (loginBox) loginBox.hidden = true;
    if (userBox) userBox.hidden = false;
    if (adminBox) adminBox.hidden = true;

    if ($("welcome-heading")) $("welcome-heading").textContent = "Welcome, " + user.name;
    if ($("welcome-sub")) $("welcome-sub").textContent = "You are authenticated with volunteer code " + user.code + " (" + user.team + " Team).";

    var lb = $("launch-btn");
    if (lb) {
      if (isTech) {
        lb.href = "techops/index.html";
        lb.textContent = "🚀 Enter TechOps Dashboard →";
      } else if (isLog) {
        lb.href = "logistics.html";
        lb.textContent = "📍 Enter Logistics Dashboard →";
      }
    }
  }

  function doLogin(code) {
    code = (code || "").trim().toUpperCase();
    if (!code) {
      showErr("Please enter your volunteer code (e.g. TO-001, LG-001, or ADM-001).");
      return;
    }
    showErr("");
    var btn = $("portal-submit-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Verifying…"; }

    Store.login(code).then(function (user) {
      if (btn) { btn.disabled = false; btn.textContent = "Sign in →"; }
      applyUser(user, true);
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = "Sign in →"; }
      showErr(err && err.message ? err.message : "Volunteer code not found. Check your code and try again.");
    });
  }

  function doLogout() {
    Store.logout().then(function () {
      applyUser(null, false);
      var inp = $("portal-code");
      if (inp) { inp.value = ""; inp.focus(); }
    });
  }

  function bind() {
    initTheme();

    var lf = $("portal-login-form");
    if (lf) {
      lf.onsubmit = function (e) {
        e.preventDefault();
        doLogin($("portal-code").value);
      };
    }

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-code]");
      if (btn) {
        var code = btn.dataset.code;
        if ($("portal-code")) $("portal-code").value = code;
        doLogin(code);
      }
    });

    if ($("portal-logout-btn")) $("portal-logout-btn").onclick = doLogout;
    if ($("switch-btn")) $("switch-btn").onclick = doLogout;
    if ($("admin-logout-btn")) $("admin-logout-btn").onclick = doLogout;

    var rs = $("roster-search");
    if (rs) {
      rs.oninput = function () {
        renderRoster(this.value);
      };
    }

    Store.restore().then(function (user) {
      applyUser(user, false);
    });
  }

  bind();
})();
