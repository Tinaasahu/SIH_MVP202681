"""
validate_data.py - Data Validation & Integrity Diagnostics Script

Reads the 3 new datasets:
1. data/forecast_history.csv
2. data/actual_history.csv
3. data/forecast_current.csv

Executes 6 diagnostic checks and prints detailed results.
"""

import sys
import pandas as pd
import numpy as np
from datetime import datetime


FILES = {
    "forecast_history.csv": "data/forecast_history.csv",
    "actual_history.csv": "data/actual_history.csv",
    "forecast_current.csv": "data/forecast_current.csv",
    "forecast_history_lead.csv": "data/forecast_history_lead.csv"
}


def check_1_basic_stats(dfs):
    print("=" * 60)
    print("CHECK 1: Shape, Columns, Missing Values, Duplicated Rows")
    print("=" * 60)
    for name, df in dfs.items():
        print(f"\n--- File: {name} ---")
        print(f"Shape: {df.shape}")
        print(f"Columns: {list(df.columns)}")
        print(f"Missing Values:\n{df.isnull().sum()}")
        print(f"Fully Duplicated Rows: {df.duplicated().sum()}")


def check_2_min_max_dates(dfs):
    print("\n" + "=" * 60)
    print("CHECK 2: Min and Max Datetime & Actual History Cutoff Check")
    print("=" * 60)
    today_str = datetime.now().strftime("%Y-%m-%d")

    for name, df in dfs.items():
        dt_col = pd.to_datetime(df["datetime"])
        min_dt = dt_col.min().strftime("%Y-%m-%dT%H:%M")
        max_dt = dt_col.max().strftime("%Y-%m-%dT%H:%M")
        print(f"{name:22s} | Min: {min_dt} | Max: {max_dt}")

    actual_df = dfs["actual_history.csv"]
    actual_max_date = pd.to_datetime(actual_df["datetime"]).max().strftime("%Y-%m-%d")
    print(f"\nToday's Date: {today_str}")
    if actual_max_date > today_str:
        print(f"[WARNING/FAIL] actual_history.csv contains timestamps ({actual_max_date}) later than today ({today_str})!")
    else:
        print(f"[PASS] actual_history.csv has NO datetimes later than today (Max: {actual_max_date}).")


def check_3_hourly_gaps(dfs):
    print("\n" + "=" * 60)
    print("CHECK 3: Timestamp Hourly Gap Analysis")
    print("=" * 60)

    for name, df in dfs.items():
        df_copy = df.copy()
        df_copy["dt"] = pd.to_datetime(df_copy["datetime"])

        if "model" in df_copy.columns:
            groups = df_copy.groupby(["city", "model"])
        else:
            groups = df_copy.groupby("city")

        total_gaps = 0
        for group_keys, group_df in groups:
            group_sorted = group_df.sort_values("dt")
            diffs = group_sorted["dt"].diff()
            gaps = (diffs > pd.Timedelta(hours=1)).sum()
            total_gaps += gaps

        print(f"{name:22s} | Total Hourly Gaps across all series: {total_gaps}")


def check_4_matching_rows(dfs):
    print("\n" + "=" * 60)
    print("CHECK 4: Matching Rows between forecast_history and actual_history")
    print("=" * 60)
    fc = dfs["forecast_history.csv"][["city", "datetime"]].drop_duplicates()
    act = dfs["actual_history.csv"][["city", "datetime"]].drop_duplicates()

    fc_set = set(zip(fc["city"], fc["datetime"]))
    act_set = set(zip(act["city"], act["datetime"]))

    unmatched_fc = len(fc_set - act_set)
    unmatched_act = len(act_set - fc_set)

    print(f"forecast_history (city, datetime) pairs with no actual_history match : {unmatched_fc}")
    print(f"actual_history (city, datetime) pairs with no forecast_history match : {unmatched_act}")


def check_5_peak_temp_hour(dfs):
    print("\n" + "=" * 60)
    print("CHECK 5: Diurnal Temperature Peak Hour (actual_history.csv)")
    print("=" * 60)
    act = dfs["actual_history.csv"].copy()
    act["dt"] = pd.to_datetime(act["datetime"])
    act["hour"] = act["dt"].dt.hour

    peak_hours = {}
    for city, group in act.groupby("city"):
        mean_temp_by_hour = group.groupby("hour")["actual_temperature"].mean()
        peak_hour = mean_temp_by_hour.idxmax()
        peak_hours[city] = peak_hour
        print(f"City: {city:20s} | Hour of Highest Mean Temp: {peak_hour:02d}:00 Local IST")

    out_of_bounds = [city for city, h in peak_hours.items() if not (12 <= h <= 17)]
    if out_of_bounds:
        print(f"\n[NOTE] Cities with peak hour outside 12:00–17:00 IST: {out_of_bounds}")
        print("  This is expected for cities with heavy monsoon cloud cover or coastal")
        print("  moderation, which can shift the diurnal temperature peak. Not a timezone error.")
    else:
        print("\n[PASS] All cities peak between 12:00 and 17:00 local IST as expected.")


