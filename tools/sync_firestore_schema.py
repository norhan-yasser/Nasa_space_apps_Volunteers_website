"""
Synchronize and enrich the Firebase Cloud Firestore (`space-apps-cairo-volunteer`) collections:
- Ensures `volunteers` collection contains all volunteer codes (`Name`, `Volunteer Code`, `Team`, `Role`).
- Ensures `rooms` collection contains all 66 venue rooms (including `STAGE`, `PR-F`, `PR-M`, `CAFETERIA`, `BREAK-1`, `BREAK-2`)
  with the complete set of fields required for room info and live editing across Maps, TechOps, Logistics, and Competition portals:
  `code`, `name`, `floor`, `floorName`, `Floor`, `wing`, `Wing`, `roomNo`, `Room No.`, `type`, `Room Type`,
  `access`, `mode`, `zone`, `assigned`, `Room Use / Function`, `resp`, `cap`, `capacity`, `Assigned Capacity`,
  `physicalCapacity`, `Physical Capacity`, `chal`, `teams`, `vteam`, `vcap`, `contact`.
"""
import csv
import json
import os
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT_ID = "space-apps-cairo-volunteer"
DATABASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_JSON = os.path.join(ROOT, "firebase", "seed-data.json")
TECHOPS_SEED_JSON = os.path.join(ROOT, "techops", "firebase", "seed-data.json")
TEMPLATE_CSV = os.path.join(ROOT, "rooms_database_template.csv")

FLOOR_NAMES = {"B": "Basement", "G": "Ground Floor", "F": "First Floor", "S": "Second Floor"}
FLOOR_SHORT = {"B": "Basement", "G": "Ground", "F": "First", "S": "Second"}
TYPE_LABEL = {
    "chairs": "Classroom",
    "cr": "Classroom",
    "classroom": "Classroom",
    "small lecture": "Small Lecture Hall",
    "slh": "Small Lecture Hall",
    "small lecture hall": "Small Lecture Hall",
    "bring your device": "Bring Your Own Device",
    "byod": "Bring Your Own Device",
    "bring your own device": "Bring Your Own Device",
    "lecture": "Lecture Hall",
    "lh": "Lecture Hall",
    "lecture hall": "Lecture Hall",
    "outer stage": "Outer Stage",
    "stage": "Outer Stage",
    "prayer room": "Prayer Room",
    "cafeteria": "Cafeteria",
    "break area": "Break Area",
}

