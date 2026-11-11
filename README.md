# NASA Space Apps Challenge · Venue & Floor Operations

Official Venue Floor Management, Interactive Room Wayfinding, and Realtime Operations System for NASA Space Apps Challenge Cairo.

---

## Features
- **Interactive Multi-Level Map:** Floor blueprints with high-contrast clickable room polygons for Basement, Ground, First, and Second floors.
- **Corridor-Following Wayfinding:** Automatic A* pathfinding showing optimal routes and stairway transitions between any two rooms or the main entrance.
- **Realtime Firebase database (Maps + Tech Ops):** Room assignments, managers, capacities, challenge tracks and team rosters live in the Firestore `rooms` collection. Maps and Tech Ops read the same documents in real time, and edits made in Maps ("Edit Room Details") show up everywhere instantly.
- **Search System:** Search any room code, lead manager, challenge track, or team name with instant pan & zoom focus.
- **Professional Space Identity:** NASA Space Apps typography (`Munake` & `abeatbyKai`), official vector logos, and seamless Dark/Light theme switching.

---

## How the site is organised

**Overview** (`index.html`) shows three cards. Each one opens a code page first:

| Card | Page | Who | Code |
|---|---|---|---|
| Maps | `maps.html` | every volunteer | the **common code** (`NSAC-2026` in the dummy data) or any TO-/LG- code |
| Logistics | `logistics/index.html` | Logistics team | `LG-xxx` |
| Tech Ops | `techops/index.html` | Tech Ops team | `TO-xxx` |
| Competition Team | `dispatch/index.html` | Competition Team (formerly Dispatch: monitor, alarm, hand out remotely) | `CT-xxx` |

The admin dashboard was removed. Codes live in the Firestore `volunteers` collection (`Team` = `Volunteers`, `Logistics` or `TechOps`), so the common code can be changed there without touching the site. If you upload a real roster with `--volunteers`, include the common code in it.

### Participant QR code (ONE poster for the whole venue)
- Poster (volunteers only, needs a code): `request/poster.html`. It encodes `request/form.html`.
- Participants scan it, pick floor + room, then choose a request. Each request type belongs to exactly **one** team
  (table `REQUEST_TYPES` in `techops/js/data.js`), so it reaches only that team's dashboard and alerts:
  - **Tech Ops:** internet lag, power, tech assistance, other tech problem.
  - **Logistics:** go to a place, prayer request, help request.
  - **Competition Team:** Discord issue, competition question, submission help, other. These are handled remotely, so the form does **not** ask for floor or room; it asks for the participant's team name and Discord username instead.
- The form asks for the **team first** (Tech Ops, Logistics or Competition Team, mandatory). Floor and room are only asked when Tech Ops or Logistics was chosen, because those teams come to the room. The form has no link to any volunteer page. Old `report.html` / `help.html` / `qr-codes.html` addresses forward here, so printed codes keep working.
- Both queues live in the Firestore `reports` collection, separated by `team`. A volunteer only sees and claims their own team's queue.

### Competition Team (the former Dispatch team)
`dispatch/index.html` is a monitor for **all three** queues (the folder is still `dispatch/`; codes are `CT-xxx` with `Team` = `Competition`; the old `DP-xxx` / `Dispatch` value still works). Every card starts with the team name, then the request (room and details are small). The page rings an alarm for new requests. A dispatcher **claims** a request, **hands it out** to a Tech Ops / Logistics member by name (suggestions come from `DISPATCH_MEMBERS` in `techops/js/config.js`, which now also has a `Competition` list), and can **Copy for Discord** to paste the request into Discord. The member then sees it as assigned to them in their own dashboard.

### Adding / changing Competition Team access codes
A person gets in with a code that exists in the Firestore `volunteers` collection, one document per code (document id = the code):
`{ "Name": "Sara", "Volunteer Code": "CT-003", "Team": "Competition" }`
- **In the Firebase console:** Firestore Database > `volunteers` > Add document, id `CT-003`, fields above. Delete the document to remove access.
- **Whole roster at once:** write a `volunteers.real.json` (format and a `CT-101` example are at the top of `techops/tools/seed_firebase.py`) and upload it with `python tools/seed_firebase.py --key key.json --volunteers volunteers.real.json`.
- **Local preview (no Firebase):** the dummy list is in `techops/js/seed-data.js` (built by `techops/tools/build_seed_data.py`) (preview codes `CT-001`, `CT-002`).
- Names given to a person should match the names in `DISPATCH_MEMBERS.Competition` (`techops/js/config.js`) so hand-out suggestions line up.
- After changing the Firestore rules file, republish the rules.