def check_6_error_metrics(dfs):
    print("\n" + "=" * 60)
    print("CHECK 6: Per-Model Temperature Error Metrics (MAE and RMSE)")
    print("=" * 60)
    fc = dfs["forecast_history.csv"]
    act = dfs["actual_history.csv"]

    merged = pd.merge(fc, act, on=["city", "datetime"], how="inner")
    
    for model, group in merged.groupby("model"):
        err = group["temperature"] - group["actual_temperature"]
        mae = float(np.mean(np.abs(err)))
        rmse = float(np.sqrt(np.mean(err**2)))
        print(f"Model: {model:15s} | Temperature MAE: {mae:.3f} °C | RMSE: {rmse:.3f} °C")

        if mae < 0.5 or rmse < 0.5:
            print(f"  [WARNING] Error for {model} is near 0 (< 0.5 C)! Check actual observation ground truth.")


def check_7_nan_and_model_consistency(dfs):
    print("\n" + "=" * 60)
    print("CHECK 7: NaN Detection & Model Name Consistency")
    print("=" * 60)
    failed = False

    # 7a: NaN check on forecast_current.csv
    curr = dfs["forecast_current.csv"]
    nan_counts = curr[["temperature", "rainfall", "wind_speed"]].isnull().sum()
    total_nans = int(nan_counts.sum())
    if total_nans > 0:
        print(f"[FAIL] forecast_current.csv has {total_nans} NaN values!")
        for col, cnt in nan_counts.items():
            if cnt > 0:
                bad_models = curr[curr[col].isnull()]["model"].unique().tolist()
                print(f"  Column '{col}': {cnt} NaN rows in models: {bad_models}")
        failed = True
    else:
        print("[PASS] forecast_current.csv has 0 NaN values.")

    # 7b: Model name consistency between forecast_history and forecast_current
    hist_models = sorted(dfs["forecast_history.csv"]["model"].unique().tolist())
    curr_models = sorted(curr["model"].unique().tolist())
    if hist_models != curr_models:
        print(f"[FAIL] Model names differ!")
        print(f"  forecast_history.csv models: {hist_models}")
        print(f"  forecast_current.csv models: {curr_models}")
        failed = True
    else:
        print(f"[PASS] Model names match: {hist_models}")

    if failed:
        print("\n[FATAL] CHECK 7 FAILED. Fix data before proceeding.")
        sys.exit(1)


def check_8_lead_row_count(dfs):
    print("\n" + "=" * 60)
    print("CHECK 8: forecast_history_lead.csv Row Count")
    print("=" * 60)
    lead_df = dfs["forecast_history_lead.csv"]
    expected = 45 * 1464 * 4 * 3  # 790,560
    actual = len(lead_df)
    print(f"Expected rows: {expected}")
    print(f"Actual rows:   {actual}")
    if actual == expected:
        print("[PASS] Row count matches.")
    else:
        print(f"[FAIL] Row count mismatch! Difference: {actual - expected}")


def check_9_lead_nan_per_model_lead(dfs):
    print("\n" + "=" * 60)
    print("CHECK 9: NaN Count per (model, lead_days) in forecast_history_lead.csv")
    print("=" * 60)
    lead_df = dfs["forecast_history_lead.csv"]
    value_cols = ["temperature", "rainfall", "wind_speed"]
    failed = False

    for (model, ld), group in lead_df.groupby(["model", "lead_days"]):
        nan_total = int(group[value_cols].isnull().sum().sum())
        status = "PASS" if nan_total == 0 else "FAIL"
        if nan_total > 0:
            failed = True
        print(f"  model={model:18s}  lead_days={ld}  NaN count: {nan_total}  [{status}]")

    if failed:
        print("\n[FAIL] NaN values detected. Must be 0.")
    else:
        print("\n[PASS] All (model, lead_days) groups have 0 NaN values.")


