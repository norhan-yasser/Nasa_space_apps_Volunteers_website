"""
Build the unified Firebase seed data for the TechOps portal.

Inputs
  data/SU TECH , Rooms.xlsx   -> `rooms`  (sheet "Sheet3": Floor, Wing, Room No., Room Type,
                                           Physical Capacity, Assigned Capacity, Room Use / Function)
  sample-data/*.csv           -> `wifi` (room points only), `team`, `inventory`, `reports`, `meetups`
  built-in dummy list         -> `volunteers` (Name / Volunteer Code / Team)

Outputs
  firebase/seed-data.json     -> uploaded to Firestore by tools/seed_firebase.py or tools/seed_firestore_rest.py
  js/seed-data.js             -> bundled for the offline "local preview" mode only (DUMMY data)

Run from the techops folder:  python tools/build_seed_data.py
"""
import csv
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOORS = {"Ground": ("G", "Ground Floor"), "First": ("F", "First Floor"), "Second": ("S", "Second Floor")}
FLOOR_BY_NAME = {v[1]: v[0] for v in FLOORS.values()}
TYPE_LETTER = {"chairs": "C", "small lecture": "S", "bring your device": "B", "lecture": "H"}

# --- dummy volunteers: replace with the real roster via seed_firebase.py --volunteers -------------
VOLUNTEERS = [
    # Common & Maps codes: open the Maps page for ANY volunteer (give NSAC-2026 to everybody). Change it before the event.
    ("NASA Space Apps Volunteer", "NSAC-2026", "Volunteers"),
    ("Maps Volunteer 1", "MAP-001", "Volunteers"),
    ("Maps Volunteer 2", "MAP-002", "Volunteers"),
    ("Maps Volunteer 3", "MAP-003", "Volunteers"),
    # Tech Ops dummy volunteer codes
    ("Mohamed Khairy", "TO-001", "TechOps"),
    ("Omar", "TO-002", "TechOps"),
    ("Lojine", "TO-003", "TechOps"),
    ("Karim", "TO-004", "TechOps"),
    ("Tasbeeh", "TO-005", "TechOps"),
    ("Nour", "TO-006", "TechOps"),
    ("Youssef", "TO-007", "TechOps"),
    ("Hana", "TO-008", "TechOps"),
    # Competition Team dummy volunteer codes
    ("Competition Lead", "CT-001", "Competition"),
    ("Competition Volunteer", "CT-002", "Competition"),
    ("Competition Coordinator", "CT-003", "Competition"),
    ("Competition Support", "CT-004", "Competition"),
    # Logistics dummy volunteer codes
    ("Norhan Yasser", "LG-001", "Logistics"),
    ("Logistics Lead", "LG-002", "Logistics"),
    ("Logistics Volunteer", "LG-003", "Logistics"),
]

# dummy Logistics tasks (QR help form): kind of help + where. Replaced by real requests during the event.
LOGISTICS_REPORTS = [
    ("LGR-0001", "2026-11-06 11:40:00", "G", "C026", "Go to a place", "Wants to go to: C140 (First Floor)", "Resolved", "Norhan Yasser", "Team Aurora"),
    ("LGR-0002", "2026-11-06 12:02:00", "F", "C139", "Prayer request", "Prayer area: Men", "In Progress", "Logistics Lead", ""),
    ("LGR-0003", "2026-11-06 12:10:00", "S", "B231", "Help request", "Lost my badge, need a replacement", "New", "", "Team Vega"),
    ("LGR-0004", "2026-11-06 12:14:00", "G", "B016", "Go to a place", "Wants to go to: Main Entrance", "New", "", ""),
]

# dummy Competition Team tasks (remote requests from QR help form, no floor/room needed). Replaced by real requests during the event.
COMPETITION_REPORTS = [
    ("CMP-0001", "2026-11-06 11:50:00", "Discord issue", "Cannot see our mentor channel on the Cairo Discord server", "Resolved", "Competition Lead", "Team Solaris · @ziad_m"),
    ("CMP-0002", "2026-11-06 12:06:00", "Competition question", "Can our 240-second demo slide deck include NASA open-source clips?", "In Progress", "Competition Volunteer", "Team Horizon · @salma_k"),
    ("CMP-0003", "2026-11-06 12:18:00", "Submission help", "GitHub repository link validation error on project submission page", "New", "", "Team Nebula · @youssef_dev"),
    ("CMP-0004", "2026-11-06 12:24:00", "Discord issue", "Invite link expired for two teammates joining late", "New", "", "Team Orion · @mariam_a"),
]


