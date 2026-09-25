import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path

# Resolve base project directory
base_dir = Path(__file__).resolve().parent.parent

# File paths
files = {
    "forecast_history": base_dir / "data" / "forecast_history.csv",
    "actual_history": base_dir / "data" / "actual_history.csv",
    "forecast_current": base_dir / "data" / "forecast_current.csv",
    "actual_weather": base_dir / "data" / "actual_weather.csv",
    "all_models_clean": base_dir / "data" / "processed" / "all_models_clean.csv",
}

# Load datasets safely with existence check
dfs = {}
for key, filepath in files.items():
    if not filepath.exists():
        print(f"[{key}] FILE NOT FOUND: {filepath}")
    else:
        dfs[key] = pd.read_csv(filepath)

# =============================================================================
# SECTION 1: Models and Unique City Lists Comparison
# =============================================================================
print("=" * 70)
print("SECTION 1: Models and Unique Cities Comparison")
print("=" * 70)

sec1_keys = ["forecast_history", "actual_history", "forecast_current"]
city_sets = {}

for key in sec1_keys:
    if key in dfs:
        df = dfs[key]
        models = df['model'].unique().tolist() if 'model' in df.columns else ["N/A (No model column)"]
        cities = set(df['city'].unique()) if 'city' in df.columns else set()
        city_sets[key] = cities
        print(f"\n[{key}]")
        print(f"  - Models: {models}")
        print(f"  - Unique City Count: {len(cities)}")

# Compare city lists across the 3 files
if len(city_sets) == 3:
    s1, s2, s3 = city_sets["forecast_history"], city_sets["actual_history"], city_sets["forecast_current"]
    are_identical = (s1 == s2 == s3)
    print(f"\nAre city lists identical across all 3 files? {are_identical}")
    if not are_identical:
        print("Differences:")
        print("  - In forecast_history but not actual_history:", s1 - s2)
        print("  - In forecast_history but not forecast_current:", s1 - s3)
        print("  - In actual_history but not forecast_history:", s2 - s1)

# =============================================================================
# SECTION 2: forecast_current.csv NaN Count Per Model
# =============================================================================
print("\n" + "=" * 70)
print("SECTION 2: forecast_current.csv NaN Count Per Model")
print("=" * 70)

if "forecast_current" in dfs:
    df_fc = dfs["forecast_current"]
    target_cols = ["temperature", "rainfall", "wind_speed"]
    nan_table = df_fc.groupby("model")[target_cols].apply(lambda g: g.isna().sum())
    print(nan_table)
else:
    print("forecast_current.csv NOT FOUND")

# =============================================================================
# SECTION 3: Sanity Flags & Variable Summary Statistics
# =============================================================================
print("\n" + "=" * 70)
print("SECTION 3: Sanity Flags & Summary Statistics")
print("=" * 70)

for key, df in dfs.items():
    print(f"\n--- Sanity Checks for {key} ---")
    temp_col = "temperature" if "temperature" in df.columns else ("actual_temperature" if "actual_temperature" in df.columns else None)
    rain_col = "rainfall" if "rainfall" in df.columns else ("actual_rainfall" if "actual_rainfall" in df.columns else None)
    wind_col = "wind_speed" if "wind_speed" in df.columns else ("actual_wind" if "actual_wind" in df.columns else None)

    if temp_col:
        invalid_temp = ((df[temp_col] < -10) | (df[temp_col] > 55)).sum()
        print(f"  - Out-of-bounds temperature (< -10 or > 55): {invalid_temp}")
    if rain_col:
        invalid_rain = (df[rain_col] < 0).sum()
        print(f"  - Negative rainfall (< 0): {invalid_rain}")
    if wind_col:
        invalid_wind = (df[wind_col] < 0).sum()
        print(f"  - Negative wind speed (< 0): {invalid_wind}")

# Min, max, mean per model in forecast_history and for actual_history
if "forecast_history" in dfs:
    df_fh = dfs["forecast_history"]
    print("\n--- Summary Stats for forecast_history (per model) ---")
    stats_fh = df_fh.groupby("model")[["temperature", "rainfall", "wind_speed"]].agg(["min", "max", "mean"])
    print(stats_fh.round(3))

if "actual_history" in dfs:
    df_ah = dfs["actual_history"]
    print("\n--- Summary Stats for actual_history ---")
    stats_ah = df_ah[["actual_temperature", "actual_rainfall", "actual_wind"]].agg(["min", "max", "mean"])
    print(stats_ah.round(3))

