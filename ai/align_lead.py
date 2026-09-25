import pandas as pd
import numpy as np
from pathlib import Path

# Named cutoff constant for train/test split
TRAIN_TEST_CUTOFF = pd.Timestamp("2026-08-29 00:00:00")

# Expected temperature MAE benchmark values for cross-check (per model per lead day)
EXPECTED_MAE = {
    "ecmwf": {1: 0.8790, 2: 0.9844, 3: 1.0423},
    "gem":   {1: 1.3303, 2: 1.3611, 3: 1.4302},
    "gfs":   {1: 1.5696, 2: 1.5958, 3: 1.5948},
    "icon":  {1: 0.9428, 2: 1.0177, 3: 1.0925},
}

# Resolve project paths
base_dir = Path(__file__).resolve().parent.parent
interim_dir = base_dir / "outputs" / "interim"
forecast_file = interim_dir / "forecast_history_lead_clean.csv"
actual_file = interim_dir / "actual_history_clean.csv"
output_file = interim_dir / "pairs_lead.csv"

# 1. Parse datetime in both files
print(f"Reading lead forecast data from {forecast_file}...")
df_fh = pd.read_csv(forecast_file)
df_fh["datetime"] = pd.to_datetime(df_fh["datetime"])

print(f"Reading actual history data from {actual_file}...")
df_ah = pd.read_csv(actual_file)
df_ah["datetime"] = pd.to_datetime(df_ah["datetime"])

# 2. Pivot the lead file to wide format: one row per (city, datetime, lead_days)
df_pivot = df_fh.pivot(
    index=["city", "datetime", "lead_days"],
    columns="model",
    values=["temperature", "rainfall", "wind_speed"]
)

# Flatten multi-index columns into format: variable_model
df_pivot.columns = [f"{var}_{mod}" for var, mod in df_pivot.columns]
df_pivot = df_pivot.reset_index()

# 3. Merge with actual_history_clean on (city, datetime), inner join
df_pairs = pd.merge(df_pivot, df_ah, on=["city", "datetime"], how="inner")

# 4. Add 'split' column: 'train' if datetime < TRAIN_TEST_CUTOFF else 'test'
df_pairs["split"] = np.where(df_pairs["datetime"] < TRAIN_TEST_CUTOFF, "train", "test")

# 5. Sort by (city, lead_days, datetime) and set explicit column ordering
forecast_cols = [
    "temperature_ecmwf", "temperature_gfs", "temperature_icon", "temperature_gem",
    "rainfall_ecmwf", "rainfall_gfs", "rainfall_icon", "rainfall_gem",
    "wind_speed_ecmwf", "wind_speed_gfs", "wind_speed_icon", "wind_speed_gem"
]
actual_cols = ["actual_temperature", "actual_rainfall", "actual_wind"]
ordered_cols = ["city", "datetime", "lead_days", "split"] + forecast_cols + actual_cols

df_pairs = df_pairs.sort_values(by=["city", "lead_days", "datetime"]).reset_index(drop=True)
df_pairs = df_pairs[ordered_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict verification - raise clear ValueError on failure)
# -----------------------------------------------------------------------------
# Assertion 1: final rows == 197640 (65880 x 3), no NaN anywhere
if len(df_pairs) != 197640:
    raise ValueError(f"Final row count mismatch: expected 197640, got {len(df_pairs)}")

if df_pairs.isna().any().any():
    raise ValueError("NaN values detected in final pairs_lead DataFrame")

# Assertion 2: unique on (city, datetime, lead_days)
if df_pairs.duplicated(subset=["city", "datetime", "lead_days"]).any():
    raise ValueError("Duplicate entries found on (city, datetime, lead_days)")

# Assertion 3: split counts: train == 136080, test == 61560
train_count = (df_pairs["split"] == "train").sum()
test_count = (df_pairs["split"] == "test").sum()
if train_count != 136080 or test_count != 61560:
    raise ValueError(f"Split count mismatch: train={train_count} (expected 136080), test={test_count} (expected 61560)")

# Assertion 4: every city has train and test rows for every lead_days in {1, 2, 3}
city_lead_split_counts = df_pairs.groupby(["city", "lead_days"])["split"].nunique()
if not (city_lead_split_counts == 2).all():
    raise ValueError("Some cities do not have both train and test splits for every lead_days in {1, 2, 3}")

# -----------------------------------------------------------------------------
# CROSS-CHECK (Print, do not assert)
# -----------------------------------------------------------------------------
print("=" * 70)
print("TEMPERATURE MAE CROSS-CHECK PER MODEL & LEAD DAY (OVER ALL ROWS)")
print("=" * 70)
models = ["ecmwf", "gem", "gfs", "icon"]
for mod in models:
    for lead in [1, 2, 3]:
        sub = df_pairs[df_pairs["lead_days"] == lead]
        comp_mae = (sub[f"temperature_{mod}"] - sub["actual_temperature"]).abs().mean()
        exp_mae = EXPECTED_MAE[mod][lead]
        status = "MATCH" if abs(comp_mae - exp_mae) <= 0.001 else "MISMATCH"
        print(f"Model: {mod:6s} | Lead: {lead} | Computed MAE: {comp_mae:.4f} | Expected: {exp_mae:.4f} | Status: {status}")

print("\n" + "=" * 70)
print("PAIRS LEAD METADATA & SUMMARY")
print("=" * 70)
print(f"Shape: {df_pairs.shape}")
print(f"Columns: {list(df_pairs.columns)}")

for split_name in ["train", "test"]:
    sub_split = df_pairs[df_pairs["split"] == split_name]
    print(f"Split '{split_name:5s}': Min Datetime = {sub_split['datetime'].min()} | Max Datetime = {sub_split['datetime'].max()}")

print("\nFirst 5 rows:")
print(df_pairs.head(5))
print("=" * 70)

# -----------------------------------------------------------------------------
# SAVE CLEANED FILE
# -----------------------------------------------------------------------------
df_pairs["datetime"] = df_pairs["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S")
output_file.parent.mkdir(parents=True, exist_ok=True)
df_pairs.to_csv(output_file, index=False)
print(f"Successfully saved pairs_lead to: {output_file}")
