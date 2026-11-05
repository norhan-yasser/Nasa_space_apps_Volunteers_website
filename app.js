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
  X: "Inaccessible"
};

const IMG = {
  G: "assets/su tech floor assets/1.png",
  F: "assets/su tech floor assets/2.png",
  S: "assets/su tech floor assets/3.png"
};
/* Room geometry (pixels of the original image). Rect = 4 numbers, polygon = flat x,y pairs. Placeholder outlines: refine in the editor. */
const R=(a,b)=>a.map((c,i)=>[c,...b[i]]);

const FLOORS=[
{id:"G",name:"Ground Floor",rooms:[
["S034",[167,195,270,281]],["S035",[167,312,270,396]],["C027",[610,235,661,310]],["C026",[662,235,712,310]],["C017",[1289,235,1336,304]],
["S016",[1356,190,1436,155,1473,218,1390,258]],["S015",[1415,270,1488,236,1522,293,1448,335]],
["X",[167,546,270,708]],["X",[1100,316,1339,391]],["X",[1100,546,1379,620]],["X",[1055,653,1285,735]]]},
{id:"F",name:"First Floor",rooms:[
["S140",[111,166,220,261]],["S141",[111,288,220,374]],
["C139",[272,208,326,295]],["C138",[328,208,380,295]],["C137",[381,208,430,295]],["C136",[432,208,483,295]],
["B135",[485,208,535,295]],["B134",[537,208,587,295]],["B133",[589,208,640,295]],["B132",[643,208,695,295]],
["B131",[953,206,1003,297]],["B130",[1005,206,1053,297]],["B129",[1055,206,1105,297]],["B128",[1107,206,1155,297]],
["C127",[1157,206,1203,297]],["C126",[1205,206,1254,297]],["C125",[1257,206,1304,297]],["C124",[1306,206,1355,297]],
["S123",[1381,158,1458,126,1500,192,1424,234]],["S122",[1443,274,1521,229,1561,295,1481,337]],
["H114",[1464,497,1578,454,1592,515,1492,566]],["H113",[1512,595,1622,563,1633,629,1544,661]],
["C154",[377,532,427,618]],["C153",[429,532,478,618]],["C152",[480,532,532,618]],
["X",[111,528,217,620]],["X",[271,528,375,620]],["X",[111,652,223,698]],["X",[274,654,372,732]],
["X",[1106,526,1203,608]],["X",[1204,526,1304,608]],["X",[1306,526,1412,608]],["X",[1106,646,1203,732]],["X",[1204,646,1304,732]]]},
{id:"S",name:"Second Floor",rooms:[
["S241",[208,249,301,329]],["S242",[208,354,301,423]],["C240",[343,284,385,352]],
["B236",[510,284,549,352]],["B235",[550,284,593,352]],["B234",[595,284,632,352]],["B233",[633,284,678,352]],
["C231",[903,278,946,349]],["C230",[946,278,987,349]],["C229",[987,278,1028,349]],["C228",[1028,278,1069,349]],
["C227",[1069,278,1110,349]],["C226",[1110,278,1153,349]],["C225",[1153,278,1195,349]],["C224",[1195,278,1237,349]],
["H210",[1326,509,1424,452,1461,520,1366,569]],["H209",[1380,589,1469,528,1509,595,1418,652]],
["C260",[208,534,254,614]],["C259",[255,534,300,614]],["C258",[340,534,380,614]],["C257",[381,534,421,614]],["C256",[422,534,463,614]],
["C265",[552,640,640,712]],
["X",[387,284,428,352]],["X",[429,284,468,352]],["X",[469,284,509,352]],["X",[452,383,528,421]],
["X",[684,269,898,435]],["X",[700,457,880,583]],["X",[1261,194,1363,292]],["X",[1309,280,1395,372]],
["X",[1021,547,1103,606]],["X",[1103,547,1193,606]],["X",[1193,547,1275,606]],
["X",[981,640,1103,718]],["X",[1103,640,1187,718]],["X",[338,646,420,715]],["X",[208,640,295,683]],
["X",[465,535,509,612]],["X",[509,535,555,612]]]}];

