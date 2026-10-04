import sys
import time
import requests
from app import app

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

client = app.test_client()

print("=" * 60)
print("1. LOCAL BACKEND VERIFICATION (Flask test_client)")
print("=" * 60)

local_endpoints = [
    ('/api/health', 'Health & RF Model Checks'),
    ('/api/forecast?city=Kanpur&lead_days=1', 'Weather Forecast API (Kanpur)'),
    ('/api/rpi?city=Kanpur', 'Decoupled RPI Multi-Hazard API'),
    ('/api/rpi/map', 'RPI GeoJSON Map Data'),
    ('/api/metadata', 'Metadata & Synoptic Info'),
    ('/api/skill', 'Model Ensemble Skill Scores'),
    ('/api/cities', '45 Synoptic Stations List'),
    ('/api/alerts', 'Active Weather Alerts'),
]

for ep, desc in local_endpoints:
    t0 = time.time()
    res = client.get(ep)
    latency = (time.time() - t0) * 1000
    if res.status_code == 200:
        print(f"[PASS 200 OK] {desc:<35} | Latency: {latency:5.1f}ms")
        if ep == '/api/rpi?city=Kanpur':
            data = res.get_json()
            print(f"   -> RPI Score: {data.get('rpi')}")
            print(f"   -> Tier Level: {data.get('tierLevel')}")
            print(f"   -> Action Tier: {data.get('actionTier')}")
            print(f"   -> Confidence: {data.get('confidence')}%")
            print(f"   -> Confidence Badge: {data.get('confidenceBadge')}")
    else:
        print(f"[ERROR {res.status_code}] {desc:<35}")

print("\n" + "=" * 60)
print("2. LIVE CLOUD BACKEND VERIFICATION (Render Cloud)")
print("=" * 60)

BASE_URL = 'https://sih-mvp202681.onrender.com'
live_endpoints = [
    ('/api/health', 'Render Health Status'),
    ('/api/forecast?city=Kanpur&lead_days=1', 'Render Live Forecast API'),
    ('/api/rpi?city=Kanpur', 'Render RPI Multi-Hazard API'),
    ('/api/rpi/map', 'Render RPI GeoJSON API'),
    ('/api/metadata', 'Render Metadata API'),
    ('/api/skill', 'Render Skill Scores API'),
]

for ep, desc in live_endpoints:
    t0 = time.time()
    try:
        r = requests.get(BASE_URL + ep, timeout=12)
        latency = (time.time() - t0) * 1000
        if r.status_code == 200:
            print(f"[PASS 200 OK] {desc:<35} | Latency: {latency:5.1f}ms")
        else:
            print(f"[STATUS {r.status_code}] {desc:<35} | Latency: {latency:5.1f}ms")
    except Exception as e:
        print(f"[FAIL] {desc:<35} | Error: {e}")

print("=" * 60)