def zone_for(use):
    u = (use or "").lower()
    for key, zone in (("judge", "Judges"), ("mentor", "Mentors"), ("vip", "VIPs"), ("volunteer", "Volunteers"),
                      ("participant", "Participants"), ("rest", "Volunteers")):
        if key in u:
            return zone
    return ""


def num(v):
    return int(v) if isinstance(v, (int, float)) else 0


def build_rooms():
    wb = openpyxl.load_workbook(os.path.join(ROOT, "data", "SU TECH , Rooms.xlsx"), data_only=True)
    ws = wb["Sheet3"]
    rows = list(ws.iter_rows(values_only=True))
    start = next(i for i, r in enumerate(rows) if r and r[0] == "Floor") + 1
    rooms = {}
    for r in rows[start:]:
        floor, wing, room_no, rtype, phys, assigned, use = (list(r) + [None] * 7)[:7]
        if floor not in FLOORS:
            continue
        room_no = str(room_no or "").strip()
        rtype = str(rtype.strip() if isinstance(rtype, str) else (rtype or "")).strip()
        letter = TYPE_LETTER.get(rtype.lower())
        if re.fullmatch(r"\d{3}", room_no) and letter:
            code = letter + room_no
        else:  # rooms that are not numbered classrooms (auditorium, clinic, meeting room, VIP room)
            base = (str(use or "").strip() or rtype) if room_no.isdigit() else room_no
            code = re.sub(r"[^A-Z0-9]+", "-", base.upper()).strip("-")
            if room_no.isdigit():
                code += "-" + room_no
        fid, fname = FLOORS[floor]
        use = str(use or "").strip()
        if not use and not room_no.isdigit():
            use = rtype
        rooms[code] = {
            "Floor": floor, "Wing": str(wing or "").strip(), "Room No.": room_no, "Room Type": rtype,
            "Physical Capacity": num(phys), "Assigned Capacity": num(assigned), "Room Use / Function": use,
            "code": code, "floor": fid, "floorName": fname, "zone": zone_for(use or rtype),
        }
    return rooms


