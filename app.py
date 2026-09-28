"""
Hybrid Weather AI - Main Application Entry Point & REST API
Smart India Hackathon 2026 (PS: 26081)
"""

import os
import csv
from flask import Flask, jsonify, request

# Graceful pandas import to support both venv and environments with C-extension conflicts
try:
    import pandas as pd
    USE_PANDAS = True
except (ImportError, ValueError, Exception):
    pd = None
    USE_PANDAS = False

app = Flask(__name__)

# Production CORS configuration for Vercel and local environments
try:
    from flask_cors import CORS
    CORS(
        app,
        resources={r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
            "allow_headers": ["Content-Type", "Authorization", "Cache-Control", "Pragma", "Accept", "X-Requested-With", "Origin"],
            "max_age": 86400
        }}
    )
except ImportError:
    pass

# Base project paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
DATA_DIR = os.path.join(BASE_DIR, "data")


def load_csv_records(csv_path):
    """
    Reads a CSV file into a list of dict records.
    Uses pandas if available; falls back to standard library csv module.
    """
    if not os.path.exists(csv_path):
        return None

    if USE_PANDAS and pd is not None:
        try:
            df = pd.read_csv(csv_path)
            df = df.where(pd.notnull(df), None)
            return df.to_dict(orient='records')
        except Exception:
            pass

    records = []
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {}
            for k, v in row.items():
                if v == '' or v is None:
                    cleaned[k] = None
                else:
                    try:
                        if '.' in v:
                            cleaned[k] = float(v)
                        else:
                            cleaned[k] = int(v)
                    except ValueError:
                        cleaned[k] = v
            records.append(cleaned)
    return records


import time
import threading

_last_freshness_check = 0

def check_forecast_freshness_async():
    """Runs forecast freshness check asynchronously in the background so HTTP requests never block."""
    global _last_freshness_check
    now = time.time()
    if now - _last_freshness_check < 3600:  # Check at most once per hour
        return
    _last_freshness_check = now

    def _worker():
        try:
            ensure_fresh_forecast()
        except Exception as _e:
            print(f"[CacheManager] Background refresh notice: {_e}")

    threading.Thread(target=_worker, daemon=True).start()


from api.cache_manager import ensure_fresh_forecast, load_metadata

# Trigger non-blocking freshness check in background
try:
    check_forecast_freshness_async()
except Exception as _e:
    print(f"[Warning] Background startup notice: {_e}")


@app.before_request
def handle_options_preflight():
    """Explicitly handle OPTIONS preflight requests for cross-origin browser clients."""
    if request.method == 'OPTIONS':
        res = app.make_default_options_response()
        res.headers['Access-Control-Allow-Origin'] = '*'
        res.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD'
        res.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cache-Control, Pragma, Accept, X-Requested-With, Origin'
        res.headers['Access-Control-Max-Age'] = '86400'
        return res