SPECIAL_ROOMS_DEFAULTS = {
    "STAGE": {
        "code": "STAGE",
        "name": "Outer Stage",
        "floor": "G",
        "floorName": "Ground Floor",
        "Floor": "Ground",
        "wing": "Outdoor East",
        "Wing": "Outdoor East",
        "roomNo": "STAGE",
        "Room No.": "STAGE",
        "type": "Outer Stage",
        "Room Type": "Outer Stage",
        "access": "ok",
        "mode": "Unassigned",
        "zone": "VIPs",
        "assigned": "Outer Stage & Main Ceremony",
        "Room Use / Function": "Outer Stage & Main Ceremony",
        "resp": "Stage Management Team",
        "cap": 400,
        "capacity": 400,
        "Assigned Capacity": 400,
        "physicalCapacity": 400,
        "Physical Capacity": 400,
        "chal": "",
        "teams": [],
        "vteam": "",
        "vcap": 0,
        "contact": "",
    },
    "PR-F": {
        "code": "PR-F",
        "name": "Female",
        "floor": "B",
        "floorName": "Basement",
        "Floor": "Basement",
        "wing": "Basement East",
        "Wing": "Basement East",
        "roomNo": "PR-F",
        "Room No.": "PR-F",
        "type": "Prayer Room",
        "Room Type": "Prayer Room",
        "access": "ok",
        "mode": "Unassigned",
        "zone": "Volunteers",
        "assigned": "Female Prayer Room",
        "Room Use / Function": "Female Prayer Room",
        "resp": "Logistics & Facilities Team",
        "cap": 30,
        "capacity": 30,
        "Assigned Capacity": 30,
        "physicalCapacity": 30,
        "Physical Capacity": 30,
        "chal": "",
        "teams": [],
        "vteam": "",
        "vcap": 0,
        "contact": "",
    },
    "PR-M": {
        "code": "PR-M",
        "name": "Men",
        "floor": "B",
        "floorName": "Basement",
        "Floor": "Basement",
        "wing": "Basement East",
        "Wing": "Basement East",
        "roomNo": "PR-M",
        "Room No.": "PR-M",
        "type": "Prayer Room",
        "Room Type": "Prayer Room",
        "access": "ok",
        "mode": "Unassigned",
        "zone": "Volunteers",
        "assigned": "Men Prayer Room",
        "Room Use / Function": "Men Prayer Room",
        "resp": "Logistics & Facilities Team",
        "cap": 40,
        "capacity": 40,
        "Assigned Capacity": 40,
        "physicalCapacity": 40,
        "Physical Capacity": 40,
        "chal": "",
        "teams": [],
        "vteam": "",
        "vcap": 0,
        "contact": "",
    },
    "CAFETERIA": {
        "code": "CAFETERIA",
        "name": "Cafeteria",
        "floor": "G",
        "floorName": "Ground Floor",
        "Floor": "Ground",
        "wing": "Ground East",
        "Wing": "Ground East",
        "roomNo": "CAFETERIA",
        "Room No.": "CAFETERIA",
        "type": "Cafeteria",
        "Room Type": "Cafeteria",
        "access": "ok",
        "mode": "Unassigned",
        "zone": "Participants",
        "assigned": "Main Cafeteria & Catering Area",
        "Room Use / Function": "Main Cafeteria & Catering Area",
        "resp": "Logistics & Catering Lead",
        "cap": 150,
        "capacity": 150,
        "Assigned Capacity": 150,
        "physicalCapacity": 150,
        "Physical Capacity": 150,
        "chal": "",
        "teams": [],
        "vteam": "",
        "vcap": 0,
        "contact": "",
    },
    "BREAK-1": {
        "code": "BREAK-1",
        "name": "Break Area",
        "floor": "F",
        "floorName": "First Floor",
        "Floor": "First",
        "wing": "First Floor East",
        "Wing": "First Floor East",
        "roomNo": "BREAK-1",
        "Room No.": "BREAK-1",
        "type": "Break Area",
        "Room Type": "Break Area",
        "access": "ok",
        "mode": "Unassigned",
        "zone": "Participants",
        "assigned": "First Floor Break & Networking Area",
        "Room Use / Function": "First Floor Break & Networking Area",
        "resp": "Logistics Team",
        "cap": 80,
        "capacity": 80,
        "Assigned Capacity": 80,
        "physicalCapacity": 80,
        "Physical Capacity": 80,
        "chal": "",
        "teams": [],
        "vteam": "",
        "vcap": 0,
        "contact": "",
    },
    "BREAK-2": {
        "code": "BREAK-2",
        "name": "Break Area",
        "floor": "S",
        "floorName": "Second Floor",
        "Floor": "Second",
        "wing": "Second Floor East",
        "Wing": "Second Floor East",
        "roomNo": "BREAK-2",
        "Room No.": "BREAK-2",
        "type": "Break Area",
        "Room Type": "Break Area",
        "access": "ok",
        "mode": "Unassigned",
        "zone": "Participants",
        "assigned": "Second Floor Break & Networking Area",
        "Room Use / Function": "Second Floor Break & Networking Area",
        "resp": "Logistics Team",
        "cap": 80,
        "capacity": 80,
        "Assigned Capacity": 80,
        "physicalCapacity": 80,
        "Physical Capacity": 80,
        "chal": "",
        "teams": [],
        "vteam": "",
        "vcap": 0,
        "contact": "",
    },
}


def from_firestore(val):
    if not isinstance(val, dict):
        return val
    if "stringValue" in val:
        return val["stringValue"]
    if "integerValue" in val:
        return int(val["integerValue"])
    if "doubleValue" in val:
        return float(val["doubleValue"])
    if "booleanValue" in val:
        return bool(val["booleanValue"])
    if "nullValue" in val:
        return None
    if "arrayValue" in val:
        return [from_firestore(x) for x in val["arrayValue"].get("values", [])]
    if "mapValue" in val:
        return {k: from_firestore(v) for k, v in val["mapValue"].get("fields", {}).items()}
    return None