/* Normalise room geometry & data structures */
FLOORS.forEach(f => {
  let n = 0;
  f.rooms = f.rooms.map(([c, g]) => {
    const pts0 = g.length == 4 
      ? [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]] 
      : g.reduce((a, v, i) => (i % 2 ? a[a.length - 1].push(v) : a.push([v]), a), []);
    const pts = f.id == "S" 
      ? pts0.map(p => [Math.round(1.152 * p[0] - 121.6), Math.round(1.155 * p[1] - 125.6)]) 
      : pts0;
    const x = c == "X";
    if (x) n++;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return {
      code: x ? "X-" + f.id + String(n).padStart(2, "0") : c,
      name: x ? "Restricted room " + n : null,
      floor: f.id,
      type: c[0],
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
const color = r => access(r) == "no" ? COL.no : mode(r) == "Unassigned" ? COL.na : COL.ok;

/* Theme handling */
function initTheme() {
  const saved = localStorage.getItem("nasa_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeButton(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current == "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("nasa_theme", next);
  updateThemeButton(next);
}

function updateThemeButton(theme) {
  const btn = $("theme-toggle");
  if (!btn) return;
  btn.innerHTML = theme == "dark" 
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg><span class="btn-text">Light</span>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span class="btn-text">Dark</span>';
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

    if (floor) draw(); else home();
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
  $("crumb").innerHTML = '<span class="crumb-active">Overview</span>';

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
            <span class="qw-badge-ok">● 5 Authorized Green Stairs In Use</span>
            <span class="qw-badge-no">✕ Outer Blue Stairs Closed</span>
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
    const a = f.rooms.filter(r => access(r) == "ok").length;
    const p = f.rooms.filter(r => mode(r) == "Participants").length;
    const levelCode = f.id == "G" ? "Level 0" : f.id == "F" ? "Level 1" : "Level 2";
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
              <span class="pill">${f.rooms.length} Rooms</span>
              <span class="pill pill-ok">${a} Accessible</span>
              ${p ? `<span class="pill pill-accent">${p} Assigned</span>` : ''}
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
  const cw = map.clientWidth, ch = map.clientHeight;
  const k = Math.min(cw / W, ch / H);
  V = { k, x: (cw - W * k) / 2, y: (ch - H * k) / 2 };
  apply();
}

function open(id, focus) {
  floor = FLOORS.find(f => f.id == id);
  $("home").hidden = true;
  $("fv").hidden = false;
  $("img").src = IMG[id];

  $("crumb").innerHTML = `<a id="bc">Overview</a> <span class="crumb-sep">›</span> <span class="crumb-active">${floor.name}</span>`;
  $("bc").onclick = home;

  $("tabs").innerHTML = FLOORS.map(f => `
    <button class="btn ${f.id == id ? "on" : ""}" data-f="${f.id}">
      ${f.name.replace(" Floor", "")}
    </button>
  `).join(" ");

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
    const c = isSel ? COL.sel : color(r);
    const p = r.pts.map(q => q.join(",")).join(" ");
    return `<polygon class="rm ${isSel ? 'sel' : ''}" data-c="${r.code}" points="${p}" fill="${c}" fill-opacity="${isSel ? .55 : dim ? .03 : .22}" stroke="${c}" stroke-width="${isSel ? 3.5 : 2}" stroke-opacity="${dim ? .2 : 1}" tabindex="0" aria-label="Room ${r.code}"/>`;
  }).join("") + stairsSvg() + routeSvg();

  $("svg").querySelectorAll(".rm").forEach(e => {
    const r = ALL.find(x => x.code == e.dataset.c);
    e.onclick = () => { if (moved < 10) show(r); };
    e.onkeydown = ev => { if (ev.key == "Enter") show(r); };
    e.onmousemove = ev => {
      const b = map.getBoundingClientRect(), t = $("tip");
      t.style.display = "block";
      const acc = access(r) == "no" ? '<span class="tip-tag tip-no">Restricted</span>' : '<span class="tip-tag tip-ok">Accessible</span>';
      const m = mode(r) != "Unassigned" ? ` · ${mode(r)}` : "";
      t.innerHTML = `<div class="tip-head"><b>${r.code}</b> ${acc}</div><div class="tip-sub">${TYPES[r.type] || "Room"}${m}</div>`;
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
      t.innerHTML = `<div class="tip-head"><b>${esc(name)}</b> <span class="tip-tag tip-ok">Active Stairs</span></div><div class="tip-sub">Authorized inner staircase · Connects Ground, 1st &amp; 2nd Floors</div>`;
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

  $("leg").innerHTML = [
    ["ok", "Accessible, assigned"],
    ["na", "Accessible, unassigned"],
    ["no", "Restricted"],
    ["sel", "Selected"]
  ].map(([k, t]) => `<span><i style="background:${COL[k]}"></i>${t}</span>`).join("")
  + `<span><i class="leg-stair-ok"></i>Authorized Stairs (Available)</span>`
  + `<span><i class="leg-stair-no"></i>Emergency Stairs (Closed)</span>`;
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

/* Wayfinding: Corridor-following A* algorithm on floor plan */
const NB = 3, GW = Math.floor(W / NB), GH = Math.floor(H / NB);
/* Only the 5 designated inner staircases are available for inter-floor routing */
const ST = {
  G: {
    WN: [580, 371],
    WS: [581, 528],
    SW: [438, 680],
    EN: [1030, 370],
    SE: [1013, 682]
  },
  F: {
    WN: [588, 370],
    WS: [587, 530],
    SW: [436, 676],
    EN: [1027, 369],
    SE: [1023, 679]
  },
  S: {
    WN: [593, 370],
    WS: [591, 529],
    SW: [441, 685],
    EN: [1041, 368],
    SE: [1011, 698]
  }
};

const SN = {
  WN: "North-West Inner Stairs (Auditorium)",
  WS: "Central-West Inner Stairs",
  SW: "South-West Wing Stairs",
  EN: "North-East Inner Stairs (Auditorium)",
  SE: "South-East Wing Stairs"
};
const UNAVAILABLE_STAIRS = [
  { id: "NW_OUT", name: "Far NW Outer Stairs (Closed)", p: [104, 215] },
  { id: "SW_OUT", name: "Far SW Outer Stairs (Closed)", p: [110, 643] },
  { id: "NE_OUT", name: "Far NE Outer Stairs (Closed)", p: [1552, 135] },
  { id: "SE_OUT", name: "Far SE Outer Stairs (Closed)", p: [1635, 511] }
];
const ORD = ["G", "F", "S"];
const ENT = { code: "ENTRANCE", floor: "G", p: [836, 672] };
const grids = {};
let ROUTE = null;

function dil(a, n) {
  for (let t = 0; t < n; t++) {
    const b = a.slice();
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        if (a[i]) {
          if (x > 0) b[i - 1] = 1;
          if (x < GW - 1) b[i + 1] = 1;
          if (y > 0) b[i - GW] = 1;
          if (y < GH - 1) b[i + GW] = 1;
        }
      }
    }
    a = b;
  }
  return a;
}

const loadImg = src => new Promise(r => {
  const i = new Image();
  i.onload = () => r(i);
  i.src = src;
});

async function grid(fid) {
  if (grids[fid]) return grids[fid];
  const im = await loadImg(IMG[fid]), c = document.createElement("canvas");
  c.width = W; c.height = H;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.drawImage(im, 0, 0, W, H);
  const px = cx.getImageData(0, 0, W, H).data;
  let blk = new Uint8Array(GW * GH);

  for (let y = 0; y < GH * NB; y++) {
    for (let x = 0; x < GW * NB; x++) {
      const p = (y * W + x) * 4;
      if (px[p] + px[p + 1] + px[p + 2] < 330) blk[(y / NB | 0) * GW + (x / NB | 0)] = 1;
    }
  }

  const thick = dil(blk, 4);
  let out = new Uint8Array(GW * GH);
  const stk = [0];
  out[0] = 1;

  while (stk.length) {
    const i = stk.pop(), x = i % GW, y = i / GW | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (!out[n] && !thick[n]) {
        out[n] = 1;
        stk.push(n);
      }
    }
  }

  out = dil(out, 5);

  FLOORS.find(f => f.id == fid).rooms.forEach(r => {
    for (let y = Math.floor((r.bb[1] + 7) / NB); y < Math.floor((r.bb[3] - 7) / NB); y++) {
      for (let x = Math.floor((r.bb[0] + 7) / NB); x < Math.floor((r.bb[2] - 7) / NB); x++) {
        blk[y * GW + x] = 0;
        out[y * GW + x] = 0;
      }
    }
  });

  // Strictly block outer / unavailable emergency stairs from all routing
  const OUTER_STAIRS_ZONES = [
    [0, 160, 165, 310],     // Far West Top outer stairs (outside S034 / S140 / S241)
    [0, 580, 165, 780],     // Far West Bottom outer stairs (outside red rooms)
    [1440, 90, 1673, 250],  // Far East Top outer stairs (outside S016)
    [1520, 470, 1673, 630]  // Far East Bottom outer stairs
  ];
  OUTER_STAIRS_ZONES.forEach(([bx1, by1, bx2, by2]) => {
    for (let y = Math.floor(by1 / NB); y <= Math.ceil(by2 / NB); y++) {
      for (let x = Math.floor(bx1 / NB); x <= Math.ceil(bx2 / NB); x++) {
        if (x >= 0 && x < GW && y >= 0 && y < GH) {
          blk[y * GW + x] = 1;
          out[y * GW + x] = 1;
        }
      }
    }
  });

  const dt = new Uint8Array(GW * GH).fill(9), q = [];
  for (let i = 0; i < blk.length; i++) if (blk[i]) { dt[i] = 0; q.push(i); }

  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (dt[i] >= 3) continue;
    const x = i % GW, y = i / GW | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const n = ny * GW + nx;
        if (dt[n] == 9) {
          dt[n] = dt[i] + 1;
          q.push(n);
        }
      }
    }
  }

  const cost = new Float32Array(GW * GH);
  for (let i = 0; i < cost.length; i++) {
    cost[i] = out[i] ? 1e6 : blk[i] ? 200 : 1 + 5 * Math.max(0, 3 - dt[i]) / 3;
  }
  return grids[fid] = cost;
}

function astar(cost, s, t) {
  const S = (s[1] / NB | 0) * GW + (s[0] / NB | 0);
  const T = (t[1] / NB | 0) * GW + (t[0] / NB | 0);
  const tx = T % GW, ty = T / GW | 0;

  const g = new Float32Array(GW * GH).fill(1e9);
  const par = new Int32Array(GW * GH).fill(-1);
  const done = new Uint8Array(GW * GH);
  const h = [];

  const push = (f, i) => {
    h.push([f, i]);
    let k = h.length - 1;
    while (k) {
      const p = (k - 1) >> 1;
      if (h[p][0] <= h[k][0]) break;
      [h[p], h[k]] = [h[k], h[p]];
      k = p;
    }
  };

  const pop = () => {
    const top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m == k) break;
        [h[m], h[k]] = [h[k], h[m]];
        k = m;
      }
    }
    return top;
  };

  g[S] = 0;
  push(0, S);

  while (h.length) {
    const c = pop()[1];
    if (done[c]) continue;
    done[c] = 1;
    if (c == T) break;
    const cx = c % GW, cy = c / GW | 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const n = ny * GW + nx;
        const nc = g[c] + cost[n] * (dx && dy ? 1.414 : 1);
        if (nc < g[n]) {
          g[n] = nc;
          par[n] = c;
          push(nc + Math.hypot(nx - tx, ny - ty), n);
        }
      }
    }
  }

  const pts = [];
  for (let c = T; c != -1; c = par[c]) pts.push([c % GW * NB + 1, (c / GW | 0) * NB + 1]);
  return { pts: pts.reverse(), cost: g[T] };
}

