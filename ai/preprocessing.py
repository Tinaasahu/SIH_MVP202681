import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
data_dir = base_dir / "data"
output_dir = base_dir / "outputs" / "interim"

# Create outputs/interim directory if it does not exist
output_dir.mkdir(parents=True, exist_ok=True)

# Define target model mapping dictionary
model_map = {
    "ecmwf_ifs025": "ecmwf",
    "gfs_seamless": "gfs",
    "icon_seamless": "icon",
    "gem_seamless": "gem"
}

# -----------------------------------------------------------------------------
# Process File Function
# -----------------------------------------------------------------------------
def process_and_validate(filename, is_forecast=True):
    filepath = data_dir / filename
    print("=" * 70)
    print(f"PROCESSING & VALIDATING: {filename}")
    print("=" * 70)

    # 1. Read input file
    df_raw = pd.read_csv(filepath)
    rows_in = len(df_raw)
    df = df_raw.copy()

    # 2. Parse datetime with pd.to_datetime
    df["datetime"] = pd.to_datetime(df["datetime"])

    # 3. Model renaming for forecast files
    if is_forecast:
        unknown_models = set(df["model"].unique()) - set(model_map.keys())
        if unknown_models:
            raise ValueError(f"Unknown model names encountered in {filename}: {unknown_models}")
        df["model"] = df["model"].map(model_map)

    # 4. Sort and reset index
    sort_cols = ["city", "model", "datetime"] if is_forecast else ["city", "datetime"]
    df = df.sort_values(by=sort_cols).reset_index(drop=True)

    # -------------------------------------------------------------------------
    # ASSERTIONS (Strict quality control - raise error on failure)
    # -------------------------------------------------------------------------
    # Assertion 1: No NaN in any column
    if df.isna().any().any():
        raise ValueError(f"NaN values detected in {filename}")

    # Assertion 2: No duplicate rows on keys
    if df.duplicated(subset=sort_cols).any():
        raise ValueError(f"Duplicate key combinations detected in {filename}")

    # Assertion 3: Series is exactly hourly with no gaps
    group_cols = ["city", "model"] if is_forecast else ["city"]
    for group_key, group in df.groupby(group_cols):
        diffs = group["datetime"].diff().dropna()
        if not (diffs == pd.Timedelta(hours=1)).all():
            raise ValueError(f"Non-hourly step or gap detected in {filename} for group {group_key}")

    # Assertion 4: Numeric range constraints
    temp_col = "temperature" if "temperature" in df.columns else "actual_temperature"
    rain_col = "rainfall" if "rainfall" in df.columns else "actual_rainfall"
    wind_col = "wind_speed" if "wind_speed" in df.columns else "actual_wind"

    if (df[temp_col] < -10).any() or (df[temp_col] > 55).any():
        raise ValueError(f"Temperature out of valid range [-10, 55] in {filename}")
    if (df[rain_col] < 0).any():
        raise ValueError(f"Negative rainfall values detected in {filename}")
    if (df[wind_col] < 0).any():
        raise ValueError(f"Negative wind values detected in {filename}")

    # Assertion 5: actual_history max datetime < datetime.now()
    if filename == "actual_history.csv":
        if df["datetime"].max() >= datetime.now():
            raise ValueError(f"actual_history max datetime is not strictly earlier than current time.")

    # -------------------------------------------------------------------------
    # REPORTING & FLAG COUNTS
    # -------------------------------------------------------------------------
    rows_out = len(df)
    if rows_in != rows_out:
        raise ValueError(f"Row count mismatch in {filename}: in={rows_in}, out={rows_out}")

    flag_temp = ((df[temp_col] < 5) | (df[temp_col] > 48)).sum()
    flag_rain = (df[rain_col] > 50).sum()
    flag_wind = (df[wind_col] > 60).sum()

    print(f"  - Rows In: {rows_in} | Rows Out: {rows_out}")
    print(f"  - Datetime Min: {df['datetime'].min()} | Max: {df['datetime'].max()}")
    print(f"  - Unique Cities: {df['city'].nunique()}")
    print(f"  - Models Present: {df['model'].unique().tolist() if is_forecast else 'N/A'}")
    print(f"  - Flag Counts (counted only, not removed):")
    print(f"      * Temperature < 5 or > 48: {flag_temp}")
    print(f"      * Rainfall > 50 mm/hour:   {flag_rain}")
    print(f"      * Wind > 60 km/h:          {flag_wind}")

    return df

# Run pipeline for all three files
df_fh_clean = process_and_validate("forecast_history.csv", is_forecast=True)
df_ah_clean = process_and_validate("actual_history.csv", is_forecast=False)
df_fc_clean = process_and_validate("forecast_current.csv", is_forecast=True)

# -----------------------------------------------------------------------------
# Assertion 6: forecast_history and actual_history set matching
# -----------------------------------------------------------------------------
fh_pairs = set(zip(df_fh_clean["city"], df_fh_clean["datetime"]))
ah_pairs = set(zip(df_ah_clean["city"], df_ah_clean["datetime"]))

if fh_pairs != ah_pairs:
    raise ValueError("forecast_history and actual_history do not contain the exact same set of (city, datetime) pairs.")
print("\n[VERIFIED] forecast_history and actual_history contain identical (city, datetime) pairs.\n")

# -----------------------------------------------------------------------------
# Save clean outputs formatted as %Y-%m-%d %H:%M:%S
# -----------------------------------------------------------------------------
out_fh = output_dir / "forecast_history_clean.csv"
out_ah = output_dir / "actual_history_clean.csv"
out_fc = output_dir / "forecast_current_clean.csv"

df_fh_clean.to_csv(out_fh, index=False, date_format="%Y-%m-%d %H:%M:%S")
df_ah_clean.to_csv(out_ah, index=False, date_format="%Y-%m-%d %H:%M:%S")
df_fc_clean.to_csv(out_fc, index=False, date_format="%Y-%m-%d %H:%M:%S")

print(f"Successfully written cleaned files to:")
print(f"  1. {out_fh}")
print(f"  2. {out_ah}")
print(f"  3. {out_fc}")