### Volunteer sign-in
The login is kept in the browser tab only (`sessionStorage`) and expires when the site was not open for `SESSION_GRACE_MS` (5 min, `techops/js/config.js`). Maps does not load any map data until the code is accepted.

### Self-test
`node tests/run.js` (or open `tests/selftest.html` in the browser from a local server) checks routing, session expiry and that the participant page links to nothing private.

## Project Structure
```
├── index.html                   # Overview: Maps / Logistics / Tech Ops
├── landing.css                  # Overview styling
├── maps.html + maps-gate.js     # Venue maps for all volunteers (code gate)
├── styles.css, app.js           # Floor geometries, A* pathfinding, live Firestore rooms (maps)
├── logistics.html               # old address, redirects to logistics/
├── logistics/                   # Logistics dashboard, help form (QR), QR poster
├── techops/                     # Tech Ops dashboard, report form (QR), QR poster, shared data layer (js/store.js)
├── rooms_database_template.csv  # 85-room database template
└── assets/                      # favicon, fonts, logos, floor images
```

---

## Live database (Firebase Firestore)
Project `space-apps-cairo-volunteer`. Everything is read in real time with `onSnapshot` (see `scripts/services/store.js`):

| Collection | Used by | Notes |
|---|---|---|
| `volunteers` | login on every page | one document per code (`NSAC-2026`, `TO-xxx`, `LG-xxx`, `CT-xxx`); codes cannot be listed, only fetched one by one |
| `rooms` | **Maps** and **Tech Ops** | document id = room code (`C034`, `A113`, `STAGE`, ...). Fields: `resp`, `cap`, `mode`, `access`, `chal`, `teams`, `vteam`, `vcap`, plus `zone`, `Room Type`, ... |
| `reports`, `team`, `meetups`, `inventory`, `wifi` | Tech Ops / Logistics / Competition Team | see `firebase/firestore.rules` |

The Google Sheet is no longer used. To bulk-edit rooms, change them in the Maps page (Edit Room Details) or in the Firebase console, or edit `firebase/seed-data.json` and upload with `python tools/seed_firebase.py --key key.json --only rooms`.

### Room codes = wing letter + number
The current floor plans (`assets/floors/*.png`, same images as `assets/su tech floor assets/*.png`) label rooms by **wing**: **A** lower-right, **B** upper-right, **C** upper-left, **D** lower-left (for example `C034`, `B123`, `A113`, `D154`). The space type (classroom, BYOD, small lecture, lecture hall) is shown by the colour on the plan and is stored in `ROOM_TYPE` in `app.js`; it is no longer the first letter of the code. Old codes (`S034`, `H113`, `C017`, `C154`, `B135`, ...) were renamed everywhere. Floor images are loaded with `?v=20261111`; bump this number whenever you replace the PNGs so phones do not keep the old picture.

### Going live checklist
1. Firebase console > Authentication > Sign-in method: **Anonymous** enabled.
2. Firestore Database created; publish `firebase/firestore.rules` (Rules tab).
3. First time only: `python tools/seed_firebase.py --key key.json` (volunteers, rooms, ...). Use `--volunteers volunteers.real.json` for the real roster.
4. Already seeded with the OLD room codes? Run once: `python tools/migrate_room_codes.py --key key.json --dry-run`, then without `--dry-run`. It moves the existing room documents to the new codes and keeps their data.
5. Push to `main`: the GitHub Action publishes the site (GitHub Pages). Custom domain: `logistics.spaceappscairo.com`.

## Ground floor additions
- **Outer Stage** (code `STAGE`): use the room document `STAGE` in Firestore (`rooms/STAGE`) and put the people responsible for arranging it in its `resp` field, separated by `;` (example: `Name 1; Name 2`).
- **Exits**: the main entrance plus four small doors are highlighted in green on the ground floor and can be used as route destinations (`EXIT-1` to `EXIT-4`, `ENTRANCE`).
- **Bathrooms** (pink) and **Nearest bathroom** from any origin on every floor.


## Basement
- Plan: `assets/floors/0.png` (floor id `B`, "Level -1").
- Only the **North-East (EN)** and **South-East (SE)** stairs reach the basement. `STAIR-WN`, `STAIR-WS`, `STAIR-SW` serve Ground -> 2nd floor only (see `ST.B` in `app.js`).
- Marked: Female Prayer (`PR-F`), Men Prayer (`PR-M`), one bathroom (`WC-B1`), far-west outer stairs shown as closed.
- Routes across several floors (e.g. Second Floor -> Basement) are chained level by level through stairs that exist on both floors.

## Cafeteria & break areas
- `CAFETERIA` (ground floor, open area east of the auditorium, entered from the north-east door or the outdoor path), `BREAK-1` (first floor) and `BREAK-2` (second floor) are routable like any room; search "cafeteria" or "break".
