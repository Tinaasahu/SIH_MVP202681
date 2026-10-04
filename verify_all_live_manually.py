import requests
import json

BASE = 'https://sih-mvp202681.onrender.com'

print("=" * 70)
print(f"MANUAL LIVE CLOUD AUDIT: {BASE}")
print("=" * 70)

checks = [
    ('1. Health', f'{BASE}/api/health'),
    ('2. Metadata', f'{BASE}/api/metadata'),
    ('3. Cities List (45 synoptic)', f'{BASE}/api/cities'),
    ('4. Hybrid Forecast (Kanpur)', f'{BASE}/api/forecast?city=Kanpur'),
    ('5. Multi-Model Forecast (Kanpur)', f'{BASE}/api/model_forecasts?city=Kanpur'),
    ('6. Model Dynamic Weights (Kanpur)', f'{BASE}/api/weights?city=Kanpur'),
    ('7. Confidence Score (Kanpur)', f'{BASE}/api/confidence?city=Kanpur'),
    ('8. Extreme Alerts', f'{BASE}/api/alerts'),
    ('9. RPI Multi-Hazard (Kanpur)', f'{BASE}/api/rpi?city=Kanpur'),
    ('10. RPI GeoJSON Map Data', f'{BASE}/api/rpi/map'),
    ('11. Model Skill Scores', f'{BASE}/api/skill'),
    ('12. AI Validation Performance', f'{BASE}/api/performance'),
    ('13. Contingency Verification', f'{BASE}/api/contingency'),
]

for name, url in checks:
    try:
        r = requests.get(url, timeout=12)
        status = r.status_code
        data = r.json()
        print(f"\n[HTTP {status}] {name}")
        if isinstance(data, list):
            print(f"   Items count: {len(data)}")
            if len(data) > 0:
                print(f"   Sample item: {json.dumps(data[0], indent=2)[:200]}...")
        elif isinstance(data, dict):
            keys = list(data.keys())
            print(f"   Keys: {keys[:6]}")
            if 'features' in data:
                print(f"   GeoJSON Features count: {len(data['features'])}")
            else:
                sample_preview = {k: data[k] for k in keys[:4]}
                print(f"   Sample data: {json.dumps(sample_preview, indent=2)[:200]}...")
    except Exception as e:
        print(f"\n[FAIL] {name}: {e}")

print("\n" + "=" * 70)
print("AUDIT COMPLETE")
print("=" * 70)
