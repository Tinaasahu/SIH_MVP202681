import pandas as pd
from datetime import datetime
from pathlib import Path

# Set up base project directory path
base_dir = Path(__file__).resolve().parent.parent

# 1. Load the target CSV files
forecast_file = base_dir / "data" / "forecast_raw.csv"
actual_raw_file = base_dir / "data" / "actual_raw.csv"
actual_weather_file = base_dir / "data" / "actual_weather.csv"

df_forecast = pd.read_csv(forecast_file)
df_actual_raw = pd.read_csv(actual_raw_file)
df_actual_weather = pd.read_csv(actual_weather_file)

# -----------------------------------------------------------------------------
# Check 1: Are actual_raw.csv and actual_weather.csv identical?
# -----------------------------------------------------------------------------
print("=" * 60)
print("CHECK 1: Are actual_raw.csv and actual_weather.csv identical?")
print("=" * 60)

# Sort both DataFrames by city and datetime, then reset index for exact comparison
sorted_raw = df_actual_raw.sort_values(by=["city", "datetime"]).reset_index(drop=True)
sorted_weather = df_actual_weather.sort_values(by=["city", "datetime"]).reset_index(drop=True)

are_identical = sorted_raw.equals(sorted_weather)
print(f"Are actual_raw.csv and actual_weather.csv identical? {are_identical}\n")

# -----------------------------------------------------------------------------
# Check 2: Current time and future rows in actual_weather.csv per city
# -----------------------------------------------------------------------------
print("=" * 60)
print("CHECK 2: Current time and future datetime rows per city")
print("=" * 60)

now = datetime.now()
print(f"Current local system time: {now}")

# Convert datetime column to pandas datetime format
df_actual_weather['datetime_dt'] = pd.to_datetime(df_actual_weather['datetime'])

# Filter rows where timestamp is strictly greater than now
future_rows = df_actual_weather[df_actual_weather['datetime_dt'] > now]
print(f"Total future rows in actual_weather.csv: {len(future_rows)}")
print("Future rows count per city:")
print(future_rows.groupby('city').size() if not future_rows.empty else "No future rows found.")
print("\n")

# -----------------------------------------------------------------------------
# Check 3 & 4: Merge forecast and actual weather, print MAE table and matched counts
# -----------------------------------------------------------------------------
print("=" * 60)
print("CHECK 3 & 4: Temperature MAE and Matched Row Counts per City/Model")
print("=" * 60)

# Merge forecast_raw and actual_weather on city and datetime
df_merged = pd.merge(df_forecast, df_actual_weather, on=["city", "datetime"])

# Calculate absolute error for temperature
df_merged["temp_abs_error"] = (df_merged["temperature"] - df_merged["actual_temperature"]).abs()

# Compute Mean Absolute Error (MAE) grouped by city and model
mae_table = df_merged.groupby(["city", "model"])["temp_abs_error"].mean().unstack()
print("\n--- Temperature Mean Absolute Error (MAE) Table (rows=city, columns=model) ---")
print(mae_table.round(4))

# Compute matched row counts grouped by city and model
match_counts = df_merged.groupby(["city", "model"]).size().unstack()
print("\n--- Number of Matched Rows per Merge (rows=city, columns=model) ---")
print(match_counts)
print(f"\nTotal matched rows across all cities/models: {len(df_merged)}")
