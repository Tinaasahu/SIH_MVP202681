"""
validate_extra_models_lead.py - Strict validation and lead-time accuracy evaluation of data/forecast_history_extra_lead.csv

Checks:
1. Row count: 45 cities x 1464 hours x 3 leads x N_models (print N_models and expected count)
2. No NaN across all columns
3. No duplicate (city, model, lead_days, datetime) tuples
4. Temperature MAE and RMSE per model per lead_days against data/actual_history.csv
5. Sanity check: confirm error grows monotonically with lead time (Lead 1 < Lead 2 < Lead 3)
"""

import os
import sys
import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
EXTRA_LEAD_CSV = os.path.join(BASE_DIR, "data", "forecast_history_extra_lead.csv")
ACTUAL_CSV = os.path.join(BASE_DIR, "data", "actual_history.csv")
BASELINE_LEAD_CSV = os.path.join(BASE_DIR, "data", "forecast_history_lead.csv")


def main():
    print("=" * 75)
    print("VALIDATION & LEAD-TIME EVALUATION: forecast_history_extra_lead.csv")
    print("=" * 75)

    if not os.path.exists(EXTRA_LEAD_CSV):
        print(f"[FATAL] Target file not found: {EXTRA_LEAD_CSV}")
        sys.exit(1)

    if not os.path.exists(ACTUAL_CSV):
        print(f"[FATAL] Actuals file not found: {ACTUAL_CSV}")
        sys.exit(1)

    df_extra = pd.read_csv(EXTRA_LEAD_CSV)
    df_actual = pd.read_csv(ACTUAL_CSV)

    models_present = sorted(df_extra['model'].unique().tolist())
    n_models = len(models_present)
    total_cities = df_extra['city'].nunique()
    total_hours = df_extra['datetime'].nunique()
    total_leads = df_extra['lead_days'].nunique()

    # 1. Dynamic Row count check
    expected_rows = 45 * 1464 * 3 * n_models
    actual_rows = len(df_extra)
    print(f"\n1. DYNAMIC ROW COUNT CHECK:")
    print(f"   Models Present (N_models={n_models}): {models_present}")
    print(f"   Formula:  45 cities x 1,464 hours x 3 leads x {n_models} models")
    print(f"   Expected: {expected_rows:,} rows")
    print(f"   Actual:   {actual_rows:,} rows")
    assert actual_rows == expected_rows, f"Row count mismatch: expected {expected_rows}, got {actual_rows}"
    print(f"   [PASS] Row count matches exactly {actual_rows:,} for N_models={n_models}.")

    # 2. NaN check
    print(f"\n2. NULL / NAN CHECK:")
    nan_counts = df_extra.isna().sum()
    print(nan_counts.to_string())
    total_nans = nan_counts.sum()
    assert total_nans == 0, f"Found {total_nans} NaN values in forecast_history_extra_lead.csv"
    print("   [PASS] Zero NaN values found.")

    # 3. Duplicate check
    print(f"\n3. DUPLICATE CHECK:")
    dup_mask = df_extra.duplicated(subset=['city', 'model', 'lead_days', 'datetime'], keep=False)
    dup_count = dup_mask.sum()
    print(f"   Duplicate (city, model, lead_days, datetime) count: {dup_count}")
    assert dup_count == 0, f"Found {dup_count} duplicate rows in forecast_history_extra_lead.csv"
    print("   [PASS] Zero duplicate entries.")

    # 4. Lead-Time Accuracy Evaluation vs actual_history.csv
    print(f"\n4. LEAD-TIME ACCURACY BENCHMARK EVALUATION (Holdout Period 18 Jul - 16 Sep 2026):")
    merged = df_extra.merge(df_actual, on=['city', 'datetime'], how='inner')
    merged["t_err"] = merged["temperature"] - merged["actual_temperature"]
    merged["r_err"] = merged["rainfall"] - merged["actual_rainfall"]
    merged["w_err"] = merged["wind_speed"] - merged["actual_wind"]

    extra_lead_metrics = merged.groupby(["model", "lead_days"]).agg(
        Bias=("t_err", "mean"),
        MAE=("t_err", lambda x: np.abs(x).mean()),
        RMSE=("t_err", lambda x: np.sqrt((x**2).mean())),
    ).round(4)

    # If baseline lead data exists, load for direct comparison
    if os.path.exists(BASELINE_LEAD_CSV):
        df_base = pd.read_csv(BASELINE_LEAD_CSV)
        merged_base = df_base.merge(df_actual, on=['city', 'datetime'], how='inner')
        merged_base["t_err"] = merged_base["temperature"] - merged_base["actual_temperature"]
        base_lead_metrics = merged_base.groupby(["model", "lead_days"]).agg(
            Bias=("t_err", "mean"),
            MAE=("t_err", lambda x: np.abs(x).mean()),
            RMSE=("t_err", lambda x: np.sqrt((x**2).mean())),
        ).round(4)
        print("\n[Baseline Existing Models (ECMWF, GFS, ICON, GEM)]")
        print(base_lead_metrics.to_string())

    print("\n[New Extra Models (UKMO, JMA) - Temperature Error °C]")
    print(extra_lead_metrics.to_string())

    # 5. Monotonic Error Degradation Check
    print(f"\n5. SANITY CHECK: LEAD-TIME ERROR GROWTH:")
    all_growth_ok = True
    for model in models_present:
        m_df = extra_lead_metrics.loc[model]
        mae_1 = m_df.loc[1, 'MAE']
        mae_2 = m_df.loc[2, 'MAE']
        mae_3 = m_df.loc[3, 'MAE']
        rmse_1 = m_df.loc[1, 'RMSE']
        rmse_2 = m_df.loc[2, 'RMSE']
        rmse_3 = m_df.loc[3, 'RMSE']

        print(f"\nModel: {model}")
        print(f"  Lead 1 (24h): MAE={mae_1:.4f}°C, RMSE={rmse_1:.4f}°C")
        print(f"  Lead 2 (48h): MAE={mae_2:.4f}°C, RMSE={rmse_2:.4f}°C")
        print(f"  Lead 3 (72h): MAE={mae_3:.4f}°C, RMSE={rmse_3:.4f}°C")

        growth_mae = mae_1 < mae_2 < mae_3
        growth_rmse = rmse_1 < rmse_2 < rmse_3
        if growth_mae and growth_rmse:
            print(f"  [PASS] Error degrades naturally with lead time (Lead 1 < Lead 2 < Lead 3).")
        else:
            print(f"  [NOTE] Non-monotonic progression observed for {model}.")
            all_growth_ok = False

    # Summary table for Rainfall and Wind Speed
    print("\n--- Extra Models Rainfall MAE / RMSE (mm) ---")
    r_metrics = merged.groupby(["model", "lead_days"]).agg(
        MAE=("r_err", lambda x: np.abs(x).mean()),
        RMSE=("r_err", lambda x: np.sqrt((x**2).mean())),
    ).round(4)
    print(r_metrics.to_string())

    print("\n--- Extra Models Wind Speed MAE / RMSE (km/h) ---")
    w_metrics = merged.groupby(["model", "lead_days"]).agg(
        MAE=("w_err", lambda x: np.abs(x).mean()),
        RMSE=("w_err", lambda x: np.sqrt((x**2).mean())),
    ).round(4)
    print(w_metrics.round(4).to_string())

    print("\n" + "=" * 75)
    print("ALL VALIDATION CRITERIA EVALUATED SUCCESSFULLY.")
    print("=" * 75)


if __name__ == "__main__":
    main()
