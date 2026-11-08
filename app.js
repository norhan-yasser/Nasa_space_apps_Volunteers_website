/**
 * NASA Space Apps Challenge - Cairo Venue & Floor Operations
 * Clean, Professional Operations & Floor Navigation System
 * Google Sheets Realtime Database Integration
 */

const W = 1673, H = 940;

/* Official NASA Space Apps Brand Palette */
const COL = {
  ok: "#10b981",    // Accessible & Assigned (Emerald Green)
  no: "#ef4444",    // Restricted (Cosmic Crimson)
  na: "#64748b",    // Accessible & Unassigned (Muted Slate)
  sel: "#fb9746"   // Selected Room & Active Route (Supernova Orange)
};

const TYPES = {
  B: "Bring Your Own Device",
  H: "Lecture Hall",
  S: "Small Lecture Hall",
  C: "Classroom",
  X: "Inaccessible",
  T: "Outer Stage",
  P: "Prayer Room",
  A: "Cafeteria",
  K: "Break Area"
};
/* codes whose first letter is NOT their type */
const SPECIAL_TYPE = { STAGE: "T", CAFETERIA: "A", "BREAK-1": "K", "BREAK-2": "K" };

const IMG = {
  B: "assets/floors/0.png",
  G: "assets/floors/1.png",
  F: "assets/floors/2.png",
  S: "assets/floors/3.png"
};
/* Room geometry (pixels of the original image). Rect = 4 numbers, polygon = flat x,y pairs. Placeholder outlines: refine in the editor. */
const R=(a,b)=>a.map((c,i)=>[c,...b[i]]);

/* Basement: only the two prayer rooms are marked (plan 0.png). Names shown next to the room code. */
const ROOM_NAMES = { "PR-F": "Female", "PR-M": "Men" };
const FLOORS=[
{id:"B",name:"Basement",rooms:[
["PR-F",[970,382,1048,505]],["PR-M",[1087,382,1188,575]]]},
{id:"G",name:"Ground Floor",rooms:[
["S034",[86,201,185,287]],["S035",[87,312,185,394]],["C027",[511,240,558,320]],["C026",[559,240,607,320]],["C017",[1157,240,1202,320]],
["S016",[1259,273,1220,208,1295,165,1333,229]],["S015",[1309,360,1270,295,1341,252,1381,316]],["X",[87,536,187,690]],["X",[978,347,1199,390]],["X",[978,538,1245,609]],
["X",[934,636,1153,716]],
/* Cafeteria: the open area east of the auditorium block, labelled on the ground plan */
["CAFETERIA",[990,396,1250,528]],
/* Outer Stage (outdoor, east of the building) - only data kept: the people responsible for arranging it */
["STAGE",[1462,182,1660,213,1617,499,1414,470]]]},
{id:"F",name:"First Floor",rooms:[
["S140",[126,178,229,269]],["S141",[126,295,230,378]],["C139",[283,218,335,304]],["C138",[334,218,384,304]],["C137",[384,218,434,304]],
["C136",[434,218,485,304]],["B135",[485,218,537,304]],["B134",[537,218,591,304]],["B133",[589,218,639,304]],["B132",[639,218,691,304]],
["B131",[940,218,994,303]],["B130",[991,218,1040,303]],["B129",[1039,217,1089,303]],["B128",[1088,217,1138,303]],["C127",[1138,217,1185,303]],
["C126",[1185,217,1235,303]],["C125",[1234,217,1283,303]],["C124",[1283,217,1333,303]],["S123",[1396,248,1355,178,1437,130,1478,201]],["S122",[1403,368,1362,298,1489,224,1530,294]],
["H114",[1466,568,1432,510,1527,455,1561,513]],["H113",[1516,658,1477,591,1563,542,1602,608]],["C154",[381,530,430,617]],["C153",[431,530,481,618]],["C152",[480,530,534,618]],
["X",[125,529,228,618]],["X",[280,529,381,617]],["X",[124,647,228,696]],["X",[279,647,379,728]],["X",[1088,526,1186,610]],
["X",[1185,526,1286,610]],["X",[1286,526,1387,610]],["X",[1088,640,1186,724]],["X",[1185,640,1284,724]],
/* Break area (labelled BREAK on the plan, east of the auditorium) */
["BREAK-1",[942,431,1086,578]]]},
{id:"S",name:"Second Floor",rooms:[
["S241",[119,165,224,257]],["S242",[120,282,225,363]],["C240",[274,203,324,286]],["B236",[465,203,512,286]],["B235",[511,203,559,286]],
["B234",[559,203,607,286]],["B233",[607,203,661,286]],["C231",[916,199,963,279]],["C230",[962,199,1011,280]],["C229",[1010,198,1058,280]],
["C228",[1058,197,1105,280]],["C227",[1106,198,1153,280]],["C226",[1152,198,1200,280]],["C225",[1201,198,1249,280]],["C224",[1249,198,1300,280]],
["H210",[1448,534,1403,462,1512,394,1557,465]],["H209",[1506,629,1460,555,1573,486,1618,559]],["C260",[119,492,173,585]],["C259",[172,492,223,585]],["C258",[268,492,317,585]],
["C257",[316,492,364,584]],["C256",[363,492,412,584]],["C265",[617,698,512,698,512,612,617,612]],["X",[322,203,370,286]],["X",[371,203,417,286]],
["X",[417,203,464,286]],["X",[397,315,489,364]],["X",[907,242,917,282,914,376,665,375,662,246,717,192,862,191]],["X",[894,405,870,552,714,552,685,406]],["X",[1364,220,1324,154,1409,103,1449,168]],
["X",[1420,312,1377,243,1462,190,1505,259]],["X",[1053,504,1146,575]],["X",[1146,504,1249,575]],["X",[1249,504,1346,575]],["X",[1008,612,1147,703]],
["X",[1247,619,1243,698,1148,699,1146,624,1153,615,1237,612]],["X",[268,618,364,698]],["X",[162,611,223,660]],["X",[413,493,463,584]],["X",[464,493,518,584]],
["BREAK-2",[948,404,1052,584]]]}];

/* Normalise room geometry & data structures */
FLOORS.forEach(f => {
  let n = 0;
  f.rooms = f.rooms.map(([c, g]) => {
    const pts0 = g.length == 4 
      ? [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]] 
      : g.reduce((a, v, i) => (i % 2 ? a[a.length - 1].push(v) : a.push([v]), a), []);
    const pts = pts0;   /* geometry is now measured directly on the floor images */
    const x = c == "X";
    if (x) n++;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return {
      code: x ? "X-" + f.id + String(n).padStart(2, "0") : c,
      name: ROOM_NAMES[c] || null,   /* restricted rooms carry no public label or code */
      floor: f.id,
      type: SPECIAL_TYPE[c] || c[0],   /* PR-* = P (prayer room) */
      pts,
      bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    };
  });
});

const ALL = FLOORS.flatMap(f => f.rooms);

/* Data layer (local browser storage with Google Sheets real-time sync) */
let DB = {};
try {
  DB = JSON.parse(localStorage.getItem("rooms") || "{}");
} catch (e) {}

// Pre-fill default assignments if empty
if (Object.keys(DB).length === 0) {
  DB = {
    C026: { resp: "Eng. Mohamed Khairy", cap: 35, mode: "Participants", access: "ok", chal: "Imager for Magnetopause-to-Aurora Exploration", teams: ["Artemis Coders", "Aurora Hunters", "Polar Orbiters"] },
    C027: { resp: "Eng. Karim", cap: 28, mode: "Participants", access: "ok", chal: "Community Mapping: Earth Observations", teams: ["GeoPioneers", "TerraNova Sync"] },
    H113: { resp: "Eng. Tasbeeh", cap: 120, mode: "Participants", access: "ok", chal: "Planetary Landers: Hazard Navigation", teams: ["Cosmic Navigators", "Orion Orbiters", "Lunar Dynamics", "DeepSpace Apollo"] },
    B133: { resp: "Eng. Omar", cap: 16, mode: "Volunteers", access: "ok", vteam: "Tech Ops & Hardware Strike Team", vcap: 16 },
    S140: { resp: "Eng. Lojine", cap: 45, mode: "Participants", access: "ok", chal: "Seismic Detection Across the Solar System", teams: ["AstroSeismo", "QuakeVoyagers"] },
    B236: { resp: "NASA Space Apps Cairo Mentors", cap: 20, mode: "Volunteers", access: "ok", vteam: "Technical Mentors & VIP Command", vcap: 20 }
  };
  try { localStorage.setItem("rooms", JSON.stringify(DB)); } catch (e) {}
}

const save = () => {
  try {
    localStorage.setItem("rooms", JSON.stringify(DB));
  } catch (e) {}
};

const D = r => DB[r.code] || {};
const access = r => D(r).access || (r.type == "X" ? "no" : "ok");
const mode = r => D(r).mode || "Unassigned";
const teams = r => (D(r).teams || []).filter(Boolean);

/* Access-control logic */
const canView = r => access(r) == "ok";
let floor = null, sel = null;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]));
const color = r => r.type == "T" ? "#14b8a6" : r.type == "P" ? "#8b5cf6" : r.type == "A" ? "#d97706" : r.type == "K" ? "#0ea5e9" : access(r) == "no" ? COL.no : mode(r) == "Unassigned" ? COL.na : COL.ok;

/* Theme handling */
function initTheme() {
  const saved = localStorage.getItem("techops_theme") || localStorage.getItem("nasa_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeButton(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current == "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("techops_theme", next);
    localStorage.setItem("nasa_theme", next);
  } catch (e) {}
  updateThemeButton(next);
}

