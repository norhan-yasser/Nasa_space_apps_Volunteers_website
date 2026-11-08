/* Self-test for routing + sessions. Runs in Node (tests/run.js) and in the browser (tests/selftest.html).
 * Uses the built-in demo data (Firebase switched off), so it never touches your real database. */
(function (root) {
  root.runSelfTest = async function () {
    var out = [], D = root.TechOpsData, Store = root.TechOpsStore;
    function ok(name, cond, extra) { out.push({ name: name, pass: !!cond, extra: cond ? "" : (extra || "") }); }
    async function reportsFor(code) {
      await Store.logout();
      await Store.login(code); Store.start();
      var d = await Store.loadAll();
      return d.reports;
    }
    function submit(typeId, room) {
      var t = D.REQUEST_TYPES.filter(function (x) { return x.id === typeId; })[0];
      return Store.addReport({ team: D.teamFor(typeId), floor: "F", room: room || "C139", issue: t.label, details: "SELFTEST " + typeId, reporter: "selftest" });
    }

    /* 1. every request type has exactly one valid team */
    D.REQUEST_TYPES.forEach(function (t) {
      ok("type '" + t.id + "' has one team (" + t.team + ")", t.team === "TechOps" || t.team === "Logistics" || t.team === "Competition");
    });
    ok("tech types: net, power, help, other",
      ["net", "power", "help", "other"].every(function (i) { return D.teamFor(i) === "TechOps"; }));
    ok("competition types: comp-discord, comp-question, comp-submission, comp-other",
      ["comp-discord", "comp-question", "comp-submission", "comp-other"].every(function (i) { return D.teamFor(i) === "Competition"; }));
    ok("logistics types: place, prayer, log-help",
      ["place", "prayer", "log-help"].every(function (i) { return D.teamFor(i) === "Logistics"; }));

    /* 2. send one request of every type through the SAME path the QR form uses */
    var sentIds = {};
    for (var i = 0; i < D.REQUEST_TYPES.length; i++) {
      var r = await submit(D.REQUEST_TYPES[i].id); sentIds[D.REQUEST_TYPES[i].id] = r.id;
    }

    /* 3. each dashboard sees only its own team's requests (strict isolation) */
    var tech = await reportsFor("TO-001"), log = await reportsFor("LG-001"), comp = await reportsFor("CT-001");
    D.REQUEST_TYPES.forEach(function (t) {
      var id = sentIds[t.id],
          inTech = tech.some(function (x) { return x.id === id; }),
          inLog = log.some(function (x) { return x.id === id; }),
          inComp = comp.some(function (x) { return x.id === id; });
      ok("'" + t.id + "' appears ONLY in the " + t.team + " dashboard",
        t.team === "TechOps" ? (inTech && !inLog && !inComp) :
        t.team === "Competition" ? (inComp && !inTech && !inLog) :
        (inLog && !inTech && !inComp),
        "TechOps: " + inTech + ", Logistics: " + inLog + ", Competition: " + inComp);
    });
    ok("Tech Ops list has ONLY Tech Ops items", tech.every(function (x) { return x.team === "TechOps"; }));
    ok("Logistics list has ONLY Logistics items", log.every(function (x) { return x.team === "Logistics"; }));
    ok("Competition list has ONLY Competition items", comp.every(function (x) { return x.team === "Competition"; }));

    /* 4. a team value forged on the form cannot create a third queue */
    var forged = await Store.addReport({ team: "Admin", floor: "F", room: "C139", issue: "x", details: "", reporter: "" });
    var after = await reportsFor("TO-001");
    ok("unknown team falls back to TechOps (never invisible)", after.some(function (x) { return x.id === forged.id; }));

    /* 5. login lives in the tab (sessionStorage) and not in permanent storage */
    await Store.logout(); await Store.login("NSAC-2026");
    ok("session stored in sessionStorage", !!root.sessionStorage.getItem("techops_volunteer_code"));
    ok("nothing stored in localStorage", !root.localStorage.getItem("techops_volunteer_code") && !root.localStorage.getItem("techops_volunteer_user"));
    ok("peekUser() resolves active session synchronously (0ms)", !!(Store.peekUser && Store.peekUser() && Store.peekUser().code === "NSAC-2026"));
    ok("restore() keeps a fresh session", !!(await Store.restore()));

    /* 5b. Strict RBAC matrix per volunteer role */
    var uMap = await Store.login("NSAC-2026");
    ok("RBAC Volunteers: Maps allowed, sub-panels blocked",
      Store.canAccess(uMap, "maps") && !Store.canAccess(uMap, "logistics") && !Store.canAccess(uMap, "competition") && !Store.canAccess(uMap, "techops"));
    var uLog = await Store.login("LG-001");
    ok("RBAC Logistics: Maps + Logistics allowed, others blocked",
      Store.canAccess(uLog, "maps") && Store.canAccess(uLog, "logistics") && !Store.canAccess(uLog, "competition") && !Store.canAccess(uLog, "techops"));
    var uComp = await Store.login("CT-001");
    ok("RBAC Competition: Maps + Competition allowed, others blocked",
      Store.canAccess(uComp, "maps") && Store.canAccess(uComp, "competition") && !Store.canAccess(uComp, "logistics") && !Store.canAccess(uComp, "techops"));
    var uTech = await Store.login("TO-001");
    ok("RBAC TechOps: TechOps allowed (built-in map), standalone Maps & others blocked",
      !Store.canAccess(uTech, "maps") && Store.canAccess(uTech, "techops") && !Store.canAccess(uTech, "logistics") && !Store.canAccess(uTech, "competition"));

    /* 5c. Map route link helper (Show Route integration) */
    if (root.TO && root.TO.routeHref) {
      ok("Show Route: standard room routes from ENTRANCE",
        root.TO.routeHref({ room: "C231", issue: "Help request", details: "Lost badge" }, "../maps.html") === "../maps.html?from=ENTRANCE&to=C231");
      ok("Show Route: 'Go to a place' routes from participant room to destination",
        root.TO.routeHref({ room: "C026", issue: "Go to a place", details: "Wants to go to: S140 (First Floor)" }, "../maps.html") === "../maps.html?from=C026&to=S140");
      ok("Show Route: 'Prayer' routes from participant room to Basement prayer room",
        root.TO.routeHref({ room: "H113", issue: "Prayer", details: "Prayer area: Women" }, "../maps.html") === "../maps.html?from=H113&to=PR-F");
      ok("Show Route: remote Competition request has empty route href",
        root.TO.routeHref({ room: "", issue: "Discord issue", details: "Invite expired" }, "../maps.html") === "");
    }

    /* 6. away too long => the code is asked again */
    root.sessionStorage.setItem("techops_session_seen", String(Date.now() - Store.sessionGraceMs - 1000));
    ok("peekUser() returns null when session expired", Store.peekUser() === null);
    ok("restore() locks after being away too long", (await Store.restore()) === null);
    ok("expired session is wiped", !root.sessionStorage.getItem("techops_volunteer_code") && !root.sessionStorage.getItem("techops_volunteer_user"));

    /* 6b. Competition Team strict isolation + hand-out & resolve flow */
    var tReq = await submit("net", "C139"), lReq = await submit("prayer", "C139"), cReq2 = await submit("comp-submission", "C139");
    var dp = await reportsFor("CT-001");
    ok("Competition Team strictly excludes Tech Ops requests", !dp.some(function (x) { return x.id === tReq.id || x.team === "TechOps"; }));
    ok("Competition Team strictly excludes Logistics requests", !dp.some(function (x) { return x.id === lReq.id || x.team === "Logistics"; }));
    ok("Competition Team sees its own Competition request", dp.some(function (x) { return x.id === cReq2.id && x.team === "Competition"; }));
    var early = false; try { await Store.handOutReport(cReq2.id, "Competition Volunteer"); } catch (e) { early = true; }
    ok("cannot hand out a request before claiming it", early);
    await Store.claimReport(cReq2.id);
    await Store.handOutReport(cReq2.id, "Competition Volunteer");
    var after1 = (await reportsFor("CT-001")).filter(function (x) { return x.id === cReq2.id; })[0];
    ok("hand-out sets assignee and records the dispatcher", after1.assigned === "Competition Volunteer" && after1.handedBy === "Competition Lead" && after1.status === "In Progress");
    var cv = await reportsFor("CT-002");
    ok("Competition member sees it as theirs", cv.some(function (x) { return x.id === cReq2.id && x.assigned === "Competition Volunteer"; }));
    ok("Logistics member never sees the Competition request", !(await reportsFor("LG-001")).some(function (x) { return x.id === cReq2.id; }));
    await reportsFor("CT-002"); await Store.resolveReport(cReq2.id);
    var fin = (await reportsFor("CT-001")).filter(function (x) { return x.id === cReq2.id; })[0];
    ok("member can mark it done and Competition Team sees it", fin.status === "Resolved");

    /* 6c. Competition requests: remote (no room), only the Competition Team monitor sees them */
    var cReq = await Store.addReport({ team: "Competition", floor: "", room: "", issue: "Discord issue", details: "SELFTEST", reporter: "Team Aurora · @omar" });
    ok("competition request id uses CMP", /^CMP/.test(cReq.id));
    await Store.logout(); await Store.login("CT-001");
    var cd = (await reportsFor("CT-001")).filter(function (x) { return x.id === cReq.id; })[0];
    ok("Competition Team sees the Discord request with team name and no room", !!cd && cd.team === "Competition" && !cd.room);
    ok("Tech Ops never sees the Competition request", !(await reportsFor("TO-002")).some(function (x) { return x.id === cReq.id; }));
    ok("Logistics never sees the Competition request", !(await reportsFor("LG-001")).some(function (x) { return x.id === cReq.id; }));

    /* 7. old permanent logins (from the previous version) no longer get anyone in */
    await Store.logout();
    root.localStorage.setItem("techops_volunteer_code", "NSAC-2026");
    ok("old localStorage login is ignored", (await Store.restore()) === null);

    /* 8. wrong code */
    var bad = false; try { await Store.login("WRONG-999"); } catch (e) { bad = true; }
    ok("wrong code is rejected", bad);

    /* 9. Tutorial / Onboarding Sandbox Mode */
    ok("Tutorial mode initially false", !Store.isTutorialMode());
    root.localStorage.removeItem("nasa_tutorial_done_techops");
    ok("isTutorialCompleted initially false", !Store.isTutorialCompleted("techops"));
    Store.setTutorialCompleted("techops", true);
    ok("setTutorialCompleted marks complete", Store.isTutorialCompleted("techops"));
    Store.setTutorialCompleted("techops", false);

    await Store.login("TO-001");
    Store.start();
    Store.enterTutorialMode("techops");
    ok("enterTutorialMode sets tutorial mode true", Store.isTutorialMode());
    var tutData = await Store.loadAll();
    ok("Tutorial mode returns mock training tasks", tutData.reports.some(function (r) { return r.id === "TUT-TO-01"; }));
    await Store.claimReport("TUT-TO-01");
    var claimedTut = (await Store.loadAll()).reports.filter(function (r) { return r.id === "TUT-TO-01"; })[0];
    ok("Claiming mock training task works in memory", claimedTut.status === "In Progress" && claimedTut.assigned === "Mohamed Khairy");
    Store.exitTutorialMode();
    ok("exitTutorialMode restores normal mode", !Store.isTutorialMode());
    var liveData = await Store.loadAll();
    ok("Normal mode has real tickets without tutorial tasks", !liveData.reports.some(function (r) { return r.id === "TUT-TO-01"; }));

    await Store.logout();
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
