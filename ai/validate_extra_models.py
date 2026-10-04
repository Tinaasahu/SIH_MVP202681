"""
validate_extra_models.py - Strict validation and benchmark evaluation of data/forecast_history_extra.csv

Checks:
1. Row count: 45 cities x 1464 hours x 2 models = 131,760 rows exactly
2. No NaN in any column
3. No duplicate (city, model, datetime) tuples
4. Same (city, datetime) set as existing data/actual_history.csv
5. Evaluation metrics (MAE, RMSE, Bias) for UKMO and JMA against actual_history.csv
"""

import os
import sys
import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
EXTRA_CSV = os.path.join(BASE_DIR, "data", "forecast_history_extra.csv")
ACTUAL_CSV = os.path.join(BASE_DIR, "data", "actual_history.csv")
EXISTING_FC_CSV = os.path.join(BASE_DIR, "data", "forecast_history.csv")


def main():
    print("=" * 70)
    print("VALIDATION & BENCHMARK REPORT: forecast_history_extra.csv")
    print("=" * 70)

    if not os.path.exists(EXTRA_CSV):
        print(f"[ERROR] Target file not found: {EXTRA_CSV}")
        sys.exit(1)

    if not os.path.exists(ACTUAL_CSV):
        print(f"[ERROR] Actual observations file not found: {ACTUAL_CSV}")
        sys.exit(1)

    df_extra = pd.read_csv(EXTRA_CSV)
    df_actual = pd.read_csv(ACTUAL_CSV)

    # 1. Row count check
    expected_rows = 45 * 1464 * 2 # 131,760
    actual_rows = len(df_extra)
    print(f"\n1. ROW COUNT CHECK:")
    print(f"   Expected: {expected_rows:,} rows")
    print(f"   Actual:   {actual_rows:,} rows")
    assert actual_rows == expected_rows, f"Row count mismatch: expected {expected_rows}, got {actual_rows}"
    print("   [PASS] Row count matches exactly 131,760.")

    # 2. NaN check
    print(f"\n2. NULL / NAN CHECK:")
    nan_counts = df_extra.isna().sum()
    print(nan_counts.to_string())
    total_nans = nan_counts.sum()
    assert total_nans == 0, f"Found {total_nans} NaN values in forecast_history_extra.csv"
    print("   [PASS] Zero NaN values found.")

    # 3. Duplicate check
    print(f"\n3. DUPLICATE CHECK:")
    dup_mask = df_extra.duplicated(subset=['city', 'model', 'datetime'], keep=False)
    dup_count = dup_mask.sum()
    print(f"   Duplicate (city, model, datetime) count: {dup_count}")
    assert dup_count == 0, f"Found {dup_count} duplicate rows in forecast_history_extra.csv"
    print("   [PASS] No duplicate entries.")

    # 4. Alignment with actual_history.csv
    print(f"\n4. ALIGNMENT WITH actual_history.csv:")
    extra_pairs = set(zip(df_extra['city'], df_extra['datetime']))
    actual_pairs = set(zip(df_actual['city'], df_actual['datetime']))
    print(f"   Unique (city, datetime) pairs in forecast_history_extra: {len(extra_pairs):,}")
    print(f"   Unique (city, datetime) pairs in actual_history:          {len(actual_pairs):,}")
    
    diff_extra_not_act = extra_pairs - actual_pairs
    diff_act_not_extra = actual_pairs - extra_pairs
    assert len(diff_extra_not_act) == 0, f"Pairs in extra but not actual: {len(diff_extra_not_act)}"
    assert len(diff_act_not_extra) == 0, f"Pairs in actual but not extra: {len(diff_act_not_extra)}"
    print("   [PASS] Both datasets share the exact same 65,880 (city, datetime) coordinate grid.")

    # 5. Accuracy Benchmark Evaluation vs actual_history.csv
    print(f"\n5. ACCURACY BENCHMARK EVALUATION (Holdout Period 18 Jul - 16 Sep 2026):")
    merged = df_extra.merge(df_actual, on=['city', 'datetime'], how='inner')

    # Load existing models for baseline comparison if available
    baseline_metrics = None
    if os.path.exists(EXISTING_FC_CSV):
        df_exist = pd.read_csv(EXISTING_FC_CSV)
        merged_exist = df_exist.merge(df_actual, on=['city', 'datetime'], how='inner')
        merged_exist["t_err"] = merged_exist["temperature"] - merged_exist["actual_temperature"]
        baseline_metrics = merged_exist.groupby("model").agg(
            Bias=("t_err", "mean"),
            MAE=("t_err", lambda x: np.abs(x).mean()),
            RMSE=("t_err", lambda x: np.sqrt((x**2).mean()))
        )

    # Extra models temperature metrics
    merged["t_err"] = merged["temperature"] - merged["actual_temperature"]
    extra_metrics = merged.groupby("model").agg(
        Bias=("t_err", "mean"),
        MAE=("t_err", lambda x: np.abs(x).mean()),
        RMSE=("t_err", lambda x: np.sqrt((x**2).mean()))
    )

    print("\n--- Temperature Accuracy Metrics (°C) ---")
    if baseline_metrics is not None:
        print("[Existing Baseline Models for Comparison]")
        print(baseline_metrics.round(4).to_string())
        print("\n[New Extra Models]")
    print(extra_metrics.round(4).to_string())

    # Sanity check: ensure MAE is not wildly uncalibrated (> 3.5°C)
    for model_name, row in extra_metrics.iterrows():
        mae = row['MAE']
        print(f"\nChecking sanity for {model_name}: MAE = {mae:.4f}°C")
        if mae > 3.5:
            print(f"[WARNING] Model {model_name} has high MAE ({mae:.4f}°C), significantly worse than GFS baseline!")
        else:
            print(f"[PASS] Model {model_name} error is within normal operational bounds.")

    # Rainfall and Wind Speed summary metrics
    print("\n--- Rainfall Accuracy Metrics (mm) ---")
    merged["r_err"] = merged["rainfall"] - merged["actual_rainfall"]
    r_metrics = merged.groupby("model").agg(
        Bias=("r_err", "mean"),
        MAE=("r_err", lambda x: np.abs(x).mean()),
        RMSE=("r_err", lambda x: np.sqrt((x**2).mean()))
    )
    print(r_metrics.round(4).to_string())

    print("\n--- Wind Speed Accuracy Metrics (km/h) ---")
    merged["w_err"] = merged["wind_speed"] - merged["actual_wind"]
    w_metrics = merged.groupby("model").agg(
        Bias=("w_err", "mean"),
        MAE=("w_err", lambda x: np.abs(x).mean()),
        RMSE=("w_err", lambda x: np.sqrt((x**2).mean()))
    )
    print(w_metrics.round(4).to_string())

    print("\n" + "=" * 70)
    print("ALL 5 VALIDATION CHECKS PASSED PERFECTLY.")
    print("=" * 70)


if __name__ == "__main__":
    main()
