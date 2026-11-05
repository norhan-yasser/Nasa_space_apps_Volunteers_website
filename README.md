# NASA Space Apps Challenge · Venue & Floor Operations

Official Venue Floor Management, Interactive Room Wayfinding, and Realtime Operations System for NASA Space Apps Challenge Cairo.

---

## Features
- **Interactive Multi-Level Map:** Floor blueprints with high-contrast clickable room polygons for Ground, First, and Second floors.
- **Corridor-Following Wayfinding:** Automatic A* pathfinding showing optimal routes and stairway transitions between any two rooms or the main entrance.
- **Realtime Google Sheets Database:** Room assignments, managers, capacities, challenge tracks, and team rosters sync live directly from Google Sheets.
- **Search System:** Search any room code, lead manager, challenge track, or team name with instant pan & zoom focus.
- **Professional Space Identity:** NASA Space Apps typography (`Munake` & `abeatbyKai`), official vector logos, and seamless Dark/Light theme switching.

---

## Project Structure
```
├── index.html                   # Main application entry point
├── styles.css                   # Responsive layout & NASA brand styling
├── app.js                       # Floor geometries, A* pathfinding, and Google Sheets sync
├── rooms_database_template.csv  # 85-room database template
└── assets/
    ├── favicon.png              # NASA Space Apps favicon
    ├── fonts/                   # Official brand typography
    ├── logos/                   # Official horizontal and square logos
    └── images/                  # Floor banners and backgrounds
```

---

## Live Google Sheet Database
The database is connected to:
[NASA Space Apps Volunteers Web Sheet](https://docs.google.com/spreadsheets/d/1E4-_JjPiIhed005w43jl1s-FfmRiAzNaISEfJZihAbQ/edit)
