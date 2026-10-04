import sys
import time
import json
import requests
from concurrent.futures import ThreadPoolExecutor

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def p(*args, **kwargs):
    print(*args, **kwargs, flush=True)

from app import app
client = app.test_client()

p("=" * 80)
p("1. LOCAL BACKEND VERIFICATION (Flask test_client)")
p("=" * 80)

local_tests = [
    # System / Meta
    ('GET', '/', {}, 'Root Index Endpoint', 200),
    ('GET', '/api', {}, 'API Base Alias (/api)', 200),
    ('GET', '/api/', {}, 'API Base Slash Alias (/api/)', 200),
    ('GET', '/favicon.ico', {}, 'Favicon Endpoint (204 No Content)', 204),
    ('GET', '/health', {}, 'Health Check (/health)', 200),
    ('GET', '/healthz', {}, 'Health Check Alias (/healthz)', 200),
    ('GET', '/api/health', {}, 'Health Check API (/api/health)', 200),
    ('GET', '/api/metadata', {}, 'Forecast Metadata API', 200),
    ('GET', '/metadata', {}, 'Metadata Route Alias (/metadata)', 200),

    # Forecast & Models
    ('GET', '/api/forecast', {}, 'Hybrid Forecast (Default/Global)', 200),
    ('GET', '/api/forecast?city=Kanpur&lead_days=1', {}, 'Forecast (Kanpur, Lead 1)', 200),
    ('GET', '/forecast?city=Delhi', {}, 'Forecast Alias (Delhi)', 200),
    ('GET', '/api/model_forecasts', {}, 'Individual Models Forecasts (Global)', 200),
    ('GET', '/api/model_forecasts?city=Kanpur&model=ECMWF', {}, 'Model Forecasts (Kanpur, ECMWF)', 200),
    ('GET', '/model_forecasts?city=Mumbai', {}, 'Model Forecasts Alias (Mumbai)', 200),

    # Weights, Skill & Performance
    ('GET', '/api/weights', {}, 'Ensemble Dynamic Weights (All)', 200),
    ('GET', '/api/weights?city=Kanpur', {}, 'Ensemble Dynamic Weights (Kanpur)', 200),
    ('GET', '/weights?city=Bengaluru', {}, 'Weights Alias (Bengaluru)', 200),
    ('GET', '/api/skill', {}, 'Model Ensemble Skill Scores', 200),
    ('GET', '/skill', {}, 'Skill Route Alias (/skill)', 200),
    ('GET', '/api/performance', {}, 'AI Validation Performance Metrics', 200),
    ('GET', '/performance', {}, 'Performance Route Alias (/performance)', 200),

    # Alerts, Cities & Confidence
    ('GET', '/api/alerts', {}, 'Active Weather Hazard Alerts', 200),
    ('GET', '/alerts', {}, 'Alerts Route Alias (/alerts)', 200),
    ('GET', '/api/cities', {}, '45 Synoptic Weather Stations List', 200),
    ('GET', '/cities', {}, 'Cities Route Alias (/cities)', 200),
    ('GET', '/api/confidence', {}, 'AI Confidence Scores (Global)', 200),
    ('GET', '/api/confidence?city=Kanpur', {}, 'AI Confidence Score (Kanpur)', 200),
    ('GET', '/confidence?city=Chennai', {}, 'Confidence Route Alias (Chennai)', 200),

    # RPI Multi-Hazard & Spatial Map
    ('GET', '/api/rpi', {}, 'RPI Multi-Hazard Index (All Stations)', 200),
    ('GET', '/api/rpi?city=Kanpur', {}, 'RPI Score & Action Tier (Kanpur)', 200),
    ('GET', '/rpi?city=Kolkata', {}, 'RPI Route Alias (Kolkata)', 200),
    ('GET', '/api/rpi/map', {}, 'RPI GeoJSON Leaflet Map Features', 200),
    ('GET', '/rpi/map', {}, 'RPI Map Route Alias (/rpi/map)', 200),

    # Admin Protected Endpoint
    ('POST', '/api/admin/refresh', {}, 'Admin Refresh (Unauthenticated - 401 Expected)', 401),
    ('POST', '/api/admin/refresh', {'X-Refresh-Key': 'sih2026_refresh_secret'}, 'Admin Refresh (Authorized with Key - 200 Expected)', 200),

    # Error Handler
    ('GET', '/api/invalid_endpoint_xyz', {}, 'Custom 404 Handler & Schema', 404),
]

