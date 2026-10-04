"""
merge_extra_models.py - Union forecast_history.csv and forecast_history_extra.csv into forecast_history_6model.csv

Reads:
- data/forecast_history.csv (ECMWF, GFS, ICON, GEM)
- data/forecast_history_extra.csv (UKMO, JMA)

Writes:
- data/forecast_history_6model.csv (All 6 NWP models)

Never modifies or overwrites either input file.
"""

import os
import sys
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
INPUT1_CSV = os.path.join(BASE_DIR, "data", "forecast_history.csv")
INPUT2_CSV = os.path.join(BASE_DIR, "data", "forecast_history_extra.csv")
OUTPUT_CSV = os.path.join(BASE_DIR, "data", "forecast_history_6model.csv")

EXPECTED_COLS = ["city", "model", "datetime", "temperature", "rainfall", "wind_speed"]
EXPECTED_MODELS_1 = {"ecmwf_ifs025", "gfs_seamless", "icon_seamless", "gem_seamless"}
EXPECTED_MODELS_2 = {"ukmo_seamless", "jma_seamless"}


def main():
    print("=" * 70)
    print("MERGING HISTORICAL FORECAST DATASETS (4-MODEL + 2-MODEL -> 6-MODEL)")
    print("=" * 70)

    # 1. Existence check
    if not os.path.exists(INPUT1_CSV):
        print(f"[FATAL] Input file 1 not found: {INPUT1_CSV}")
        sys.exit(1)
    if not os.path.exists(INPUT2_CSV):
        print(f"[FATAL] Input file 2 not found: {INPUT2_CSV}")
        sys.exit(1)

    print(f"Loading {INPUT1_CSV}...")
    df1 = pd.read_csv(INPUT1_CSV)
    print(f"Loaded input 1: {len(df1):,} rows")

    print(f"Loading {INPUT2_CSV}...")
    df2 = pd.read_csv(INPUT2_CSV)
    print(f"Loaded input 2: {len(df2):,} rows")

    # 2. Schema check
    print("\n1. Verifying column schemas...")
    if list(df1.columns) != EXPECTED_COLS:
        print(f"[FATAL] Column mismatch in input 1! Expected: {EXPECTED_COLS}, got: {list(df1.columns)}")
        sys.exit(1)
    if list(df2.columns) != EXPECTED_COLS:
        print(f"[FATAL] Column mismatch in input 2! Expected: {EXPECTED_COLS}, got: {list(df2.columns)}")
        sys.exit(1)
    print("   [PASS] Both files have identical column names and order.")

    # 3. Model set check
    print("\n2. Verifying model sets...")
    models1 = set(df1["model"].unique())
    models2 = set(df2["model"].unique())

    if models1 != EXPECTED_MODELS_1:
        print(f"[FATAL] Unexpected models in input 1! Expected: {EXPECTED_MODELS_1}, got: {models1}")
        sys.exit(1)
    if models2 != EXPECTED_MODELS_2:
        print(f"[FATAL] Unexpected models in input 2! Expected: {EXPECTED_MODELS_2}, got: {models2}")
        sys.exit(1)

    overlap = models1.intersection(models2)
    if len(overlap) > 0:
        print(f"[FATAL] Model overlap detected between source files: {overlap}")
        sys.exit(1)
    print(f"   [PASS] Input 1 models: {sorted(models1)}")
    print(f"   [PASS] Input 2 models: {sorted(models2)}")
    print("   [PASS] Zero overlap between models.")

    # 4. Date range check
    print("\n3. Verifying date ranges...")
    min_dt1, max_dt1 = df1["datetime"].min(), df1["datetime"].max()
    min_dt2, max_dt2 = df2["datetime"].min(), df2["datetime"].max()

    print(f"   Input 1 range: {min_dt1} to {max_dt1}")
    print(f"   Input 2 range: {min_dt2} to {max_dt2}")
    if min_dt1 != min_dt2 or max_dt1 != max_dt2:
        print(f"[FATAL] Date range mismatch! File 1: ({min_dt1}, {max_dt1}) vs File 2: ({min_dt2}, {max_dt2})")
        sys.exit(1)
    print("   [PASS] Date ranges match identically (18 Jul - 16 Sep 2026).")

    # 5. Concatenation and Sorting
    print("\n4. Concatenating and sorting records...")
    df_merged = pd.concat([df1, df2], ignore_index=True)
    df_merged.sort_values(by=["city", "model", "datetime"], inplace=True)
    df_merged.reset_index(drop=True, inplace=True)

    # 6. Strict Assertions
    print("\n5. Running strict assertions...")
    expected_rows = len(df1) + len(df2)
    actual_rows = len(df_merged)
    print(f"   Total rows: {actual_rows:,} (Expected: {expected_rows:,})")
    assert actual_rows == expected_rows == 395280, f"Row count error: expected 395,280, got {actual_rows}"

    unique_models = sorted(df_merged["model"].unique().tolist())
    print(f"   Unique models count: {len(unique_models)} (Expected: 6)")
    assert len(unique_models) == 6, f"Expected 6 models, got {len(unique_models)}"

    unique_cities = df_merged["city"].nunique()
    print(f"   Unique cities count: {unique_cities} (Expected: 45)")
    assert unique_cities == 45, f"Expected 45 cities, got {unique_cities}"

    dup_count = df_merged.duplicated(subset=["city", "model", "datetime"]).sum()
    print(f"   Duplicate tuples: {dup_count} (Expected: 0)")
    assert dup_count == 0, f"Found {dup_count} duplicate (city, model, datetime) rows"

    nan_count = df_merged.isna().sum().sum()
    print(f"   NaN values count: {nan_count} (Expected: 0)")
    assert nan_count == 0, f"Found {nan_count} NaN values in merged dataset"

    print("   [PASS] All assertions passed successfully.")

    # 7. Write to destination file
    df_merged.to_csv(OUTPUT_CSV, index=False)
    print(f"\n[Success] Saved merged dataset to: {OUTPUT_CSV}")

    # 8. Print Final Summary Table
    print("\n" + "=" * 70)
    print("FINAL 6-MODEL DATASET SUMMARY")
    print("=" * 70)
    print(f"Date Range:    {df_merged['datetime'].min()} to {df_merged['datetime'].max()}")
    print(f"Total Rows:    {len(df_merged):,}")
    print(f"Total Cities:  {unique_cities}")
    print(f"All Models:    {', '.join(unique_models)}\n")
    print("Row Count Per Model (Expected: 65,880 each):")
    counts = df_merged["model"].value_counts().sort_index()
    for m, c in counts.items():
        print(f"  - {m:<15}: {c:,} rows {'[OK]' if c == 65880 else '[FAIL]'}")
        assert c == 65880, f"Model {m} has {c} rows, expected 65,880"
    print("=" * 70)


if __name__ == "__main__":
    main()