def to_firestore(val):
    if val is None:
        return {"nullValue": None}
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, list):
        return {"arrayValue": {"values": [to_firestore(x) for x in val]}}
    if isinstance(val, dict):
        return {"mapValue": {"fields": {k: to_firestore(v) for k, v in val.items()}}}
    return {"stringValue": str(val)}


def fetch_collection(collection):
    url = f"{DATABASE_URL}/{collection}?pageSize=300"
    try:
        req = urllib.request.urlopen(url, timeout=15)
        raw = json.loads(req.read().decode("utf-8"))
        out = {}
        for doc in raw.get("documents", []):
            doc_id = doc["name"].split("/")[-1]
            fields = {k: from_firestore(v) for k, v in doc.get("fields", {}).items()}
            out[doc_id] = fields
        return out
    except Exception as e:
        print(f"Warning fetching {collection}: {e}")
        return {}


def upload_doc(collection, doc_id, data):
    quoted_id = urllib.parse.quote(doc_id, safe="")
    url = f"{DATABASE_URL}/{collection}/{quoted_id}"
    fields = {k: to_firestore(v) for k, v in data.items()}
    body = json.dumps({"fields": fields}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200, collection, doc_id, None
    except Exception as e:
        return False, collection, doc_id, str(e)


def delete_doc(collection, doc_id):
    quoted_id = urllib.parse.quote(doc_id, safe="")
    url = f"{DATABASE_URL}/{collection}/{quoted_id}"
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200, collection, doc_id, None
    except Exception as e:
        return False, collection, doc_id, str(e)


def new_wing_letter(n):
    if n in (15, 16, 17) or 122 <= n <= 131 or 224 <= n <= 231:
        return "B"
    if n in (26, 27, 34, 35) or 132 <= n <= 141 or 233 <= n <= 242:
        return "C"
    if 113 <= n <= 114 or 209 <= n <= 210:
        return "A"
    if 152 <= n <= 154 or 252 <= n <= 265:
        return "D"
    return None


def canonical_room_code(code):
    """Map legacy space-type room codes (e.g. C152, H113, S015) to canonical wing codes (D152, A113, B015)."""
    if len(code) == 4 and code[0] in ("S", "C", "B", "H") and code[1:].isdigit():
        letter = new_wing_letter(int(code[1:]))
        if letter:
            return letter + code[1:]
    return code


def floor_code_from_str(s):
    s = str(s or "").strip().lower()
    if s.startswith("b"):
        return "B"
    if s.startswith("g"):
        return "G"
    if s.startswith("f"):
        return "F"
    if s.startswith("s"):
        return "S"
    return "G"


def load_template_csv():
    if not os.path.exists(TEMPLATE_CSV):
        return {}
    out = {}
    with open(TEMPLATE_CSV, "r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            code = (row.get("Room Code") or "").strip()
            if not code:
                continue
            teams_raw = (row.get("Team Names") or "").strip()
            teams = [t.strip() for t in teams_raw.replace(",", ";").split(";") if t.strip()] if teams_raw else []
            cap_str = (row.get("Capacity") or "").strip()
            vcap_str = (row.get("Volunteer Capacity") or "").strip()
            access_raw = (row.get("Access Status") or "Accessible").strip().lower()
            out[code] = {
                "floor": floor_code_from_str(row.get("Floor")),
                "type": (row.get("Space Type") or "").strip(),
                "access": "no" if access_raw == "restricted" else "ok",
                "mode": (row.get("Assignment Type") or "Unassigned").strip() or "Unassigned",
                "resp": (row.get("Lead Manager") or "").strip(),
                "cap": int(cap_str) if cap_str.isdigit() else None,
                "chal": (row.get("Challenge Track") or "").strip(),
                "teams": teams,
                "vteam": (row.get("Volunteer Squad") or "").strip(),
                "vcap": int(vcap_str) if vcap_str.isdigit() else 0,
            }
    return out


def enrich_room(code, base_doc, tpl_doc, live_doc):
    # Start from special defaults if applicable
    merged = {}
    if code in SPECIAL_ROOMS_DEFAULTS:
        merged.update(SPECIAL_ROOMS_DEFAULTS[code])
    if base_doc:
        merged.update(base_doc)

    # Determine floor
    fl = (live_doc or {}).get("floor") or merged.get("floor") or (tpl_doc or {}).get("floor") or floor_code_from_str(merged.get("Floor") or merged.get("floorName"))
    fl_name = FLOOR_NAMES.get(fl, "Ground Floor")
    fl_short = FLOOR_SHORT.get(fl, "Ground")

    # Determine wing & roomNo
    wing = str((live_doc or {}).get("wing") or (live_doc or {}).get("Wing") or merged.get("wing") or merged.get("Wing") or "").strip()
    if not wing and len(code) == 4 and code[0] in ("A", "B", "C", "D") and code[1:].isdigit():
        wing = f"Wing {code[0]}"
    room_no = str((live_doc or {}).get("roomNo") or (live_doc or {}).get("Room No.") or merged.get("roomNo") or merged.get("Room No.") or "").strip()
    if not room_no and len(code) == 4 and code[1:].isdigit():
        room_no = code[1:]

    # Determine Space Type
    raw_type = str((live_doc or {}).get("type") or (tpl_doc or {}).get("type") or merged.get("type") or merged.get("Room Type") or "").strip()
    norm_type = TYPE_LABEL.get(raw_type.lower(), raw_type) or "Classroom"
    raw_room_type = str(merged.get("Room Type") or norm_type).strip() or norm_type

    # Capacities
    phys_cap = int((live_doc or {}).get("physicalCapacity") or (live_doc or {}).get("Physical Capacity") or merged.get("physicalCapacity") or merged.get("Physical Capacity") or 0)
    base_assigned_cap = int(merged.get("Assigned Capacity") or merged.get("capacity") or merged.get("cap") or 0)
    tpl_cap = (tpl_doc or {}).get("cap")
    live_cap = (live_doc or {}).get("cap") if (live_doc or {}).get("cap") not in (None, "") else None
    cap = int(live_cap if live_cap is not None else (tpl_cap if tpl_cap is not None else (base_assigned_cap or phys_cap)))
    if phys_cap == 0 and cap > 0:
        phys_cap = cap

    # Assignment mode (single unified field for Assignment Type / Zone / Room Use)
    live_mode = (live_doc or {}).get("mode")
    tpl_mode = (tpl_doc or {}).get("mode")
    live_zone = (live_doc or {}).get("zone")
    mode = (
        live_mode
        if live_mode in ("Participants", "Volunteers", "Judges", "Mentors", "VIPs")
        else (
            tpl_mode
            if tpl_mode in ("Participants", "Volunteers", "Judges", "Mentors", "VIPs")
            else (
                live_zone
                if live_zone in ("Participants", "Volunteers", "Judges", "Mentors", "VIPs")
                else "Unassigned"
            )
        )
    )

    access_val = (live_doc or {}).get("access") or (tpl_doc or {}).get("access") or merged.get("access") or "ok"
    access = "no" if str(access_val).lower() in ("no", "restricted") else "ok"

    resp = str((live_doc or {}).get("resp") or (tpl_doc or {}).get("resp") or merged.get("resp") or "").strip()
    chal = str((live_doc or {}).get("chal") or (tpl_doc or {}).get("chal") or merged.get("chal") or "").strip()

    live_teams = (live_doc or {}).get("teams")
    tpl_teams = (tpl_doc or {}).get("teams")
    teams = live_teams if isinstance(live_teams, list) and len(live_teams) > 0 else (tpl_teams if isinstance(tpl_teams, list) else [])

    vteam = str((live_doc or {}).get("vteam") or (tpl_doc or {}).get("vteam") or merged.get("vteam") or "").strip()
    live_vcap = (live_doc or {}).get("vcap")
    tpl_vcap = (tpl_doc or {}).get("vcap")
    vcap = int(live_vcap if live_vcap not in (None, "") else (tpl_vcap if tpl_vcap not in (None, "") else 0))

    name = str((live_doc or {}).get("name") or merged.get("name") or ("Female" if code == "PR-F" else "Men" if code == "PR-M" else "")).strip()

    return {
        "code": code,
        "name": name,
        "floor": fl,
        "type": norm_type,
        "access": access,
        "mode": mode,
        "resp": resp,
        "cap": cap,
        "chal": chal,
        "teams": teams,
        "vteam": vteam,
        "vcap": vcap,
    }


def main():
    with open(SEED_JSON, "r", encoding="utf-8") as f:
        seed = json.load(f)

    tpl_rooms = load_template_csv()
    live_rooms = fetch_collection("rooms")
    live_vols = fetch_collection("volunteers")

    print(f"Fetched {len(live_rooms)} live rooms and {len(live_vols)} live volunteers from Firestore.")

    # 1. Enrich Volunteers
    volunteers = dict(seed.get("volunteers", {}))
    for vcode, vdoc in live_vols.items():
        if vcode not in volunteers:
            volunteers[vcode] = vdoc
        else:
            volunteers[vcode].update(vdoc)

    for vcode, vdoc in list(volunteers.items()):
        name = vdoc.get("Name") or vdoc.get("name") or vcode
        team = vdoc.get("Team") or vdoc.get("team") or "Volunteers"
        role = vdoc.get("Role") or vdoc.get("role") or team
        volunteers[vcode] = {
            "Name": name,
            "Volunteer Code": vcode,
            "Team": team,
            "Role": role,
        }

    # 2. Enrich Rooms (canonical wing-based rooms + special rooms, deleting stale pre-migration room IDs)
    base_rooms = {k: v for k, v in seed.get("rooms", {}).items() if canonical_room_code(k) == k}
    stale_live_rooms = [k for k in live_rooms.keys() if canonical_room_code(k) != k]
    valid_live_rooms = {k: v for k, v in live_rooms.items() if canonical_room_code(k) == k}

    all_room_codes = sorted(set(base_rooms.keys()) | set(tpl_rooms.keys()) | set(SPECIAL_ROOMS_DEFAULTS.keys()) | set(valid_live_rooms.keys()))

    enriched_rooms = {}
    for code in all_room_codes:
        enriched_rooms[code] = enrich_room(
            code,
            base_rooms.get(code),
            tpl_rooms.get(code),
            valid_live_rooms.get(code),
        )

    seed["volunteers"] = volunteers
    seed["rooms"] = enriched_rooms

    with open(SEED_JSON, "w", encoding="utf-8") as f:
        json.dump(seed, f, indent=2, ensure_ascii=False)
    if os.path.exists(os.path.dirname(TECHOPS_SEED_JSON)):
        with open(TECHOPS_SEED_JSON, "w", encoding="utf-8") as f:
            json.dump(seed, f, indent=2, ensure_ascii=False)

    if stale_live_rooms:
        print(f"Removing {len(stale_live_rooms)} stale pre-migration room documents from Firestore...")
        with ThreadPoolExecutor(max_workers=12) as ex:
            list(ex.map(lambda doc_id: delete_doc("rooms", doc_id), stale_live_rooms))

    # Upload volunteers and rooms (and ensure wifi, team, inventory, reports, meetups exist)
    tasks = []
    for col in ("volunteers", "rooms", "wifi", "team", "inventory"):
        for doc_id, doc_data in seed.get(col, {}).items():
            tasks.append((col, doc_id, doc_data))

    print(f"Uploading {len(tasks)} documents (volunteers: {len(volunteers)}, rooms: {len(enriched_rooms)}) to Firestore `{PROJECT_ID}`...")
    ok_count = 0
    errors = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = [ex.submit(upload_doc, col, doc_id, doc_data) for col, doc_id, doc_data in tasks]
        for fut in as_completed(futs):
            ok, col, doc_id, err = fut.result()
            if ok:
                ok_count += 1
            else:
                errors.append(f"{col}/{doc_id}: {err}")

    print(f"Completed: {ok_count}/{len(tasks)} documents uploaded.")
    if errors:
        print("Errors:", errors[:10])


if __name__ == "__main__":
    main()