const fname = id => FLOORS.find(f => f.id == id).name;

function loc(code) {
  code = code.trim().toUpperCase();
  if (code == "ENTRANCE") return ENT;
  if (code.startsWith("STAIR-")) {
    const k = code.replace("STAIR-", "");
    if (SN[k] && floor) {
      return { code: SN[k], floor: floor.id, p: ST[floor.id][k] };
    }
  }
  const r = ALL.find(x => x.code == code);
  return r ? { code: r.code, floor: r.floor, p: [(r.bb[0] + r.bb[2]) / 2 | 0, (r.bb[1] + r.bb[3]) / 2 | 0], room: r } : null;
}

async function planRoute(a, b) {
  const legs = [], steps = [];
  if (a.floor == b.floor) {
    const r = astar(await grid(a.floor), a.p, b.p);
    legs.push({ floor: a.floor, pts: r.pts, m: [[a.p, "s"], [b.p, "e"]] });
    steps.push([0, `Start at ${a.code} (${fname(a.floor)}) and follow the highlighted path to ${b.code}.`]);
    return { legs, steps };
  }

  let best = null;
  const Ga = await grid(a.floor), Gb = await grid(b.floor);
  for (const k in SN) {
    const r1 = astar(Ga, a.p, ST[a.floor][k]), r2 = astar(Gb, ST[b.floor][k], b.p);
    const c = r1.cost + r2.cost;
    if (!best || c < best.c) best = { c, k, r1, r2 };
  }

  const up = ORD.indexOf(b.floor) > ORD.indexOf(a.floor);
  legs.push(
    { floor: a.floor, pts: best.r1.pts, m: [[a.p, "s"], [ST[a.floor][best.k], "t"]] },
    { floor: b.floor, pts: best.r2.pts, m: [[ST[b.floor][best.k], "t"], [b.p, "e"]] }
  );

  steps.push(
    [0, `From ${a.code} (${fname(a.floor)}) walk towards the ${SN[best.k]}.`],
    [0, `Take the stairs ${up ? "UP ▲" : "DOWN ▼"} to the ${fname(b.floor)}.`],
    [1, `Leave the ${SN[best.k]} and follow the highlighted path to ${b.code}.`]
  );
  return { legs, steps };
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
        <g class="stair-marker stair-active" data-stair="${k}" data-name="${esc(name)}" transform="translate(${x},${y})" tabindex="0">
          <circle cx="0" cy="0" r="22" class="stair-halo" fill="rgba(16, 185, 129, 0.22)" stroke="#10b981" stroke-width="2"/>
          <circle cx="0" cy="0" r="14" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
          <path d="M-6 4 L-6 1 L-2 1 L-2 -2 L2 -2 L2 -5 L6 -5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="-24" y="17" width="48" height="15" rx="3" fill="rgba(9, 13, 24, 0.9)" stroke="#10b981" stroke-width="1"/>
          <text x="0" y="28" text-anchor="middle" font-size="9" font-weight="800" fill="#10b981" font-family="'Inter', system-ui, sans-serif">STAIRS</text>
        </g>
      `;
    }
  }

  UNAVAILABLE_STAIRS.forEach(s => {
    const [x, y] = s.p;
    h += `
      <g class="stair-marker stair-closed" data-closed="${s.id}" data-name="${esc(s.name)}" transform="translate(${x},${y})" tabindex="0">
        <rect x="-18" y="-18" width="36" height="36" rx="6" fill="rgba(37, 72, 230, 0.16)" stroke="#2548e6" stroke-width="2.5" stroke-dasharray="4 2"/>
        <line x1="-12" y1="-12" x2="12" y2="12" stroke="#2548e6" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="12" y1="-12" x2="-12" y2="12" stroke="#2548e6" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="-22" y="20" width="44" height="14" rx="3" fill="rgba(9, 13, 24, 0.9)" stroke="#2548e6" stroke-width="1"/>
        <text x="0" y="30" text-anchor="middle" font-size="8.5" font-weight="900" fill="#60a5fa" font-family="'Inter', system-ui, sans-serif">CLOSED</text>
      </g>
    `;
  });

  return h;
}

function routeSvg() {
  if (!ROUTE || !floor) return "";
  return ROUTE.legs.filter(l => l.floor == floor.id).map(l => {
    const p = l.pts.filter((_, i) => i % 2 == 0 || i == l.pts.length - 1).map(q => q.join(",")).join(" ");
    return `
      <g pointer-events="none" class="route-group">
        <polyline points="${p}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <polyline class="rt" points="${p}" fill="none" stroke="${COL.sel}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        ${l.m.map(([q, t]) => `
          <circle cx="${q[0]}" cy="${q[1]}" r="12" fill="${t == "s" ? COL.ok : t == "e" ? COL.no : "#fb9746"}" stroke="#ffffff" stroke-width="2.5"/>
          <text x="${q[0]}" y="${q[1] + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff" font-family="'Inter', sans-serif">${t == "s" ? "A" : t == "e" ? "B" : "▲"}</text>
        `).join("")}
      </g>
    `;
  }).join("");
}

function fit(bb) {
  const w = bb[2] - bb[0] + 120, h = bb[3] - bb[1] + 120;
  const cw = map.clientWidth;
  const dr = $("dir").style.display == "block" ? Math.max(0, map.getBoundingClientRect().bottom - $("dir").getBoundingClientRect().top) : 0;
  const ch = Math.max(120, map.clientHeight - dr);
  const k = Math.min(cw / w, ch / h, 3);
  V = { k, x: cw / 2 - (bb[0] + bb[2]) / 2 * k, y: ch / 2 - (bb[1] + bb[3]) / 2 * k };
  stage.style.transition = "transform .35s ease-out";
  apply();
  setTimeout(() => stage.style.transition = "", 400);
}

function goLeg(i) {
  const l = ROUTE.legs[i];
  open(l.floor);
  const xs = l.pts.map(p => p[0]), ys = l.pts.map(p => p[1]);
  fit([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
}

function fillDL() {
  const dl = $("dl");
  if (!dl) return;
  dl.innerHTML = [
    '<option value="ENTRANCE">Main Entrance (Ground Floor)</option>',
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

async function go() {
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

  let html = "";
  if (ROUTE.legs.length > 1) {
    html += `
      <div class="route-floor-switch">
        ${ROUTE.legs.map((l, idx) => `
          <button type="button" class="btn ${idx == 0 ? 'on' : ''} r-floor-btn" data-leg="${idx}">
            ${idx == 0 ? '1. ' : '2. '}${fname(l.floor)}
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

const fvDirBtn = $("fv-dir-btn");
if (fvDirBtn) {
  fvDirBtn.onclick = () => {
    const d = $("dir");
    d.style.display = d.style.display == "block" ? "none" : "block";
    fillDL();
  };
}

const dUseEnt = $("d-use-ent");
if (dUseEnt) {
  dUseEnt.onclick = () => {
    $("df").value = "ENTRANCE";
    if ($("dt").value) go();
  };
}

$("dx").onclick = () => $("dir").style.display = "none";
$("ded").onclick = () => $("dir").classList.remove("min");
$("dgo").onclick = go;
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

// Auto-sync from Google Sheet on startup if URL configured
if (GSHEET_URL) {
  syncFromGoogleSheet(GSHEET_URL, true);
}