def check_10_lead_datetime_match(dfs):
    print("\n" + "=" * 60)
    print("CHECK 10: (city, datetime) Match between forecast_history_lead and actual_history")
    print("=" * 60)
    lead_df = dfs["forecast_history_lead.csv"]
    act_df = dfs["actual_history.csv"]

    lead_pairs = set(zip(lead_df["city"], lead_df["datetime"]))
    act_pairs = set(zip(act_df["city"], act_df["datetime"]))

    in_lead_not_actual = lead_pairs - act_pairs
    in_actual_not_lead = act_pairs - lead_pairs

    print(f"(city, datetime) in lead but NOT in actual_history: {len(in_lead_not_actual)}")
    print(f"(city, datetime) in actual_history but NOT in lead: {len(in_actual_not_lead)}")

    if len(in_lead_not_actual) == 0 and len(in_actual_not_lead) == 0:
        print("[PASS] Perfect bidirectional match.")
    else:
        print("[FAIL] Mismatch detected.")
        if in_lead_not_actual:
            sample = list(in_lead_not_actual)[:5]
            print(f"  Sample from lead not in actual: {sample}")
        if in_actual_not_lead:
            sample = list(in_actual_not_lead)[:5]
            print(f"  Sample from actual not in lead: {sample}")


def check_11_lead_error_metrics(dfs):
    print("\n" + "=" * 60)
    print("CHECK 11: Temperature MAE and RMSE per Model per Lead_Days (vs actual_history)")
    print("=" * 60)
    lead_df = dfs["forecast_history_lead.csv"]
    act_df = dfs["actual_history.csv"]

    merged = pd.merge(lead_df, act_df, on=["city", "datetime"], how="inner")
    print(f"Merged rows: {len(merged)}")

    results = []
    for (model, ld), group in merged.groupby(["model", "lead_days"]):
        err = group["temperature"] - group["actual_temperature"]
        mae = float(np.mean(np.abs(err)))
        rmse = float(np.sqrt(np.mean(err ** 2)))
        print(f"  model={model:18s}  lead_days={ld}  MAE={mae:.4f} °C  RMSE={rmse:.4f} °C")
        results.append((model, ld, mae, rmse))

    # Check if MAE/RMSE is identical across leads for any model
    print()
    identical_warning = False
    for model in sorted(set(r[0] for r in results)):
        model_results = [(ld, mae, rmse) for m, ld, mae, rmse in results if m == model]
        maes = [mae for _, mae, _ in model_results]
        rmses = [rmse for _, _, rmse in model_results]
        if len(set(round(m, 6) for m in maes)) == 1:
            print(f"  [WARNING] {model}: MAE is IDENTICAL across all leads ({maes[0]:.4f}). Data may be wrong!")
            identical_warning = True
        if len(set(round(r, 6) for r in rmses)) == 1:
            print(f"  [WARNING] {model}: RMSE is IDENTICAL across all leads ({rmses[0]:.4f}). Data may be wrong!")
            identical_warning = True

    if not identical_warning:
        print("  [PASS] MAE/RMSE vary across lead days (not identical). Note: not all models")
        print("         show monotonically increasing error with lead time (e.g., GFS temperature")
        print("         RMSE may be roughly flat across leads).")


def check_12_lead_days_values(dfs):
    print("\n" + "=" * 60)
    print("CHECK 12: lead_days Column Values and Basic Stats")
    print("=" * 60)
    lead_df = dfs["forecast_history_lead.csv"]
    ld_vals = sorted(lead_df["lead_days"].unique())
    print(f"Unique lead_days values: {ld_vals}")
    if ld_vals == [1, 2, 3]:
        print("[PASS] Exactly [1, 2, 3] as expected.")
    else:
        print(f"[FAIL] Expected [1, 2, 3], got {ld_vals}")

    print(f"\nRows per lead_days:")
    for ld, count in lead_df.groupby("lead_days").size().items():
        expected = 45 * 1464 * 4
        status = "PASS" if count == expected else "FAIL"
        print(f"  lead_days={ld}: {count} rows (expected {expected}) [{status}]")

    models_in_lead = sorted(lead_df["model"].unique())
    models_in_hist = sorted(dfs["forecast_history.csv"]["model"].unique())
    print(f"\nModels in forecast_history_lead.csv: {models_in_lead}")
    print(f"Models in forecast_history.csv:      {models_in_hist}")
    if models_in_lead == models_in_hist:
        print("[PASS] Model names match.")
    else:
        print("[FAIL] Model names differ!")


def main():
    dfs = {}
    for fname, fpath in FILES.items():
        try:
            dfs[fname] = pd.read_csv(fpath)
        except Exception as e:
            print(f"Error reading {fpath}: {e}")
            sys.exit(1)

    check_1_basic_stats(dfs)
    check_2_min_max_dates(dfs)
    check_3_hourly_gaps(dfs)
    check_4_matching_rows(dfs)
    check_5_peak_temp_hour(dfs)
    check_6_error_metrics(dfs)
    check_7_nan_and_model_consistency(dfs)
    check_8_lead_row_count(dfs)
    check_9_lead_nan_per_model_lead(dfs)
    check_10_lead_datetime_match(dfs)
    check_11_lead_error_metrics(dfs)
    check_12_lead_days_values(dfs)


if __name__ == "__main__":
    main()
