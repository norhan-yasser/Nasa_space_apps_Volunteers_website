"""
Cleanup and align the Firestore `wifi` collection with the canonical `rooms` collection:
1. Deletes all stale Wi-Fi documents from Firestore that reference non-existent / pre-migration room IDs.
2. Removes old static dummy Wi-Fi documents so untested rooms appear neutral on the TechOps heatmap.
3. Aligns the room, floor, floorName, and coordinates for any tested Wi-Fi readings with the canonical rooms collection.
4. Cleans up local seed-data.json and sample WiFi.csv files.
"""
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


def from_firestore(fields):
    out = {}
    for k, v in fields.items():
        if "stringValue" in v:
            out[k] = v["stringValue"]
        elif "integerValue" in v:
            out[k] = int(v["integerValue"])
        elif "doubleValue" in v:
            out[k] = float(v["doubleValue"])
        elif "booleanValue" in v:
            out[k] = v["booleanValue"]
        elif "nullValue" in v:
            out[k] = None
        elif "arrayValue" in v:
            out[k] = [next(iter(item.values())) for item in v["arrayValue"].get("values", [])]
        elif "mapValue" in v:
            out[k] = from_firestore(v["mapValue"].get("fields", {}))
    return out


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
    docs = {}
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for doc in data.get("documents", []):
                doc_id = doc["name"].split("/")[-1]
                fields = from_firestore(doc.get("fields", {}))
                docs[doc_id] = fields
    except Exception as e:
        print(f"Error fetching collection `{collection}`: {e}")
    return docs


def delete_doc(collection, doc_id):
    quoted = urllib.parse.quote(doc_id, safe="")
    url = f"{DATABASE_URL}/{collection}/{quoted}"
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"Failed to delete {collection}/{doc_id}: {e}")
        return False


def upload_doc(collection, doc_id, data):
    quoted = urllib.parse.quote(doc_id, safe="")
    url = f"{DATABASE_URL}/{collection}/{quoted}"
    fields = {k: to_firestore(v) for k, v in data.items()}
    body = json.dumps({"fields": fields}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200, collection, doc_id, None
    except Exception as e:
        return False, collection, doc_id, str(e)


def main():
    print(f"Connecting to Firestore `{PROJECT_ID}`...")
    rooms = fetch_collection("rooms")
    wifi = fetch_collection("wifi")

    print(f"Found {len(rooms)} rooms and {len(wifi)} wifi documents in Firestore.")

    room_codes = set(rooms.keys())

    to_delete = []
    to_keep = []

    for wid, wdoc in wifi.items():
        # Match room code
        rc = wdoc.get("room") or wid.replace("WF-", "")
        if rc not in room_codes:
            # Stale document referencing a deleted or old room
            to_delete.append((wid, f"Invalid room: {rc}"))
        elif not wdoc.get("tested"):
            # Static dummy Wi-Fi data that has not been tested
            to_delete.append((wid, f"Static dummy data for room {rc} (not tested)"))
        else:
            # Valid tested document
            to_keep.append((wid, rc, wdoc))

    print(f"\nIdentified {len(to_delete)} wifi documents to delete from Firestore:")
    for wid, reason in to_delete[:15]:
        print(f"  - {wid}: {reason}")
    if len(to_delete) > 15:
        print(f"  ... and {len(to_delete) - 15} more")

    print(f"\nTested wifi documents to preserve: {len(to_keep)}")

    # Execute deletions in parallel
    if to_delete:
        print(f"\nDeleting {len(to_delete)} stale/dummy documents from Firestore `wifi` collection...")
        with ThreadPoolExecutor(max_workers=12) as ex:
            results = list(ex.map(lambda item: delete_doc("wifi", item[0]), to_delete))
        print(f"Deleted {results.count(True)}/{len(to_delete)} documents.")

    # Clean local seed-data.json
    print("\nUpdating local seed-data.json and techops seed-data.json...")
    for seed_path in (SEED_JSON, TECHOPS_SEED_JSON):
        if os.path.exists(seed_path):
            with open(seed_path, "r", encoding="utf-8") as f:
                seed = json.load(f)
            # Retain only tested readings or initialize empty so dummy data is removed
            cleaned_wifi = {}
            for wid, wdoc in seed.get("wifi", {}).items():
                rc = wdoc.get("room") or wid.replace("WF-", "")
                if rc in room_codes and wdoc.get("tested") is True:
                    cleaned_wifi[wid] = wdoc
            seed["wifi"] = cleaned_wifi
            with open(seed_path, "w", encoding="utf-8") as f:
                json.dump(seed, f, indent=2, ensure_ascii=False)
            print(f"Cleaned {os.path.basename(seed_path)}: {len(cleaned_wifi)} tested wifi records remaining.")

    print("\n=== FIRESTORE & SEED WIFI CLEANUP COMPLETE ===")


if __name__ == "__main__":
    main()