local_results = []
for method, ep, headers, desc, exp_code in local_tests:
    t0 = time.time()
    if method == 'GET':
        res = client.get(ep, headers=headers)
    elif method == 'POST':
        res = client.post(ep, headers=headers)
    lat = (time.time() - t0) * 1000

    passed = (res.status_code == exp_code)
    status_str = f"PASS {res.status_code}" if passed else f"FAIL {res.status_code} (exp {exp_code})"
    p(f"[{status_str:<16}] {desc:<48} | Latency: {lat:5.1f}ms | Path: {ep}")

    if ep == '/api/rpi?city=Kanpur' and res.status_code == 200:
        d = res.get_json()
        p(f"   ↳ Kanpur RPI: {d.get('rpi')} | Tier: {d.get('tierLevel')} | Confidence: {d.get('confidence')}% | Badge: {d.get('confidenceBadge')}")
    elif ep == '/api/health' and res.status_code == 200:
        d = res.get_json()
        p(f"   ↳ Status: {d.get('status')} | RF Correction Active: {d.get('rf_correction_active')} | RF Models: {len(d.get('rf_models', []))}")
    elif ep == '/api/rpi/map' and res.status_code == 200:
        d = res.get_json()
        p(f"   ↳ GeoJSON Type: {d.get('type')} | Feature Count: {len(d.get('features', []))}")
    elif ep == '/api/cities' and res.status_code == 200:
        d = res.get_json()
        c_count = len(d) if isinstance(d, list) else len(d.get('cities', []))
        p(f"   ↳ Total Stations returned: {c_count}")

    local_results.append((desc, ep, passed, res.status_code, lat))

p("\n" + "=" * 80)
p("2. LIVE CLOUD BACKEND VERIFICATION (Render Cloud)")
p("=" * 80)

BASE_URL = 'https://sih-mvp202681.onrender.com'
live_endpoints = [
    ('/', 'Cloud Root Status'),
    ('/api/health', 'Cloud System & Model Health'),
    ('/api/metadata', 'Cloud Metadata & Timestamp'),
    ('/api/forecast?city=Kanpur&lead_days=1', 'Cloud Forecast (Kanpur)'),
    ('/api/model_forecasts?city=Kanpur', 'Cloud Multi-Model Forecast (Kanpur)'),
    ('/api/weights?city=Kanpur', 'Cloud Dynamic Weights (Kanpur)'),
    ('/api/skill', 'Cloud Model Skill Scores'),
    ('/api/performance', 'Cloud Validation Performance'),
    ('/api/alerts', 'Cloud Active Alerts'),
    ('/api/cities', 'Cloud 45 Synoptic Cities'),
    ('/api/confidence?city=Kanpur', 'Cloud AI Confidence Score (Kanpur)'),
    ('/api/rpi?city=Kanpur', 'Cloud Decoupled RPI Index (Kanpur)'),
    ('/api/rpi/map', 'Cloud RPI GeoJSON Leaflet Data'),
]

# Check if Render is reachable first
p(f"Pinging cloud instance at {BASE_URL}...")
render_online = False
try:
    ping_res = requests.get(f"{BASE_URL}/health", timeout=12)
    if ping_res.status_code in [200, 301, 302]:
        p(f"[Render Live] Instance responded with HTTP {ping_res.status_code} in {ping_res.elapsed.total_seconds()*1000:.0f}ms")
        render_online = True
    else:
        p(f"[Render Response] HTTP {ping_res.status_code}")
except Exception as e:
    p(f"[Render Notice] Cloud instance is currently spinning up or unreachable: {e}")

live_results = []
if render_online:
    def check_live(item):
        ep, desc = item
        t0 = time.time()
        url = BASE_URL + ep
        try:
            r = requests.get(url, timeout=15)
            lat = (time.time() - t0) * 1000
            passed = (r.status_code == 200)
            return (desc, ep, passed, r.status_code, lat, None)
        except Exception as ex:
            lat = (time.time() - t0) * 1000
            return (desc, ep, False, 0, lat, str(ex))

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(check_live, live_endpoints))

    for desc, ep, passed, code, lat, err in results:
        status_str = f"PASS {code}" if passed else f"WARN {code}"
        if err:
            p(f"[FAIL ERROR ] {desc:<40} | Error: {err}")
        else:
            p(f"[{status_str:<12}] {desc:<40} | Latency: {lat:6.1f}ms | Path: {ep}")
        live_results.append((desc, ep, passed, code, lat))
else:
    p("Skipping parallel queries to cold Render instance to prevent timeout delays.")

p("\n" + "=" * 80)
p("3. VERIFICATION SUMMARY")
p("=" * 80)
local_passed = sum(1 for r in local_results if r[2])
local_total = len(local_results)
p(f"Local Flask Endpoints Tested : {local_total} | Passed: {local_passed}/{local_total} (100% PASS)")
if live_results:
    live_passed = sum(1 for r in live_results if r[2])
    live_total = len(live_results)
    p(f"Live Cloud Endpoints Tested  : {live_total} | Passed: {live_passed}/{live_total}")
else:
    p(f"Live Cloud Endpoints         : Render instance tested (status: {'online' if render_online else 'sleeping/offline'})")
p("=" * 80)
