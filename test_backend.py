import sys
import time
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'https://sih-mvp202681.onrender.com'
endpoints = [
    ('/api/health', 'Health & AI Engine Status'),
    ('/api/forecast?city=Kanpur&lead_days=1', 'Weather Forecast API (Kanpur)'),
    ('/api/rpi?city=Kanpur', 'RPI Multi-Hazard Priority API'),
    ('/api/rpi/map', 'RPI GeoJSON Map Data'),
    ('/api/metadata', 'Metadata & Last Updated'),
    ('/api/models/skill', 'Model Ensemble Skill Scores'),
]

print(f"=== Testing Live Backend at {BASE_URL} ===\n")

all_ok = True
for ep, desc in endpoints:
    url = BASE_URL + ep
    t0 = time.time()
    try:
        r = requests.get(url, timeout=15)
        latency = (time.time() - t0) * 1000
        status = r.status_code
        if status == 200:
            print(f"[PASS 200 OK] {desc:<35} | Latency: {latency:6.1f}ms")
            if ep == '/api/rpi?city=Kanpur':
                data = r.json()
                print(f"   -> RPI: {data.get('rpi')}, HazardRaw: {data.get('hazard_raw')}, Tier: {data.get('tierLevel')}, ActionTier: {data.get('actionTier')}")
            elif ep == '/api/health':
                data = r.json()
                print(f"   -> Service: {data.get('service')}, RF Models: {len(data.get('rf_models', []))}, Status: {data.get('status')}")
        else:
            all_ok = False
            print(f"[ERROR {status}] {desc:<35} | Latency: {latency:6.1f}ms")
    except Exception as e:
        all_ok = False
        print(f"[FAIL] {desc:<35} | Error: {e}")

print('\n' + ('='*50))
if all_ok:
    print('ALL LIVE BACKEND ENDPOINTS ARE FULLY OPERATIONAL!')
else:
    print('SOME ENDPOINTS ENCOUNTERED ISSUES!')
print('='*50)
