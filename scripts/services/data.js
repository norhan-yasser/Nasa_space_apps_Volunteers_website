/**
 * Static venue geometry for the TechOps prototype.
 * Room outlines are measured on the floor-plan images (1673 x 940 px), the same plans
 * the Logistics site uses. Only rooms that can be assigned to groups are listed here.
 */
(function () {
  var isSub = typeof location !== "undefined" && /\/(techops|logistics|dispatch|request|tests)\//i.test(location.pathname);
  var IMG_DIR = (isSub ? "../" : "") + "assets/floors/";

  /* [code, geometry]  geometry: 4 numbers = rectangle, otherwise flat x,y pairs (polygon) */
  var RAW = {
    /* Basement (plan 0.png): only the two prayer rooms are marked */
    B: [["PR-F", [970, 382, 1048, 505]], ["PR-M", [1087, 382, 1188, 575]]],
    G: [
      ["C034", [86, 201, 185, 287]], ["C035", [87, 312, 185, 394]], ["C027", [511, 240, 558, 320]],
      ["C026", [559, 240, 607, 320]], ["B020", [1025, 240, 1070, 320]], ["B019", [1070, 240, 1115, 320]],
      ["B018", [1115, 240, 1158, 320]], ["B017", [1157, 240, 1202, 320]],
      ["B016", [1259, 273, 1220, 208, 1295, 165, 1333, 229]],
      ["B015", [1309, 360, 1270, 295, 1341, 252, 1381, 316]],
      ["CLINIC", [1273, 646, 1337, 609, 1358, 638, 1304, 671, 1273, 671]],
      ["CAFETERIA", [1070, 429, 1225, 468]],
      ["CAFETERIA-W", [264, 549, 435, 588]],
      ["STAGE", [1462, 182, 1660, 213, 1617, 499, 1414, 470]]
    ],
    F: [
      ["C140", [126, 178, 229, 269]], ["C141", [126, 295, 230, 378]], ["C139", [283, 218, 335, 304]],
      ["C138", [334, 218, 384, 304]], ["C137", [384, 218, 434, 304]], ["C136", [434, 218, 485, 304]],
      ["C135", [485, 218, 537, 304]], ["C134", [537, 218, 591, 304]], ["C133", [589, 218, 639, 304]],
      ["C132", [639, 218, 691, 304]], ["B131", [940, 218, 994, 303]], ["B130", [991, 218, 1040, 303]],
      ["B129", [1039, 217, 1089, 303]], ["B128", [1088, 217, 1138, 303]], ["B127", [1138, 217, 1185, 303]],
      ["B126", [1185, 217, 1235, 303]], ["B125", [1234, 217, 1283, 303]], ["B124", [1283, 217, 1333, 303]],
      ["B123", [1396, 248, 1355, 178, 1437, 130, 1478, 201]],
      ["B122", [1403, 368, 1362, 298, 1489, 224, 1530, 294]],
      ["A114", [1466, 568, 1432, 510, 1527, 455, 1561, 513]],
      ["A113", [1516, 658, 1477, 591, 1563, 542, 1602, 608]],
      ["D154", [381, 530, 430, 617]], ["D153", [431, 530, 481, 618]], ["D152", [480, 530, 534, 618]],
      ["BREAK-1", [942, 431, 1086, 578]]
    ],
    S: [
      ["C241", [119, 165, 224, 257]], ["C242", [120, 282, 225, 363]], ["C240", [274, 203, 324, 286]],
      ["C236", [465, 203, 512, 286]], ["C235", [511, 203, 559, 286]], ["C234", [559, 203, 607, 286]],
      ["C233", [607, 203, 661, 286]], ["B231", [916, 199, 963, 279]], ["B230", [962, 199, 1011, 280]],
      ["B229", [1010, 198, 1058, 280]], ["B228", [1058, 197, 1105, 280]], ["B227", [1106, 198, 1153, 280]],
      ["B226", [1152, 198, 1200, 280]], ["B225", [1201, 198, 1249, 280]], ["B224", [1249, 198, 1300, 280]],
      ["A210", [1448, 534, 1403, 462, 1512, 394, 1557, 465]],
      ["A209", [1506, 629, 1460, 555, 1573, 486, 1618, 559]],
      ["D260", [119, 492, 173, 585]], ["D259", [172, 492, 223, 585]], ["D258", [268, 492, 317, 585]],
      ["D257", [316, 492, 364, 584]], ["D256", [363, 492, 412, 584]], ["D252", [520, 404, 585, 500]],
      ["D265", [617, 698, 512, 698, 512, 612, 617, 612]],
      ["BREAK-2", [948, 404, 1052, 584]]
    ]
  };

  /* Shared places (not assignable to a group): shown on the map and usable in routes, reports and meetups */
  var PLACE_KIND = { "PR-F": "prayer", "PR-M": "prayer", "CAFETERIA": "cafeteria", "CAFETERIA-W": "cafeteria", "BREAK-1": "break", "BREAK-2": "break", "STAGE": "stage", "B018": "games", "B019": "games", "B020": "games", "CLINIC": "clinic" };
  var PLACE_STYLE = {
    prayer: { color: "#8b5cf6", label: "Prayer Room" },
    cafeteria: { color: "#d97706", label: "Cafeteria" },
    "break": { color: "#0ea5e9", label: "Break Area" },
    stage: { color: "#14b8a6", label: "Outer Stage" },
    games: { color: "#6366f1", label: "Games Room" },
    clinic: { color: "#38bdf8", label: "Clinic" }
  };

  var META = {
    B: { name: "Basement", short: "Basement", level: "Level -1", img: IMG_DIR + "0.png?v=20261111" },
    G: { name: "Ground Floor", short: "Ground", level: "Level 0", img: IMG_DIR + "1.png?v=20261112-clinic-wings" },
    F: { name: "First Floor", short: "First", level: "Level 1", img: IMG_DIR + "2.png?v=20261112-clinic-wings" },
    S: { name: "Second Floor", short: "Second", level: "Level 2", img: IMG_DIR + "3.png?v=20261112-clinic-wings" }
  };

  var FLOORS = ["B", "G", "F", "S"].map(function (id) {
    var rooms = RAW[id].map(function (r) {
      var g = r[1], pts = [];
      if (g.length === 4) pts = [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]];
      else for (var i = 0; i < g.length; i += 2) pts.push([g[i], g[i + 1]]);
      var cx = 0, cy = 0;
      pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
      cx = Math.round(cx / pts.length); cy = Math.round(cy / pts.length);
      var xs = pts.map(function (p) { return p[0]; });
      var ys = pts.map(function (p) { return p[1]; });
      var bb = [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
      return { code: r[0], floor: id, pts: pts, cx: cx, cy: cy, bb: bb, kind: PLACE_KIND[r[0]] || "" };
    });
    return { id: id, name: META[id].name, short: META[id].short, level: META[id].level, img: META[id].img, rooms: rooms };
  });

  var ALL_ROOMS = [];
  FLOORS.forEach(function (f) { ALL_ROOMS = ALL_ROOMS.concat(f.rooms); });

  /* Point-in-polygon: the room (geometry) that contains pixel (x, y) on a floor plan, or null. */
  function roomAt(floorId, x, y) {
    var f = FLOORS.filter(function (fl) { return fl.id === floorId; })[0];
    if (!f) return null;
    for (var i = 0; i < f.rooms.length; i++) {
      var p = f.rooms[i].pts, inside = false;
      for (var a = 0, b = p.length - 1; a < p.length; b = a++) {
        if ((p[a][1] > y) !== (p[b][1] > y) && x < (p[b][0] - p[a][0]) * (y - p[a][1]) / (p[b][1] - p[a][1]) + p[a][0]) inside = !inside;
      }
      if (inside) return f.rooms[i];
    }
    return null;
  }

  window.TechOpsData = {
    roomAt: roomAt,
    W: 1673,
    H: 940,
    FLOORS: FLOORS,
    PLACE_STYLE: PLACE_STYLE,
    ALL: ALL_ROOMS,
    ZONES: {
      Participants: { color: "#3d6bff", label: "Participants" },
      Volunteers: { color: "#10b981", label: "Volunteers" },
      VIPs: { color: "#fb9746", label: "VIPs" },
      Judges: { color: "#a78bfa", label: "Judges" },
      Mentors: { color: "#22d3ee", label: "Mentors" }
    },
    ISSUES: [
      { id: "net", label: "Internet is lagging", hint: "Slow or dropping Wi-Fi" },
      { id: "power", label: "Electricity / Power problem", hint: "No power, tripped outlets, cables" },
      { id: "help", label: "Need TechOps assistance", hint: "Equipment, setup or any tech help" },
      { id: "other", label: "Other", hint: "Describe the problem yourself" }
    ],
    /* Logistics QR help form: the three things a member can ask the Logistics team for */
    LOG_ISSUES: [
      { id: "place", label: "Go to a place", hint: "I need to get to a certain room or area" },
      { id: "prayer", label: "Prayer request", hint: "Show me or take me to the prayer area" },
      { id: "help", label: "Help request", hint: "Any other help from the Logistics team" }
    ],
    /* ONE participant QR form: every request type belongs to exactly one team. The team decides which dashboard
     * (and which alerts) receive it, so the two queues never overlap. Labels match ISSUES / LOG_ISSUES above. */
    REQUEST_TYPES: [
      { id: "net",      team: "TechOps",   icon: "\uD83D\uDCF6", label: "Internet is lagging",         hint: "Slow or dropping Wi-Fi" },
      { id: "power",    team: "TechOps",   icon: "\u26A1",       label: "Electricity / Power problem", hint: "No power, tripped outlets, cables" },
      { id: "help",     team: "TechOps",   icon: "\uD83D\uDEE0\uFE0F", label: "Need TechOps assistance", hint: "Equipment, setup or any tech help" },
      { id: "other",    team: "TechOps",   icon: "\uD83D\uDCAC", label: "Other",                       hint: "Another tech problem, describe it" },
      { id: "place",    team: "Logistics", icon: "\uD83E\uDDED", label: "Go to a place",               hint: "I need to get to a certain room or area" },
      { id: "prayer",   team: "Logistics", icon: "\uD83D\uDD4C", label: "Prayer request",              hint: "Show me or take me to the prayer area" },
      { id: "log-help", team: "Logistics", icon: "\uD83D\uDE4B", label: "Help request",                hint: "Any other help from the Logistics team" },
      /* Competition Team: handled remotely (claimed and handed out from the monitor), so no floor / room is asked */
      { id: "comp-discord",    team: "Competition", icon: "\uD83C\uDFAE", label: "Discord issue",          hint: "Cannot join, access or use the event Discord" },
      { id: "comp-question",   team: "Competition", icon: "\u2753",       label: "Competition question",   hint: "Rules, schedule, judging or challenge questions" },
      { id: "comp-submission", team: "Competition", icon: "\uD83D\uDCE4", label: "Submission help",        hint: "Project submission or deadline problem" },
      { id: "comp-other",      team: "Competition", icon: "\uD83D\uDCAC", label: "Other competition request", hint: "Anything else for the Competition Team" }
    ],
    TEAM_LABELS: { TechOps: "Tech Ops", Logistics: "Logistics", Competition: "Competition Team" },
    teamFor: function (typeId) {
      var t = (window.TechOpsData.REQUEST_TYPES || []).filter(function (x) { return x.id === typeId; })[0];
      return t ? t.team : null;
    },
    STATUSES: ["New", "In Progress", "Resolved"]
  };
})();
