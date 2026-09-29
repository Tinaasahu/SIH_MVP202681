import os
import json
from datetime import datetime, timedelta
import pandas as pd


def run_healthcheck():
    failures = []
    print("=" * 60)
    print("           NABHDRISHTI AI PIPELINE HEALTHCHECK")
    print("=" * 60)

    # 1. Metadata freshness check
    meta_path = os.path.join("outputs", "metadata.json")
    if not os.path.exists(meta_path):
        failures.append("Check 1: metadata.json does not exist")
        print("[FAIL] Check 1: outputs/metadata.json not found")
    else:
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            last_updated_str = meta.get("last_updated", "")
            last_updated = datetime.fromisoformat(last_updated_str)
            if last_updated.tzinfo is not None:
                now_cmp = datetime.now(last_updated.tzinfo)
            else:
                now_cmp = datetime.now()
            hours_old = (now_cmp - last_updated).total_seconds() / 3600.0
            print(f"[INFO] Metadata last_updated: {last_updated_str} ({hours_old:.2f} hours old)")
            if hours_old > 12.0:
                failures.append(f"Check 1: metadata is {hours_old:.2f}h old (> 12h)")
                print(f"[FAIL] Check 1: Metadata is older than 12 hours ({hours_old:.2f}h)")
            else:
                print(f"[PASS] Check 1: Metadata freshness ({hours_old:.2f}h <= 12h)")
        except Exception as e:
            failures.append(f"Check 1: Failed to read/parse metadata.json ({e})")
            print(f"[FAIL] Check 1: {e}")

    # 2. Hybrid vs Blended RF temperature difference check
    hybrid_path = os.path.join("outputs", "hybrid_forecast.csv")
    blended_path = os.path.join("outputs", "blended_forecast.csv")
    df_hybrid = None
    if not os.path.exists(hybrid_path) or not os.path.exists(blended_path):
        failures.append("Check 2: hybrid_forecast.csv or blended_forecast.csv not found")
        print("[FAIL] Check 2: Missing forecast CSV files")
    else:
        try:
            df_hybrid = pd.read_csv(hybrid_path)
            df_blended = pd.read_csv(blended_path)
            merged = pd.merge(
                df_hybrid[["city", "datetime", "temperature"]],
                df_blended[["city", "datetime", "temperature"]],
                on=["city", "datetime"],
                suffixes=("_hybrid", "_blended")
            )
            mean_diff = float((merged["temperature_hybrid"] - merged["temperature_blended"]).abs().mean())
            print(f"[INFO] Hybrid vs Blended temperature mean absolute difference: {mean_diff:.4f}")
            if mean_diff == 0.0 or pd.isna(mean_diff):
                failures.append("Check 2: temperature mean absolute difference is 0.0 (RF correction not running)")
                print("[FAIL] Check 2: Mean absolute difference is exactly 0.0 (RF correction inactive)")
            else:
                print(f"[PASS] Check 2: RF correction active (mean absolute difference = {mean_diff:.4f} > 0)")
        except Exception as e:
            failures.append(f"Check 2: Error comparing forecast temperatures ({e})")
            print(f"[FAIL] Check 2: {e}")

    # 3. Forecast start datetime vs current date
    if df_hybrid is None and os.path.exists(hybrid_path):
        try:
            df_hybrid = pd.read_csv(hybrid_path)
        except Exception:
            pass

    if df_hybrid is None:
        failures.append("Check 3: Unable to load hybrid_forecast.csv for date check")
        print("[FAIL] Check 3: hybrid_forecast.csv unavailable")
    else:
        try:
            dt_series = pd.to_datetime(df_hybrid["datetime"])
            min_dt = dt_series.min()
            now = datetime.now()
            days_ago = (now - min_dt).total_seconds() / 86400.0
            print(f"[INFO] Forecast min datetime: {min_dt} (now: {now.strftime('%Y-%m-%d %H:%M:%S')}, {days_ago:.2f} days ago)")
            if min_dt < now - timedelta(days=1):
                failures.append(f"Check 3: Forecast start {min_dt} is > 1 day in the past ({days_ago:.2f} days)")
                print(f"[FAIL] Check 3: Forecast start {min_dt} is more than 1 day in the past")
            else:
                print(f"[PASS] Check 3: Forecast horizon current ({days_ago:.2f} days ago <= 1 day)")
        except Exception as e:
            failures.append(f"Check 3: Error evaluating forecast datetimes ({e})")
            print(f"[FAIL] Check 3: {e}")

    # 4. RF model joblib artifacts check
    model_vars = ["temperature", "rainfall", "wind_speed"]
    models_ok = True
    for var in model_vars:
        model_file = os.path.join("outputs", "models", f"rf_{var}.joblib")
        if not os.path.exists(model_file):
            models_ok = False
            failures.append(f"Check 4: Model file outputs/models/rf_{var}.joblib missing")
            print(f"[FAIL] Check 4: outputs/models/rf_{var}.joblib not found")
        else:
            size = os.path.getsize(model_file)
            if size == 0:
                models_ok = False
                failures.append(f"Check 4: Model file outputs/models/rf_{var}.joblib is empty")
                print(f"[FAIL] Check 4: outputs/models/rf_{var}.joblib is 0 bytes")
            else:
                print(f"[INFO] Model rf_{var}.joblib: {size / (1024 * 1024):.2f} MB")
    if models_ok:
        print("[PASS] Check 4: All 3 Random Forest model artifacts present and non-empty")

    # 5. Overlap check for extreme_alerts.csv and confidence_scores.csv
    if df_hybrid is None:
        failures.append("Check 5: Cannot verify overlap without hybrid_forecast.csv")
        print("[FAIL] Check 5: hybrid_forecast.csv not loaded")
    else:
        try:
            h_start = pd.to_datetime(df_hybrid["datetime"]).min()
            h_end = pd.to_datetime(df_hybrid["datetime"]).max()

            for name in ["extreme_alerts.csv", "confidence_scores.csv"]:
                f_path = os.path.join("outputs", name)
                if not os.path.exists(f_path):
                    failures.append(f"Check 5: outputs/{name} does not exist")
                    print(f"[FAIL] Check 5: outputs/{name} not found")
                    continue

                df_sub = pd.read_csv(f_path)
                if df_sub.empty or "datetime" not in df_sub.columns:
                    failures.append(f"Check 5: outputs/{name} is empty or missing datetime column")
                    print(f"[FAIL] Check 5: outputs/{name} empty or missing datetime")
                    continue

                sub_start = pd.to_datetime(df_sub["datetime"]).min()
                sub_end = pd.to_datetime(df_sub["datetime"]).max()
                overlaps = max(h_start, sub_start) <= min(h_end, sub_end)
                print(f"[INFO] {name} range: {sub_start} to {sub_end} | Hybrid range: {h_start} to {h_end}")

                if not overlaps:
                    failures.append(f"Check 5: outputs/{name} does not overlap with hybrid forecast range")
                    print(f"[FAIL] Check 5: outputs/{name} date range does not overlap")
                else:
                    print(f"[PASS] Check 5: outputs/{name} overlaps with hybrid forecast date range")
        except Exception as e:
            failures.append(f"Check 5: Error evaluating downstream overlap ({e})")
            print(f"[FAIL] Check 5: {e}")

    # Final summary line
    print("=" * 60)
    if not failures:
        print("ALL CHECKS PASSED")
        return 0
    else:
        print(f"FAILED CHECKS ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(run_healthcheck())
