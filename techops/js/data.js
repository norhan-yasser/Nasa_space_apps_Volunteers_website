/**
 * Static venue geometry for the TechOps prototype.
 * Room outlines are measured on the floor-plan images (1673 x 940 px), the same plans
 * the Logistics site uses. Only rooms that can be assigned to groups are listed here.
 */
(function () {
  var IMG_DIR = "../assets/su tech floor assets/";

  /* [code, geometry]  geometry: 4 numbers = rectangle, otherwise flat x,y pairs (polygon) */
  var RAW = {
    G: [
      ["S034", [86, 201, 185, 287]], ["S035", [87, 312, 185, 394]], ["C027", [511, 240, 558, 320]],
      ["C026", [559, 240, 607, 320]], ["C017", [1157, 240, 1202, 320]],
      ["S016", [1259, 273, 1220, 208, 1295, 165, 1333, 229]],
      ["S015", [1309, 360, 1270, 295, 1341, 252, 1381, 316]]
    ],
    F: [
      ["S140", [126, 178, 229, 269]], ["S141", [126, 295, 230, 378]], ["C139", [283, 218, 335, 304]],
      ["C138", [334, 218, 384, 304]], ["C137", [384, 218, 434, 304]], ["C136", [434, 218, 485, 304]],
      ["B135", [485, 218, 537, 304]], ["B134", [537, 218, 591, 304]], ["B133", [589, 218, 639, 304]],
      ["B132", [639, 218, 691, 304]], ["B131", [940, 218, 994, 303]], ["B130", [991, 218, 1040, 303]],
      ["B129", [1039, 217, 1089, 303]], ["B128", [1088, 217, 1138, 303]], ["C127", [1138, 217, 1185, 303]],
      ["C126", [1185, 217, 1235, 303]], ["C125", [1234, 217, 1283, 303]], ["C124", [1283, 217, 1333, 303]],
      ["S123", [1396, 248, 1355, 178, 1437, 130, 1478, 201]],
      ["S122", [1403, 368, 1362, 298, 1489, 224, 1530, 294]],
      ["H114", [1466, 568, 1432, 510, 1527, 455, 1561, 513]],
      ["H113", [1516, 658, 1477, 591, 1563, 542, 1602, 608]],
      ["C154", [381, 530, 430, 617]], ["C153", [431, 530, 481, 618]], ["C152", [480, 530, 534, 618]]
    ],
    S: [
      ["S241", [119, 165, 224, 257]], ["S242", [120, 282, 225, 363]], ["C240", [274, 203, 324, 286]],
      ["B236", [465, 203, 512, 286]], ["B235", [511, 203, 559, 286]], ["B234", [559, 203, 607, 286]],
      ["B233", [607, 203, 661, 286]], ["C231", [916, 199, 963, 279]], ["C230", [962, 199, 1011, 280]],
      ["C229", [1010, 198, 1058, 280]], ["C228", [1058, 197, 1105, 280]], ["C227", [1106, 198, 1153, 280]],
      ["C226", [1152, 198, 1200, 280]], ["C225", [1201, 198, 1249, 280]], ["C224", [1249, 198, 1300, 280]],
      ["H210", [1448, 534, 1403, 462, 1512, 394, 1557, 465]],
      ["H209", [1506, 629, 1460, 555, 1573, 486, 1618, 559]],
      ["C260", [119, 492, 173, 585]], ["C259", [172, 492, 223, 585]], ["C258", [268, 492, 317, 585]],
      ["C257", [316, 492, 364, 584]], ["C256", [363, 492, 412, 584]],
      ["C265", [617, 698, 512, 698, 512, 612, 617, 612]]
    ]
  };

  var META = {
    G: { name: "Ground Floor", short: "Ground", level: "Level 0", img: IMG_DIR + "1.png" },
    F: { name: "First Floor", short: "First", level: "Level 1", img: IMG_DIR + "2.png" },
    S: { name: "Second Floor", short: "Second", level: "Level 2", img: IMG_DIR + "3.png" }
  };

  var FLOORS = ["G", "F", "S"].map(function (id) {
    var rooms = RAW[id].map(function (r) {
      var g = r[1], pts = [];
      if (g.length === 4) pts = [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]];
      else for (var i = 0; i < g.length; i += 2) pts.push([g[i], g[i + 1]]);
      var cx = 0, cy = 0;
      pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
      cx = Math.round(cx / pts.length); cy = Math.round(cy / pts.length);
      return { code: r[0], floor: id, pts: pts, cx: cx, cy: cy };
    });
    return { id: id, name: META[id].name, short: META[id].short, level: META[id].level, img: META[id].img, rooms: rooms };
  });

  window.TechOpsData = {
    W: 1673,
    H: 940,
    FLOORS: FLOORS,
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
    STATUSES: ["New", "Acknowledged", "In progress", "Resolved"]
  };
})();
