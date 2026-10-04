import sys
import time
import json
import sqlite3
import os
from pathlib import Path
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def p(*args, **kwargs):
    print(*args, **kwargs, flush=True)

p("=" * 80)
p("           COMPLETE SYSTEM AUDIT & HEALTH VERIFICATION")
p("=" * 80)

CLOUD_URL = "https://sih-mvp202681.onrender.com"
VERCEL_URL = "https://sih-mvp-202681.vercel.app"
BASE_DIR = Path(__file__).resolve().parent

results = []

def record(category, test_name, passed, detail):
    status = "PASS" if passed else "FAIL"
    p(f"[{status:<4}] {category:<20} | {test_name:<35} | {detail}")
    results.append((category, test_name, passed, detail))

# ----------------------------------------------------------------------
# 1. LIVE CLOUD BACKEND (Render)
# ----------------------------------------------------------------------
p("\n1. LIVE CLOUD BACKEND (Render: https://sih-mvp202681.onrender.com)")
p("-" * 80)

cloud_endpoints = [
    ("/api/health", "System & AI Health", 200),
    ("/api/metadata", "Forecast Metadata", 200),
    ("/api/forecast?city=Kanpur&lead_days=1", "Forecast (Kanpur, Lead 1)", 200),
    ("/api/forecast?city=Delhi&lead_days=1", "Forecast (Delhi, Lead 1)", 200),
    ("/api/model_forecasts?city=Kanpur", "Multi-Model Raw NWP", 200),
    ("/api/weights?city=Kanpur", "Ensemble Dynamic Weights", 200),
    ("/api/skill", "Model Skill Scores", 200),
    ("/api/performance", "AI Performance Metrics", 200),
    ("/api/alerts", "Hazard Alerts", 200),
    ("/api/cities", "45 Synoptic Stations List", 200),
    ("/api/confidence?city=Kanpur", "AI Confidence Score", 200),
    ("/api/rpi?city=Kanpur", "Decoupled RPI Multi-Hazard", 200),
    ("/api/rpi/map", "RPI GeoJSON Map Data", 200),
]

for path, name, exp_status in cloud_endpoints:
    t0 = time.time()
    try:
        r = requests.get(CLOUD_URL + path, timeout=15)
        lat = (time.time() - t0) * 1000
        passed = (r.status_code == exp_status)
        detail = f"{lat:5.0f}ms (HTTP {r.status_code})"

        # Content validation
        if passed:
            data = r.json()
            if path == "/api/health":
                rf_ok = data.get("rf_correction_active") is True
                rf_count = len(data.get("rf_models", []))
                passed = passed and rf_ok
                detail += f" | RF Active: {rf_ok}, Models: {rf_count}"
            elif path == "/api/cities":
                c_count = len(data) if isinstance(data, list) else len(data.get("cities", []))
                passed = passed and (c_count == 45)
                detail += f" | Stations: {c_count}/45"
            elif path.startswith("/api/rpi?city=Kanpur"):
                rpi_score = data.get("rpi")
                tier = data.get("tierLevel")
                conf = data.get("confidence")
                detail += f" | RPI: {rpi_score}, Tier: {tier}, Conf: {conf}%"
            elif path == "/api/rpi/map":
                feats = len(data.get("features", []))
                passed = passed and (feats == 45)
                detail += f" | GeoJSON Features: {feats}/45"

        record("Cloud API", name, passed, detail)
    except Exception as e:
        record("Cloud API", name, False, f"Error: {e}")

# ----------------------------------------------------------------------
# 2. LIVE FRONTEND (Vercel)
# ----------------------------------------------------------------------
p("\n2. LIVE FRONTEND DEPLOYMENT (Vercel: https://sih-mvp-202681.vercel.app)")
p("-" * 80)
try:
    t0 = time.time()
    res = requests.get(VERCEL_URL, timeout=15)
    lat = (time.time() - t0) * 1000
    has_html = "<!DOCTYPE html>" in res.text or "<html" in res.text
    record("Frontend", "Vercel Web App", res.status_code == 200 and has_html, f"{lat:5.0f}ms (HTTP {res.status_code})")
except Exception as e:
    record("Frontend", "Vercel Web App", False, f"Error: {e}")

# ----------------------------------------------------------------------
# 3. LOCAL DATABASE & ARTIFACTS INTEGRITY
# ----------------------------------------------------------------------
p("\n3. LOCAL DATA & DATABASE INTEGRITY")
p("-" * 80)

db_path = BASE_DIR / "database" / "weather.db"
if db_path.exists():
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [r[0] for r in cur.fetchall()]
        passed_db = len(tables) >= 4
        record("Database", "weather.db Tables", passed_db, f"Tables: {', '.join(tables)}")
        for tbl in ["forecast_history", "actual_history", "forecast_current"]:
            if tbl in tables:
                cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                cnt = cur.fetchone()[0]
                record("Database", f"Table: {tbl}", cnt > 0, f"Rows: {cnt:,}")
        conn.close()
    except Exception as e:
        record("Database", "weather.db", False, f"DB Error: {e}")
else:
    record("Database", "weather.db", False, "database/weather.db file missing")

# Check outputs/
outputs_dir = BASE_DIR / "outputs"
required_outputs = [
    "hybrid_forecast.csv",
    "blended_forecast.csv",
    "metadata.json",
    "model_weights_lead.csv",
    "confidence_scores.csv",
    "extreme_alerts.csv",
    "models/rf_temperature.joblib",
    "models/rf_rainfall.joblib",
    "models/rf_wind_speed.joblib"
]

for out_file in required_outputs:
    fp = outputs_dir / out_file
    exists = fp.exists() and fp.stat().st_size > 0
    size_str = f"{fp.stat().st_size:,} bytes" if fp.exists() else "Missing"
    record("Outputs Data", out_file, exists, size_str)

# ----------------------------------------------------------------------
# 4. FINAL VERIFICATION SUMMARY
# ----------------------------------------------------------------------
p("\n" + "=" * 80)
total_tests = len(results)
passed_tests = sum(1 for r in results if r[2])
p(f"AUDIT SUMMARY: {passed_tests}/{total_tests} Tests Passed ({(passed_tests/total_tests)*100:.1f}%)")
if passed_tests == total_tests:
    p("ALL SYSTEMS (CLOUD BACKEND, FRONTEND, MODELS, DATABASE) ARE FULLY OPERATIONAL!")
else:
    p("SOME TESTS REPORTED ISSUES - REVIEW DETAILS ABOVE.")
p("=" * 80)