function updateThemeButton(theme) {
  const label = theme == "dark" ? "Light" : "Dark";
  const btn = $("theme-toggle");
  if (btn) {
    btn.innerHTML = theme == "dark" 
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg><span class="btn-text">Light</span>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span class="btn-text">Dark</span>';
  }
  const mText = $("mobile-theme-text");
  if (mText) mText.textContent = label;
}

/* Google Sheets Realtime Database Engine */
const DEFAULT_SHEET_ID = "1E4-_JjPiIhed005w43jl1s-FfmRiAzNaISEfJZihAbQ";
let GSHEET_URL = localStorage.getItem("nasa_gsheet_url") || DEFAULT_SHEET_ID;

function extractSheetId(urlOrId) {
  if (!urlOrId) return "";
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

// Robust RFC-4180 CSV parser
function parseCSV(text) {
  const rows = [];
  let row = [];
  let val = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        val += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        val += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(val.trim());
        val = '';
      } else if (ch === '\r' || ch === '\n') {
        row.push(val.trim());
        val = '';
        if (row.length > 1 || row[0] !== '') {
          rows.push(row);
        }
        row = [];
        if (ch === '\r' && next === '\n') i++;
      } else {
        val += ch;
      }
    }
  }
  if (val || row.length) {
    row.push(val.trim());
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function loadGoogleSheetJSONP(sheetId) {
  return new Promise((resolve, reject) => {
    const callbackName = "handleGSheet_" + Math.random().toString(36).substring(2, 9);
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Request timed out"));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    window[callbackName] = function(data) {
      cleanup();
      if (!data || !data.table) {
        reject(new Error("Invalid spreadsheet format"));
        return;
      }
      resolve(data.table);
    };

    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?headers=1&tqx=responseHandler:${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Failed to load Google Sheet script"));
    };
    document.head.appendChild(script);
  });
}

async function syncFromGoogleSheet(urlOrId, silent = false) {
  const statusEl = $("gsheet-status");
  const sheetId = extractSheetId(urlOrId || GSHEET_URL);
  
  if (!sheetId) {
    if (!silent && statusEl) {
      statusEl.className = "sheet-status-badge warning";
      statusEl.textContent = "Please enter a valid Google Sheet URL or ID";
    }
    return false;
  }

  if (statusEl && !silent) {
    statusEl.className = "sheet-status-badge syncing";
    statusEl.textContent = "Syncing with Google Sheets…";
  }

  try {
    const table = await loadGoogleSheetJSONP(sheetId);
    let updatedCount = 0;

    for (const row of table.rows) {
      if (!row || !row.c) continue;
      const getVal = (idx) => {
        const cell = row.c[idx];
        return cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : "";
      };

      const code = getVal(0).toUpperCase();
      if (!code) continue;

      const floorName = getVal(1);
      const spaceType = getVal(2);
      const accRaw = getVal(3).toLowerCase();
      const modeRaw = getVal(4);
      const respRaw = getVal(5);
      const capRaw = getVal(6);
      const chalRaw = getVal(7);
      const teamsRaw = getVal(8);
      const vteamRaw = getVal(9);
      const vcapRaw = getVal(10);

      const parsedTeams = teamsRaw ? teamsRaw.split(/[;,]/).map(s => s.trim()).filter(Boolean) : [];

      DB[code] = {
        resp: respRaw,
        cap: capRaw === "" ? "" : Math.max(0, parseInt(capRaw) || 0),
        mode: modeRaw || "Unassigned",
        access: accRaw.startsWith("res") || accRaw === "no" ? "no" : "ok",
        chal: chalRaw,
        teams: parsedTeams,
        vteam: vteamRaw,
        vcap: vcapRaw === "" ? "" : Math.max(0, parseInt(vcapRaw) || 0)
      };
      updatedCount++;
    }

    save();
    GSHEET_URL = sheetId;
    localStorage.setItem("nasa_gsheet_url", sheetId);

    if (statusEl) {
      statusEl.className = "sheet-status-badge success";
      statusEl.textContent = `✓ Synced: ${updatedCount} rooms updated from Google Sheets`;
    }

    if (floor) {
      draw();
    } else if (!ROUTE) {
      const prevFrom = $("qw-from") ? $("qw-from").value : "";
      const prevTo = $("qw-to") ? $("qw-to").value : "";
      home();
      if ($("qw-from") && prevFrom) $("qw-from").value = prevFrom;
      if ($("qw-to") && prevTo) $("qw-to").value = prevTo;
    }
    return true;
  } catch (err) {
    console.warn("Google Sheet sync error:", err);
    if (statusEl && !silent) {
      statusEl.className = "sheet-status-badge error";
      statusEl.textContent = "Sync failed. Ensure sheet is set to 'Anyone with link can view'.";
    }
    return false;
  }
}

/* Views & Navigation */
function home() {
  floor = null;
  $("home").hidden = false;
  $("fv").hidden = true;
  if ($("crumb")) {
    $("crumb").hidden = false;
    $("crumb").innerHTML = '<span class="crumb-active">Overview</span>';
  }
  if ($("map-filter-panel")) $("map-filter-panel").hidden = true;
  if ($("filter-toggle")) $("filter-toggle").setAttribute("aria-expanded", "false");

  const quickWayfindHtml = `
    <div class="quick-wayfind-card">
      <div class="qw-header">
        <div class="qw-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
        <div class="qw-text">
          <h3 class="qw-title">Room-to-Room Path Search &amp; Directions</h3>
          <p class="qw-desc">
            Find the optimal walking route between any room and destination.
          </p>
        </div>
      </div>
      <div class="qw-controls">
        <div class="qw-input-col">
          <label for="qw-from">Origin:</label>
          <div class="qw-input-wrap">
            <input id="qw-from" list="dl" placeholder="ENTRANCE or Room (e.g. C026)" autocomplete="off">
            <button type="button" class="qw-mini-btn" id="qw-ent-btn">Entrance</button>
          </div>
        </div>
        <div class="qw-swap-col">
          <button class="btn qw-swap-btn" id="qw-swap" title="Swap direction">⇄</button>
        </div>
        <div class="qw-input-col">
          <label for="qw-to">Destination:</label>
          <input id="qw-to" list="dl" placeholder="Room code (e.g. S140, B133, H113)" autocomplete="off">
        </div>
        <div class="qw-action-col">
          <button class="btn on qw-btn" id="qw-go">Find Path →</button>
        </div>
      </div>
    </div>
  `;

  let cardsHtml = FLOORS.map(f => {
    const a = f.rooms.filter(r => r.type != "T" && r.type != "A" && r.type != "K" && access(r) == "ok").length;   /* accessible rooms only (no total, no restricted, no stage) */
    const levelCode = f.id == "B" ? "Level -1" : f.id == "G" ? "Level 0" : f.id == "F" ? "Level 1" : "Level 2";
    return `
      <div class="fc" data-f="${f.id}">
        <div class="fc-preview">
          <img src="${IMG[f.id]}" alt="${f.name} Floor Plan">
          <div class="fc-badge">${levelCode}</div>
        </div>
        <div class="fc-body">
          <div class="fc-meta">
            <h3 class="fc-title">${f.name}</h3>
            <div class="fc-pills">
              <span class="pill pill-ok">${a} Accessible Rooms</span>
            </div>
          </div>
          <button class="fc-btn" tabindex="-1">Open Floor Map →</button>
        </div>
      </div>
    `;
  }).join("");

  $("home").innerHTML = `
    ${quickWayfindHtml}
    <div class="grid">${cardsHtml}</div>
    <div class="note">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>Select a floor to view room allocations, space accessibility, and interactive corridor navigation.</span>
    </div>
  `;

  $("home").querySelectorAll(".fc").forEach(e => e.onclick = () => open(e.dataset.f));
  fillDL();
  const qwGo = $("qw-go");
  if (qwGo) {
    qwGo.onclick = () => {
      const from = $("qw-from").value.trim() || "ENTRANCE";
      const to = $("qw-to").value.trim();
      if (!to) {
        openDir("t", "");
        return;
      }
      $("df").value = from;
      $("dt").value = to;
      $("dir").style.display = "block";
      go();
    };
  }
  const qwEnt = $("qw-ent-btn");
  if (qwEnt) qwEnt.onclick = () => { $("qw-from").value = "ENTRANCE"; };
  const qwSwap = $("qw-swap");
  if (qwSwap) qwSwap.onclick = () => {
    const tmp = $("qw-from").value;
    $("qw-from").value = $("qw-to").value;
    $("qw-to").value = tmp;
  };
}

const map = $("map"), stage = $("stage");
let V = { k: 1, x: 0, y: 0 };

function apply() {
  stage.style.transform = `translate(${V.x}px,${V.y}px) scale(${V.k})`;
}

function reset() {
  const cw = map.clientWidth || 360, ch = map.clientHeight || 280;
  if (cw < 640) {
    /* Mobile portrait fit: fill the map frame cleanly without top/bottom black bars */
    const k = Math.max(cw / (W * 0.88), ch / (H * 0.78));
    V = { k, x: cw / 2 - (W * 0.50) * k, y: ch / 2 - (H * 0.46) * k };
  } else {
    const k = Math.min(cw / W, ch / H);
    V = { k, x: (cw - W * k) / 2, y: (ch - H * k) / 2 };
  }
  apply();
}

