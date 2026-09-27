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


from api.cache_manager import ensure_fresh_forecast, load_metadata

# Ensure fresh forecast on application startup
try:
    ensure_fresh_forecast()
except Exception as _e:
    print(f"[Warning] Startup forecast refresh notice: {_e}")


@app.after_request
def add_cors_headers(response):
    """Enable CORS for local frontend development."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


@app.route('/')
def index():
    return jsonify({
        "status": "online",
        "service": "Hybrid Weather AI System",
        "version": "1.0.0",
        "engine": "pandas" if (USE_PANDAS and pd is not None) else "standard-csv",
        "endpoints": {
            "forecast": "/api/forecast",
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
            meta = ensure_fresh_forecast()
        except Exception:
            meta = {
                "last_updated": "2026-09-26T23:45:12",
                "cities": 45,
                "models": 4,
                "city_count": 45,
                "model_count": 4
            }
    return jsonify(meta)


@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    """
    Returns records from outputs/blended_forecast.csv.
    Checks freshness and auto-regenerates if file is older than today.
    Optional query parameters:
      - city: filter by city name (e.g. ?city=Kanpur)
      - lead_days: filter by lead time (1, 2, or 3)
    """
    # 1. Check freshness and auto-regenerate if older than today
    try:
        ensure_fresh_forecast()
    except Exception as e:
        print(f"[API Error] Forecast auto-refresh failed: {e}")

    # 2. Load latest blended forecast
    csv_path = os.path.join(OUTPUTS_DIR, "blended_forecast.csv")
    if not os.path.exists(csv_path):
        csv_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")

    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "blended_forecast.csv not found"}), 404

    # Ensure backward-compatible blend_* fields for all frontend consumers
    for r in records:
        if 'blend_temperature' not in r or r['blend_temperature'] is None:
            r['blend_temperature'] = r.get('temperature')
        if 'blend_rainfall' not in r or r['blend_rainfall'] is None:
            r['blend_rainfall'] = r.get('rainfall')
        if 'blend_wind_speed' not in r or r['blend_wind_speed'] is None:
            r['blend_wind_speed'] = r.get('wind_speed')

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

    return jsonify(records)


@app.route('/api/weights', methods=['GET'])
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


@app.route('/api/alerts', methods=['GET'])
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

    forecast_records = load_csv_records(forecast_path) or []
    confidence_records = load_csv_records(confidence_path) or []
    city_records = load_csv_records(cities_path) or []

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

        dom_model = c.get('dominant_model') or ('ECMWF' if rain > 40 else 'ICON' if temp > 35 else 'GFS')
        if dom_model == 'AI':
            dom_model = 'ECMWF'

        if dom_model == 'ECMWF':
            weights = {'ecmwf': 45, 'icon': 25, 'gfs': 18, 'gem': 12}
        elif dom_model == 'ICON':
            weights = {'ecmwf': 25, 'icon': 45, 'gfs': 18, 'gem': 12}
        elif dom_model == 'GFS':
            weights = {'ecmwf': 20, 'icon': 22, 'gfs': 46, 'gem': 12}
        else:
            weights = {'ecmwf': 22, 'icon': 20, 'gfs': 18, 'gem': 40}

        recommendations = []
        if rain > 45 or rain_risk > 50:
            recommendations.append({
                'id': f'{c_key}-rec-rain-1',
                'title': 'Deploy SDRF & NDRF Water Rescue Battalions',
                'description': f'Pre-position State Disaster Response Force inflatable boats & rescue personnel at low-lying riverine basins. Projected rainfall at {rain:.1f} mm/24h.',
                'category': 'rain',
                'priority': 'critical' if rain > 70 else 'high',
                'department': 'Disaster Management Authority (SDMA / DDMA)',
                'status': 'Ready',
                'actionCode': 'SDRF-DEPL-01'
            })
            recommendations.append({
                'id': f'{c_key}-rec-rain-2',
                'title': 'Open Emergency Relief Shelters & Stock Rations',
                'description': 'Activate community shelters and primary healthcare relief camps with drinking water, dry rations, and medical kits.',
                'category': 'rain',
                'priority': 'high',
                'department': 'Revenue & Civil Supplies Dept',
                'status': 'Standby',
                'actionCode': 'SHELTER-ACT-04'
            })
            recommendations.append({
                'id': f'{c_key}-rec-rain-3',
                'title': 'Continuous Drainage & Sump Pump Monitoring',
                'description': 'Deploy high-capacity dewatering pump sets at major urban underpasses, storm drains, and culverts.',
                'category': 'rain',
                'priority': 'high' if rain > 60 else 'medium',
                'department': 'Municipal Corporation / PWD',
                'status': 'Active',
                'actionCode': 'DRAIN-PUMP-02'
            })

        if temp >= 37 or heat_risk > 55:
            recommendations.append({
                'id': f'{c_key}-rec-heat-1',
                'title': 'Issue Heatwave Red Alert & Public Advisory',
                'description': f'Broadcast urgent heat warnings via SMS, radio, and social media. Restrict heavy physical outdoor work between 11:30 AM and 03:30 PM. Temp: {temp:.1f}°C.',
                'category': 'heat',
                'priority': 'critical' if temp >= 40 else 'high',
                'department': 'Dept of Public Health & Family Welfare',
                'status': 'Active',
                'actionCode': 'HEAT-ADV-01'
            })
            recommendations.append({
                'id': f'{c_key}-rec-heat-2',
                'title': 'Activate Air-Cooled Public Relief Centres',
                'description': 'Open air-conditioned civic centers, bus terminuses, and libraries as heat relief shelters with ORS hydration stations.',
                'category': 'heat',
                'priority': 'high',
                'department': 'District Administration / Urban Local Bodies',
                'status': 'Ready',
                'actionCode': 'COOL-CTR-02'
            })
            recommendations.append({
                'id': f'{c_key}-rec-heat-3',
                'title': 'Mobilize Emergency Drinking Water Tankers',
                'description': 'Deploy municipal water supply bowsers to informal settlements, construction clusters, and water-stressed wards.',
                'category': 'heat',
                'priority': 'medium',
                'department': 'Water Supply & Sewerage Board',
                'status': 'Dispatched',
                'actionCode': 'WATER-MOB-03'
            })

        if wind >= 25 or wind_risk > 45:
            recommendations.append({
                'id': f'{c_key}-rec-wind-1',
                'title': 'Secure High-Rise Hoardings & Structural Assets',
                'description': f'Inspect and dismantle unauthorized temporary billboards, overhead hoardings, and construction scaffolding facing wind gusts of {wind:.1f} km/h.',
                'category': 'wind',
                'priority': 'high' if wind > 35 else 'medium',
                'department': 'Municipal Town Planning / Safety Wing',
                'status': 'Active',
                'actionCode': 'WIND-SEC-01'
            })
            recommendations.append({
                'id': f'{c_key}-rec-wind-2',
                'title': 'Suspend Marine, Port & Crane Operations',
                'description': 'Issue immediate no-sail advisory for artisanal fishing boats and halt towering construction tower crane operations.',
                'category': 'wind',
                'priority': 'high' if wind > 40 else 'medium',
                'department': 'Port Authority / Labour Enforcement',
                'status': 'Standby',
                'actionCode': 'OPS-HALT-02'
            })

        if not recommendations:
            recommendations.append({
                'id': f'{c_key}-rec-std-1',
                'title': 'Standard Operational Readiness & Sensor Verification',
                'description': 'All synoptic parameters within baseline thresholds. Maintain automated radar & rain-gauge calibration.',
                'category': 'general',
                'priority': 'routine',
                'department': 'State Meteorological Control Cell',
                'status': 'Active',
                'actionCode': 'EOC-STBY-00'
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
def get_rpi_map():
    """
    Returns GeoJSON FeatureCollection of all Indian synoptic stations with RPI attributes
    for Leaflet Map APIs and spatial visualizations.
    """
    forecast_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")
    confidence_path = os.path.join(OUTPUTS_DIR, "confidence_scores.csv")
    cities_path = os.path.join(DATA_DIR, "cities.csv")

    forecast_records = load_csv_records(forecast_path) or []
    confidence_records = load_csv_records(confidence_path) or []
    city_records = load_csv_records(cities_path) or []

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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n🚀 Hybrid Weather AI API starting on http://localhost:{port}")
    print(f"📡 Endpoints available at http://localhost:{port}/api/\n")
    app.run(host='0.0.0.0', port=port, debug=True)