def read_csv(name):
    with open(os.path.join(ROOT, "sample-data", name), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def pick(row, mapping):
    out = {}
    for src, dst in mapping:
        v = (row.get(src) or "").strip()
        out[dst] = float(v) if dst in ("x", "y", "mbps", "latency", "qty") and v else (0 if dst in ("x", "y", "mbps", "latency", "qty") else v)
        if isinstance(out[dst], float):
            out[dst] = int(out[dst])
    return out


def point_in_poly(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def room_polygons():
    """Read room geometry out of js/data.js so Wi-Fi points can be validated against it."""
    src = open(os.path.join(ROOT, "js", "data.js"), encoding="utf-8").read()
    polys = {}
    for code, geo in re.findall(r'\["([A-Z]\d{3})", \[([\d, ]+)\]\]', src):
        n = [int(v) for v in geo.split(",")]
        polys[code] = ([(n[0], n[1]), (n[2], n[1]), (n[2], n[3]), (n[0], n[3])] if len(n) == 4
                       else [(n[i], n[i + 1]) for i in range(0, len(n), 2)])
    return polys


def with_floor(d, name_key="floorName", id_key="floor"):
    d[id_key] = FLOOR_BY_NAME.get(d.get(name_key, ""), "")
    return d


def main():
    polys = room_polygons()
    rooms = build_rooms()

    wifi = {}
    skipped = []
    for r in read_csv("WiFi.csv"):
        d = pick(r, [("Point ID", "id"), ("Floor", "floorName"), ("Label", "label"), ("X", "x"), ("Y", "y"),
                     ("Speed Mbps", "mbps"), ("Latency ms", "latency"), ("Last Updated", "updated")])
        code = d["id"][3:]
        if code not in polys:  # corridor / hall / outer-stage access points: NOT part of the room heatmap
            skipped.append(d["label"])
            continue
        if not point_in_poly(d["x"], d["y"], polys[code]):
            xs, ys = zip(*polys[code])
            d["x"], d["y"] = round(sum(xs) / len(xs)), round(sum(ys) / len(ys))
        d["room"] = code
        wifi[d["id"]] = with_floor(d)

    team = {}
    for r in read_csv("Team.csv"):
        d = pick(r, [("Name", "name"), ("Role", "role"), ("Phone", "phone"), ("Current Floor", "floorName"),
                     ("Current Room", "room"), ("Status", "status"), ("Focus Area", "focus")])
        team[d["name"]] = with_floor(d)

    inventory = {}
    for r in read_csv("Inventory.csv"):
        d = pick(r, [("Item ID", "id"), ("Item", "item"), ("Category", "category"), ("Quantity", "qty"),
                     ("Held By", "holder"), ("Lent To Team", "team"), ("Lent To Room", "room"),
                     ("Lent To Floor", "floorName"), ("Status", "status"), ("Last Updated", "updated")])
        inventory[d["id"]] = with_floor(d)

    reports = {}
    for r in read_csv("Reports.csv"):
        d = pick(r, [("Report ID", "id"), ("Timestamp", "ts"), ("Floor", "floorName"), ("Room", "room"),
                     ("Issue Type", "issue"), ("Details", "details"), ("Status", "status"),
                     ("Assigned To", "assigned"), ("Resolved At", "resolvedAt"), ("Reporter", "reporter")])
        d["status"] = {"in progress": "In Progress", "acknowledged": "In Progress"}.get(d["status"].lower(), d["status"])
        d["team"] = "TechOps"
        d["claimedAt"] = d["ts"] if d["assigned"] else ""
        reports[d["id"]] = with_floor(d)

    meetups = {}
    for r in read_csv("Meetups.csv"):
        d = pick(r, [("Request ID", "id"), ("Timestamp", "ts"), ("Requested By", "by"), ("Target Member", "target"),
                     ("Requester Floor", "byFloorName"), ("Requester Room", "byRoom"), ("Target Floor", "targetFloorName"),
                     ("Target Room", "targetRoom"), ("Meet At", "meetAt"), ("Note", "note"), ("Status", "status")])
        with_floor(d, "byFloorName", "byFloor")
        with_floor(d, "targetFloorName", "targetFloor")
        meetups[d["id"]] = d

    for rid, ts, fl, room, issue, details, status, assigned, reporter in LOGISTICS_REPORTS:
        d = {"id": rid, "ts": ts, "floor": fl, "room": room, "issue": issue, "details": details, "status": status, "assigned": assigned,
             "claimedAt": ts if assigned else "", "resolvedAt": ts if status == "Resolved" else "", "reporter": reporter, "team": "Logistics"}
        d["floorName"] = {v[0]: v[1] for v in FLOORS.values()}[fl]
        reports[rid] = d

    for rid, ts, issue, details, status, assigned, reporter in COMPETITION_REPORTS:
        d = {"id": rid, "ts": ts, "floor": "", "floorName": "", "room": "", "issue": issue, "details": details,
             "status": status, "assigned": assigned, "claimedAt": ts if assigned else "",
             "resolvedAt": ts if status == "Resolved" else "", "reporter": reporter, "team": "Competition"}
        reports[rid] = d

    volunteers = {code: {"Name": name, "Volunteer Code": code, "Team": team_name} for name, code, team_name in VOLUNTEERS}

    data = {"volunteers": volunteers, "rooms": rooms, "wifi": wifi, "team": team,
            "inventory": inventory, "reports": reports, "meetups": meetups}

    os.makedirs(os.path.join(ROOT, "firebase"), exist_ok=True)
    with open(os.path.join(ROOT, "firebase", "seed-data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    with open(os.path.join(ROOT, "js", "seed-data.js"), "w", encoding="utf-8") as f:
        f.write("/* DUMMY preview data (offline local mode only). Generated by tools/build_seed_data.py - do not edit.\n"
                " * Real data lives in Firebase. Never put real volunteer codes in this file. */\n")
        f.write("window.TECHOPS_SEED = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")

    print("rooms:", len(rooms), "(mapped on floor plans:", sum(1 for c in rooms if c in polys), ")")
    print("wifi room points:", len(wifi), "| erased non-room points:", ", ".join(skipped))
    print("volunteers:", len(volunteers), "| team:", len(team), "| inventory:", len(inventory),
          "| reports:", len(reports), "| meetups:", len(meetups))
    unmapped = [c for c in polys if c not in rooms]
    if unmapped:
        print("WARNING map rooms missing from the xlsx:", unmapped, file=sys.stderr)


if __name__ == "__main__":
    main()
