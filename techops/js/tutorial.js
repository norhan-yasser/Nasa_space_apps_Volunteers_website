/**
 * NASA Space Apps Cairo - Guided Onboarding (Tutorial Mode)
 * Tailored 4 Role-Based Mission Briefings: TechOps, Logistics, Competition, Maps.
 * Loads isolated sandbox dummy data during tour; clicking "Finish Tutorial & Start Working"
 * updates the completion flag, clears dummy state, and restores live data.
 * Professional tone, seamless map panel integration, zero visual noise.
 */
(function () {
  var Store = window.TechOpsStore, TO = window.TO;

  var FLOWS = {
    techops: [
      {
        target: "#status-pill",
        title: "Tech Ops Command Center",
        desc: "Welcome to Tech Ops. You monitor portal connectivity, Wi-Fi health, power lines, and technical help tickets in real time.",
        badge: "Mission Briefing · Step 1/5",
        sandboxText: "Sandbox Training Active"
      },
      {
        target: "#issue-filters",
        title: "Technical Ticket Queue",
        desc: "Filter tickets between Unclaimed, Mine, or Done. Real-time notifications and audio alerts trigger whenever a participant reports an issue.",
        badge: "Mission Briefing · Step 2/5",
        sandboxText: "Practice Filtering"
      },
      {
        target: "#issue-rows .req-card:first-child",
        fallbackTarget: "#issue-rows",
        title: "Practice Ticket & Claiming",
        desc: "This is a safe training ticket. Click 'Claim' to assign it to yourself, or 'Show Route' to see the exact walking route to the problem room.",
        badge: "Mission Briefing · Step 3/5",
        sandboxText: "Interactive Practice"
      },
      {
        target: "#map",
        fallbackTarget: "#floor-seg",
        title: "Interactive Floor Maps & Routes",
        desc: "Tech Ops includes built-in multi-floor blueprints, Wi-Fi heatmap diagnostics, and stairwell navigation. Switch floors or click on rooms to inspect details.",
        badge: "Mission Briefing · Step 4/5",
        sandboxText: "Diagnostic Wayfinding",
        onEnter: function () {
          if (typeof window.setTab === "function") {
            window.setTab("maps");
          } else {
            var b = document.querySelector(".tabs [data-tab='maps'], .mobile-nav [data-tab='maps'], [data-tab='maps']");
            if (b) b.click();
          }
        },
        onLeave: function () {
          if (typeof window.setTab === "function") {
            window.setTab("issues");
          } else {
            var b = document.querySelector(".tabs [data-tab='issues'], .mobile-nav [data-tab='issues'], [data-tab='issues']");
            if (b) b.click();
          }
        }
      },
      {
        target: null,
        title: "Mission Training Complete",
        desc: "You have completed Tech Ops training and are ready for live operations on the ground at NASA Space Apps Cairo.",
        badge: "Training Certified",
        isFinish: true
      }
    ],

    logistics: [
      {
        target: "#status-pill",
        title: "Logistics Operations Command",
        desc: "Welcome to Logistics. You coordinate participant guidance, prayer rooms, supply distribution, and badge replacements across all floors.",
        badge: "Mission Briefing · Step 1/4",
        sandboxText: "Sandbox Training Active"
      },
      {
        target: "[data-if='unassigned']",
        fallbackTarget: ".chips-scroll-row",
        title: "Unclaimed Participant Requests",
        desc: "Keep this tab open to catch new incoming requests. Audio alerts notify your team as soon as a participant submits a help ticket.",
        badge: "Mission Briefing · Step 2/4",
        sandboxText: "Queue Management"
      },
      {
        target: null,
        title: "Venue Route Navigation",
        desc: "Tap 'Show Route' on any ticket to view the floor blueprint and exact walking path from the operations desk to the participant's room.",
        badge: "Mission Briefing · Step 3/4",
        sandboxText: "Interactive Practice",
        mapPreview: {
          room: "B231",
          floor: "S",
          label: "Room B231 · Second Floor"
        }
      },
      {
        target: null,
        title: "Logistics Training Complete",
        desc: "You are prepared to assist participants and keep operations flowing smoothly throughout the venue.",
        badge: "Training Certified",
        isFinish: true
      }
    ],

    competition: [
      {
        target: "header.top",
        title: "Competition Team Monitor",
        desc: "Welcome to the Competition Desk. You manage participant challenge inquiries, judging schedules, submission troubleshooting, and Discord queries.",
        badge: "Mission Briefing · Step 1/4",
        sandboxText: "Sandbox Training Active"
      },
      {
        target: "#cards .req-card:first-child",
        fallbackTarget: "#cards",
        title: "Discord & Remote Inquiries",
        desc: "Inquiries tagged [Remote] are handled online. Use 'Copy for Discord' to format prompt, professional replies to participants on the server.",
        badge: "Mission Briefing · Step 2/4",
        sandboxText: "Remote Escalations"
      },
      {
        target: null,
        title: "Venue Route Guidance",
        desc: "When a participant inquiry requires physical guidance or runner dispatch, tap 'Show Route' on the ticket to inspect the floor blueprint, stairwells, and room directions.",
        badge: "Mission Briefing · Step 3/4",
        sandboxText: "Field Navigation",
        mapPreview: {
          room: "B130",
          floor: "F",
          label: "Room B130 · First Floor"
        }
      },
      {
        target: null,
        title: "Competition Desk Certified",
        desc: "You are prepared to lead participant communications and challenge monitoring. Exit the sandbox to enter live mode.",
        badge: "Training Certified",
        isFinish: true
      }
    ],

    maps: [
      {
        target: "#map",
        title: "Campus Blueprints & Zones",
        desc: "Explore detailed multi-floor blueprints for Basement, Ground, First, and Second floors. Tap or pinch to zoom and inspect any room.",
        badge: "Mission Briefing · Step 1/4",
        sandboxText: "Interactive Blueprint"
      },
      {
        target: ".floor-switcher",
        fallbackTarget: ".map-toolbar",
        title: "Multi-Floor Switcher",
        desc: "Tap Basement, Ground Floor, First Floor, or Second Floor to instantly switch blueprint views.",
        badge: "Mission Briefing · Step 2/4",
        sandboxText: "Floor Navigation"
      },
      {
        target: "#map-filter-panel",
        fallbackTarget: "#filter-toggle",
        title: "Room & Zone Filters",
        desc: "Select categories to filter rooms across participants, mentors, judges, VIPs, or rest zones.",
        badge: "Mission Briefing · Step 3/4",
        sandboxText: "Zone Diagnostics",
        onEnter: function () {
          var p = document.getElementById("map-filter-panel");
          if (p) p.classList.add("is-open");
        },
        onLeave: function () {
          var p = document.getElementById("map-filter-panel");
          if (p) p.classList.remove("is-open");
        }
      },
      {
        target: null,
        title: "Venue Navigation Certified",
        desc: "You have mastered venue navigation and can guide anyone to any room or staircase across the entire campus.",
        badge: "Training Certified",
        isFinish: true
      }
    ]
  };

  function NasaTutorial() {
    this.role = null;
    this.currentStep = 0;
    this.steps = [];
    this.overlayEl = null;
    this.spotlightEl = null;
    this.cardEl = null;
    this.bannerEl = null;
    this.activeTarget = null;
    this.onFinishCallback = null;
    this._onResize = this._reposition.bind(this);
  }

  var P = NasaTutorial.prototype;

  P.init = function (role, onFinish) {
    this.role = role || "techops";
    this.steps = FLOWS[this.role] || FLOWS.techops;
    this.currentStep = 0;
    this.onFinishCallback = onFinish;
  };

  P.start = function (role, onFinish) {
    // Unconditionally close mobile drawer and route map panel
    var drawer = document.getElementById("mobile-drawer");
    if (drawer) drawer.hidden = true;
    var toggle = document.getElementById("mobile-menu-toggle") || document.getElementById("mobile-menu-btn");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (window.RouteMapPanel) window.RouteMapPanel.close();

    this.init(role, onFinish);
    this._buildDOM();
    this._showStep(0);
    window.addEventListener("resize", this._onResize);
    window.addEventListener("scroll", this._onResize, true);
  };

  P._buildDOM = function () {
    this.destroy();

    var overlay = document.createElement("div");
    overlay.id = "nasa-tutorial-overlay";
    overlay.className = "tutorial-overlay";
    overlay.innerHTML =
      '<div class="tutorial-backdrop"></div>' +
      '<div class="tutorial-spotlight"></div>' +
      '<div class="tutorial-card" role="dialog" aria-modal="true" aria-label="Interactive Tutorial"></div>';

    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.backdropEl = overlay.querySelector(".tutorial-backdrop");
    this.spotlightEl = overlay.querySelector(".tutorial-spotlight");
    this.cardEl = overlay.querySelector(".tutorial-card");

    this._renderBanner();
  };

  P._renderBanner = function () {
    if (document.getElementById("sandbox-mode-banner") || document.getElementById("sandbox-banner")) return;
    var banner = document.createElement("div");
    banner.id = "sandbox-mode-banner";
    banner.className = "sandbox-mode-banner";
    banner.innerHTML =
      '<span><b>TRAINING SANDBOX MODE</b> — Interacting with practice dummy data.</span>' +
      '<button class="sandbox-mode-exit-btn" id="sandbox-exit-btn" type="button">Finish Training</button>';

    var header = document.querySelector("header.top, header.portal-top, header");
    if (header && header.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    this.bannerEl = banner;

    var self = this;
    banner.querySelector("#sandbox-exit-btn").addEventListener("click", function () {
      self.finish();
    });
  };

  P._showStep = function (index) {
    if (index < 0) index = 0;
    if (index >= this.steps.length) {
      this.finish();
      return;
    }

    if (this.steps[this.currentStep] && typeof this.steps[this.currentStep].onLeave === "function" && this.currentStep !== index) {
      try { this.steps[this.currentStep].onLeave(); } catch (e) {}
    }

    this.currentStep = index;
    var step = this.steps[index];

    if (this.activeTarget) {
      this.activeTarget.classList.remove("tutorial-target-active");
      this.activeTarget = null;
    }

    if (typeof step.onEnter === "function") {
      try { step.onEnter(); } catch (e) {}
    }

    var target = null;
    if (step.target) {
      target = document.querySelector(step.target);
      if (!target && step.fallbackTarget) {
        target = document.querySelector(step.fallbackTarget);
      }
    }

    var dots = "";
    for (var i = 0; i < this.steps.length; i++) {
      var cls = i === index ? "tutorial-progress-dot active" : i < index ? "tutorial-progress-dot done" : "tutorial-progress-dot";
      dots += '<div class="' + cls + '"></div>';
    }

    var isLast = index === this.steps.length - 1 || step.isFinish;
    var nextLabel = isLast ? "Finish Tutorial & Start Working" : "Next Step →";
    var nextClass = isLast ? "tutorial-btn finish" : "tutorial-btn primary";
    var nextId = isLast ? "tut-finish-btn" : "tut-next-btn";

    // Toggle card class for map preview sizing
    if (step.mapPreview) {
      this.cardEl.classList.add("has-map");
    } else {
      this.cardEl.classList.remove("has-map");
    }

    var h =
      '<div class="tutorial-card-header">' +
        '<span class="tutorial-badge">' + (step.badge || "Mission Briefing") + '</span>' +
        '<span class="tutorial-step-count">' + (index + 1) + ' of ' + this.steps.length + '</span>' +
      '</div>' +
      '<div class="tutorial-progress-bar">' + dots + '</div>' +
      '<h3 class="tutorial-title">' + step.title + '</h3>' +
      '<p class="tutorial-desc">' + step.desc + '</p>';

    // Render Embedded Route Map Preview if specified
    if (step.mapPreview) {
      var mp = step.mapPreview;
      var roomCode = mp.room;
      var floor = mp.floor || "G";
      var floorFiles = { B: "0.png", G: "1.png", F: "2.png", S: "3.png" };
      var isSub = typeof location !== "undefined" && /\/(techops|logistics|dispatch|request|tests)\//i.test(location.pathname);
      var imgSrc = (isSub ? "../" : "") + "assets/floors/" + (floorFiles[floor] || "1.png") + "?v=20261111";
      var rObj = null;
      var D = window.TechOpsData || {};
      if (D.ALL && D.ALL.length) {
        for (var k = 0; k < D.ALL.length; k++) {
          if (D.ALL[k].code && D.ALL[k].code.toUpperCase() === roomCode.toUpperCase()) {
            rObj = D.ALL[k];
            break;
          }
        }
      }

      var cx = rObj ? (rObj.cx || 800) : 800;
      var cy = rObj ? (rObj.cy || 375) : 375;
      var ox = 620, oy = 320;
      var midX = (ox + cx) / 2;
      var routePts = ox + "," + oy + " " + midX + "," + oy + " " + midX + "," + cy + " " + cx + "," + cy;

      var polySvg = "";
      if (rObj && rObj.pts && rObj.pts.length) {
        var ptsStr = rObj.pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
        polySvg = '<polygon points="' + ptsStr + '" fill="rgba(59, 130, 246, 0.45)" stroke="#3b82f6" stroke-width="4" stroke-dasharray="8 4" />';
      }

      h +=
        '<div class="tutorial-map-preview">' +
          '<div class="tut-map-header">' +
            '<span class="tut-map-badge">Venue Route</span>' +
            '<span class="tut-map-label">' + (mp.label || ('Room ' + roomCode)) + '</span>' +
          '</div>' +
          '<div class="tut-map-stage">' +
            '<img class="tut-map-img" src="' + imgSrc + '" alt="Floor Map Blueprint">' +
            '<svg class="tut-map-svg" viewBox="0 0 1673 940">' +
              polySvg +
              '<polyline points="' + routePts + '" fill="none" stroke="#60a5fa" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 6" />' +
              '<circle cx="' + ox + '" cy="' + oy + '" r="10" fill="#10b981" stroke="#ffffff" stroke-width="3" />' +
              '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="#ef4444" stroke="#ffffff" stroke-width="3" />' +
              '<text x="' + cx + '" y="' + (cy - 20) + '" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="bold" font-size="24" stroke="#020617" stroke-width="4" paint-order="stroke fill">' + roomCode + '</text>' +
            '</svg>' +
          '</div>' +
        '</div>';
    }

    if (step.sandboxText) {
      h += '<div class="tutorial-sandbox-tag">' + step.sandboxText + '</div>';
    }

    h +=
      '<div class="tutorial-actions">' +
        '<button class="tutorial-btn ghost" id="tut-skip-btn" type="button">Skip Tour</button>' +
        '<div class="tutorial-actions-right">' +
          (index > 0 ? '<button class="tutorial-btn" id="tut-prev-btn" type="button">← Back</button>' : '') +
          '<button class="' + nextClass + '" id="' + nextId + '" type="button">' + nextLabel + '</button>' +
        '</div>' +
      '</div>';

    this.cardEl.innerHTML = h;

    var self = this;
    var btnNext = this.cardEl.querySelector("#tut-next-btn, #tut-finish-btn");
    var btnPrev = this.cardEl.querySelector("#tut-prev-btn");
    var btnSkip = this.cardEl.querySelector("#tut-skip-btn");

    if (btnNext) btnNext.onclick = function () { if (isLast) self.finish(); else self._showStep(index + 1); };
    if (btnPrev) btnPrev.onclick = function () { self._showStep(index - 1); };
    if (btnSkip) btnSkip.onclick = function () { self.finish(); };

    if (target) {
      this.activeTarget = target;
      target.classList.add("tutorial-target-active");
      try {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch (e) {}
    }

    this._reposition();
  };

  P._reposition = function () {
    if (!this.overlayEl || !this.cardEl) return;
    var step = this.steps[this.currentStep];
    var target = this.activeTarget;

    if (target) {
      var r = target.getBoundingClientRect();
      var pad = 6;
      this.spotlightEl.style.display = "block";
      this.spotlightEl.style.top = Math.max(0, r.top - pad) + "px";
      this.spotlightEl.style.left = Math.max(0, r.left - pad) + "px";
      this.spotlightEl.style.width = (r.width + pad * 2) + "px";
      this.spotlightEl.style.height = (r.height + pad * 2) + "px";

      var isMobile = window.innerWidth <= 640;
      if (!isMobile) {
        var cardW = this.cardEl.offsetWidth || 370;
        var cardH = this.cardEl.offsetHeight || 220;
        var top = r.bottom + 14;
        var left = Math.min(window.innerWidth - cardW - 20, Math.max(20, r.left));

        if (top + cardH > window.innerHeight - 20) {
          top = Math.max(20, r.top - cardH - 14);
        }
        this.cardEl.style.top = top + "px";
        this.cardEl.style.left = left + "px";
        this.cardEl.style.right = "auto";
        this.cardEl.style.bottom = "auto";
        this.cardEl.style.transform = "none";
      }
    } else {
      this.spotlightEl.style.display = "none";
      var isMobile = window.innerWidth <= 640;
      if (!isMobile) {
        this.cardEl.style.top = "50%";
        this.cardEl.style.left = "50%";
        this.cardEl.style.transform = "translate(-50%, -50%)";
        this.cardEl.style.right = "auto";
        this.cardEl.style.bottom = "auto";
      }
    }
  };

  P.finish = function () {
    var role = this.role;
    if (this.steps[this.currentStep] && typeof this.steps[this.currentStep].onLeave === "function") {
      try { this.steps[this.currentStep].onLeave(); } catch (e) {}
    }

    if (Store && Store.setTutorialCompleted) {
      Store.setTutorialCompleted(role, true);
      Store.exitTutorialMode();
    }
    this.destroy();

    if (this.onFinishCallback) {
      this.onFinishCallback();
    }

    if (TO && TO.toast) {
      TO.toast("Mission Training Complete", "You are now connected to real operations.", "ok");
      if (TO.beep) TO.beep();
    }
  };

  P.destroy = function () {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("scroll", this._onResize, true);
    if (this.steps[this.currentStep] && typeof this.steps[this.currentStep].onLeave === "function") {
      try { this.steps[this.currentStep].onLeave(); } catch (e) {}
    }
    if (this.activeTarget) {
      this.activeTarget.classList.remove("tutorial-target-active");
      this.activeTarget = null;
    }
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    if (this.bannerEl && this.bannerEl.parentNode) {
      this.bannerEl.parentNode.removeChild(this.bannerEl);
    }
    this.overlayEl = null;
    this.spotlightEl = null;
    this.cardEl = null;
    this.bannerEl = null;
  };

  window.NasaTutorial = new NasaTutorial();
})();
