"""
cache_manager.py - Forecast Cache & Auto-Refresh Manager
Smart India Hackathon 2026 (PS: 26081)

Manages forecast freshness, Open-Meteo fetching, preprocessing,
adaptive weighting blending, and caching metadata.

Rules:
- If blended_forecast.csv is from today's date: do not fetch again.
- If file is older than today (or missing): automatically regenerate.
- Metadata is stored in outputs/metadata.json.
"""

import os
import json
import threading
from datetime import datetime, date
from pathlib import Path
import requests
import pandas as pd
import numpy as np

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUTS_DIR = BASE_DIR / "outputs"
INTERIM_DIR = OUTPUTS_DIR / "interim"

CITIES_CSV = DATA_DIR / "cities.csv"
FORECAST_CURR_CSV = DATA_DIR / "forecast_current.csv"
CLEAN_FC_CSV = INTERIM_DIR / "forecast_current_clean.csv"
WEIGHTS_CSV = OUTPUTS_DIR / "model_weights_lead.csv"
BLENDED_CSV = OUTPUTS_DIR / "blended_forecast.csv"
HYBRID_CSV = OUTPUTS_DIR / "hybrid_forecast.csv"
METADATA_JSON = OUTPUTS_DIR / "metadata.json"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MODELS_API = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless", "gem_seamless"]
MODEL_MAP = {
    "ecmwf_ifs025": "ecmwf",
    "gfs_seamless": "gfs",
    "icon_seamless": "icon",
    "gem_seamless": "gem",
}
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Concurrency lock to prevent duplicate regeneration runs
_refresh_lock = threading.Lock()


def get_today_date_str():
    """Returns today's date string in YYYY-MM-DD format."""
    return date.today().strftime("%Y-%m-%d")


