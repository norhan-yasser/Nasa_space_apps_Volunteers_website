import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT_ID = "space-apps-cairo-volunteer"
DATABASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

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

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    seed_file = os.path.join(script_dir, "Website Repo", "Nasa_space_apps_Volunteers_website", "techops", "firebase", "seed-data.json")
    if not os.path.exists(seed_file):
        seed_file = os.path.join(script_dir, "techops", "firebase", "seed-data.json")
    
    with open(seed_file, "r", encoding="utf-8") as f:
        all_data = json.load(f)

    tasks = []
    for col, docs in all_data.items():
        if isinstance(docs, dict):
            for doc_id, doc_data in docs.items():
                tasks.append((col, doc_id, doc_data))

    total = len(tasks)
    print(f"Uploading {total} documents to Firestore project: {PROJECT_ID}...")

    success_count = 0
    errors = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(upload_doc, col, doc_id, doc_data) for col, doc_id, doc_data in tasks]
        for f in as_completed(futures):
            ok, col, doc_id, err = f.result()
            if ok:
                success_count += 1
            else:
                errors.append(f"{col}/{doc_id}: {err}")
    
    print(f"Finished! Successfully uploaded: {success_count}/{total} documents.")
    if errors:
        print(f"Errors ({len(errors)}):")
        for err in errors[:10]:
            print("  ", err)

if __name__ == "__main__":
    main()