function open(id, focus) {
  floor = FLOORS.find(f => f.id == id);
  $("home").hidden = true;
  $("fv").hidden = false;
  $("img").src = IMG[id];

  if ($("crumb")) {
    $("crumb").hidden = true;
    $("crumb").innerHTML = `<a id="bc">Overview</a> <span class="crumb-sep">›</span> <span class="crumb-active">${floor.name}</span>`;
    if ($("bc")) $("bc").onclick = home;
  }

  $("tabs").innerHTML = FLOORS.map(f => `
    <button class="btn ${f.id == id ? "on" : ""}" data-f="${f.id}">
      ${f.name.replace(" Floor", "")}
    </button>
  `).join("");

  $("tabs").querySelectorAll("button").forEach(b => b.onclick = () => open(b.dataset.f));
  draw();
  reset();
  if (focus) zoomTo(focus);
}

function draw() {
  const ft = $("ft").value, fa = $("fa").value, fs = $("fs").value;
  $("svg").innerHTML = floor.rooms.map(r => {
    const dim = (ft && r.type != ft) || (fa && access(r) != fa) || (fs && mode(r) != fs);
    const isSel = r === sel;
    const no = access(r) == "no";
    const c = isSel && !no ? COL.sel : color(r);
    const p = r.pts.map(q => q.join(",")).join(" ");
    return `<polygon class="rm ${r.type == 'T' ? 'stage' : ''} ${isSel ? 'sel' : ''}" data-c="${r.code}" points="${p}" fill="${c}" fill-opacity="${dim ? .03 : isSel ? .55 : no ? .42 : .22}" stroke="${c}" stroke-width="${isSel ? 3.5 : 2}" stroke-opacity="${dim ? .2 : 1}" tabindex="0" aria-label="${no ? 'Restricted area' : 'Room ' + r.code}"/>`;
  }).join("") + bathsSvg() + exitsSvg() + stairsSvg() + routeSvg();

  $("svg").querySelectorAll(".rm").forEach(e => {
    const r = ALL.find(x => x.code == e.dataset.c);
    e.onclick = () => { if (moved < 10) show(r); };
    e.onkeydown = ev => { if (ev.key == "Enter") show(r); };
    e.onmousemove = ev => {
      const b = map.getBoundingClientRect(), t = $("tip");
      t.style.display = "block";
      const acc = access(r) == "no" ? '<span class="tip-tag tip-no">Restricted</span>' : '<span class="tip-tag tip-ok">Accessible</span>';
      const m = mode(r) != "Unassigned" ? ` · ${mode(r)}` : "";
      t.innerHTML = access(r) == "no"
        ? `<div class="tip-head"><b>Restricted area</b> ${acc}</div>`
        : `<div class="tip-head"><b>${r.code}</b> ${acc}</div><div class="tip-sub">${TYPES[r.type] || "Room"}${m}</div>`;
      t.style.left = ev.clientX - b.left + 14 + "px";
      t.style.top = ev.clientY - b.top + 14 + "px";
    };
    e.onmouseleave = () => $("tip").style.display = "none";
  });

  $("svg").querySelectorAll(".stair-active").forEach(e => {
    const k = e.dataset.stair;
    const name = e.dataset.name;
    e.onmousemove = ev => {
      const b = map.getBoundingClientRect(), t = $("tip");
      t.style.display = "block";
      t.innerHTML = `<div class="tip-head"><b>${esc(name)}</b> <span class="tip-tag tip-ok">Active Stairs</span></div><div class="tip-sub">Authorized inner staircase · ${STAIR_CONNECTS[k]}</div>`;
      t.style.left = ev.clientX - b.left + 14 + "px";
      t.style.top = ev.clientY - b.top + 14 + "px";
    };
    e.onmouseleave = () => $("tip").style.display = "none";
    e.onclick = () => {
      if (moved < 10) openDir("t", `STAIR-${k}`);
    };
  });

  $("svg").querySelectorAll(".stair-closed").forEach(e => {
    const name = e.dataset.name;
    e.onmousemove = ev => {
      const b = map.getBoundingClientRect(), t = $("tip");
      t.style.display = "block";
      t.innerHTML = `<div class="tip-head"><b>${esc(name)}</b> <span class="tip-tag tip-no" style="background:rgba(37,72,230,0.25);color:#93c5fd;border:1px solid #2548e6">Unavailable</span></div><div class="tip-sub">Emergency exit only · Closed for venue wayfinding</div>`;
      t.style.left = ev.clientX - b.left + 14 + "px";
      t.style.top = ev.clientY - b.top + 14 + "px";
    };
    e.onmouseleave = () => $("tip").style.display = "none";
  });

  $("svg").querySelectorAll(".exit-mk").forEach(e => {
    const x = EXITS.find(v => v.id == e.dataset.exit);
    e.onmousemove = ev => {
      const bb = map.getBoundingClientRect(), t = $("tip");
      t.style.display = "block";
      t.innerHTML = `<div class="tip-head"><b>${esc(x.label)}</b> <span class="tip-tag" style="background:rgba(34,197,94,.22);color:#86efac;border:1px solid #22c55e">Exit</span></div><div class="tip-sub">Click for directions</div>`;
      t.style.left = ev.clientX - bb.left + 14 + "px";
      t.style.top = ev.clientY - bb.top + 14 + "px";
    };
    e.onmouseleave = () => $("tip").style.display = "none";
    e.onclick = () => { if (moved < 10) openDir("t", x.id); };
  });

  $("svg").querySelectorAll(".wc").forEach(e => {
    const b = BATH_ALL.find(x => x.id == e.dataset.wc);
    e.onmousemove = ev => {
      const bb = map.getBoundingClientRect(), t = $("tip");
      t.style.display = "block";
      t.innerHTML = `<div class="tip-head"><b>${esc(b.label)}</b> <span class="tip-tag" style="background:rgba(236,72,153,.25);color:#f9a8d4;border:1px solid #ec4899">Bathroom</span></div><div class="tip-sub">Click for directions</div>`;
      t.style.left = ev.clientX - bb.left + 14 + "px";
      t.style.top = ev.clientY - bb.top + 14 + "px";
    };
    e.onmouseleave = () => $("tip").style.display = "none";
    e.onclick = () => { if (moved < 10) openDir("t", b.id); };
  });

  $("leg").innerHTML = [
    ["ok", "Accessible, assigned"],
    ["na", "Accessible, unassigned"],
    ["no", "Restricted"],
    ["sel", "Selected"]
  ].map(([k, t]) => `<span><i style="background:${COL[k]}"></i>${t}</span>`).join("")
  + `<span><i class="leg-stair-ok"></i>Authorized Stairs (Available)</span>`
  + `<span><i class="leg-stair-no"></i>Emergency Stairs (Closed)</span>`
  + `<span><i class="leg-wc"></i>Bathrooms</span>`
  + (floor.id == "F" || floor.id == "S" ? `<span><i style="background:#0ea5e9"></i>Break Area</span>` : "")
  + (floor.id == "B" ? `<span><i style="background:#8b5cf6"></i>Prayer Rooms</span>` : "")
  + (floor.id == "G" ? `<span><i class="leg-exit"></i>Exits (5)</span><span><i class="leg-stage"></i>Outer Stage</span><span><i style="background:#d97706"></i>Cafeteria</span>` : "");
}

function updateFilterBadge() {
  const count = [$("ft").value, $("fa").value, $("fs").value].filter(Boolean).length;
  const badge = $("filter-badge");
  const toggleBtn = $("filter-toggle");
  if (badge) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
  if (toggleBtn) {
    toggleBtn.classList.toggle("on", count > 0);
  }
}

["ft", "fa", "fs"].forEach(i => $(i).onchange = () => {
  updateFilterBadge();
  draw();
});

const filterToggle = $("filter-toggle");
const filterPanel = $("map-filter-panel");
const filterClose = $("filter-close");
const filterReset = $("filter-reset");

if (filterToggle && filterPanel) {
  filterToggle.onclick = e => {
    e.stopPropagation();
    const openState = filterPanel.hidden;
    filterPanel.hidden = !openState;
    filterToggle.setAttribute("aria-expanded", openState ? "true" : "false");
  };
  document.addEventListener("click", e => {
    if (!filterPanel.hidden && !e.target.closest(".filter-wrap")) {
      filterPanel.hidden = true;
      filterToggle.setAttribute("aria-expanded", "false");
    }
  });
}
if (filterClose && filterPanel) {
  filterClose.onclick = () => {
    filterPanel.hidden = true;
    if (filterToggle) filterToggle.setAttribute("aria-expanded", "false");
  };
}
if (filterReset) {
  filterReset.onclick = () => {
    $("ft").value = "";
    $("fa").value = "";
    $("fs").value = "";
    updateFilterBadge();
    if (floor) draw();
  };
}

/* Zoom & Pan Handlers */
let moved = 0, g0 = null;
const P = new Map();

const snap = () => {
  const a = [...P.values()];
  if (a.length == 1) g0 = { x: a[0].x, y: a[0].y, vx: V.x, vy: V.y };
  else if (a.length >= 2) {
    const [p, q] = a;
    g0 = { d: Math.hypot(p.x - q.x, p.y - q.y) || 1, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, V: { ...V } };
  } else g0 = null;
};

map.onpointerdown = e => {
  if (e.target.closest(".zc")) return;
  P.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  snap();
  map.style.cursor = "grabbing";
};

