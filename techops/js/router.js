/**
 * TechOps Navigation & Routing Engine
 * Ported from Logistics site with multi-level stairways, corridor snapping,
 * and Dijkstra shortest-path calculations.
 */
(function () {
  var D = window.TechOpsData;

  /* Only the 5 designated inner staircases are used for inter-floor routing */
  var ST = {
    /* Basement: reached ONLY by the North-East (EN) and South-East (SE) stairs.
       WN / WS / SW are locked to the basement (Ground -> 2nd floor only). */
    B: {
      EN: [1140, 352],
      SE: [1078, 703]
    },
    G: {
      WN: [508, 421],
      WS: [492, 579],
      SW: [352, 693],
      EN: [944, 419],
      SE: [911, 690]
    },
    F: {
      WN: [573, 407],
      WS: [552, 580],
      SW: [403, 700],
      EN: [1053, 403],
      SE: [1013, 699]
    },
    S: {
      WN: [551, 382],
      WS: [537, 548],
      SW: [388, 671],
      EN: [1019, 385],
      SE: [985, 671]
    }
  };

  var SN = {
    WN: "North-West Inner Stairs (Auditorium)",
    WS: "Central-West Inner Stairs",
    SW: "South-West Wing Stairs",
    EN: "North-East Inner Stairs (Auditorium)",
    SE: "South-East Wing Stairs"
  };

  var ORD = ["B", "G", "F", "S"];
  var ENT = { code: "ENTRANCE", floor: "G", p: [726, 689] };

  var EXITS = [
    { id: "ENTRANCE", label: "Main Entrance", main: true, p: ENT.p, bb: [659, 655, 801, 694] },
    { id: "EXIT-1", label: "North-West Door", p: [199, 386], bb: [186, 377, 213, 396] },
    { id: "EXIT-2", label: "North-East Door", p: [1208, 378], bb: [1195, 366, 1221, 391] },
    { id: "EXIT-3", label: "South-West Door", p: [199, 539], bb: [186, 529, 212, 550] },
    { id: "EXIT-4", label: "South-East Door", p: [1306, 573], bb: [1292, 555, 1320, 592] }
  ];

  var BATHS = {
    B: [
      { id: "WC-B1", bb: [1090, 255, 1186, 322], door: [1086, 318] }
    ],
    G: [
      { id: "WC-G1", bb: [472, 344, 537, 390] },
      { id: "WC-G2", bb: [913, 344, 985, 390] },
      { id: "WC-G3", bb: [375, 627, 442, 717] },
      { id: "WC-G4", bb: [1152, 625, 1222, 715] }
    ],
    F: [
      { id: "WC-F1", bb: [553, 343, 612, 395] },
      { id: "WC-F2", bb: [1027, 341, 1086, 389] },
      { id: "WC-F3", bb: [434, 646, 497, 715] },
      { id: "WC-F4", bb: [1298, 640, 1349, 715] }
    ],
    S: [
      { id: "WC-S1", bb: [517, 311, 583, 389] },
      { id: "WC-S2", bb: [983, 303, 1046, 395] },
      { id: "WC-S3", bb: [425, 608, 478, 698] },
      { id: "WC-S4", bb: [1246, 608, 1298, 698] }
    ]
  };

  var CORRIDORS = {
    B: [
      [[517, 355], [1068, 355]],
      [[517, 355], [517, 618]],
      [[1068, 355], [1068, 618]],
      [[517, 618], [1068, 618]],
      [[1068, 352], [1140, 352]],
      [[1068, 618], [1068, 650], [1078, 703]],
      [[1068, 355], [1068, 318], [1086, 318]]
    ],
    G: [
      [[178, 334], [600, 334]],
      [[551, 334], [550, 500], [549, 600], [539, 613]],
      [[830, 332], [1213, 334], [1240, 325]],
      [[909, 334], [902, 360], [899, 560], [913, 622]],
      [[288, 624], [327, 624], [482, 630], [539, 613], [600, 608], [817, 610], [864, 622], [945, 623], [1076, 622], [1291, 619]],
      [[300, 624], [300, 592], [236, 560], [199, 539]],
      [[1291, 619], [1306, 573]],
      [[1306, 573], [1265, 556], [1250, 513], [1273, 482], [1334, 448], [1422, 420]],
      [[1213, 334], [1208, 378]],
      [[1208, 378], [1262, 420], [1334, 448]],
      [[1208, 378], [1200, 425]],
      [[1262, 420], [1200, 425]]
    ],
    F: [
      [[243, 319], [680, 319]],
      [[243, 266], [244, 549], [243, 631]],
      [[622, 319], [622, 592], [616, 622]],
      [[940, 318], [1317, 317], [1335, 328]],
      [[1335, 328], [1372, 305]],
      [[1335, 328], [1332, 341], [1461, 588], [1448, 625]],
      [[1030, 318], [1008, 330], [1005, 420], [1005, 594], [1030, 626]],
      [[243, 631], [601, 632], [616, 622], [734, 611], [751, 598], [855, 597], [925, 596], [962, 621], [1030, 626], [1448, 625]]
    ],
    S: [
      [[243, 303], [681, 303]],
      [[243, 250], [243, 596]],
      [[598, 303], [598, 596]],
      [[920, 294], [1290, 294], [1298, 300]],
      [[1298, 300], [1296, 320], [1411, 499], [1400, 536], [1417, 590]],
      [[1036, 294], [975, 296], [971, 462], [980, 472], [980, 489], [966, 503], [968, 585], [985, 597]],
      [[134, 598], [973, 592], [1018, 600], [1078, 596], [1383, 597], [1417, 590]]
    ]
  };

  var DOOR_ROWS = [
    { f: "G", y: 323, dx: 0, codes: ["C027", "C026", "C017"] },
    { f: "F", y: 305, dx: 0, codes: ["C139", "C138", "C137", "C136", "B135", "B134", "B133", "B132"] },
    { f: "F", y: 305, dx: 0, codes: ["B131", "B130", "B129", "B128", "C127", "C126", "C125", "C124"] },
    { f: "F", y: 622, dx: 0, codes: ["C154", "C153", "C152"] },
    { f: "S", y: 287, dx: 0, codes: ["C240", "B236", "B235", "B234", "B233"] },
    { f: "S", y: 287, dx: 0, codes: ["C231", "C230", "C229", "C228", "C227", "C226", "C225", "C224"] },
    { f: "S", y: 588, dx: 0, codes: ["C260", "C259", "C258", "C257", "C256"] },
    { f: "S", y: 616, dx: 0, codes: ["C265"] }
  ];

  var DOOR_PTS = {
    S034: [178, 298], S035: [184, 340], S016: [1257, 273], S015: [1275, 323],
    S140: [232, 265], S141: [232, 338], S123: [1383, 238], S122: [1392, 284],
    H114: [1438, 520], H113: [1482, 612],
    S241: [232, 250], S242: [232, 322], H210: [1408, 468], H209: [1466, 560],
    "PR-F": [1050, 403], "PR-M": [1088, 394],          /* basement prayer rooms */
    CAFETERIA: [1200, 425],                            /* ground: inside the NE door */
    "BREAK-1": [1005, 500], "BREAK-2": [986, 480]      /* open to the east inner halls */
  };

  function doorOf(r) {
    if (DOOR_PTS[r.code]) return DOOR_PTS[r.code];
    var row = DOOR_ROWS.filter(function (w) { return w.f === r.floor && w.codes.indexOf(r.code) >= 0; })[0];
    if (row && r.bb) return [Math.round((r.bb[0] + r.bb[2]) / 2) + row.dx, row.y];
    return [r.cx || ((r.bb[0] + r.bb[2]) / 2 | 0), r.cy || ((r.bb[1] + r.bb[3]) / 2 | 0)];
  }

  function nvDist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function nvNearest(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return { t: t, pt: [a[0] + t * dx, a[1] + t * dy] };
  }

  var NAV = {};

  function buildNav(fid) {
    if (NAV[fid]) return NAV[fid];
    var lines = CORRIDORS[fid].map(function (l) { return l.map(function (p) { return p.slice(); }); });

    /* 1. Join corridor ends that touch or nearly touch another corridor */
    lines.forEach(function (ln, li) {
      [0, ln.length - 1].forEach(function (ei) {
        var e = ln[ei], best = null;
        lines.forEach(function (o, oi) {
          if (oi === li) return;
          for (var i = 0; i < o.length - 1; i++) {
            var r = nvNearest(e, o[i], o[i + 1]), d = nvDist(e, r.pt);
            if (d <= 10 && (!best || d < best.d)) best = { d: d, oi: oi, i: i, pt: r.pt };
          }
        });
        if (!best) return;
        var o = lines[best.oi], v = o.filter(function (q) { return nvDist(q, best.pt) < 0.5; })[0];
        if (v) ln[ei] = v.slice();
        else { o.splice(best.i + 1, 0, best.pt); ln[ei] = best.pt.slice(); }
      });
    });

    var segs = [];
    lines.forEach(function (l) {
      for (var i = 0; i < l.length - 1; i++) segs.push([l[i], l[i + 1]]);
    });

    /* 2. Anchor points: stairs, entrance, room doors */
    var targets = {};
    for (var k in ST[fid]) targets["STAIR:" + k] = ST[fid][k];
    if (fid === "G") targets["ENTRANCE"] = ENT.p;
    if (fid === "G") EXITS.filter(function (e) { return !e.main; }).forEach(function (e) { targets["E:" + e.id] = e.p; });

    var floorObj = D.FLOORS.filter(function (f) { return f.id === fid; })[0];
    if (floorObj) {
      floorObj.rooms.forEach(function (r) {
        targets["R:" + r.code] = doorOf(r);
      });
    }

    var att = {}, ins = {};
    for (var id in targets) {
      var p = targets[id], best = null;
      segs.forEach(function (s, si) {
        var r = nvNearest(p, s[0], s[1]), d = nvDist(p, r.pt);
        if (!best || d < best.d) best = { d: d, si: si, t: r.t, pt: r.pt };
      });
      att[id] = { p: p, pt: best.pt, d: best.d };
      (ins[best.si] = ins[best.si] || []).push({ t: best.t, pt: best.pt });
    }

    /* 3. Build graph */
    var nodes = [], idx = {}, adj = [];
    function nid(p) {
      var k = Math.round(p[0] * 2) + "," + Math.round(p[1] * 2);
      if (idx[k] === undefined) { idx[k] = nodes.length; nodes.push([p[0], p[1]]); adj.push([]); }
      return idx[k];
    }
    function link(a, b) {
      if (a === b) return;
      var w = nvDist(nodes[a], nodes[b]);
      adj[a].push([b, w]); adj[b].push([a, w]);
    }
    segs.forEach(function (s, si) {
      var pts = [s[0]].concat((ins[si] || []).sort(function (x, y) { return x.t - y.t; }).map(function (i) { return i.pt; }), [s[1]]);
      for (var i = 0; i < pts.length - 1; i++) link(nid(pts[i]), nid(pts[i + 1]));
    });

    var at = {};
    for (var id in att) {
      var a = att[id], n = nodes.length;
      nodes.push([a.p[0], a.p[1]]);
      adj.push([]);
      link(n, nid(a.pt));
      at[id] = n;
    }
    return NAV[fid] = { nodes: nodes, adj: adj, at: at };
  }

  function walk(fid, fromId, toId) {
    var g = buildNav(fid), s = g.at[fromId], t = g.at[toId];
    if (s === undefined || t === undefined) throw new Error("Navigation anchor not found for " + fromId + " or " + toId);
    var n = g.nodes.length, d = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    d[s] = 0;
    for (;;) {
      var u = -1;
      for (var i = 0; i < n; i++) if (!done[i] && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0 || d[u] === Infinity || u === t) break;
      done[u] = true;
      for (var j = 0; j < g.adj[u].length; j++) {
        var v = g.adj[u][j][0], w = g.adj[u][j][1];
        if (d[u] + w < d[v]) { d[v] = d[u] + w; prev[v] = u; }
      }
    }
    if (d[t] === Infinity) throw new Error("Path not connected between " + fromId + " and " + toId);
    var pts = [];
    for (var c = t; c !== -1; c = prev[c]) pts.push(g.nodes[c].slice());
    return { cost: d[t], pts: pts.reverse() };
  }

  function fname(id) {
    var f = D.FLOORS.filter(function (x) { return x.id === id; })[0];
    return f ? f.name : id;
  }

  function loc(code, curFloor) {
    if (!code) return null;
    code = String(code).trim().toUpperCase();
    if (code === "ENTRANCE" || code === "MAIN ENTRANCE") return { code: "Main Entrance", floor: "G", p: ENT.p, id: "ENTRANCE" };
    if (code.indexOf("STAIR-") === 0) {
      var k = code.replace("STAIR-", "");
      var fl = curFloor || "G";
      if (SN[k] && ST[fl] && ST[fl][k]) {
        return { code: SN[k], floor: fl, p: ST[fl][k], id: "STAIR:" + k };
      }
    }
    var ex = EXITS.filter(function (x) { return x.id === code && !x.main; })[0];
    if (ex) return { code: ex.label + " (Exit)", floor: "G", p: ex.p, id: "E:" + ex.id, exit: ex };

    /* Look up room in TechOpsData */
    var foundRoom = null;
    for (var i = 0; i < D.FLOORS.length; i++) {
      var r = D.FLOORS[i].rooms.filter(function (x) { return x.code === code; })[0];
      if (r) { foundRoom = r; break; }
    }
    if (foundRoom) {
      return {
        code: foundRoom.code,
        floor: foundRoom.floor,
        p: [foundRoom.cx, foundRoom.cy],
        room: foundRoom,
        id: "R:" + foundRoom.code
      };
    }
    return null;
  }

  function planRoute(a, b) {
    if (!a || !b) return null;
    var legs = [], steps = [];

    /* Same floor walk */
    if (a.floor === b.floor) {
      var r = walk(a.floor, a.id, b.id);
      legs.push({
        floor: a.floor,
        pts: [a.p].concat(r.pts, [b.p]),
        m: [[a.p, "s", a.code], [b.p, "e", b.code]]
      });
      steps.push({
        legIdx: 0,
        floor: a.floor,
        icon: "walk",
        text: "Start at " + a.code + " (" + fname(a.floor) + ") and follow the highlighted corridor route to " + b.code + "."
      });
      var estSeconds = Math.max(15, Math.round(r.cost / 14));
      return {
        legs: legs,
        steps: steps,
        summary: fname(a.floor) + " · ~" + estSeconds + "s walk",
        totalCost: r.cost
      };
    }

    /* Multi-floor walk. Floors are crossed one level at a time (Basement - Ground - First - Second); each level
       change may only use a stair that exists on BOTH floors (the Basement has EN and SE only). The cheapest
       combination of stairs wins (dynamic programming over the floors). */
    function safe(fid, from, to) { try { return walk(fid, from, to); } catch (err) { return null; } }
    var i0 = ORD.indexOf(a.floor), i1 = ORD.indexOf(b.floor), dir = i1 > i0 ? 1 : -1;
    var fl = [];
    for (var q = i0; q !== i1 + dir; q += dir) fl.push(ORD[q]);
    var n = fl.length, up = dir > 0, trans = [], j;
    function stairsFor(x, y) { return Object.keys(SN).filter(function (k) { return ST[x][k] && ST[y][k]; }); }
    for (j = 0; j < n - 1; j++) trans.push(stairsFor(fl[j], fl[j + 1]));
    var best = [{}];
    trans[0].forEach(function (k) {
      var r0 = safe(fl[0], a.id, "STAIR:" + k);
      if (r0) best[0][k] = { c: r0.cost, prev: null, r: r0 };
    });
    for (j = 1; j < n - 1; j++) {
      best[j] = {};
      (function (jj) {
        trans[jj].forEach(function (k) {
          var bj = null;
          trans[jj - 1].forEach(function (kp) {
            if (!best[jj - 1][kp]) return;
            var rr = safe(fl[jj], "STAIR:" + kp, "STAIR:" + k);
            if (!rr) return;
            var c = best[jj - 1][kp].c + rr.cost;
            if (!bj || c < bj.c) bj = { c: c, prev: kp, r: rr };
          });
          if (bj) best[jj][k] = bj;
        });
      })(j);
    }
    var fin = null;
    trans[n - 2].forEach(function (k) {
      if (!best[n - 2][k]) return;
      var rl = safe(fl[n - 1], "STAIR:" + k, b.id);
      if (!rl) return;
      var c = best[n - 2][k].c + rl.cost;
      if (!fin || c < fin.c) fin = { c: c, k: k, r: rl };
    });
    if (!fin) return null;
    var ks = new Array(n - 1);
    ks[n - 2] = fin.k;
    for (j = n - 2; j > 0; j--) ks[j - 1] = best[j][ks[j]].prev;

    var arrow = up ? "UP ▲" : "DOWN ▼", icon = up ? "up" : "down";
    function note(x) { return (fl[x] === "B" || fl[x + 1] === "B") ? " Only the North-East and South-East stairs connect to the Basement." : ""; }
    legs.push({ floor: fl[0], pts: [a.p].concat(best[0][ks[0]].r.pts), m: [[a.p, "s", a.code], [ST[fl[0]][ks[0]], "t", SN[ks[0]]]] });
    steps.push(
      { legIdx: 0, floor: fl[0], icon: "walk", text: "From " + a.code + " (" + fname(a.floor) + "), walk towards the " + SN[ks[0]] + "." },
      { legIdx: 0, floor: fl[0], icon: icon, text: "Take the stairs " + arrow + " to the " + fname(fl[1]) + "." + note(0) }
    );
    for (j = 1; j < n - 1; j++) {
      if (ks[j - 1] === ks[j]) {
        steps.push({ legIdx: legs.length - 1, floor: legs[legs.length - 1].floor, icon: icon, text: "Keep going " + arrow + " on the same stairs, past the " + fname(fl[j]) + ", to the " + fname(fl[j + 1]) + "." + note(j) });
      } else {
        var rj = best[j][ks[j]].r;
        legs.push({ floor: fl[j], pts: rj.pts, m: [[ST[fl[j]][ks[j - 1]], "t", SN[ks[j - 1]]], [ST[fl[j]][ks[j]], "t", SN[ks[j]]]] });
        steps.push(
          { legIdx: legs.length - 1, floor: fl[j], icon: "walk", text: "Leave the " + SN[ks[j - 1]] + " on the " + fname(fl[j]) + " and walk to the " + SN[ks[j]] + "." },
          { legIdx: legs.length - 1, floor: fl[j], icon: icon, text: "Take the stairs " + arrow + " to the " + fname(fl[j + 1]) + "." + note(j) }
        );
      }
    }
    var last = n - 1;
    legs.push({ floor: fl[last], pts: fin.r.pts.concat([b.p]), m: [[ST[fl[last]][ks[last - 1]], "t", SN[ks[last - 1]]], [b.p, "e", b.code]] });
    steps.push({ legIdx: legs.length - 1, floor: fl[last], icon: "walk", text: "Exit the stairs at " + fname(fl[last]) + " and follow the highlighted corridor route to " + b.code + "." });

    var names = [];
    ks.forEach(function (k) { if (names.indexOf(SN[k]) < 0) names.push(SN[k]); });
    var estSec = Math.max(30, Math.round(fin.c / 14) + 25 * (n - 1));
    return {
      legs: legs,
      steps: steps,
      summary: fname(a.floor) + " → " + fname(b.floor) + " via " + names.join(" → ") + " · ~" + estSec + "s walk",
      totalCost: fin.c,
      stair: ks[0],
      stairName: names.join(" → ")
    };
  }

  window.TechOpsRouter = {
    ST: ST,
    SN: SN,
    EXITS: EXITS,
    BATHS: BATHS,
    CORRIDORS: CORRIDORS,
    doorOf: doorOf,
    buildNav: buildNav,
    walk: walk,
    loc: loc,
    planRoute: planRoute,
    fname: fname
  };
})();
