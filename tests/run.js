/* Run with:  node tests/run.js   (from the project folder) */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failed = 0;
const line = (pass, name, extra) => { if (!pass) failed++; console.log((pass ? "  PASS  " : "  FAIL  ") + name + (extra ? "  -> " + extra : "")); };

/* ---------- A. logic tests in a fake browser ---------- */
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
const win = { localStorage: mem(), sessionStorage: mem(), TECHOPS_FIREBASE: {}, TECHOPS_CONFIG: { SESSION_GRACE_MS: 5 * 60 * 1000 } };
win.window = win; win.document = { hidden: false, addEventListener() {}, getElementById() { return null; } };
win.addEventListener = () => {}; win.location = { reload() {} };
win.setInterval = () => 0; win.setTimeout = setTimeout; win.clearTimeout = clearTimeout; win.Promise = Promise;
const ctx = vm.createContext(Object.assign(win, { console, Date, Math, JSON, Object, Array, String, Number, Error, URLSearchParams }));
ctx.localStorage = win.localStorage; ctx.sessionStorage = win.sessionStorage;
for (const f of ["techops/js/seed-data.js", "techops/js/data.js", "techops/js/store.js", "tests/selftest.js"]) vm.runInContext(read(f), ctx, { filename: f });
console.log("\nA. Routing and sign-in");
win.runSelfTest().then((res) => {
  res.forEach((r) => line(r.pass, r.name, r.extra));

  /* ---------- B. static checks on the files ---------- */
  console.log("\nB. Files");
  const form = read("request/form.html");
  line(!/href="[^"#]*(index|maps|logistics|techops)[^"#]*"/i.test(form.replace(/href="\.\.\/(assets|techops\/css)[^"]*"/g, "")), "participant form links to no volunteer page");
  line(!/maps\.html|logistics\/index|techops\/index/.test(read("request/form.js")), "participant script has no volunteer links");
  line(form.indexOf('id="team-opts"') > -1 && form.indexOf('id="team-opts"') < form.indexOf('id="floor"'), "team choice is the first thing on the participant form");
  line(/Please choose the team first/.test(read("request/form.js")), "form refuses to send without a team");
  line(fs.existsSync(path.join(ROOT, "dispatch/index.html")) && /handOutReport/.test(read("dispatch/js/dashboard.js")), "Dispatch dashboard exists and can hand out");
  line(/isDispatch\(\)/.test(read("techops/firebase/firestore.rules")) && /handedBy/.test(read("techops/firebase/firestore.rules")), "Firestore rules know the Dispatch team");
  line(/dispatch\/index\.html/.test(read("index.html")), "Overview has a Competition Team card");
  line(/Competition Team/.test(read("index.html")) && /COMPETITION TEAM/.test(read("dispatch/index.html")), "Dispatch team is named Competition Team");
  line(form.indexOf('id="grp-Competition"') > -1 && /Competition Team/.test(read("request/form.js")), "QR form has the Competition Team and its requests");
  line(/Discord issue/.test(read("techops/js/data.js")), "QR form offers a Discord issue request");
  line(/hidden = tm === "Competition"/.test(read("request/form.js")), "room details are hidden for the Competition Team (remote)");
  line(/'Competition'\]/.test(read("techops/firebase/firestore.rules")), "Firestore rules accept Competition requests");
  line(/noindex/.test(form), "participant form is hidden from search engines");
  ["techops/report.html", "logistics/help.html"].forEach((f) => line(/request\/form\.html/.test(read(f)), f + " forwards to the one form"));
  ["techops/qr-codes.html", "logistics/qr-codes.html"].forEach((f) => line(/request\/poster\.html/.test(read(f)), f + " forwards to the one poster"));
  line(/location\.replace\("\.\.\/logistics\/index\.html"\)/.test(read("techops/js/dashboard.js")), "Tech Ops -> Logistics redirect opens index.html (the folder-listing bug)");
  const bare = [];
  (function walk(d) { for (const n of fs.readdirSync(path.join(ROOT, d))) { const p = d ? d + "/" + n : n; const st = fs.statSync(path.join(ROOT, p));
    if (st.isDirectory()) { if (!/node_modules|\.git|vendor|tools/.test(n)) walk(p); }
    else if (/\.(html|js)$/.test(n) && !/seed-data|img_data|qrcode/.test(n)) { const t = read(p); const m = t.match(/(href="|location\.(replace|href\s*=)\(?\s*")(?!https?:)[^"]*\/"/g); if (m) bare.push(p + ": " + m[0]); } } })("");
  line(bare.length === 0, "no link points at a bare folder (these open a file listing)", bare.join("; "));
  const maps = read("maps.html"), app = read("app.js"), gate = read("maps-gate.js");
  line(/body\.locked > \*:not\(\.gate\)\{visibility:hidden\}/.test(maps), "maps content is hidden while locked");
  line(/maps:unlocked/.test(gate) && /maps:unlocked/.test(app), "map data loads only after the code is accepted");
  line(!/^if \(GSHEET_URL\) \{\s*syncFromGoogleSheet/m.test(app), "no sheet request fires at page load");
  line(/config\.js/.test(maps), "maps page loads the session-timeout setting");
  console.log(failed ? "\n" + failed + " check(s) FAILED" : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error("Test run crashed:", e); process.exit(2); });
