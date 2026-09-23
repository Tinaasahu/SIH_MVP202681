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
    "forecast_current.csv": "data/forecast_current.csv"
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
        print(f"\n[TIMEZONE PROBLEM DETECTED] Cities with unexpected peak hour: {out_of_bounds}")
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


if __name__ == "__main__":
    main()