addEventListener("pointermove", e => {
  if (!P.has(e.pointerId)) return;
  P.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const a = [...P.values()], b = map.getBoundingClientRect();
  if (a.length == 1 && g0 && g0.vx !== undefined) {
    const dx = a[0].x - g0.x, dy = a[0].y - g0.y;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    V.x = g0.vx + dx;
    V.y = g0.vy + dy;
    apply();
  } else if (a.length >= 2 && g0 && g0.d) {
    const [p, q] = a, d = Math.hypot(p.x - q.x, p.y - q.y), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    moved = 99;
    const k = Math.max(.3, Math.min(8, g0.V.k * d / g0.d)), r = k / g0.V.k, cx = g0.mx - b.left, cy = g0.my - b.top;
    V.k = k;
    V.x = (mx - b.left) - (cx - g0.V.x) * r;
    V.y = (my - b.top) - (cy - g0.V.y) * r;
    apply();
  }
});

const up = e => {
  if (!P.has(e.pointerId)) return;
  P.delete(e.pointerId);
  snap();
  if (!P.size) {
    map.style.cursor = "grab";
    setTimeout(() => moved = 0, 0);
  }
};

addEventListener("pointerup", up);
addEventListener("pointercancel", up);

function zoom(f, cx, cy) {
  const b = map.getBoundingClientRect();
  cx = cx ?? b.width / 2;
  cy = cy ?? b.height / 2;
  const k = Math.max(.3, Math.min(8, V.k * f)), r = k / V.k;
  V.x = cx - (cx - V.x) * r;
  V.y = cy - (cy - V.y) * r;
  V.k = k;
  apply();
}

map.addEventListener("wheel", e => {
  e.preventDefault();
  const b = map.getBoundingClientRect();
  zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - b.left, e.clientY - b.top);
}, { passive: false });

$("zi").onclick = () => zoom(1.3);
$("zo").onclick = () => zoom(1 / 1.3);
$("zr").onclick = reset;

function zoomTo(r) {
  const [w, h] = [r.bb[2] - r.bb[0], r.bb[3] - r.bb[1]];
  const cw = map.clientWidth, ch = map.clientHeight;
  const k = Math.min(cw / (w * 3), ch / (h * 3), 4);
  V = { k, x: cw / 2 - (r.bb[0] + w / 2) * k, y: ch / 2 - (r.bb[1] + h / 2) * k };
  stage.style.transition = "transform .4s cubic-bezier(0.16, 1, 0.3, 1)";
  apply();
  setTimeout(() => stage.style.transition = "", 450);
}

/* Room Modal Dialog */
function row(k, v) {
  return `<span>${k}</span><span class="${v ? "kv-val" : "na"}">${v ? esc(v) : "Not assigned"}</span>`;
}

function show(r) {
  sel = r;
  draw();
  const d = D(r), a = access(r), m = $("modal");
  const tag = `<span class="tag" style="background:${a == "no" ? COL.no : COL.ok}">${a == "no" ? "Restricted" : "Accessible"}</span>`;
  
  let h = `
    <div class="mh">
      <div>
        <h2>${r.type == "T" ? "Outer Stage" : a == "no" ? "Restricted Area" : r.code}</h2>
        <div class="pill">${a == "no" ? "Restricted" : (r.name ? esc(r.name) + " · " : "") + TYPES[r.type]} · ${FLOORS.find(f => f.id == r.floor).name}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${tag}
        <button class="x" id="cl" aria-label="Close">×</button>
      </div>
    </div>
  `;

  if (!canView(r)) {
    h += `
      <div class="warn">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${COL.no}" stroke-width="2">
          <rect x="4" y="11" width="16" height="10" rx="2"/>
          <path d="M8 11V7a4 4 0 018 0v4"/>
        </svg>
        <b>Access Restricted</b>
        <span class="pill">This room is restricted for operations staff and authorized personnel.</span>
      </div>
    `;
  } else if (r.type == "P" || r.type == "A" || r.type == "K") {
    h += `
      <div class="sec">
        <h4>${TYPES[r.type]}</h4>
        <div class="kv">
          ${row("Person responsible", d.resp)}
          ${row("Space Capacity", d.cap != null && d.cap !== "" ? d.cap + " people" : "")}
        </div>
      </div>
    `;
  } else if (r.type == "T") {
    const names = (d.resp || "").split(/[;,]/).map(s => s.trim()).filter(Boolean);
    h += `
      <div class="sec">
        <h4>Stage Management</h4>
        <div class="kv">${row("Total people responsible", names.length ? String(names.length) : "")}</div>
        <div style="margin-top:10px">
          <div class="pill" style="margin-bottom:6px">Responsible for arranging the stage</div>
          ${names.length ? names.map(x => `<span class="chip">${esc(x)}</span>`).join("") : "<span class='na'>Not assigned</span>"}
        </div>
      </div>
    `;
  } else {
    const t = teams(r);
    h += `
      <div class="sec">
        <h4>Room Assignment Details</h4>
        <div class="kv">
          ${row("Lead Manager", d.resp)}
          ${row("Space Capacity", d.cap != null && d.cap !== "" ? d.cap + " people" : "")}
          ${row("Assignment Type", mode(r) == "Unassigned" ? "" : mode(r))}
        </div>
      </div>
    `;

    if (mode(r) == "Participants") {
      h += `
        <div class="sec">
          <h4>Assigned Challenge &amp; Teams</h4>
          <div class="kv">
            ${row("Challenge Track", d.chal)}
            ${row("Total Teams", t.length ? String(t.length) + " teams" : "")}
          </div>
          <div style="margin-top:10px">
            ${t.length ? t.map(x => `<span class="chip">${esc(x)}</span>`).join("") : "<span class='na'>No teams assigned yet</span>"}
          </div>
        </div>
      `;
    }

    if (mode(r) == "Volunteers") {
      h += `
        <div class="sec">
          <h4>Volunteer Squad</h4>
          <div class="kv">
            ${row("Volunteer Team", d.vteam)}
            ${row("Team Capacity", d.vcap != null && d.vcap !== "" ? d.vcap + " people" : "")}
          </div>
        </div>
      `;
    }

    if (mode(r) == "Unassigned") {
      h += `<div class="sec"><span class="na">No participants or volunteers assigned to this room.</span></div>`;
    }
  }

  if (canView(r)) {
    h += `
      <div class="modal-actions">
        <button class="btn" data-d="f">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/></svg>
          Directions from here
        </button>
        <button class="btn" data-d="t">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Directions to here
        </button>
        <button class="btn btn-wc" data-d="wc">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 8h6M12 8v8M9 16h6"/></svg>
          Nearest bathroom
        </button>
      </div>
    `;
  }

  m.innerHTML = h;
  m.querySelectorAll("[data-d]").forEach(b => b.onclick = () => {
    close();
    openDir(b.dataset.d, r.code);
  });

  const bd = $("bd");
  bd.style.display = "flex";
  requestAnimationFrame(() => bd.classList.add("show"));
  $("cl").onclick = close;
}

function close() {
  const bd = $("bd");
  bd.classList.remove("show");
  setTimeout(() => { bd.style.display = "none"; }, 200);
  sel = null;
  if (floor) draw();
}

$("bd").onclick = e => { if (e.target.id == "bd") close(); };
addEventListener("keydown", e => { 
  if (e.key == "Escape") {
    close(); 
    $("res").hidden = true;
    $("dir").style.display = "none";
    const gModal = $("gsheet-modal");
    if (gModal) gModal.classList.remove("show");
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "k") {
    e.preventDefault();
    $("q").focus();
  }
});

/* Search System */
function hits(q) {
  q = q.toLowerCase();
  return ALL.filter(r => {
    const d = D(r);
    if (!canView(r)) return false;   /* restricted rooms are never listed in search */
    return [r.code, r.name, TYPES[r.type], d.resp, d.chal, d.vteam, ...teams(r)].some(s => s && String(s).toLowerCase().includes(q));
  });
}

$("q").oninput = e => {
  const q = e.target.value.trim(), res = $("res");
  if (!q) {
    res.hidden = true;
    return;
  }
  const h = hits(q).slice(0, 12);
  res.hidden = false;
  res.innerHTML = h.length 
    ? h.map(r => {
        const d = D(r), t = teams(r);
        const why = canView(r) ? (d.chal ? d.chal + " · " : "") + (t.length ? t.join(", ") : d.vteam || "") : "Restricted";
        const dirBtn = canView(r) ? `<button type="button" class="res-dir-btn" data-rc="${r.code}" title="Get directions to ${r.code}">Route →</button>` : "";
        return `<div data-c="${r.code}">
          <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">
            <b>${r.code}</b> <small>${FLOORS.find(f => f.id == r.floor).name}${why ? " · " + esc(why) : ""}</small>
          </div>
          ${dirBtn}
        </div>`;
      }).join("")
    : `<div><small>No matching rooms or teams found.</small></div>`;

  /* exits: typing "exit", "door" or "entrance" lists the 5 ground-floor exits */
  if (/^(exit|door|entr)/i.test(q)) {
    const exHtml = EXITS.map(e => `<div data-ex="${e.id}"><div style="flex:1;min-width:0"><b>${esc(e.label)}</b> <small>Exit · Ground Floor</small></div><button type="button" class="res-dir-btn" data-rc="${e.id}" title="Get directions">Route →</button></div>`).join("");
    res.innerHTML = exHtml + (h.length ? res.innerHTML : "");
    res.hidden = false;
    res.querySelectorAll("[data-ex]").forEach(e => e.onclick = ev => {
      if (ev.target.closest(".res-dir-btn")) return;
      const x = EXITS.find(v => v.id == e.dataset.ex);
      res.hidden = true;
      open("G", x);
    });
  }

  /* bathrooms: typing "bath", "wc", "toilet" or "restroom" lists them */
  if (/^(bath|wc|rest|toil|lav)/i.test(q)) {
    const wcHtml = BATH_ALL.map(b => `<div data-wc="${b.id}"><div style="flex:1;min-width:0"><b>${esc(b.label)}</b> <small>${esc(FLOORS.find(f => f.id == b.floor).name)}</small></div><button type="button" class="res-dir-btn" data-rc="${b.id}" title="Get directions">Route →</button></div>`).join("");
    res.innerHTML = wcHtml + (h.length ? res.innerHTML : "");
    res.hidden = false;
    res.querySelectorAll("[data-wc]").forEach(e => e.onclick = ev => {
      if (ev.target.closest(".res-dir-btn")) return;
      const b = BATH_ALL.find(x => x.id == e.dataset.wc);
      res.hidden = true;
      open(b.floor, b);
    });
  }

  res.querySelectorAll(".res-dir-btn").forEach(btn => {
    btn.onclick = ev => {
      ev.stopPropagation();
      const code = btn.dataset.rc;
      res.hidden = true;
      openDir("t", code);
    };
  });

  res.querySelectorAll("[data-c]").forEach(e => e.onclick = ev => {
    if (ev.target.closest(".res-dir-btn")) return;
    const r = ALL.find(x => x.code == e.dataset.c);
    res.hidden = true;
    open(r.floor, r);
    show(r);
  });
};

