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

    /* 3. each dashboard sees only its own team's requests */
    var tech = await reportsFor("TO-001"), log = await reportsFor("LG-001");
    D.REQUEST_TYPES.forEach(function (t) {
      var id = sentIds[t.id], inTech = tech.some(function (x) { return x.id === id; }), inLog = log.some(function (x) { return x.id === id; });
      ok("'" + t.id + "' appears ONLY in the " + t.team + " dashboard", t.team === "TechOps" ? (inTech && !inLog) : t.team === "Competition" ? (!inTech && !inLog) : (inLog && !inTech),
        "TechOps sees it: " + inTech + ", Logistics sees it: " + inLog);
    });
    ok("Tech Ops list has no Logistics items", tech.every(function (x) { return x.team === "TechOps"; }));
    ok("Logistics list has no Tech Ops items", log.every(function (x) { return x.team === "Logistics"; }));

    /* 4. a team value forged on the form cannot create a third queue */
    var forged = await Store.addReport({ team: "Admin", floor: "F", room: "C139", issue: "x", details: "", reporter: "" });
    var after = await reportsFor("TO-001");
    ok("unknown team falls back to TechOps (never invisible)", after.some(function (x) { return x.id === forged.id; }));

    /* 5. login lives in the tab (sessionStorage) and not in permanent storage */
    await Store.logout(); await Store.login("NSAC-2026");
    ok("session stored in sessionStorage", !!root.sessionStorage.getItem("techops_volunteer_code"));
    ok("nothing stored in localStorage", !root.localStorage.getItem("techops_volunteer_code"));
    ok("restore() keeps a fresh session", !!(await Store.restore()));

    /* 6. away too long => the code is asked again */
    root.sessionStorage.setItem("techops_session_seen", String(Date.now() - Store.sessionGraceMs - 1000));
    ok("restore() locks after being away too long", (await Store.restore()) === null);
    ok("expired session is wiped", !root.sessionStorage.getItem("techops_volunteer_code"));

    /* 6b. Dispatch: sees BOTH queues, claims, hands out remotely; the member then owns it */
    var tReq = await submit("net", "C139"), lReq = await submit("prayer", "C139");
    var dp = await reportsFor("CT-001");
    ok("Dispatch sees the Tech Ops request", dp.some(function (x) { return x.id === tReq.id && x.team === "TechOps"; }));
    ok("Dispatch sees the Logistics request", dp.some(function (x) { return x.id === lReq.id && x.team === "Logistics"; }));
    var early = false; try { await Store.handOutReport(tReq.id, "Omar"); } catch (e) { early = true; }
    ok("cannot hand out a request before claiming it", early);
    await Store.claimReport(tReq.id);
    await Store.handOutReport(tReq.id, "Omar");
    var after1 = (await reportsFor("CT-001")).filter(function (x) { return x.id === tReq.id; })[0];
    ok("hand-out sets assignee and records the dispatcher", after1.assigned === "Omar" && after1.handedBy === "Competition Lead" && after1.status === "In Progress");
    var omar = await reportsFor("TO-002");
    ok("the member sees it as theirs", omar.some(function (x) { return x.id === tReq.id && x.assigned === "Omar"; }));
    ok("Logistics member never sees the Tech Ops request", !(await reportsFor("LG-001")).some(function (x) { return x.id === tReq.id; }));
    await reportsFor("TO-002"); await Store.resolveReport(tReq.id);
    var fin = (await reportsFor("CT-001")).filter(function (x) { return x.id === tReq.id; })[0];
    ok("member can mark it done and Dispatch sees it", fin.status === "Resolved");
    await Store.claimReport(lReq.id).catch(function () {});
    await reportsFor("CT-001"); await Store.claimReport(lReq.id); await Store.resolveReport(lReq.id);
    ok("dispatcher can also close what they claimed", (await reportsFor("CT-001")).some(function (x) { return x.id === lReq.id && x.status === "Resolved"; }));

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
    await Store.logout();
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
