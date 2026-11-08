# TechOps prototype

An isolated prototype for the **TechOps** category of NASA Space Apps Cairo. It lives in this folder only and does not touch the Logistics site (`logistics.html`, `app.js`, `styles.css`) or the Logistics Google Sheet.

| Page | What it is |
|---|---|
| `index.html` | TechOps dashboard: issues, floor maps (zones + Wi-Fi heatmap), team and meetups, inventory |
| `report.html` | Public mobile form opened by the room QR codes |
| `qr-codes.html` | Printable sheet with one QR code per room (now also the prayer rooms, cafeteria and break areas) |

Open `index.html` directly in a browser, or serve the repo root (for example `python -m http.server`) and go to `/techops/`.

## Features

- **4 interactive floor maps (Basement, Ground, First, Second)** (pan, zoom, click a room). Rooms are coloured by zone: Participants, Volunteers, VIPs, Judges, Mentors.
- **QR issue reporting.** Each room has a QR code that opens `report.html?floor=F&room=C139`. The user can change floor and room, then picks *Internet is lagging*, *Electricity / Power problem*, *Need TechOps assistance* or *Other* (free text).
- **Live alerts.** The dashboard re-reads the sheet every 12 s (`POLL_MS`). A new report raises a toast, a sound, a bell counter, a pulsing pin on the map and, if enabled, a desktop notification (button *Enable alerts*).
- **Team and meetups.** Click a profile, enter your room and their room, choose where to meet. The request is stored, shown to that member (choose *Viewing as* in the header) with *On my way* / *Done*, and previewed on the map.
- **Wi-Fi heatmap.** Glowing overlay from the `WiFi` tab: green (good) fading through yellow and orange to red (poor).
- **Inventory.** Who holds each item, and which team and room it was lent to. Change holder, lend out, mark returned.

## The separate Google Sheet (dummy data)

**TechOps Prototype - Dummy Backend**, ID `1W_tfJnBPlaeqshRK_09IjRKlAe-3mE61yK9iV8AbBxM` (set in `js/config.js`). It is a different spreadsheet from the Logistics one.

| Tab | Columns |
|---|---|
| `Rooms` | Room Code, Floor, Zone, Space Type, Capacity, Assigned To, Room Contact |
| `WiFi` | Point ID, Floor, Label, X, Y, Speed Mbps, Latency ms, Last Updated (X/Y are pixels on the floor plan) |
| `Team` | Name, Role, Phone, Current Floor, Current Room, Status, Focus Area |
| `Inventory` | Item ID, Item, Category, Quantity, Held By, Lent To Team, Lent To Room, Lent To Floor, Status, Last Updated |
| `Reports` | Report ID, Timestamp, Floor, Room, Issue Type, Details, Status, Assigned To, Resolved At, Reporter |
| `Meetups` | Request ID, Timestamp, Requested By, Target Member, Requester Floor, Requester Room, Target Floor, Target Room, Meet At, Note, Status |

`sample-data/*.csv` hold the same dummy data. `tools/generate-sample-data.ps1` regenerates the CSVs and `js/sample-data.js`.

## Going live (two one-time steps)

1. **Reading:** in the sheet click *Share* and set General access to *Anyone with the link: Viewer*. Until then the site shows the bundled dummy data and the header says **Demo data**.
2. **Writing:** a static site cannot write to a sheet by itself, so use the Apps Script in `apps-script/Code.gs`:
   1. Open the sheet, then *Extensions, Apps Script*, and paste `Code.gs`.
   2. *Deploy, New deployment, Web app*. Execute as **Me**, access **Anyone**.
   3. Copy the Web app URL into `APPS_SCRIPT_URL` in `js/config.js`.

Without step 2 the prototype runs in **demo write mode**: reports, meetups and edits are saved in that browser only (tabs of the same browser see each other, so you can test the alert flow by opening `report.html` in one tab and the dashboard in another).

### QR codes

QR codes point to `PUBLIC_BASE_URL` in `js/config.js` (default: the GitHub Pages address of this folder). On `qr-codes.html` you can type another address and press *Apply*. Phones cannot open `file://` or `localhost`, so print the codes only after the folder is hosted. The Pages workflow deploys from `main`.

## Replacing dummy data with real data

Edit the tabs in the sheet (keep the header row). Room codes must match the floor plans (see `js/data.js`); rooms missing from the `Rooms` tab show as grey. For the heatmap add one row per measurement in `WiFi` with its floor and X/Y position.

## Security notes

- The Apps Script endpoint has no login: anyone who knows the URL can send reports. Fine for a prototype; add a shared secret or Google sign-in before real use.
- The script only writes to the listed tabs and existing columns, limits text length and neutralises formulas.
- The sheet is world-readable once shared by link, so keep real phone numbers and personal data out of it unless that is acceptable.

## Basement, cafeteria and break areas
- Basement uses `../assets/su tech floor assets/0.png`. Only `STAIR-EN` and `STAIR-SE` reach it; `WN`, `WS`, `SW` serve Ground to Second only (`ST.B` in `js/router.js`).
- `PR-F`, `PR-M` (basement prayer rooms), `CAFETERIA` (ground), `BREAK-1` (first) and `BREAK-2` (second) are in `js/data.js` as shared places. They have no sheet row: the dashboard adds a plain one so they can be selected, routed to, reported on and used for meetups.
- Routes across several floors are chained level by level through stairs that exist on both floors.