# =============================================================================
# SECTION 4: Merge forecast_history & actual_history -> Metrics Tables
# =============================================================================
print("\n" + "=" * 70)
print("SECTION 4: Evaluation Metrics (Bias, MAE, RMSE) per Model")
print("=" * 70)

if "forecast_history" in dfs and "actual_history" in dfs:
    df_fh = dfs["forecast_history"]
    df_ah = dfs["actual_history"]
    merged = pd.merge(df_fh, df_ah, on=["city", "datetime"])

    print(f"Matched row count total: {len(merged)}")
    print("\nMatched row count per model:")
    print(merged.groupby("model").size())

    var_pairs = [
        ("Temperature", "temperature", "actual_temperature"),
        ("Rainfall", "rainfall", "actual_rainfall"),
        ("Wind Speed", "wind_speed", "actual_wind"),
    ]

    for name, f_col, a_col in var_pairs:
        print(f"\n--- Evaluation Metrics for {name} ---")
        merged["err"] = merged[f_col] - merged[a_col]
        merged["abs_err"] = merged["err"].abs()
        merged["sq_err"] = merged["err"] ** 2

        metrics = merged.groupby("model").agg(
            bias=("err", "mean"),
            MAE=("abs_err", "mean"),
            RMSE=("sq_err", lambda x: np.sqrt(x.mean()))
        )
        print(metrics.round(4))
else:
    print("forecast_history or actual_history NOT FOUND for merging.")

# =============================================================================
# SECTION 5: Rainfall Analysis in actual_history
# =============================================================================
print("\n" + "=" * 70)
print("SECTION 5: Rainfall Analysis in actual_history")
print("=" * 70)

if "actual_history" in dfs:
    df_ah = dfs["actual_history"]
    rain_series = df_ah["actual_rainfall"].dropna()
    overall_frac = (rain_series > 0.1).mean()
    max_rain = rain_series.max()

    print(f"Overall fraction of hours with rainfall > 0.1 mm: {overall_frac:.4f} ({overall_frac*100:.2f}%)")
    print(f"Maximum hourly rainfall overall: {max_rain:.2f} mm")

    city_frac = df_ah.groupby("city")["actual_rainfall"].apply(lambda s: (s > 0.1).mean())
    print("\nTop 5 cities with highest fraction of rainfall > 0.1 mm:")
    print(city_frac.nlargest(5).round(4))

    print("\nTop 5 cities with lowest fraction of rainfall > 0.1 mm:")
    print(city_frac.nsmallest(5).round(4))
else:
    print("actual_history NOT FOUND")

# =============================================================================
# SECTION 6: Provenance Check & Cross-Verification of Other Files
# =============================================================================
print("\n" + "=" * 70)
print("SECTION 6: Provenance Check of Other Files")
print("=" * 70)

now = datetime.now()
print(f"Current local system time: {now}\n")

prov_keys = ["actual_weather", "all_models_clean"]
for key in prov_keys:
    if key in dfs:
        df = dfs[key]
        print(f"--- Provenance Metadata for {key} ---")
        print(f"  - Shape: {df.shape}")
        print(f"  - Columns: {df.columns.tolist()}")

        dt_series = pd.to_datetime(df["datetime"], errors="coerce")
        print(f"  - Min datetime: {dt_series.min()}")
        print(f"  - Max datetime: {dt_series.max()}")

        future_count = (dt_series > now).sum()
        print(f"  - Rows with datetime > now ({now}): {future_count}")
        print(f"  - Unique cities count: {df['city'].nunique()}")

        if key == "all_models_clean" and "lead_hours" in df.columns:
            print(f"  - Min lead_hours: {df['lead_hours'].min()}")
            print(f"  - Max lead_hours: {df['lead_hours'].max()}")
            print(f"  - Unique lead_hours count: {df['lead_hours'].nunique()}")
        print("\n")
    else:
        print(f"{key} NOT FOUND\n")

# Cross-verification merge of actual_weather.csv and actual_history.csv
if "actual_weather" in dfs and "actual_history" in dfs:
    df_aw = dfs["actual_weather"]
    df_ah = dfs["actual_history"]
    aw_ah_merged = pd.merge(df_aw, df_ah, on=["city", "datetime"], suffixes=("_weather", "_history"))

    print("--- Cross-Verification Merge: actual_weather vs actual_history ---")
    print(f"Matched row count: {len(aw_ah_merged)}")
    temp_mae = (aw_ah_merged["actual_temperature_weather"] - aw_ah_merged["actual_temperature_history"]).abs().mean()
    print(f"Temperature MAE between actual_weather and actual_history: {temp_mae:.6f}")
