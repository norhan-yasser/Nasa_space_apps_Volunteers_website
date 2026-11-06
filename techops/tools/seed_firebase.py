"""
Upload the unified TechOps seed data to Firestore (admin SDK, bypasses the security rules).

Usage (from the techops folder):
    pip install firebase-admin
    python tools/seed_firebase.py --key path/to/serviceAccount.json
    python tools/seed_firebase.py --key key.json --volunteers volunteers.real.json   # real roster
    python tools/seed_firebase.py --dry-run                                           # just validate

Get the key: Firebase console -> Project settings -> Service accounts -> Generate new private key.
NEVER commit the key or your real roster (both are in .gitignore).

`volunteers.real.json` format - one object keyed by Volunteer Code:
    { "TO-101": { "Name": "Sara Ali", "Volunteer Code": "TO-101", "Team": "TechOps" },
      "LG-201": { "Name": "Omar H.",  "Volunteer Code": "LG-201", "Team": "Logistics" } }
`Team` must be exactly "TechOps" or "Logistics". Codes: letters, digits, "-" or "_" (stored upper-case).
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEAMS = {"TechOps", "Logistics"}


def load_volunteers(path):
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    items = raw.values() if isinstance(raw, dict) else raw
    out = {}
    for v in items:
        code = re.sub(r"\s+", "", str(v.get("Volunteer Code", ""))).upper()
        name, team = str(v.get("Name", "")).strip(), str(v.get("Team", "")).strip()
        if not re.fullmatch(r"[A-Z0-9_-]{2,40}", code) or not name or team not in TEAMS:
            sys.exit(f"Invalid volunteer record: {v!r} (need Name, Volunteer Code, Team = TechOps | Logistics)")
        out[code] = {"Name": name, "Volunteer Code": code, "Team": team}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", help="service account JSON")
    ap.add_argument("--volunteers", help="real roster JSON (replaces the dummy volunteers)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep-existing-reports", action="store_true", help="do not overwrite reports/meetups already in Firestore")
    args = ap.parse_args()

    with open(os.path.join(ROOT, "firebase", "seed-data.json"), encoding="utf-8") as f:
        data = json.load(f)
    if args.volunteers:
        data["volunteers"] = load_volunteers(args.volunteers)

    for col, docs in data.items():
        print(f"{col:11s} {len(docs):4d} documents")
    if args.dry_run:
        print("Dry run only - nothing uploaded.")
        return
    if not args.key:
        sys.exit("--key is required (or use --dry-run)")

    import firebase_admin
    from firebase_admin import credentials, firestore

    firebase_admin.initialize_app(credentials.Certificate(args.key))
    db = firestore.client()
    for col, docs in data.items():
        if args.keep_existing_reports and col in ("reports", "meetups"):
            print(f"skipping {col} (--keep-existing-reports)")
            continue
        batch, n = db.batch(), 0
        for doc_id, body in docs.items():
            batch.set(db.collection(col).document(doc_id), body)
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()
        print(f"uploaded {col}")
    print("Done.")


if __name__ == "__main__":
    main()
