import pandas as pd
import numpy as np
from pathlib import Path

# Hard-coded cutoff constant as requested
TRAIN_TEST_CUTOFF = pd.Timestamp("2026-08-29 00:00:00")

# Expected temperature MAE values from earlier EDA for cross-check
EXPECTED_MAE = {
    "ecmwf": 0.4544,
    "gem": 1.1793,
    "gfs": 1.4403,
    "icon": 0.8857,
}

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
input_dir = base_dir / "outputs" / "interim"
output_file = input_dir / "pairs.csv"

# 1. Load clean interim files
fh_file = input_dir / "forecast_history_clean.csv"
ah_file = input_dir / "actual_history_clean.csv"

df_fh = pd.read_csv(fh_file)
df_ah = pd.read_csv(ah_file)

# Parse datetimes
df_fh["datetime"] = pd.to_datetime(df_fh["datetime"])
df_ah["datetime"] = pd.to_datetime(df_ah["datetime"])

# 2. Pivot forecast_history_clean to wide format: one row per (city, datetime)
df_pivot = df_fh.pivot(index=["city", "datetime"], columns="model", values=["temperature", "rainfall", "wind_speed"])

# Flatten multi-index columns into format: variable_model
df_pivot.columns = [f"{var}_{mod}" for var, mod in df_pivot.columns]
df_pivot = df_pivot.reset_index()

# 3. Merge with actual_history_clean on (city, datetime) using inner join
df_pairs = pd.merge(df_pivot, df_ah, on=["city", "datetime"], how="inner")

# 4. Add 'split' column: 'train' if datetime < TRAIN_TEST_CUTOFF else 'test'
df_pairs["split"] = np.where(df_pairs["datetime"] < TRAIN_TEST_CUTOFF, "train", "test")

# 5. Sort by (city, datetime) and order columns precisely
forecast_cols = [
    "temperature_ecmwf", "temperature_gfs", "temperature_icon", "temperature_gem",
    "rainfall_ecmwf", "rainfall_gfs", "rainfall_icon", "rainfall_gem",
    "wind_speed_ecmwf", "wind_speed_gfs", "wind_speed_icon", "wind_speed_gem"
]
actual_cols = ["actual_temperature", "actual_rainfall", "actual_wind"]
ordered_cols = ["city", "datetime", "split"] + forecast_cols + actual_cols

df_pairs = df_pairs.sort_values(by=["city", "datetime"]).reset_index(drop=True)
df_pairs = df_pairs[ordered_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict quality control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: Final row count == 65880
if len(df_pairs) != 65880:
    raise ValueError(f"Final row count mismatch: expected 65880, got {len(df_pairs)}")

# Assertion 2: No NaN anywhere
if df_pairs.isna().any().any():
    raise ValueError("NaN values detected in final pairs DataFrame.")

# Assertion 3: (city, datetime) is unique
if df_pairs.duplicated(subset=["city", "datetime"]).any():
    raise ValueError("Duplicate (city, datetime) keys detected in final pairs DataFrame.")

# Assertion 4: Split counts: train == 45360, test == 20520
train_count = (df_pairs["split"] == "train").sum()
test_count = (df_pairs["split"] == "test").sum()
if train_count != 45360 or test_count != 20520:
    raise ValueError(f"Split counts mismatch: train={train_count} (expected 45360), test={test_count} (expected 20520)")

# Assertion 5: Every city has both train and test rows
city_split_counts = df_pairs.groupby("city")["split"].nunique()
if not (city_split_counts == 2).all():
    missing_cities = city_split_counts[city_split_counts < 2].index.tolist()
    raise ValueError(f"Cities missing either train or test split: {missing_cities}")

# -----------------------------------------------------------------------------
# CROSS-CHECK & PRINT REPORT
# -----------------------------------------------------------------------------
print("=" * 70)
print("TEMPERATURE MAE CROSS-CHECK OVER ALL ROWS")
print("=" * 70)
models = ["ecmwf", "gem", "gfs", "icon"]
for mod in models:
    comp_mae = (df_pairs[f"temperature_{mod}"] - df_pairs["actual_temperature"]).abs().mean()
    exp_mae = EXPECTED_MAE[mod]
    status = "MATCH" if abs(comp_mae - exp_mae) <= 0.001 else "MISMATCH"
    print(f"Model {mod:7s} | Computed MAE: {comp_mae:.4f} | Expected: {exp_mae:.4f} | Status: {status}")

print("\n" + "=" * 70)
print("PAIRS DATASET METADATA & SUMMARY")
print("=" * 70)
print(f"Shape: {df_pairs.shape}")
print(f"\nColumns ({len(df_pairs.columns)}):")
print(df_pairs.columns.tolist())

print("\nMin/Max Datetime per Split:")
split_dates = df_pairs.groupby("split")["datetime"].agg(["min", "max", "count"])
print(split_dates)

print("\nFirst 5 Rows:")
print(df_pairs.head(5))

# -----------------------------------------------------------------------------
# SAVE OUTPUT
# -----------------------------------------------------------------------------
df_pairs.to_csv(output_file, index=False, date_format="%Y-%m-%d %H:%M:%S")
print(f"\nSuccessfully saved pairs table to {output_file}")
