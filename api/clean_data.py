"""
clean_data.py - Weather Forecast Preprocessing & Cleaning Pipeline (Smart India Hackathon)

This module loads raw weather forecast CSV files from `data/raw_forecasts/`, executes data
cleaning and feature engineering (datetime parsing, deduplication, sorting, numeric casting,
impossible value correction, forward-fill missing value imputation, and lead_hours calculation),
and saves cleaned individual model files as well as a merged dataset to `data/processed/`.

Dependencies: pandas, numpy
"""

import os
import pandas as pd
import numpy as np


RAW_DIR = "data/raw_forecasts"
PROCESSED_DIR = "data/processed"
MODELS = ["ecmwf", "gfs", "icon", "gem"]
COLUMNS_ORDER = ["city", "model", "datetime", "lead_hours", "temperature", "rainfall", "wind_speed"]


def ensure_directory_exists(dir_path):
    """
    Create directory automatically if it does not exist.
    """
    os.makedirs(dir_path, exist_ok=True)


def load_raw_forecast(file_path):
    """
    Read a raw forecast CSV file into a pandas DataFrame.
    """
    if not os.path.exists(file_path):
        print(f"[Warning] Raw forecast file missing at: {file_path}")
        return pd.DataFrame()
    return pd.read_csv(file_path)


def clean_forecast_dataframe(df, model_name):
    """
    Preprocess a single raw forecast DataFrame:
      1. Add model identifier column from filename.
      2. Convert datetime to pandas datetime objects.
      3. Remove duplicate rows based on city and datetime.
      4. Sort data by city and datetime.
      5. Ensure numeric data types for temperature, rainfall, and wind_speed.
      6. Replace impossible negative values (< 0) with 0 for rainfall and wind_speed.
      7. Fill missing values using forward fill within each city.
      8. Create new feature lead_hours = hours from the first timestamp of that city.

    Parameters:
        df (pd.DataFrame): Raw forecast dataframe.
        model_name (str): Identifier name for the forecast model.

    Returns:
        tuple: (pd.DataFrame cleaned_df, dict stats)
    """
    if df.empty:
        return pd.DataFrame(), {
            "initial_rows": 0,
            "final_rows": 0,
            "duplicates_removed": 0,
            "missing_fixed": 0
        }

    initial_rows = len(df)

    # 1. Add model column automatically using the model identifier/filename
    df = df.copy()
    df["model"] = model_name

    # 2. Convert datetime to proper pandas datetime
    df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")

    # 3. Remove duplicate rows based on city and datetime
    duplicates_count = int(df.duplicated(subset=["city", "datetime"]).sum())
    df = df.drop_duplicates(subset=["city", "datetime"]).copy()

    # 4. Sort by city and datetime
    df = df.sort_values(by=["city", "datetime"]).reset_index(drop=True)

    # 5. Ensure numeric types for weather variables
    numeric_cols = ["temperature", "rainfall", "wind_speed"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # 6. Replace impossible values (rainfall < 0 -> 0, wind_speed < 0 -> 0)
    df["rainfall"] = np.maximum(0.0, df["rainfall"])
    df["wind_speed"] = np.maximum(0.0, df["wind_speed"])

    # 7. Fill missing values using forward fill within each city
    missing_count = int(df[numeric_cols].isna().sum().sum())
    for col in numeric_cols:
        df[col] = df.groupby("city")[col].ffill()
        # Fallback bfill and fillna for any initial NaN values at city boundaries
        df[col] = df.groupby("city")[col].bfill().fillna(0.0)

    # 8. Create lead_hours = hours from the first timestamp of that city
    min_datetime = df.groupby("city")["datetime"].transform("min")
    df["lead_hours"] = ((df["datetime"] - min_datetime).dt.total_seconds() / 3600).round().astype(int)

    # Format datetime back to ISO standard string format for clean CSV output
    df["datetime"] = df["datetime"].dt.strftime("%Y-%m-%dT%H:%M:%S")

    # Reorder columns explicitly as requested
    cleaned_df = df[COLUMNS_ORDER].copy()
    final_rows = len(cleaned_df)

    stats = {
        "initial_rows": initial_rows,
        "final_rows": final_rows,
        "duplicates_removed": duplicates_count,
        "missing_fixed": missing_count
    }

    return cleaned_df, stats


def save_cleaned_forecast(df, output_path):
    """
    Save cleaned DataFrame to a target CSV file path.
    """
    output_dir = os.path.dirname(output_path)
    if output_dir:
        ensure_directory_exists(output_dir)
    df.to_csv(output_path, index=False)
    print(f"[Success] Saved {len(df)} cleaned records to {output_path}")


def process_all_forecasts(raw_dir=RAW_DIR, processed_dir=PROCESSED_DIR):
    """
    Main processing pipeline: reads all four raw forecast CSV files,
    cleans each file, saves individual cleaned model outputs, and builds
    the merged all_models_clean.csv dataset.
    """
    ensure_directory_exists(processed_dir)
    cleaned_dfs = []

    print(f"Starting data cleaning pipeline for files in '{raw_dir}'...\n")

    for model in MODELS:
        file_path = os.path.join(raw_dir, f"{model}.csv")
        print(f"--- Preprocessing Model: {model} ({file_path}) ---")

        df_raw = load_raw_forecast(file_path)
        if df_raw.empty:
            print(f"[Warning] Skipping empty or missing file for model '{model}'.")
            continue

        df_clean, stats = clean_forecast_dataframe(df_raw, model)

        print(f"  rows before cleaning : {stats['initial_rows']}")
        print(f"  rows after cleaning  : {stats['final_rows']}")
        print(f"  missing values fixed : {stats['missing_fixed']}")
        print(f"  duplicates removed   : {stats['duplicates_removed']}")

        # Save individual cleaned file
        out_path = os.path.join(processed_dir, f"{model}_clean.csv")
        save_cleaned_forecast(df_clean, out_path)
        cleaned_dfs.append(df_clean)
        print()

    # Create merged file: data/processed/all_models_clean.csv
    if cleaned_dfs:
        merged_df = pd.concat(cleaned_dfs, ignore_index=True)
        merged_out_path = os.path.join(processed_dir, "all_models_clean.csv")
        print(f"--- Saving Merged Clean Dataset ---")
        save_cleaned_forecast(merged_df, merged_out_path)
        print(f"Total merged cleaned records saved: {len(merged_df)}")
    else:
        print("[Error] No cleaned datasets were generated.")


def main():
    """
    Main entry point for data cleaning script.
    """
    process_all_forecasts()


if __name__ == "__main__":
    main()