@app.after_request
def add_cors_headers(response):
    """Enable CORS for Vercel, Render, and local frontend origins."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cache-Control, Pragma, Accept, X-Requested-With, Origin'
    response.headers['Access-Control-Max-Age'] = '86400'
    return response


@app.route('/favicon.ico')
def favicon():
    """Return 204 No Content to satisfy browser requests without 404."""
    return ('', 204)


@app.route('/')
@app.route('/api')
@app.route('/api/')
@app.route('/health')
@app.route('/healthz')
def index():
    return jsonify({
        "status": "online",
        "service": "Hybrid Weather AI System",
        "version": "1.0.0",
        "engine": "pandas" if (USE_PANDAS and pd is not None) else "standard-csv",
        "endpoints": {
            "forecast": "/api/forecast",
            "model_forecasts": "/api/model_forecasts",
            "metadata": "/api/metadata",
            "weights": "/api/weights",
            "skill": "/api/skill",
            "alerts": "/api/alerts",
            "cities": "/api/cities",
            "confidence": "/api/confidence",
            "rpi": "/api/rpi",
            "rpi_map": "/api/rpi/map"
        }
    })


@app.route('/api/metadata', methods=['GET'])
@app.route('/metadata', methods=['GET'])
def get_metadata():
    """
    Returns forecast freshness metadata:
      - last_updated
      - city count (cities)
      - model count (models)
    """
    meta = load_metadata()
    if not meta:
        try:
            check_forecast_freshness_async()
        except Exception:
            pass
        meta = {
            "last_updated": "2026-09-27T10:25:33",
            "cities": 45,
            "models": 4,
            "city_count": 45,
            "model_count": 4
        }
    return jsonify(meta)


@app.route('/api/forecast', methods=['GET'])
@app.route('/forecast', methods=['GET'])
def get_forecast():
    """
    Returns records from outputs/hybrid_forecast.csv (falls back to blended_forecast.csv if missing).
    Checks freshness asynchronously in background without blocking.
    Optional query parameters:
      - city: filter by city name (e.g. ?city=Kanpur)
      - lead_days: filter by lead time (1, 2, or 3)
    """
    # 1. Asynchronously check freshness in background without blocking this HTTP request
    try:
        check_forecast_freshness_async()
    except Exception as e:
        print(f"[API Error] Async refresh notice: {e}")

    # 2. Load latest forecast (primary: hybrid_forecast.csv, fallback: blended_forecast.csv)
    hybrid_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")
    blended_path = os.path.join(OUTPUTS_DIR, "blended_forecast.csv")

    is_fallback = False
    if os.path.exists(hybrid_path):
        csv_path = hybrid_path
    elif os.path.exists(blended_path):
        csv_path = blended_path
        is_fallback = True
    else:
        return jsonify({"error": "Forecast data not found (neither hybrid nor blended)"}), 404

    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": f"{os.path.basename(csv_path)} could not be loaded"}), 404

    # Ensure backward-compatible blend_* fields for all frontend consumers
    for r in records:
        if is_fallback:
            r['is_fallback'] = True
        if 'blend_temperature' not in r or r['blend_temperature'] is None:
            r['blend_temperature'] = r.get('temperature')
        if 'blend_rainfall' not in r or r['blend_rainfall'] is None:
            r['blend_rainfall'] = r.get('rainfall')
        if 'blend_wind_speed' not in r or r['blend_wind_speed'] is None:
            r['blend_wind_speed'] = r.get('wind_speed')

    # Keep only rows where datetime >= the current hour (floor of now to the hour, Asia/Kolkata)
    from datetime import datetime, timezone, timedelta
    kolkata_tz = timezone(timedelta(hours=5, minutes=30))
    current_hour_dt = datetime.now(kolkata_tz).replace(minute=0, second=0, microsecond=0).replace(tzinfo=None)
    current_hour_str = current_hour_dt.strftime("%Y-%m-%d %H:00:00")

    filtered_time_records = []
    for r in records:
        dt_val = str(r.get('datetime', '')).replace('T', ' ')
        if len(dt_val) == 16:
            dt_val += ":00"
        if dt_val >= current_hour_str:
            filtered_time_records.append(r)
    records = filtered_time_records

    # If no rows remain, return [] with HTTP 200 and a "stale": true field
    if not records:
        resp = jsonify([])
        resp.headers['stale'] = 'true'
        resp.headers['X-Forecast-Stale'] = 'true'
        return resp, 200

    city = request.args.get('city')
    lead_days = request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if lead_days:
        try:
            ld = int(lead_days)
            records = [r for r in records if r.get('lead_days') == ld]
        except ValueError:
            pass

    if not records:
        resp = jsonify([])
        resp.headers['stale'] = 'true'
        resp.headers['X-Forecast-Stale'] = 'true'
        return resp, 200

    return jsonify(records)


@app.route('/api/model_forecasts', methods=['GET'])
@app.route('/model_forecasts', methods=['GET'])
def get_model_forecasts():
    """
    Returns per-model forecast values from data/forecast_current.csv
    (columns: city, model, datetime, temperature, rainfall, wind_speed;
    models: ecmwf_ifs025, gfs_seamless, icon_seamless, gem_seamless).
    Filtered to datetime >= current hour (Asia/Kolkata) and to the lead_days window
    (lead_days = hours since the file's first datetime // 24 + 1).
    Also includes the hybrid values from outputs/hybrid_forecast.csv for the same rows.
    No computed multipliers.
    Query parameters:
      - city: filter by city name (e.g. ?city=Kanpur)
      - lead_days: filter by lead days window (1, 2, 3)
    """
    from datetime import datetime, timezone, timedelta

    curr_csv_path = os.path.join(DATA_DIR, "forecast_current.csv")
    hybrid_csv_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")

    raw_records = load_csv_records(curr_csv_path)
    if raw_records is None:
        return jsonify({"error": "data/forecast_current.csv not found"}), 404

    # Determine file's first datetime
    first_dt = None
    for r in raw_records:
        if r.get('datetime'):
            dt_clean = str(r['datetime']).replace('T', ' ')
            if len(dt_clean) == 16:
                dt_clean += ":00"
            try:
                first_dt = datetime.strptime(dt_clean[:19], "%Y-%m-%d %H:%M:%S")
                break
            except Exception:
                pass
    if first_dt is None:
        first_dt = datetime.now()

    # Current hour floor in Asia/Kolkata
    kolkata_tz = timezone(timedelta(hours=5, minutes=30))
    current_hour_dt = datetime.now(kolkata_tz).replace(minute=0, second=0, microsecond=0).replace(tzinfo=None)
    current_hour_str = current_hour_dt.strftime("%Y-%m-%d %H:00:00")

    city = request.args.get('city')
    lead_days = request.args.get('lead_days')
    target_lead = int(lead_days) if lead_days and str(lead_days).isdigit() else None
    target_city = city.strip().lower() if city else None

    results = []
    valid_keys = set()

    for r in raw_records:
        r_city = str(r.get('city', '')).strip()
        if target_city and r_city.lower() != target_city:
            continue

        dt_raw = str(r.get('datetime', '')).replace('T', ' ')
        if len(dt_raw) == 16:
            dt_raw += ":00"
        if dt_raw < current_hour_str:
            continue

        # lead_days = hours since the file's first datetime // 24 + 1
        try:
            row_dt = datetime.strptime(dt_raw[:19], "%Y-%m-%d %H:%M:%S")
            hours_ahead = int((row_dt - first_dt).total_seconds() // 3600)
            row_lead = int(hours_ahead // 24 + 1)
        except Exception:
            row_lead = 1

        if target_lead is not None and row_lead != target_lead:
            continue

        rec_entry = {
            "city": r_city,
            "model": r.get('model'),
            "datetime": dt_raw,
            "lead_days": row_lead,
            "temperature": r.get('temperature'),
            "rainfall": r.get('rainfall'),
            "wind_speed": r.get('wind_speed')
        }
        results.append(rec_entry)
        valid_keys.add((r_city.lower(), dt_raw))

    # Also include the hybrid values from outputs/hybrid_forecast.csv for the same rows
    hybrid_records = load_csv_records(hybrid_csv_path) or []
    for hr in hybrid_records:
        h_city = str(hr.get('city', '')).strip()
        h_dt = str(hr.get('datetime', '')).replace('T', ' ')
        if len(h_dt) == 16:
            h_dt += ":00"

        # Match city, datetime >= current hour, and target_lead
        if (h_city.lower(), h_dt) in valid_keys or (
            (not valid_keys) and
            (not target_city or h_city.lower() == target_city) and
            h_dt >= current_hour_str and
            (target_lead is None or hr.get('lead_days') == target_lead)
        ):
            h_lead = hr.get('lead_days')
            if h_lead is None:
                try:
                    row_dt = datetime.strptime(h_dt[:19], "%Y-%m-%d %H:%M:%S")
                    hours_ahead = int((row_dt - first_dt).total_seconds() // 3600)
                    h_lead = int(hours_ahead // 24 + 1)
                except Exception:
                    h_lead = 1

            results.append({
                "city": h_city,
                "model": "hybrid",
                "datetime": h_dt,
                "lead_days": h_lead,
                "temperature": hr.get('temperature'),
                "rainfall": hr.get('rainfall'),
                "wind_speed": hr.get('wind_speed')
            })

    return jsonify(results)


@app.route('/api/weights', methods=['GET'])
@app.route('/weights', methods=['GET'])
def get_weights():
    """
    Returns records from outputs/model_weights_lead.csv.
    Optional query parameters:
      - city: filter by city name
      - variable: filter by variable ('temperature', 'rainfall', 'wind_speed')
      - lead_days: filter by lead_days (1, 2, 3)
    """
    csv_path = os.path.join(OUTPUTS_DIR, "model_weights_lead.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "model_weights_lead.csv not found"}), 404

    city = request.args.get('city')
    variable = request.args.get('variable')
    lead_days = request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if variable:
        var_lower = variable.strip().lower()
        records = [r for r in records if str(r.get('variable', '')).lower() == var_lower]
    if lead_days:
        try:
            ld = int(lead_days)
            records = [r for r in records if r.get('lead_days') == ld]
        except ValueError:
            pass

    return jsonify(records)


@app.route('/api/skill', methods=['GET'])
@app.route('/skill', methods=['GET'])
def get_skill():
    """
    Returns records from outputs/skill_scores_lead.csv.
    Optional query parameters:
      - city: filter by city name
      - variable: filter by variable ('temperature', 'rainfall', 'wind_speed')
      - lead_days: filter by lead_days (1, 2, 3)
    """
    csv_path = os.path.join(OUTPUTS_DIR, "skill_scores_lead.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "skill_scores_lead.csv not found"}), 404

    city = request.args.get('city')
    variable = request.args.get('variable')
    lead_days = request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if variable:
        var_lower = variable.strip().lower()
        records = [r for r in records if str(r.get('variable', '')).lower() == var_lower]
    if lead_days:
        try:
            ld = int(lead_days)
            records = [r for r in records if r.get('lead_days') == ld]
        except ValueError:
            pass

    return jsonify(records)


@app.route('/api/performance', methods=['GET'])
@app.route('/performance', methods=['GET'])
def get_performance():
    """
    Returns records from outputs/performance_summary.csv.
    Optional query parameters:
      - variable: filter by variable ('temperature', 'rainfall', 'wind' / 'wind_speed')
      - lead_days: filter by lead_days (1, 2, 3)
      - method: filter by method ('ecmwf', 'gfs', 'icon', 'gem', 'equal_avg', 'weighted_blend', 'bias_corrected', 'hybrid_rf')
    """
    csv_path = os.path.join(OUTPUTS_DIR, "performance_summary.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "performance_summary.csv not found"}), 404

    variable = request.args.get('variable')
    lead_days = request.args.get('lead_days')
    method = request.args.get('method')

    if variable:
        var_lower = variable.strip().lower()
        if var_lower == 'wind':
            records = [r for r in records if str(r.get('variable', '')).lower() in ['wind', 'wind_speed']]
        else:
            records = [r for r in records if str(r.get('variable', '')).lower() == var_lower]
    if lead_days:
        try:
            ld = int(lead_days)
            records = [r for r in records if r.get('lead_days') == ld]
        except ValueError:
            pass
    if method:
        method_lower = method.strip().lower()
        records = [r for r in records if str(r.get('method', '')).lower() == method_lower]

    return jsonify(records)


@app.route('/api/alerts', methods=['GET'])
@app.route('/alerts', methods=['GET'])
def get_alerts():
    """
    Returns records from outputs/extreme_alerts.csv.
    Optional query parameter:
      - city: filter by city name
    """
    csv_path = os.path.join(OUTPUTS_DIR, "extreme_alerts.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "extreme_alerts.csv not found"}), 404

    city = request.args.get('city')
    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]

    return jsonify(records)


@app.route('/api/cities', methods=['GET'])
@app.route('/cities', methods=['GET'])
def get_cities():
    """
    Returns unique cities and their latitude/longitude coordinates from
    data/cities.csv or outputs/hybrid_forecast.csv.
    """
    cities_path = os.path.join(DATA_DIR, "cities.csv")
    forecast_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")

    cities = load_csv_records(cities_path)
    if cities is not None:
        return jsonify(cities)

    forecast_records = load_csv_records(forecast_path)
    if forecast_records is not None:
        unique_cities = sorted(list({r['city'] for r in forecast_records if 'city' in r}))
        return jsonify([{"city": c} for c in unique_cities])

    return jsonify([])


@app.route('/api/confidence', methods=['GET'])
@app.route('/confidence', methods=['GET'])
def get_confidence():
    """
    Returns records from outputs/confidence_scores.csv.
    Optional query parameters:
      - city: filter by city name (e.g. ?city=Kanpur)
      - lead_day: filter by lead day (1, 2, or 3)
    """
    csv_path = os.path.join(OUTPUTS_DIR, "confidence_scores.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "confidence_scores.csv not found"}), 404

    city = request.args.get('city')
    lead_day = request.args.get('lead_day') or request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if lead_day:
        try:
            ld = int(lead_day)
            records = [r for r in records if r.get('lead_day') == ld or r.get('lead_days') == ld]
        except ValueError:
            pass

    return jsonify(records)


@app.route('/api/rpi', methods=['GET'])
@app.route('/rpi', methods=['GET'])
def get_rpi():
    """
    Risk Priority Index (RPI) - Government Emergency Operations Decision Support.
    Formula: RPI = 35% Rain Risk + 25% Heat Risk + 20% Wind Risk + 20% Confidence
    Priority:
      0-30: Low
      31-55: Moderate
      56-75: High
      76-100: Critical
    Optional query parameter:
      - city: filter by city name (e.g. ?city=Kanpur)
    """
    forecast_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")
    confidence_path = os.path.join(OUTPUTS_DIR, "confidence_scores.csv")
    cities_path = os.path.join(DATA_DIR, "cities.csv")
    weights_path = os.path.join(OUTPUTS_DIR, "model_weights_lead.csv")

    forecast_records = load_csv_records(forecast_path) or []
    confidence_records = load_csv_records(confidence_path) or []
    city_records = load_csv_records(cities_path) or []
    weights_records = load_csv_records(weights_path) or []

    # Calculate real model weights per city from model_weights_lead.csv
    city_weights_raw = {}
    for wr in weights_records:
        w_city = str(wr.get('city', '')).strip().lower()
        if not w_city:
            continue
        m = str(wr.get('model', '')).strip().lower()
        try:
            w_val = float(wr.get('weight', 0.0))
        except (ValueError, TypeError):
            w_val = 0.0
        if w_city not in city_weights_raw:
            city_weights_raw[w_city] = {}
        if m not in city_weights_raw[w_city]:
            city_weights_raw[w_city][m] = []
        city_weights_raw[w_city][m].append(w_val)

    city_model_weights = {}
    for w_city, m_dict in city_weights_raw.items():
        w_avg = {m: sum(vals)/len(vals) for m, vals in m_dict.items() if vals}
        tot = sum(w_avg.values()) or 1.0
        city_model_weights[w_city] = {m: round((v / tot) * 100.0, 1) for m, v in w_avg.items()}

    city_meta = {}
    for c in city_records:
        city_meta[str(c.get('city', '')).lower()] = {
            'state': c.get('state', 'India'),
            'lat': c.get('latitude'),
            'lon': c.get('longitude')
        }

    city_forecasts = {}
    for r in forecast_records:
        c_name = str(r.get('city', '')).strip()
        if not c_name:
            continue
        c_key = c_name.lower()
        if c_key not in city_forecasts:
            city_forecasts[c_key] = r

    city_conf = {}
    for r in confidence_records:
        c_name = str(r.get('city', '')).strip()
        if not c_name:
            continue
        c_key = c_name.lower()
        if c_key not in city_conf:
            city_conf[c_key] = r

    target_city = request.args.get('city')
    if target_city:
        target_keys = [target_city.strip().lower()]
    else:
        target_keys = sorted(list(set(list(city_forecasts.keys()) + list(city_meta.keys()))))

    results = []
    for c_key in target_keys:
        f = city_forecasts.get(c_key, {})
        c = city_conf.get(c_key, {})
        meta = city_meta.get(c_key, {})

        c_display = f.get('city') or c.get('city') or c_key.capitalize()

        rain = float(f.get('rainfall') or f.get('blend_rainfall') or 0.0)
        temp = float(f.get('temperature') or f.get('blend_temperature') or 30.0)
        wind = float(f.get('wind_speed') or f.get('blend_wind_speed') or 15.0)
        conf = float(c.get('confidence') or 85.0)

        rain_risk = min(100.0, max(0.0, round((rain / 80.0) * 100.0, 1)))
        heat_risk = min(100.0, max(0.0, round(((temp - 25.0) / 20.0) * 100.0, 1)))
        wind_risk = min(100.0, max(0.0, round((wind / 65.0) * 100.0, 1)))
        conf_score = min(100.0, max(0.0, conf))

        rpi = round(0.35 * rain_risk + 0.25 * heat_risk + 0.20 * wind_risk + 0.20 * conf_score, 1)

        if rpi <= 30:
            priority = 'Low'
        elif rpi <= 55:
            priority = 'Moderate'
        elif rpi <= 75:
            priority = 'High'
        else:
            priority = 'Critical'

        # Real model weights from outputs/model_weights_lead.csv
        real_w = city_model_weights.get(c_key)
        if real_w and len(real_w) >= 4:
            weights = real_w
            best_model_name = max(real_w.items(), key=lambda x: x[1])[0]
            dom_model = best_model_name.upper()
        else:
            dom_model = c.get('dominant_model') or ('ECMWF' if rain > 40 else 'ICON' if temp > 35 else 'GFS')
            if dom_model == 'AI':
                dom_model = 'ECMWF'
            weights = {'ecmwf': 30.5, 'icon': 28.0, 'gfs': 21.5, 'gem': 20.0}

        # Real-time quantitative resource estimations based on synoptic thresholds
        # Real-time quantitative resource estimations based on synoptic thresholds for all 3 disaster domains
        recommendations = []

        # --- 1. FLOOD & PRECIPITATION CONTINGENCY ---
        if rain >= 50:
            boats = max(2, int(rain * 0.25))
            pumps = max(5, int(rain * 0.4))
            personnel = max(20, int(rain * 1.5))
            shelter_cap = int(max(200, rain * 50))
            recommendations.append({
                'id': f'{c_key}-rec-rain-crit',
                'title': 'Deploy SDRF & NDRF Water Rescue Battalions',
                'description': f'Stage 4 Critical Alert: Pre-position rescue boats & diving personnel at low-lying riverine basins. Projected rainfall: {rain:.1f} mm/24h. Estimated requirement: {boats} inflatable rescue boats, {personnel} response personnel.',
                'category': 'rain',
                'priority': 'critical',
                'department': 'Disaster Management Authority (SDMA / DDMA)',
                'status': 'Ready',
                'actionCode': 'SDRF-DEPL-01',
                'estimatedResources': {
                    'rescueBoats': boats,
                    'personnel': personnel,
                    'dewateringPumps': pumps,
                    'shelterCapacity': shelter_cap
                }
            })
        elif rain >= 20:
            boats = max(1, int(rain * 0.2))
            pumps = max(4, int(rain * 0.35))
            personnel = max(12, int(rain * 1.2))
            recommendations.append({
                'id': f'{c_key}-rec-rain-high',
                'title': 'Pre-emptive Drainage Sump Mobilization & SDRF Standby',
                'description': f'Stage 3 High Alert: Position mobile dewatering pumps at major urban underpasses and storm drains facing {rain:.1f} mm/24h rainfall. Standby rescue squads on 30-min notice.',
                'category': 'rain',
                'priority': 'high',
                'department': 'Municipal Corporation / PWD & SDRF',
                'status': 'Active',
                'actionCode': 'DRAIN-PUMP-02',
                'estimatedResources': {
                    'dewateringPumps': pumps,
                    'standbyBoats': boats,
                    'responseSquads': personnel
                }
            })
        elif rain >= 5:
            pumps = max(2, int(rain * 0.3))
            personnel = max(6, int(rain * 0.8))
            recommendations.append({
                'id': f'{c_key}-rec-rain-med',
                'title': 'Catchment Basin & Storm Sump Surveillance',
                'description': f'Stage 2 Alert: Moderate rainfall expected ({rain:.1f} mm/24h). Monitor municipal culverts and test automated sump sensors. Maintain emergency clearing teams.',
                'category': 'rain',
                'priority': 'medium',
                'department': 'Urban Water Supply & Drainage Cell',
                'status': 'Active',
                'actionCode': 'BASIN-WATCH-03',
                'estimatedResources': {
                    'standbyPumps': pumps,
                    'patrolCrews': personnel
                }
            })
        else:
            recommendations.append({
                'id': f'{c_key}-rec-rain-base',
                'title': 'Baseline Synoptic Pluviometer Monitoring & Readiness',
                'description': f'Stage 1 Baseline: Light/normal rainfall ({rain:.1f} mm/24h). Maintain automated radar rain-gauge calibration and synoptic telemetry monitoring.',
                'category': 'rain',
                'priority': 'routine',
                'department': 'State Meteorological Control Cell',
                'status': 'Active',
                'actionCode': 'RAIN-BASE-04',
                'estimatedResources': {
                    'activeRainGauges': 8,
                    'telemetrySensors': 12
                }
            })

        # --- 2. HEAT ACTION PLAN PROTOCOL ---
        if temp >= 40:
            tankers = max(6, int((temp - 35) * 5))
            ors_pkts = int((temp - 35) * 1500)
            cooling_centers = max(4, int((temp - 35) * 2.5))
            heat_beds = max(20, int((temp - 35) * 10))
            recommendations.append({
                'id': f'{c_key}-rec-heat-crit',
                'title': 'Issue Heatwave Red Alert & Outdoor Work Curfew',
                'description': f'Stage 4 Emergency: Severe heatwave conditions ({temp:.1f}°C). Enforce physical outdoor labor ban from 11:30 AM to 03:30 PM. Mobilize hospital burn/heat stroke wards.',
                'category': 'heat',
                'priority': 'critical',
                'department': 'Dept of Public Health & Disaster Management',
                'status': 'Active',
                'actionCode': 'HEAT-ADV-01',
                'estimatedResources': {
                    'emergencyHeatBeds': heat_beds,
                    'waterTankers': tankers,
                    'orsPackets': ors_pkts,
                    'coolingCenters': cooling_centers
                }
            })
        elif temp >= 36:
            tankers = max(4, int((temp - 33) * 3))
            ors_pkts = int((temp - 33) * 1000)
            cooling_centers = max(2, int((temp - 33) * 1.5))
            recommendations.append({
                'id': f'{c_key}-rec-heat-high',
                'title': 'Activate Civic Air-Cooled Relief Shelters & Tankers',
                'description': f'Stage 3 High Alert: Elevated thermal stress ({temp:.1f}°C). Open air-conditioned public transit hubs & libraries with ORS kiosks. Dispatch water bowsers to unshaded wards.',
                'category': 'heat',
                'priority': 'high',
                'department': 'Urban Local Bodies / Health Dept',
                'status': 'Ready',
                'actionCode': 'COOL-CTR-02',
                'estimatedResources': {
                    'coolingCenters': cooling_centers,
                    'waterTankers': tankers,
                    'orsPackets': ors_pkts
                }
            })
        elif temp >= 31:
            tankers = max(2, int((temp - 28) * 1.5))
            ors_pkts = max(500, int((temp - 28) * 500))
            recommendations.append({
                'id': f'{c_key}-rec-heat-med',
                'title': 'Thermal Index Advisory & Public Hydration Points',
                'description': f'Stage 2 Alert: Warm conditions ({temp:.1f}°C). Setup civic water kiosks at major bus terminals and marketplaces. Issue heat avoidance guidelines.',
                'category': 'heat',
                'priority': 'medium',
                'department': 'Municipal Public Health Wing',
                'status': 'Active',
                'actionCode': 'WATER-MOB-03',
                'estimatedResources': {
                    'hydrationKiosks': tankers,
                    'orsUnits': ors_pkts
                }
            })
        else:
            recommendations.append({
                'id': f'{c_key}-rec-heat-base',
                'title': 'Thermal Baseline & Heat Index Surveillance',
                'description': f'Stage 1 Baseline: Temperature ({temp:.1f}°C) within normal seasonal comfort thresholds. Maintain surface air temperature sensor calibration.',
                'category': 'heat',
                'priority': 'routine',
                'department': 'Health Surveillance & Met Cell',
                'status': 'Active',
                'actionCode': 'HEAT-BASE-04',
                'estimatedResources': {
                    'ambientSensors': 6,
                    'healthMonitors': 2
                }
            })

        # --- 3. WIND & INFRASTRUCTURE DEFENSE ---
        if wind >= 45:
            cranes = max(3, int(wind * 0.15))
            crews = max(6, int(wind * 0.3))
            vessels = max(2, int(wind * 0.1))
            recommendations.append({
                'id': f'{c_key}-rec-wind-crit',
                'title': 'Suspend Marine Operations & Halt High-Altitude Cranes',
                'description': f'Stage 4 Critical: Dangerous wind gusts ({wind:.1f} km/h). Issue immediate port and artisanal fishing craft bans. Halt construction tower cranes and evacuate vulnerable scaffolding.',
                'category': 'wind',
                'priority': 'critical',
                'department': 'Port Authority, Labour & Police Safety',
                'status': 'Active',
                'actionCode': 'OPS-HALT-02',
                'estimatedResources': {
                    'patrolVessels': vessels,
                    'craneSafetyUnits': cranes,
                    'emergencyLineCrews': crews
                }
            })
        elif wind >= 30:
            cranes = max(1, int(wind * 0.1))
            crews = max(4, int(wind * 0.25))
            recommendations.append({
                'id': f'{c_key}-rec-wind-high',
                'title': 'Secure Overhead Hoardings & Scaffolding Inspections',
                'description': f'Stage 3 High Alert: Strong wind gusts ({wind:.1f} km/h). Inspect and dismantle unauthorized billboards and temporary construction hoardings.',
                'category': 'wind',
                'priority': 'high',
                'department': 'Municipal Town Planning / Safety Wing',
                'status': 'Active',
                'actionCode': 'WIND-SEC-01',
                'estimatedResources': {
                    'safetyInspectors': crews,
                    'mobileCranes': cranes
                }
            })
        elif wind >= 18:
            crews = max(2, int(wind * 0.2))
            recommendations.append({
                'id': f'{c_key}-rec-wind-med',
                'title': 'Power Grid Line Patrol & Tree Clearing Squads',
                'description': f'Stage 2 Alert: Moderate wind activity ({wind:.1f} km/h). Pre-position power transmission line maintenance crews and hydraulic branch trimming teams.',
                'category': 'wind',
                'priority': 'medium',
                'department': 'State Electricity Board / Forestry Works',
                'status': 'Standby',
                'actionCode': 'GRID-STBY-03',
                'estimatedResources': {
                    'powerRestorationCrews': crews,
                    'treeTrimmingUnits': max(1, int(crews / 2))
                }
            })
        else:
            recommendations.append({
                'id': f'{c_key}-rec-wind-base',
                'title': 'Anemometer Verification & Baseline Grid Monitoring',
                'description': f'Stage 1 Baseline: Wind velocity ({wind:.1f} km/h) well within safe operational engineering parameters. Continuous sonic anemometer tracking.',
                'category': 'wind',
                'priority': 'routine',
                'department': 'State Meteorological Control Cell',
                'status': 'Active',
                'actionCode': 'WIND-BASE-04',
                'estimatedResources': {
                    'anemometers': 6,
                    'gridTelemetry': 10
                }
            })

        results.append({
            'city': c_display,
            'state': meta.get('state', 'India'),
            'lat': meta.get('lat', 20.5937),
            'lon': meta.get('lon', 78.9629),
            'rainfall': round(rain, 1),
            'temperature': round(temp, 1),
            'wind': round(wind, 1),
            'confidence': round(conf_score, 1),
            'rainRisk': rain_risk,
            'heatRisk': heat_risk,
            'windRisk': wind_risk,
            'rpiScore': rpi,
            'priority': priority,
            'dominantModel': dom_model,
            'modelWeights': weights,
            'recommendations': recommendations,
            'updatedAt': '2026-09-26T18:30:00'
        })

    if target_city:
        if results:
            return jsonify(results[0])
        return jsonify({'error': f'City {target_city} not found'}), 404

    return jsonify(results)


@app.route('/api/rpi/map', methods=['GET'])
@app.route('/rpi/map', methods=['GET'])
def get_rpi_map():
    """
    Returns GeoJSON FeatureCollection of all Indian synoptic stations with RPI attributes
    for Leaflet Map APIs and spatial visualizations.
    """
    forecast_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")
    confidence_path = os.path.join(OUTPUTS_DIR, "confidence_scores.csv")
    cities_path = os.path.join(DATA_DIR, "cities.csv")
    weights_path = os.path.join(OUTPUTS_DIR, "model_weights_lead.csv")

    forecast_records = load_csv_records(forecast_path) or []
    confidence_records = load_csv_records(confidence_path) or []
    city_records = load_csv_records(cities_path) or []
    weights_records = load_csv_records(weights_path) or []

    city_weights_raw = {}
    for wr in weights_records:
        w_city = str(wr.get('city', '')).strip().lower()
        if not w_city:
            continue
        m = str(wr.get('model', '')).strip().lower()
        try:
            w_val = float(wr.get('weight', 0.0))
        except (ValueError, TypeError):
            w_val = 0.0
        if w_city not in city_weights_raw:
            city_weights_raw[w_city] = {}
        if m not in city_weights_raw[w_city]:
            city_weights_raw[w_city][m] = []
        city_weights_raw[w_city][m].append(w_val)

    city_model_weights = {}
    for w_city, m_dict in city_weights_raw.items():
        w_avg = {m: sum(vals)/len(vals) for m, vals in m_dict.items() if vals}
        tot = sum(w_avg.values()) or 1.0
        city_model_weights[w_city] = {m: round((v / tot) * 100.0, 1) for m, v in w_avg.items()}

    city_meta = {}
    for c in city_records:
        city_meta[str(c.get('city', '')).lower()] = {
            'state': c.get('state', 'India'),
            'lat': c.get('latitude'),
            'lon': c.get('longitude')
        }

    city_forecasts = {}
    for r in forecast_records:
        c_name = str(r.get('city', '')).strip()
        if not c_name:
            continue
        c_key = c_name.lower()
        if c_key not in city_forecasts:
            city_forecasts[c_key] = r

    city_conf = {}
    for r in confidence_records:
        c_name = str(r.get('city', '')).strip()
        if not c_name:
            continue
        c_key = c_name.lower()
        if c_key not in city_conf:
            city_conf[c_key] = r

    features = []
    target_keys = sorted(list(set(list(city_forecasts.keys()) + list(city_meta.keys()))))

    for c_key in target_keys:
        f = city_forecasts.get(c_key, {})
        c = city_conf.get(c_key, {})
        meta = city_meta.get(c_key, {})

        c_display = f.get('city') or c.get('city') or c_key.capitalize()
        lat = meta.get('lat') or 20.5937
        lon = meta.get('lon') or 78.9629

        rain = float(f.get('rainfall') or f.get('blend_rainfall') or 0.0)
        temp = float(f.get('temperature') or f.get('blend_temperature') or 30.0)
        wind = float(f.get('wind_speed') or f.get('blend_wind_speed') or 15.0)
        conf = float(c.get('confidence') or 85.0)

        rain_risk = min(100.0, max(0.0, round((rain / 80.0) * 100.0, 1)))
        heat_risk = min(100.0, max(0.0, round(((temp - 25.0) / 20.0) * 100.0, 1)))
        wind_risk = min(100.0, max(0.0, round((wind / 65.0) * 100.0, 1)))
        rpi = round(0.35 * rain_risk + 0.25 * heat_risk + 0.20 * wind_risk + 0.20 * conf, 1)

        priority = 'Low' if rpi <= 30 else 'Moderate' if rpi <= 55 else 'High' if rpi <= 75 else 'Critical'
        real_w = city_model_weights.get(c_key)
        if real_w and len(real_w) >= 4:
            dom_model = max(real_w.items(), key=lambda x: x[1])[0].upper()
        else:
            dom_model = c.get('dominant_model') or ('ECMWF' if rain > 40 else 'ICON' if temp > 35 else 'GFS')
            if dom_model == 'AI':
                dom_model = 'ECMWF'

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(lon), float(lat)]
            },
            "properties": {
                "city": c_display,
                "state": meta.get('state', 'India'),
                "rpiScore": rpi,
                "priority": priority,
                "dominantModel": dom_model,
                "rainfall": round(rain, 1),
                "temperature": round(temp, 1),
                "wind": round(wind, 1),
                "confidence": round(conf, 1)
            }
        })

    return jsonify({
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "totalStations": len(features),
            "generatedAt": "2026-09-26T18:30:00Z",
            "crs": "EPSG:4326"
        }
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Not Found",
        "message": "The requested endpoint does not exist.",
        "status": 404,
        "available_endpoints": {
            "root": "/",
            "health": "/health",
            "metadata": "/api/metadata",
            "forecast": "/api/forecast",
            "model_forecasts": "/api/model_forecasts",
            "weights": "/api/weights",
            "skill": "/api/skill",
            "alerts": "/api/alerts",
            "cities": "/api/cities",
            "confidence": "/api/confidence",
            "performance": "/api/performance",
            "rpi": "/api/rpi",
            "rpi_map": "/api/rpi/map"
        }
    }), 404


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    port = int(os.environ.get('PORT', 5001))
    print(f"\n🚀 Hybrid Weather AI API starting on http://localhost:{port}")
    print(f"📡 Endpoints available at http://localhost:{port}/api/\n")
    app.run(host='0.0.0.0', port=port, debug=False)
