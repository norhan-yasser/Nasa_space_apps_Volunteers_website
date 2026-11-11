"""
One-time migration of the LIVE Firestore data to the new wing-based room codes.

The updated floor plans label rooms by WING instead of by room type:
    A = lower-right wing, B = upper-right, C = upper-left, D = lower-left
    e.g.  S034 -> C034,  H113 -> A113,  C017 -> B017,  C154 -> D154,  B135 -> C135

Unlike re-running seed_firebase.py (which overwrites every document with the dummy seed data), this script
MOVES what is already in Firestore: room assignments (person responsible, capacity, challenge, teams, ...)
are copied to the new document id, and every `room` reference in reports / team / meetups / inventory / wifi
is rewritten. Nothing is lost, and running it twice is harmless.

Usage (from the project folder):
    pip install firebase-admin
    python tools/migrate_room_codes.py --key path/to/serviceAccount.json --dry-run    # show what would change
    python tools/migrate_room_codes.py --key path/to/serviceAccount.json              # do it

Get the key: Firebase console -> Project settings -> Service accounts -> Generate new private key.
NEVER commit the key (keep it outside the repository).
"""
import argparse
import re
import sys

PAT = re.compile(r"(?<![A-Za-z0-9#])([SCBH])(\d{3})(?![A-Za-z0-9])")


def new_letter(n):
    if n in (15, 16, 17) or 122 <= n <= 131 or 224 <= n <= 231:
        return "B"
    if n in (26, 27, 34, 35) or 132 <= n <= 141 or 233 <= n <= 242:
        return "C"
    if 113 <= n <= 114 or 209 <= n <= 210:
        return "A"
    if 152 <= n <= 154 or 252 <= n <= 265:
        return "D"
    return None


def convert(text):
    """Replace every old room code inside a string (also inside ids like WF-S034)."""
    def sub(m):
        letter = new_letter(int(m.group(2)))
        return letter + m.group(2) if letter else m.group(0)
    return PAT.sub(sub, text)


def convert_value(v):
    if isinstance(v, str):
        return convert(v)
    if isinstance(v, list):
        return [convert_value(x) for x in v]
    if isinstance(v, dict):
        return {k: convert_value(x) for k, x in v.items()}
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", help="service account JSON")
    ap.add_argument("--dry-run", action="store_true", help="only print what would change")
    args = ap.parse_args()
    if not args.key and not args.dry_run:
        sys.exit("--key is required (or use --dry-run with --key to preview against the real database)")
    if not args.key:
        sys.exit("--dry-run still needs --key because it reads the live database")

    import firebase_admin
    from firebase_admin import credentials, firestore

    firebase_admin.initialize_app(credentials.Certificate(args.key))
    db = firestore.client()
    moved = rewritten = 0

    # 1) collections whose DOCUMENT ID is a room code (rooms) or contains one (wifi: WF-S034)
    for col in ("rooms", "wifi"):
        for snap in list(db.collection(col).stream()):
            new_id = convert(snap.id)
            data = convert_value(snap.to_dict() or {})
            if new_id == snap.id:
                if data != (snap.to_dict() or {}):
                    print(f"[{col}] rewrite fields of {snap.id}")
                    rewritten += 1
                    if not args.dry_run:
                        snap.reference.set(data)
                continue
            if col == "rooms":
                data["code"] = new_id
            if col == "wifi":
                data["id"] = new_id
            target = db.collection(col).document(new_id)
            exists = target.get().exists
            print(f"[{col}] {snap.id} -> {new_id}" + ("  (target already exists: kept, old one removed)" if exists else ""))
            moved += 1
            if not args.dry_run:
                if not exists:
                    target.set(data)
                snap.reference.delete()

    # 2) collections that only REFERENCE rooms in their fields
    for col in ("reports", "team", "meetups", "inventory"):
        for snap in list(db.collection(col).stream()):
            old = snap.to_dict() or {}
            new = convert_value(old)
            if new != old:
                print(f"[{col}] {snap.id}: " + ", ".join(f"{k}: {old[k]!r} -> {new[k]!r}" for k in new if new[k] != old.get(k)))
                rewritten += 1
                if not args.dry_run:
                    snap.reference.update({k: new[k] for k in new if new[k] != old.get(k)})

    print(f"\n{'DRY RUN - nothing changed. ' if args.dry_run else ''}Moved {moved} documents, rewrote {rewritten}.")


if __name__ == "__main__":
    main()