/* ============================================================
   WAYFINDING — simple corridor map
   Each floor has a few hand-placed corridor lines. Every room has a
   door point that snaps onto the nearest corridor, and the 5 inner
   stairs are the only way between floors. Shortest walk = Dijkstra.
   ============================================================ */
/* Only the 5 designated inner staircases are available for inter-floor routing */
const ST = {
  /* Basement is reached ONLY by the North-East (EN) and South-East (SE) stairs.
     WN / WS / SW are locked to the basement: they serve Ground -> 2nd floor only. */
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

const SN = {
  WN: "North-West Inner Stairs (Auditorium)",
  WS: "Central-West Inner Stairs",
  SW: "South-West Wing Stairs",
  EN: "North-East Inner Stairs (Auditorium)",
  SE: "South-East Wing Stairs"
};
const STAIR_CONNECTS = {
  WN: "Connects Ground, 1st &amp; 2nd Floors (no Basement access)",
  WS: "Connects Ground, 1st &amp; 2nd Floors (no Basement access)",
  SW: "Connects Ground, 1st &amp; 2nd Floors (no Basement access)",
  EN: "Connects Basement, Ground, 1st &amp; 2nd Floors",
  SE: "Connects Basement, Ground, 1st &amp; 2nd Floors"
};
const UNAVAILABLE_STAIRS = [
  { id: "NW_OUT", name: "Far NW Outer Stairs (Closed)", p: [77, 245], pf: { B: [462, 355], G: [37, 266], F: [77, 250], S: [75, 238] } },
  { id: "SW_OUT", name: "Far SW Outer Stairs (Closed)", p: [77, 645], pf: { G: [40, 659], F: [77, 660], S: [66, 634] } },
  { id: "NE_OUT", name: "Far NE Outer Stairs (Closed)", p: [1490, 150], pf: { G: [1354, 201], F: [1495, 166], S: [1476, 135] } },
  { id: "SE_OUT", name: "Far SE Outer Stairs (Closed)", p: [1595, 515], pf: { G: [1440, 538], F: [1596, 535], S: [1617, 477] } }
];
const ORD = ["B", "G", "F", "S"];
const ENT = { code: "ENTRANCE", floor: "G", p: [726, 689] };

/* ============================================================
   EXITS (green) - the main entrance + 4 small doors on the ground floor
   ============================================================ */
const EXITS = [
  { id: "ENTRANCE", label: "Main Entrance", main: true, p: ENT.p, bb: [659, 655, 801, 694] },
  { id: "EXIT-1", label: "North-West Door", p: [199, 386], bb: [186, 377, 213, 396] },
  { id: "EXIT-2", label: "North-East Door", p: [1208, 378], bb: [1195, 366, 1221, 391] },
  { id: "EXIT-3", label: "South-West Door", p: [199, 539], bb: [186, 529, 212, 550] },
  { id: "EXIT-4", label: "South-East Door", p: [1306, 573], bb: [1292, 555, 1320, 592] }
];

/* ============================================================
   BATHROOMS (pink)
   Ground floor: positions taken from the highlighted ground-floor plan.
   1st & 2nd floor: located on the plan drawings (same stall blocks) - please
   confirm with a highlighted plan and adjust the boxes [x1, y1, x2, y2] if needed.
   ============================================================ */
const BATHS = {
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
const BATH_ALL = Object.keys(BATHS).flatMap(f => BATHS[f].map(b => {
  const cy = (b.bb[1] + b.bb[3]) / 2, cx = (b.bb[0] + b.bb[2]) / 2;
  const side = (cy < 450 ? "North" : "South") + "-" + (cx < 836 ? "West" : "East");
  const fl = FLOORS.find(x => x.id == f).name.replace(" Floor", "");
  return { ...b, floor: f, side, label: `${side} Bathroom (${fl})`, door: b.door || [Math.round(cx), b.bb[1] + 4], pts: [[b.bb[0], b.bb[1]], [b.bb[2], b.bb[1]], [b.bb[2], b.bb[3]], [b.bb[0], b.bb[3]]] };
}));
let ROUTE = null;

/* Corridor centre-lines (pixels of the floor image). Lines that touch
   each other are joined automatically. Outer (closed) stairs are never
   part of this map, so they can never be used. */
const CORRIDORS = {
  B: [
    [[517, 355], [1068, 355]],                                   // north corridor
    [[517, 355], [517, 618]],                                    // west hall
    [[1068, 355], [1068, 618]],                                  // east hall (prayer rooms)
    [[517, 618], [1068, 618]],                                   // south corridor
    [[1068, 352], [1140, 352]],                                  // -> stairs EN
    [[1068, 618], [1068, 650], [1078, 703]],                     // -> stairs SE
    [[1068, 355], [1068, 318], [1086, 318]]                      // -> bathroom door
  ],
  G: [
    [[178, 334], [600, 334]],                                    // north-west corridor
    [[551, 334], [550, 500], [549, 600], [539, 613]],            // west inner hall (stairs WN, WS)
    [[830, 332], [1213, 334], [1240, 325]],                      // north-east corridor
    [[909, 334], [902, 360], [899, 560], [913, 622]],            // east inner hall (stairs EN)
    [[288, 624], [327, 624], [482, 630], [539, 613], [600, 608], [817, 610], [864, 622], [945, 623], [1076, 622], [1291, 619]],   // main east-west spine through the lobby
    [[300, 624], [300, 592], [236, 560], [199, 539]],            // spine -> hall -> south-west door
    [[1291, 619], [1306, 573]],                                  // east wing up to the south-east door
    [[1306, 573], [1265, 556], [1250, 513], [1273, 482], [1334, 448], [1422, 420]],  // outdoor path: south-east door -> around the east wing -> stage
    [[1213, 334], [1208, 378]],                                  // corridor end -> north-east door
    [[1208, 378], [1262, 420], [1334, 448]],                     // outdoor path: north-east door -> joins the stage path
    [[1208, 378], [1200, 425]],                                  // north-east door -> cafeteria
    [[1262, 420], [1200, 425]]                                   // outdoor path -> cafeteria (from the SE door / stage side)
  ],
  F: [
    [[243, 319], [680, 319]],                                    // north-west corridor
    [[243, 266], [244, 549], [243, 631]],                        // far-west vertical corridor
    [[622, 319], [622, 592], [616, 622]],                        // west inner hall
    [[940, 318], [1317, 317], [1335, 328]],                      // north-east corridor
    [[1335, 328], [1372, 305]],                                  // to S122 / S123
    [[1335, 328], [1332, 341], [1461, 588], [1448, 625]],        // diagonal wing to H113 / H114
    [[1030, 318], [1008, 330], [1005, 420], [1005, 594], [1030, 626]],   // east inner hall
    [[243, 631], [601, 632], [616, 622], [734, 611], [751, 598], [855, 597], [925, 596], [962, 621], [1030, 626], [1448, 625]]   // main east-west spine
  ],
  S: [
    [[243, 303], [681, 303]],                                    // north-west corridor
    [[243, 250], [243, 596]],                                    // far-west vertical corridor
    [[598, 303], [598, 596]],                                    // west inner hall
    [[920, 294], [1290, 294], [1298, 300]],                      // north-east corridor
    [[1298, 300], [1296, 320], [1411, 499], [1400, 536], [1417, 590]],   // diagonal wing to H209 / H210
    [[1036, 294], [975, 296], [971, 462], [980, 472], [980, 489], [966, 503], [968, 585], [985, 597]],   // east inner hall
    [[134, 598], [973, 592], [1018, 600], [1078, 596], [1383, 597], [1417, 590]]  // main east-west spine
  ]
};

/* Door points. A "row" is a line of rooms along one corridor: the door
   x comes from each room's centre, y is the room's corridor-side wall. */
const DOOR_ROWS = [
  { f: "G", y: 323, dx: 0,   codes: ["C027", "C026", "C017"] },
  { f: "F", y: 305, dx: 0,   codes: ["C139", "C138", "C137", "C136", "B135", "B134", "B133", "B132"] },
  { f: "F", y: 305, dx: 0,  codes: ["B131", "B130", "B129", "B128", "C127", "C126", "C125", "C124"] },
  { f: "F", y: 622, dx: 0,   codes: ["C154", "C153", "C152"] },
  { f: "S", y: 287, dx: 0,   codes: ["C240", "B236", "B235", "B234", "B233"] },
  { f: "S", y: 287, dx: 0,   codes: ["C231", "C230", "C229", "C228", "C227", "C226", "C225", "C224"] },
  { f: "S", y: 588, dx: 0,   codes: ["C260", "C259", "C258", "C257", "C256"] },
  { f: "S", y: 616, dx: 0,   codes: ["C265"] }
];
const DOOR_PTS = {
  S034: [178, 298], S035: [184, 340], S016: [1257, 273], S015: [1275, 323],
  S140: [232, 265], S141: [232, 338], S123: [1383, 238], S122: [1392, 284],
  H114: [1438, 520], H113: [1482, 612],
  S241: [232, 250], S242: [232, 322], H210: [1408, 468], H209: [1466, 560]
};

DOOR_PTS.STAGE = [1422, 420];
DOOR_PTS.CAFETERIA = [1200, 425];       /* ground: inside the NE door of the cafeteria */
DOOR_PTS["BREAK-1"] = [1005, 500];   /* first floor: open to the east inner hall */
DOOR_PTS["BREAK-2"] = [986, 480];    /* second floor: open to the east inner hall */
DOOR_PTS["PR-F"] = [1050, 403];   /* basement: Female prayer room door (east wall) */
DOOR_PTS["PR-M"] = [1088, 394];   /* basement: Men prayer room door (top-left, opens onto the east hall) */   /* stage entrance (outdoor) */

function doorOf(r) {
  if (DOOR_PTS[r.code]) return DOOR_PTS[r.code];
  const row = DOOR_ROWS.find(w => w.f == r.floor && w.codes.includes(r.code));
  if (row) return [Math.round((r.bb[0] + r.bb[2]) / 2) + row.dx, row.y];
  return [(r.bb[0] + r.bb[2]) / 2 | 0, (r.bb[1] + r.bb[3]) / 2 | 0];   // fallback: room centre
}

const nvDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function nvNearest(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { t, pt: [a[0] + t * dx, a[1] + t * dy] };
}

const NAV = {};
function buildNav(fid) {
  if (NAV[fid]) return NAV[fid];
  const lines = CORRIDORS[fid].map(l => l.map(p => p.slice()));

  /* 1. join corridor ends that touch (or nearly touch) another corridor */
  lines.forEach((ln, li) => {
    [0, ln.length - 1].forEach(ei => {
      const e = ln[ei];
      let best = null;
      lines.forEach((o, oi) => {
        if (oi == li) return;
        for (let i = 0; i < o.length - 1; i++) {
          const r = nvNearest(e, o[i], o[i + 1]), d = nvDist(e, r.pt);
          if (d <= 10 && (!best || d < best.d)) best = { d, oi, i, pt: r.pt };
        }
      });
      if (!best) return;
      const o = lines[best.oi], v = o.find(q => nvDist(q, best.pt) < 0.5);
      if (v) ln[ei] = v.slice();
      else { o.splice(best.i + 1, 0, best.pt); ln[ei] = best.pt.slice(); }
    });
  });

  const segs = [];
  lines.forEach(l => { for (let i = 0; i < l.length - 1; i++) segs.push([l[i], l[i + 1]]); });

  /* 2. things that must be reachable: stairs, entrance, every room door */
  const targets = {};
  for (const k in ST[fid]) targets["STAIR:" + k] = ST[fid][k];
  if (fid == "G") targets["ENTRANCE"] = ENT.p;
  if (fid == "G") EXITS.filter(e => !e.main).forEach(e => { targets["E:" + e.id] = e.p; });
  (BATHS[fid] || []).forEach(b => { targets["B:" + b.id] = BATH_ALL.find(x => x.id == b.id).door; });
  FLOORS.find(f => f.id == fid).rooms.forEach(r => {
    if (r.type != "X") targets["R:" + r.code] = doorOf(r);
  });

  const att = {}, ins = {};
  for (const id in targets) {
    const p = targets[id];
    let best = null;
    segs.forEach((s, si) => {
      const r = nvNearest(p, s[0], s[1]), d = nvDist(p, r.pt);
      if (!best || d < best.d) best = { d, si, t: r.t, pt: r.pt };
    });
    att[id] = { p, pt: best.pt, d: best.d };
    (ins[best.si] = ins[best.si] || []).push({ t: best.t, pt: best.pt });
  }

  /* 3. build the graph (corridor pieces + short door/stair stubs) */
  const nodes = [], idx = {}, adj = [];
  const nid = p => {
    const k = Math.round(p[0] * 2) + "," + Math.round(p[1] * 2);
    if (idx[k] === undefined) { idx[k] = nodes.length; nodes.push([p[0], p[1]]); adj.push([]); }
    return idx[k];
  };
  const link = (a, b) => {
    if (a == b) return;
    const w = nvDist(nodes[a], nodes[b]);
    adj[a].push([b, w]); adj[b].push([a, w]);
  };
  segs.forEach((s, si) => {
    const pts = [s[0], ...(ins[si] || []).sort((x, y) => x.t - y.t).map(i => i.pt), s[1]];
    for (let i = 0; i < pts.length - 1; i++) link(nid(pts[i]), nid(pts[i + 1]));
  });
  const at = {};
  for (const id in att) {
    const a = att[id], n = nodes.length;
    nodes.push([a.p[0], a.p[1]]); adj.push([]);       // the door / stair itself
    link(n, nid(a.pt));
    at[id] = n;
  }
  return NAV[fid] = { nodes, adj, at };
}

function walk(fid, fromId, toId) {
  const g = buildNav(fid), s = g.at[fromId], t = g.at[toId];
  if (s === undefined || t === undefined) throw new Error("no anchor");
  const n = g.nodes.length, d = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  d[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || d[u] == Infinity || u == t) break;
    done[u] = true;
    for (const [v, w] of g.adj[u]) if (d[u] + w < d[v]) { d[v] = d[u] + w; prev[v] = u; }
  }
  if (d[t] == Infinity) throw new Error("not connected");
  const pts = [];
  for (let c = t; c != -1; c = prev[c]) pts.push(g.nodes[c].slice());
  return { cost: d[t], pts: pts.reverse() };
}

const fname = id => FLOORS.find(f => f.id == id).name;

function loc(code) {
  code = code.trim().toUpperCase();
  if (code == "ENTRANCE") return { ...ENT, id: "ENTRANCE" };
  if (code.startsWith("STAIR-")) {
    const k = code.replace("STAIR-", "");
    if (SN[k] && floor && ST[floor.id][k]) {
      return { code: SN[k], floor: floor.id, p: ST[floor.id][k], id: "STAIR:" + k };
    }
  }
  const ex = EXITS.find(x => x.id == code && !x.main);
  if (ex) return { code: ex.label + " (Exit)", floor: "G", p: ex.p, id: "E:" + ex.id, exit: ex };
  const wc = BATH_ALL.find(x => x.id == code);
  if (wc) return { code: wc.label, floor: wc.floor, p: wc.door, id: "B:" + wc.id, bath: wc };
  const r = ALL.find(x => x.code == code);
  return r ? { code: r.code, floor: r.floor, p: [(r.bb[0] + r.bb[2]) / 2 | 0, (r.bb[1] + r.bb[3]) / 2 | 0], room: r, id: "R:" + r.code } : null;
}

async function planRoute(a, b) {
  const legs = [], steps = [];
  if (a.floor == b.floor) {
    const r = walk(a.floor, a.id, b.id);
    legs.push({ floor: a.floor, pts: [a.p, ...r.pts, b.p], m: [[a.p, "s"], [b.p, "e"]] });
    steps.push([0, `Start at ${a.code} (${fname(a.floor)}) and follow the highlighted path to ${b.code}.`]);
    return { legs, steps };
  }

  /* different floors: floors are crossed one level at a time (B-G-F-S). For each level change only
     stairs that exist on BOTH floors can be used (the Basement has EN and SE only). Cheapest
     combination wins (dynamic programming over the floors). */
  const i0 = ORD.indexOf(a.floor), i1 = ORD.indexOf(b.floor), dir = i1 > i0 ? 1 : -1;
  const fl = [];
  for (let i = i0; i != i1 + dir; i += dir) fl.push(ORD[i]);
  const n = fl.length, up = dir > 0;
  const trans = [];
  for (let j = 0; j < n - 1; j++) trans.push(Object.keys(SN).filter(k => ST[fl[j]][k] && ST[fl[j + 1]][k]));
  const best = [];
  best[0] = {};
  trans[0].forEach(k => { const r = walk(fl[0], a.id, "STAIR:" + k); best[0][k] = { c: r.cost, prev: null, r }; });
  for (let j = 1; j < n - 1; j++) {
    best[j] = {};
    trans[j].forEach(k => {
      let bj = null;
      trans[j - 1].forEach(kp => {
        const r = walk(fl[j], "STAIR:" + kp, "STAIR:" + k), c = best[j - 1][kp].c + r.cost;
        if (!bj || c < bj.c) bj = { c, prev: kp, r };
      });
      best[j][k] = bj;
    });
  }
  let fin = null;
  trans[n - 2].forEach(k => {
    const r = walk(fl[n - 1], "STAIR:" + k, b.id), c = best[n - 2][k].c + r.cost;
    if (!fin || c < fin.c) fin = { c, k, r };
  });
  if (!fin) throw new Error("no stairs");
  const ks = new Array(n - 1);
  ks[n - 2] = fin.k;
  for (let j = n - 2; j > 0; j--) ks[j - 1] = best[j][ks[j]].prev;

  const arrow = up ? "UP ▲" : "DOWN ▼";
  const note = j => (fl[j] == "B" || fl[j + 1] == "B") ? " Only the North-East and South-East stairs connect to the Basement." : "";
  legs.push({ floor: fl[0], pts: [a.p, ...best[0][ks[0]].r.pts], m: [[a.p, "s"], [ST[fl[0]][ks[0]], "t"]] });
  steps.push(
    [0, `From ${a.code} (${fname(a.floor)}) walk towards the ${SN[ks[0]]}.`],
    [0, `Take the stairs ${arrow} to the ${fname(fl[1])}.${note(0)}`]
  );
  for (let j = 1; j < n - 1; j++) {
    if (ks[j - 1] == ks[j]) {
      steps.push([legs.length - 1, `Keep going ${arrow} on the same stairs, past the ${fname(fl[j])}, to the ${fname(fl[j + 1])}.${note(j)}`]);
    } else {
      const r = best[j][ks[j]].r, sp = ST[fl[j]][ks[j - 1]], sn = ST[fl[j]][ks[j]];
      legs.push({ floor: fl[j], pts: r.pts, m: [[sp, "t"], [sn, "t"]] });
      steps.push(
        [legs.length - 1, `Leave the ${SN[ks[j - 1]]} on the ${fname(fl[j])} and walk to the ${SN[ks[j]]}.`],
        [legs.length - 1, `Take the stairs ${arrow} to the ${fname(fl[j + 1])}.${note(j)}`]
      );
    }
  }
  const last = n - 1;
  legs.push({ floor: fl[last], pts: [...fin.r.pts, b.p], m: [[ST[fl[last]][ks[last - 1]], "t"], [b.p, "e"]] });
  steps.push([legs.length - 1, `Leave the ${SN[ks[last - 1]]} and follow the highlighted path to ${b.code}.`]);
  return { legs, steps };
}

function exitsSvg() {
  if (!floor || floor.id != "G") return "";
  return EXITS.map(e => {
    const cx = (e.bb[0] + e.bb[2]) / 2, cy = (e.bb[1] + e.bb[3]) / 2, w = e.main ? 64 : 40;
    return `<g class="exit-mk" data-exit="${e.id}" transform="translate(${cx},${cy})" tabindex="0" aria-label="${esc(e.label)} (exit)"><circle r="15" fill="#22c55e" stroke="#ffffff" stroke-width="2.5"/><path d="M-5 -5 L5 -5 L5 5 M5 -5 L-6 6" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="${-w / 2}" y="18" width="${w}" height="14" rx="3" fill="rgba(9,13,24,.9)" stroke="#22c55e" stroke-width="1"/><text y="28.5" text-anchor="middle" font-size="9" font-weight="800" fill="#4ade80" font-family="'abeatbyKai', sans-serif">${e.main ? "MAIN EXIT" : "EXIT"}</text></g>`;
  }).join("");
}

function bathsSvg() {
  if (!floor) return "";
  return BATH_ALL.filter(b => b.floor == floor.id).map(b => {
    const [x1, y1, x2, y2] = b.bb, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    return `<g class="wc" data-wc="${b.id}" tabindex="0" aria-label="${esc(b.label)}"><rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="4" fill="#ec4899" fill-opacity=".34" stroke="#ec4899" stroke-width="2.5"/><g transform="translate(${cx},${cy})"><circle r="13" fill="#ec4899" stroke="#ffffff" stroke-width="2"/><text y="4" text-anchor="middle" font-size="10" font-weight="800" fill="#ffffff" font-family="'abeatbyKai', sans-serif">WC</text></g></g>`;
  }).join("");
}

function stairsSvg() {
  if (!floor) return "";
  let h = "";
  const act = ST[floor.id];
  if (act) {
    for (const k in act) {
      const [x, y] = act[k];
      const name = SN[k];
      h += `
        <g class="stair-marker stair-active" data-stair="${k}" data-name="${esc(name)}" transform="translate(${x},${y})" tabindex="0"><g class="stair-inner">
          <circle cx="0" cy="0" r="22" class="stair-halo" fill="rgba(16, 185, 129, 0.22)" stroke="#10b981" stroke-width="2"/>
          <circle cx="0" cy="0" r="14" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
          <path d="M-6 4 L-6 1 L-2 1 L-2 -2 L2 -2 L2 -5 L6 -5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="-24" y="17" width="48" height="15" rx="3" fill="rgba(9, 13, 24, 0.9)" stroke="#10b981" stroke-width="1"/>
          <text x="0" y="28" text-anchor="middle" font-size="9" font-weight="800" fill="#10b981" font-family="'abeatbyKai', sans-serif">STAIRS</text>
        </g></g>
      `;
    }
  }

  UNAVAILABLE_STAIRS.forEach(s => {
    if (floor.id == "B" && !(s.pf && s.pf.B)) return;   /* only the far-west outer stairs exist in the basement */
    const [x, y] = (s.pf && s.pf[floor.id]) || s.p;
    h += `
      <g class="stair-marker stair-closed" data-closed="${s.id}" data-name="${esc(s.name)}" transform="translate(${x},${y})" tabindex="0"><g class="stair-inner">
        <rect x="-18" y="-18" width="36" height="36" rx="6" fill="rgba(37, 72, 230, 0.16)" stroke="#2548e6" stroke-width="2.5" stroke-dasharray="4 2"/>
        <line x1="-12" y1="-12" x2="12" y2="12" stroke="#2548e6" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="12" y1="-12" x2="-12" y2="12" stroke="#2548e6" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="-22" y="20" width="44" height="14" rx="3" fill="rgba(9, 13, 24, 0.9)" stroke="#2548e6" stroke-width="1"/>
        <text x="0" y="30" text-anchor="middle" font-size="8.5" font-weight="900" fill="#60a5fa" font-family="'abeatbyKai', sans-serif">CLOSED</text>
      </g></g>
    `;
  });

  return h;
}

function routeSvg() {
  if (!ROUTE || !floor) return "";
  return ROUTE.legs.filter(l => l.floor == floor.id).map(l => {
    const p = l.pts.map(q => q.map(v => Math.round(v)).join(",")).join(" ");
    return `
      <g pointer-events="none" class="route-group">
        <polyline points="${p}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <polyline class="rt" points="${p}" fill="none" stroke="${COL.sel}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        ${l.m.map(([q, t]) => `
          <circle cx="${q[0]}" cy="${q[1]}" r="12" fill="${t == "s" ? COL.ok : t == "e" ? COL.no : "#fb9746"}" stroke="#ffffff" stroke-width="2.5"/>
          <text x="${q[0]}" y="${q[1] + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff" font-family="'abeatbyKai', sans-serif">${t == "s" ? "A" : t == "e" ? "B" : "▲"}</text>
        `).join("")}
      </g>
    `;
  }).join("");
}

/* Pan to a route WITHOUT changing the zoom level the user is already at.
   If the whole leg fits on screen at this zoom it is centred, otherwise the view
   is centred on the start of the leg so the user can follow it from the beginning. */
function panTo(bb, start, k, animate) {
  const cw = map.clientWidth;
  const dirEl = $("dir");
  const dr = (innerWidth < 700 && dirEl.style.display == "block")
    ? Math.max(0, map.getBoundingClientRect().bottom - dirEl.getBoundingClientRect().top) : 0;
  const ch = Math.max(120, map.clientHeight - dr);
  /* Whole floor already fits on screen at this zoom: keep the normal centred view, nothing to pan. */
  if (k <= Math.min(cw / W, map.clientHeight / H) * 1.05) { reset(); return; }
  const pad = 60;
  const fits = (bb[2] - bb[0]) * k + pad * 2 <= cw && (bb[3] - bb[1]) * k + pad * 2 <= ch;
  const cx = fits ? (bb[0] + bb[2]) / 2 : start[0];
  const cy = fits ? (bb[1] + bb[3]) / 2 : start[1];
  V = { k, x: cw / 2 - cx * k, y: ch / 2 - cy * k };
  if (animate) stage.style.transition = "transform .35s ease-out";
  apply();
  if (animate) setTimeout(() => stage.style.transition = "", 400);
}

function goLeg(i) {
  const l = ROUTE.legs[i];
  const inFloorView = !$("fv").hidden && !!floor;
  const keepK = inFloorView ? V.k : null;           /* the zoom the user is currently at */
  const sameFloor = inFloorView && floor.id == l.floor;
  if (sameFloor) draw();                            /* just redraw the route, don't reset the view */
  else open(l.floor);                               /* switching floor: open() resets the view */
  const xs = l.pts.map(p => p[0]), ys = l.pts.map(p => p[1]);
  panTo([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], l.pts[0], keepK ?? V.k, sameFloor);
}

function fillDL() {
  const dl = $("dl");
  if (!dl) return;
  dl.innerHTML = [
    '<option value="ENTRANCE">Main Entrance (Ground Floor)</option>',
    ...EXITS.filter(e => !e.main).map(e => `<option value="${e.id}">${e.label} (Exit, Ground Floor)</option>`),
    ...BATH_ALL.map(b => `<option value="${b.id}">${b.label}</option>`),
    ...ALL.filter(canView).map(r => {
      const flName = FLOORS.find(f => f.id == r.floor).name;
      const typeName = TYPES[r.type] || "Room";
      return `<option value="${r.code}">${r.code} · ${typeName} (${flName})</option>`;
    })
  ].join("");
}

function openDir(w, code) {
  $("dir").style.display = "block";
  $("dir").classList.remove("min");
  fillDL();
  if (w == "wc") { $("df").value = code; nearestWC(); return; }
  if (w == "t") {
    $("dt").value = code;
    if (!$("df").value) $("df").value = "ENTRANCE";
  } else if (w == "f") {
    $("df").value = code;
  }
  if ($("df").value && $("dt").value) {
    go();
  }
}

/* Nearest bathroom (shortest walking distance on the origin's floor) */
function nearestBath(a) {
  let best = null;
  BATH_ALL.filter(b => b.floor == a.floor && "B:" + b.id != a.id).forEach(b => {
    try {
      const r = walk(a.floor, a.id, "B:" + b.id);
      if (!best || r.cost < best.cost) best = { b, cost: r.cost };
    } catch (e) { /* unreachable from here */ }
  });
  return best && best.b;
}

function nearestWC() {
  const out = $("dout");
  $("dir").style.display = "block";
  $("dir").classList.remove("min");
  fillDL();
  const a = loc($("df").value);
  if (!a) { out.innerHTML = "<p class='na'>Choose where you are (Origin), then press Nearest bathroom.</p>"; return; }
  if (a.room && !canView(a.room)) { out.innerHTML = `<p class="na">${esc(a.code)} is restricted, so a route cannot be shown from it.</p>`; return; }
  const b = nearestBath(a);
  if (!b) { out.innerHTML = "<p class='na'>No bathroom is reachable from that location.</p>"; return; }
  $("dt").value = b.id;
  go(true);
}

async function go(near) {
  const out = $("dout"), a = loc($("df").value), b = loc($("dt").value);
  if (!a || !b) {
    out.innerHTML = "<p class='na'>Please select two valid room codes or ENTRANCE.</p>";
    return;
  }
  if (a.code == b.code) {
    out.innerHTML = "<p class='na'>Origin and destination are the exact same room.</p>";
    return;
  }
  for (const x of [a, b]) {
    if (x.room && !canView(x.room)) {
      out.innerHTML = `<p class="na">${x.code} is restricted. Wayfinding route cannot be displayed.</p>`;
      return;
    }
  }
  out.innerHTML = "<p class='na'>Calculating optimal route…</p>";
  try {
    ROUTE = await planRoute(a, b);
  } catch (e) {
    out.innerHTML = "<p class='na'>Unable to find a viable path between these locations.</p>";
    return;
  }

  if (near === true) ROUTE.steps.unshift([0, `Nearest bathroom from ${a.code}: ${b.code}.`]);
  let html = "";
  if (ROUTE.legs.length > 1) {
    html += `
      <div class="route-floor-switch">
        ${ROUTE.legs.map((l, idx) => `
          <button type="button" class="btn ${idx == 0 ? 'on' : ''} r-floor-btn" data-leg="${idx}">
            ${idx + 1}. ${fname(l.floor)}
          </button>
        `).join("")}
      </div>
    `;
  }

  html += "<ol class='route-steps'>" + ROUTE.steps.map(([l, t], idx) => `
    <li data-l="${l}" class="route-step-item">
      <span class="step-bullet">${idx + 1}</span>
      <span class="step-text">${esc(t)}</span>
    </li>
  `).join("") + "</ol>";

  out.innerHTML = html;

  out.querySelectorAll(".r-floor-btn").forEach(btn => {
    btn.onclick = () => {
      out.querySelectorAll(".r-floor-btn").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
      goLeg(+btn.dataset.leg);
    };
  });

  out.querySelectorAll(".route-step-item").forEach(li => {
    li.onclick = () => {
      const legIdx = +li.dataset.l;
      out.querySelectorAll(".r-floor-btn").forEach((b, i) => b.classList.toggle("on", i == legIdx));
      goLeg(legIdx);
    };
  });

  if (innerWidth < 700) $("dir").classList.add("min");
  goLeg(0);
}

$("dirb").onclick = () => {
  const d = $("dir");
  d.style.display = d.style.display == "block" ? "none" : "block";
  fillDL();
};

const dUseEnt = $("d-use-ent");
if (dUseEnt) {
  dUseEnt.onclick = () => {
    $("df").value = "ENTRANCE";
    if ($("dt").value) go();
  };
}

$("dx").onclick = () => $("dir").style.display = "none";
$("ded").onclick = () => $("dir").classList.remove("min");
$("dgo").onclick = () => go();
$("dwc").onclick = nearestWC;
$("dsw").onclick = () => {
  const t = $("df").value;
  $("df").value = $("dt").value;
  $("dt").value = t;
  go();
};
$("dcl").onclick = () => {
  ROUTE = null;
  $("df").value = $("dt").value = "";
  $("dout").innerHTML = "";
  if (floor) draw();
};

/* Theme Button Click Handler */
const themeToggleBtn = $("theme-toggle");
if (themeToggleBtn) {
  themeToggleBtn.onclick = toggleTheme;
}

/* Google Sheet Modal Handlers */
const gsheetBtn = $("gsheet-btn");
const gsheetModal = $("gsheet-modal");
const gsheetClose = $("gsheet-close");
const gsheetSyncBtn = $("gsheet-sync-btn");
const gsheetSaveBtn = $("gsheet-save-btn");
const gsheetOpenBtn = $("gsheet-open-btn");
const gsheetInput = $("gsheet-url-input");

if (gsheetBtn && gsheetModal) {
  gsheetBtn.onclick = () => {
    if (gsheetInput) gsheetInput.value = GSHEET_URL || "";
    gsheetModal.classList.add("show");
  };
}

if (gsheetClose && gsheetModal) {
  gsheetClose.onclick = () => gsheetModal.classList.remove("show");
}

if (gsheetModal) {
  gsheetModal.onclick = e => {
    if (e.target.id === "gsheet-modal") gsheetModal.classList.remove("show");
  };
}

if (gsheetSaveBtn) {
  gsheetSaveBtn.onclick = async () => {
    const val = gsheetInput ? gsheetInput.value.trim() : "";
    if (val) {
      await syncFromGoogleSheet(val, false);
    }
  };
}

if (gsheetSyncBtn) {
  gsheetSyncBtn.onclick = async () => {
    await syncFromGoogleSheet(GSHEET_URL, false);
  };
}

if (gsheetOpenBtn) {
  gsheetOpenBtn.onclick = () => {
    const id = extractSheetId(GSHEET_URL || (gsheetInput ? gsheetInput.value : ""));
    if (id) {
      window.open(`https://docs.google.com/spreadsheets/d/${id}/edit`, "_blank");
    } else {
      window.open("https://sheets.new", "_blank");
    }
  };
}

/* Init */
initTheme();
home();

// Auto-sync from Google Sheet and apply any URL route parameters once the volunteer code gate is open
function applyUrlRoute() {
  if (window.__urlRouteApplied) return;
  const params = new URLSearchParams(location.search);
  const rawTo = (params.get("to") || params.get("routeTo") || params.get("room") || "").trim();
  const rawFrom = (params.get("from") || params.get("routeFrom") || "").trim();
  if (!rawTo) return;
  window.__urlRouteApplied = true;

  const norm = s => {
    const u = String(s || "").trim().toUpperCase();
    return u === "MAIN ENTRANCE" ? "ENTRANCE" : u;
  };
  const toCode = norm(rawTo);
  const destLoc = loc(toCode);
  if (!destLoc) return;

  let fromCode = norm(rawFrom);
  if (!fromCode || !loc(fromCode) || fromCode === toCode) {
    fromCode = toCode === "ENTRANCE" ? "C026" : "ENTRANCE";
  }

  $("dir").style.display = "block";
  $("dir").classList.remove("min");
  fillDL();
  $("df").value = fromCode;
  $("dt").value = toCode;
  go();
}

function onMapsUnlocked() {
  if (!window.__sheetSyncStarted && GSHEET_URL) {
    window.__sheetSyncStarted = true;
    syncFromGoogleSheet(GSHEET_URL, true);
  }
  applyUrlRoute();
  if (window.NasaTutorial && window.TechOpsStore && !window.TechOpsStore.isTutorialCompleted("maps")) {
    if (typeof open === "function") { try { open("G"); } catch (e) {} }
    window.NasaTutorial.start("maps");
  }
}
if (window.MapsGate && window.MapsGate.isUnlocked()) onMapsUnlocked();
else document.addEventListener("maps:unlocked", onMapsUnlocked);

function bindMapsTutorial() {
  const tb = document.getElementById("tutorial-btn");
  const mtb = document.getElementById("mobile-tutorial-btn");
  const launch = () => {
    const drawer = document.getElementById("mobile-drawer");
    if (drawer) drawer.hidden = true;
    const toggle = document.getElementById("mobile-menu-toggle") || document.getElementById("mobile-menu-btn");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (typeof open === "function") { try { open("G"); } catch (e) {} }
    if (window.NasaTutorial) window.NasaTutorial.start("maps");
  };
  if (tb) tb.onclick = launch;
  if (mtb) mtb.onclick = launch;
}
bindMapsTutorial();