def load_metadata():
    """
    Reads outputs/metadata.json. Returns dict or None.
    """
    if not METADATA_JSON.exists():
        return None
    try:
        with open(METADATA_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[CacheManager] Failed to read metadata.json: {e}")
        return None


def save_metadata(metadata_dict):
    """
    Saves metadata dict to outputs/metadata.json.
    """
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(METADATA_JSON, "w", encoding="utf-8") as f:
        json.dump(metadata_dict, f, indent=2)
    print(f"[CacheManager] Saved metadata to {METADATA_JSON}")


def is_cache_fresh():
    """
    Checks if forecast cache is fresh.
    Fresh only if metadata.json 'last_updated' is less than 6 hours old.
    As a secondary safeguard, verifies the forecast's first datetime is today or later.
    """
    meta = load_metadata()
    if not meta or "last_updated" not in meta:
        print("[CacheManager] metadata.json missing or lacks last_updated -> stale.")
        return False

    try:
        last_updated_dt = datetime.fromisoformat(meta["last_updated"])
        hours_old = (datetime.now() - last_updated_dt).total_seconds() / 3600.0
        if hours_old < 0 or hours_old >= 6.0:
            print(f"[CacheManager] metadata.json is {hours_old:.2f}h old (>= 6 hours) -> stale.")
            return False
    except Exception as e:
        print(f"[CacheManager] Error parsing metadata last_updated: {e}")
        return False

    # Secondary safeguard: Check that blended_forecast.csv's first datetime is today or later
    if not BLENDED_CSV.exists():
        print("[CacheManager] blended_forecast.csv does not exist -> stale.")
        return False

    today_str = get_today_date_str()
    try:
        with open(BLENDED_CSV, "r", encoding="utf-8") as f:
            header = f.readline()
            first_row = f.readline()
            if not first_row:
                return False
            parts = first_row.strip().split(",")
            if len(parts) >= 2:
                fc_dt_str = parts[1].strip()
                fc_date_str = fc_dt_str[:10]
                if fc_date_str < today_str:
                    print(f"[CacheManager] blended_forecast.csv date ({fc_date_str}) is older than today ({today_str}) -> stale.")
                    return False
    except Exception as e:
        print(f"[CacheManager] Error checking file date: {e}")
        return False

    return True


def fetch_open_meteo_forecasts(cities_df):
    """
    Fetches 72-hour forecast from Open-Meteo for all 45 cities for all 4 NWP models:
    ECMWF (ecmwf_ifs025), GFS (gfs_seamless), ICON (icon_seamless), GEM (gem_seamless).
    Uses batch multi-location query with automatic fallback to single-city requests.
    """
    print(f"[CacheManager] Fetching fresh forecasts from Open-Meteo for {len(cities_df)} cities...")
    lats = ",".join(cities_df["latitude"].astype(str))
    lons = ",".join(cities_df["longitude"].astype(str))

    headers = {"User-Agent": "SIH-HybridWeatherAI/2.0"}
    params = {
        "latitude": lats,
        "longitude": lons,
        "forecast_days": 3,
        "hourly": "temperature_2m,precipitation,wind_speed_10m",
        "models": ",".join(MODELS_API),
        "timezone": "Asia/Kolkata",
    }

    records = []
    success = False

    try:
        res = requests.get(OPEN_METEO_URL, params=params, headers=headers, timeout=25.0)
        if res.status_code == 200:
            data_list = res.json()
            if isinstance(data_list, list) and len(data_list) == len(cities_df):
                for idx, item in enumerate(data_list):
                    city = cities_df.iloc[idx]["city"]
                    hourly = item.get("hourly", {})
                    times = hourly.get("time", [])
                    for model in MODELS_API:
                        temps = hourly.get(f"temperature_2m_{model}", hourly.get("temperature_2m", []))
                        precips = hourly.get(f"precipitation_{model}", hourly.get("precipitation", []))
                        winds = hourly.get(f"wind_speed_10m_{model}", hourly.get("wind_speed_10m", []))
                        for i in range(len(times)):
                            records.append({
                                "city": city,
                                "model": model,
                                "datetime": times[i][:16],
                                "temperature": temps[i] if i < len(temps) else None,
                                "rainfall": precips[i] if i < len(precips) else None,
                                "wind_speed": winds[i] if i < len(winds) else None,
                            })
                success = True
    except Exception as e:
        print(f"[CacheManager] Batch Open-Meteo fetch notice: {e}. Trying individual requests...")

    # Fallback to city-by-city if batch query fails
    if not success or not records:
        records = []
        for idx, row in cities_df.iterrows():
            city = row["city"]
            lat = row["latitude"]
            lon = row["longitude"]
            c_params = {
                "latitude": lat,
                "longitude": lon,
                "forecast_days": 3,
                "hourly": "temperature_2m,precipitation,wind_speed_10m",
                "models": ",".join(MODELS_API),
                "timezone": "Asia/Kolkata",
            }
            try:
                c_res = requests.get(OPEN_METEO_URL, params=c_params, headers=headers, timeout=15.0)
                if c_res.status_code == 200:
                    hourly = c_res.json().get("hourly", {})
                    times = hourly.get("time", [])
                    for model in MODELS_API:
                        temps = hourly.get(f"temperature_2m_{model}", hourly.get("temperature_2m", []))
                        precips = hourly.get(f"precipitation_{model}", hourly.get("precipitation", []))
                        winds = hourly.get(f"wind_speed_10m_{model}", hourly.get("wind_speed_10m", []))
                        for i in range(len(times)):
                            records.append({
                                "city": city,
                                "model": model,
                                "datetime": times[i][:16],
                                "temperature": temps[i] if i < len(temps) else None,
                                "rainfall": precips[i] if i < len(precips) else None,
                                "wind_speed": winds[i] if i < len(winds) else None,
                            })
            except Exception as e:
                print(f"[CacheManager] Error fetching city {city}: {e}")

    df_raw = pd.DataFrame(records)
    if df_raw.empty:
        raise RuntimeError("Failed to fetch forecast records from Open-Meteo API.")

    # Impute missing values within each (city, model) group; fail explicitly if NaN remains
    for col in ["temperature", "rainfall", "wind_speed"]:
        df_raw[col] = df_raw.groupby(["city", "model"])[col].ffill().bfill()
        if df_raw[col].isna().any():
            culprits = df_raw[df_raw[col].isna()][["city", "model"]].drop_duplicates().to_dict(orient="records")
            raise RuntimeError(
                f"Missing data in column '{col}' after (city, model) ffill/bfill for: {culprits}. "
                f"Never inventing fallback numbers."
            )

    # Save to data/forecast_current.csv
    FORECAST_CURR_CSV.parent.mkdir(parents=True, exist_ok=True)
    df_raw.to_csv(FORECAST_CURR_CSV, index=False)
    print(f"[CacheManager] Saved {len(df_raw)} records to {FORECAST_CURR_CSV}")
    return df_raw


def run_preprocessing(df_raw):
    """
    Runs existing preprocessing on forecast_current.csv:
    1. Maps model names (ecmwf_ifs025 -> ecmwf, etc.)
    2. Parses datetime
    3. Sorts by city, model, datetime
    4. Validates assertions (no NaNs, numeric ranges)
    5. Saves to outputs/interim/forecast_current_clean.csv
    """
    print("[CacheManager] Running preprocessing on fresh forecast...")
    df = df_raw.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df["model"] = df["model"].map(MODEL_MAP)
    df = df.sort_values(by=["city", "model", "datetime"]).reset_index(drop=True)

    # Assertions: fail explicitly if any NaN remains within (city, model) group
    for col in ["temperature", "rainfall", "wind_speed"]:
        df[col] = df.groupby(["city", "model"])[col].ffill().bfill()
        if df[col].isna().any():
            culprits = df[df[col].isna()][["city", "model"]].drop_duplicates().to_dict(orient="records")
            raise RuntimeError(
                f"Preprocessing error: Missing data in column '{col}' after (city, model) ffill/bfill for: {culprits}"
            )

    INTERIM_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(CLEAN_FC_CSV, index=False, date_format="%Y-%m-%d %H:%M:%S")
    print(f"[CacheManager] Saved cleaned forecast to {CLEAN_FC_CSV}")
    return df


def run_adaptive_weighting():
    """
    Runs existing adaptive weighting from outputs/model_weights_lead.csv
    to generate outputs/blended_forecast.csv.
    """
    print("[CacheManager] Running adaptive weighting to generate blended_forecast.csv...")
    if not CLEAN_FC_CSV.exists():
        raise FileNotFoundError(f"{CLEAN_FC_CSV} does not exist.")
    if not WEIGHTS_CSV.exists():
        raise FileNotFoundError(f"{WEIGHTS_CSV} does not exist.")

    df_fc = pd.read_csv(CLEAN_FC_CSV)
    df_fc["datetime"] = pd.to_datetime(df_fc["datetime"])
    df_weights = pd.read_csv(WEIGHTS_CSV)

    # 1. Lead days calculation
    start_time = df_fc["datetime"].min()
    hours_ahead = ((df_fc["datetime"] - start_time).dt.total_seconds() // 3600).astype(int)
    df_fc["lead_days"] = hours_ahead // 24 + 1

    # 2. Pivot forecast to wide format
    df_pivot = df_fc.pivot(
        index=["city", "datetime", "lead_days"],
        columns="model",
        values=VARIABLES
    )
    df_wide = df_pivot.copy()
    df_wide.columns = [f"{var}_{mod}" for var, mod in df_pivot.columns]
    df_wide = df_wide.reset_index()

    # 3. Pivot weights and compute weighted blend
    df_blended = df_wide.copy()
    models_short = ["ecmwf", "gfs", "icon", "gem"]

    for var in VARIABLES:
        w_pivot = df_weights[df_weights["variable"] == var].pivot(
            index=["city", "lead_days"],
            columns="model",
            values="weight"
        ).reset_index()

        w_cols = [f"w_{m}" for m in models_short]
        w_pivot.columns = ["city", "lead_days"] + w_cols

        merged = pd.merge(df_wide, w_pivot, on=["city", "lead_days"], how="left")
        w_sum = merged[w_cols].sum(axis=1)
        for m in models_short:
            merged[f"w_{m}"] = merged[f"w_{m}"] / w_sum

        df_blended[var] = sum(merged[f"w_{m}"] * merged[f"{var}_{m}"] for m in models_short)

    output_cols = ["city", "datetime", "lead_days", "temperature", "rainfall", "wind_speed"]
    df_out = df_blended.sort_values(by=["city", "datetime"]).reset_index(drop=True)[output_cols]

    # Quality control: fail if NaN produced
    if df_out.isna().any().any():
        raise RuntimeError("Adaptive weighting produced NaN values in blended forecast.")

    df_out["datetime"] = df_out["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # Save blended_forecast.csv
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    df_out.to_csv(BLENDED_CSV, index=False)
    print(f"[CacheManager] Successfully generated {BLENDED_CSV} ({len(df_out)} rows)")

    # Generate hybrid_forecast.csv using trained Random Forest models from ai/predict.py
    print("[CacheManager] Generating hybrid_forecast.csv with Random Forest residual corrections...")
    from ai.predict import build_current_features, predict_hybrid, FEATURE_COLS

    orig_cwd = os.getcwd()
    try:
        os.chdir(str(BASE_DIR))
        curr_df, _ = build_current_features()
        hybrids, _ = predict_hybrid(curr_df)
    finally:
        os.chdir(orig_cwd)

    curr_df["temperature"] = hybrids["temperature"]
    curr_df["rainfall"] = hybrids["rainfall"]
    curr_df["wind_speed"] = hybrids["wind_speed"]

    hybrid_cols = [
        "city", "datetime", "lead_days",
        "blend_temperature", "blend_rainfall", "blend_wind_speed",
        "temperature", "rainfall", "wind_speed"
    ]
    df_hybrid = curr_df[hybrid_cols].sort_values(by=["city", "datetime"]).copy()
    df_hybrid["datetime"] = pd.to_datetime(df_hybrid["datetime"]).dt.strftime("%Y-%m-%d %H:%M:%S")

    # Save hybrid_forecast.csv
    df_hybrid.to_csv(HYBRID_CSV, index=False)
    print(f"[CacheManager] Successfully generated {HYBRID_CSV} ({len(df_hybrid)} rows)")

    # Assertion: for a random sample of 5 rows, hybrid value must NOT exactly equal blend value
    sample_rows = df_hybrid.sample(n=min(5, len(df_hybrid)), random_state=42)
    all_equal = True
    for _, s_row in sample_rows.iterrows():
        is_row_equal = (
            np.isclose(s_row["temperature"], s_row["blend_temperature"], atol=1e-6) and
            np.isclose(s_row["rainfall"], s_row["blend_rainfall"], atol=1e-6) and
            np.isclose(s_row["wind_speed"], s_row["blend_wind_speed"], atol=1e-6)
        )
        if not is_row_equal:
            all_equal = False
            break
    if all_equal:
        raise RuntimeError("Assertion failed: Random sample of 5 rows showed hybrid exactly equals blend for all 5. RF correction was skipped!")

    # Summary and difference printout
    row_count = len(df_hybrid)
    date_min = df_hybrid["datetime"].min()
    date_max = df_hybrid["datetime"].max()
    print("\n" + "=" * 60)
    print("=== HYBRID FORECAST (AI-NWP RF CORRECTION) SUMMARY ===")
    print(f"Total row count : {row_count}")
    print(f"Date range      : {date_min} to {date_max}")
    print("Mean absolute difference (|hybrid - blend|):")
    for var in ["temperature", "rainfall", "wind_speed"]:
        mae_diff = float(np.mean(np.abs(df_hybrid[var].values - df_hybrid[f"blend_{var}"].values)))
        print(f"  {var:<12}: {mae_diff:.4f}")
        if mae_diff <= 0:
            raise RuntimeError(f"RF correction verification failed: mean absolute difference for '{var}' is {mae_diff:.4f} (must be > 0)")
    print("=" * 60 + "\n")

    # Run downstream alerts and confidence updates strictly AFTER hybrid_forecast.csv is fully written
    if not HYBRID_CSV.exists() or HYBRID_CSV.stat().st_size == 0:
        raise RuntimeError(f"[CacheManager] {HYBRID_CSV} does not exist or is empty before downstream updates.")
    run_downstream_updates()

    return df_out


def run_downstream_updates():
    """
    Refreshes outputs/extreme_alerts.csv and outputs/confidence_scores.csv
    based on the freshly written hybrid forecast.
    Captures and prints return code and stderr of ai/alerts.py and ai/confidence_engine.py.
    """
    if not HYBRID_CSV.exists() or HYBRID_CSV.stat().st_size == 0:
        print(f"[CacheManager] Cannot run downstream updates: {HYBRID_CSV} is missing or empty.")
        return

    import sys
    import subprocess

    venv_py = BASE_DIR / "venv" / "bin" / "python"
    venv_py_win = BASE_DIR / "venv" / "Scripts" / "python.exe"
    if venv_py.exists():
        py_exec = str(venv_py)
    elif venv_py_win.exists():
        py_exec = str(venv_py_win)
    else:
        py_exec = sys.executable

    # Run ai/alerts.py
    alerts_script = BASE_DIR / "ai" / "alerts.py"
    if alerts_script.exists():
        print(f"[CacheManager] Running downstream alerts: {alerts_script}...")
        res_alerts = subprocess.run(
            [py_exec, str(alerts_script)],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True
        )
        print(f"[CacheManager] ai/alerts.py return code: {res_alerts.returncode}")
        if res_alerts.stdout:
            print(f"[CacheManager] ai/alerts.py stdout:\n{res_alerts.stdout}")
        if res_alerts.stderr:
            print(f"[CacheManager] ai/alerts.py stderr:\n{res_alerts.stderr}")
        if res_alerts.returncode != 0:
            print(f"[CacheManager] Warning: ai/alerts.py exited with non-zero code {res_alerts.returncode}")

    # Run ai/confidence_engine.py
    conf_script = BASE_DIR / "ai" / "confidence_engine.py"
    if conf_script.exists():
        print(f"[CacheManager] Running downstream confidence: {conf_script}...")
        res_conf = subprocess.run(
            [py_exec, str(conf_script)],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True
        )
        print(f"[CacheManager] ai/confidence_engine.py return code: {res_conf.returncode}")
        if res_conf.stdout:
            print(f"[CacheManager] ai/confidence_engine.py stdout:\n{res_conf.stdout}")
        if res_conf.stderr:
            print(f"[CacheManager] ai/confidence_engine.py stderr:\n{res_conf.stderr}")
        if res_conf.returncode != 0:
            print(f"[CacheManager] Warning: ai/confidence_engine.py exited with non-zero code {res_conf.returncode}")


def regenerate_forecast():
    """
    Complete regeneration pipeline:
    1. Fetch fresh Open-Meteo forecasts for all 45 cities.
    2. Fetch all four models (ECMWF, GFS, ICON, GEM).
    3. Run existing preprocessing.
    4. Run existing adaptive weighting.
    5. Generate new blended_forecast.csv.
    6. Save metadata.json for caching.
    """
    with _refresh_lock:
        # Check again inside lock
        if is_cache_fresh():
            print("[CacheManager] Cache is already fresh (verified inside lock).")
            return load_metadata() or {
                "last_updated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                "cities": 45,
                "models": 4
            }

        print("[CacheManager] Starting forecast regeneration pipeline...")
        cities_df = pd.read_csv(CITIES_CSV)
        city_count = len(cities_df)
        model_count = len(MODELS_API)

        # 1 & 2: Fetch Open-Meteo
        df_raw = fetch_open_meteo_forecasts(cities_df)

        # 3: Preprocess
        run_preprocessing(df_raw)

        # 4 & 5: Adaptive Weighting & Blended Forecast
        run_adaptive_weighting()

        # 6: Save metadata
        timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        metadata = {
            "last_updated": timestamp,
            "cities": city_count,
            "models": model_count,
            "city_count": city_count,
            "model_count": model_count
        }
        save_metadata(metadata)
        print(f"[CacheManager] Auto-refresh complete at {timestamp}!")
        return metadata


def ensure_fresh_forecast(force=False):
    """
    Ensures that blended_forecast.csv is fresh (from today).
    If fresh and not forced, does nothing.
    Otherwise, regenerates.
    """
    if force or not is_cache_fresh():
        print("[CacheManager] Forecast data needs refresh -> regenerating...")
        return regenerate_forecast()
    else:
        print("[CacheManager] Existing forecast is fresh for today. Using cached forecast.")
        meta = load_metadata()
        if not meta:
            meta = {
                "last_updated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
                "cities": 45,
                "models": 4,
                "city_count": 45,
                "model_count": 4
            }
            save_metadata(meta)
        return meta
