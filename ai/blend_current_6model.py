import pandas as pd
import numpy as np
from pathlib import Path

# Lead days calculation rule:
# start = minimum datetime in forecast_current_6model.csv
# hours_ahead = (datetime - start) in whole hours
# lead_days = hours_ahead // 24 + 1 (values in {1, 2, 3})

MODELS = ["ecmwf", "gfs", "icon", "gem", "ukmo", "jma"]
MODEL_MAP = {
    "ecmwf_ifs025": "ecmwf",
    "gfs_seamless": "gfs",
    "icon_seamless": "icon",
    "gem_seamless": "gem",
    "ukmo_seamless": "ukmo",
    "jma_seamless": "jma",
    "ecmwf": "ecmwf",
    "gfs": "gfs",
    "icon": "icon",
    "gem": "gem",
    "ukmo": "ukmo",
    "jma": "jma",
}
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
forecast_file = base_dir / "data" / "forecast_current_6model.csv"
weights_file = base_dir / "outputs" / "model_weights_6model.csv"
output_file = base_dir / "outputs" / "blended_forecast_6model.csv"


def main():
    print(f"Loading 6-model current forecast from {forecast_file}...")
    df_fc = pd.read_csv(forecast_file)
    df_fc["datetime"] = pd.to_datetime(df_fc["datetime"])

    print(f"Loading 6-model weights from {weights_file}...")
    df_weights = pd.read_csv(weights_file)

    # 1. Standardize model names to short identifiers
    unknown_models = set(df_fc["model"].unique()) - set(MODEL_MAP.keys())
    if unknown_models:
        raise ValueError(f"Unknown model names encountered in current forecast: {unknown_models}")
    df_fc["model"] = df_fc["model"].map(MODEL_MAP)

    # 2. Audit & bounded opt-in correction for float artifacts (e.g. JMA interpolation)
    neg_rain_mask = df_fc["rainfall"] < 0
    neg_wind_mask = df_fc["wind_speed"] < 0
    if neg_rain_mask.any() or neg_wind_mask.any():
        affected = df_fc[neg_rain_mask | neg_wind_mask]
        print(f"[Notice] Detected {len(affected)} negative values in current forecast. Checking magnitude bounds...")
        if (df_fc.loc[neg_rain_mask, "rainfall"] <= -0.5).any():
            raise ValueError("Rainfall <= -0.5 detected in current forecast. Pipeline halted.")
        if (df_fc.loc[neg_wind_mask, "wind_speed"] <= -0.5).any():
            raise ValueError("Wind speed <= -0.5 detected in current forecast. Pipeline halted.")
        df_fc["rainfall"] = np.maximum(0.0, df_fc["rainfall"])
        df_fc["wind_speed"] = np.maximum(0.0, df_fc["wind_speed"])
        print(f"Clipped {len(affected)} rows (all verified as float artifacts > -0.5).")

    # 3. Assign lead_days using forecast's own start time
    start_time = df_fc["datetime"].min()
    hours_ahead = ((df_fc["datetime"] - start_time).dt.total_seconds() // 3600).astype(int)
    df_fc["lead_days"] = hours_ahead // 24 + 1

    # Assert lead_days values are exactly {1, 2, 3}
    if set(df_fc["lead_days"].unique()) != {1, 2, 3}:
        raise ValueError(f"Unexpected lead_days values: {set(df_fc['lead_days'].unique())}")

    # 4. Pivot forecast to wide format: one row per (city, datetime, lead_days)
    df_pivot = df_fc.pivot(
        index=["city", "datetime", "lead_days"],
        columns="model",
        values=VARIABLES
    )

    # Flatten multi-index columns: variable_model
    df_wide = df_pivot.copy()
    df_wide.columns = [f"{var}_{mod}" for var, mod in df_pivot.columns]
    df_wide = df_wide.reset_index()

    # 5. Pivot weights and calculate blended forecast for each variable
    df_blended = df_wide.copy()

    for var in VARIABLES:
        # Pivot weights for the current variable to (city, lead_days) level
        w_pivot = df_weights[df_weights["variable"] == var].pivot(
            index=["city", "lead_days"],
            columns="model",
            values="weight"
        ).reset_index()

        w_cols = [f"w_{m}" for m in MODELS]
        w_pivot.columns = ["city", "lead_days"] + w_cols

        # Merge weights onto wide forecast on (city, lead_days)
        merged = pd.merge(df_wide, w_pivot, on=["city", "lead_days"], how="left")

        # Normalize merged weights so they sum to exactly 1.0 per row
        w_sum = merged[w_cols].sum(axis=1)
        for m in MODELS:
            merged[f"w_{m}"] = merged[f"w_{m}"] / w_sum

        # Compute blend = sum(weight * forecast) across all 6 models
        df_blended[var] = sum(merged[f"w_{m}"] * merged[f"{var}_{m}"] for m in MODELS)

    # 6. Format output columns and sort by city, datetime
    output_cols = ["city", "datetime", "lead_days", "temperature", "rainfall", "wind_speed"]
    df_out = df_blended.sort_values(by=["city", "datetime"]).reset_index(drop=True)[output_cols]

    # -----------------------------------------------------------------------------
    # ASSERTIONS (Strict Quality Control - raise clear error if violated)
    # -----------------------------------------------------------------------------
    # Assertion 1: Exact row count = 45 cities x 72 hours = 3240 rows, 6 columns
    if df_out.shape != (3240, 6):
        raise ValueError(f"Output shape mismatch: expected (3240, 6), got {df_out.shape}")

    # Assertion 2: No NaN anywhere in output dataframe
    if df_out.isna().any().any():
        raise ValueError("NaN values detected in blended forecast dataframe.")

    # Assertion 3: lead_days values are exactly {1, 2, 3} with exactly 1080 rows per lead day
    if set(df_out["lead_days"].unique()) != {1, 2, 3}:
        raise ValueError(f"Unexpected lead_days in output: {set(df_out['lead_days'].unique())}")
    lead_counts = df_out.groupby("lead_days").size().to_dict()
    if lead_counts != {1: 1080, 2: 1080, 3: 1080}:
        raise ValueError(f"Expected 1080 rows per lead_days, got {lead_counts}")

    # Assertion 4: Exactly 45 unique cities
    if df_out["city"].nunique() != 45:
        raise ValueError(f"City count mismatch: expected 45, got {df_out['city'].nunique()}")

    # Assertion 5: For every row and variable, blend lies between min and max of 6 model forecasts
    for var in VARIABLES:
        fc_cols = [f"{var}_{m}" for m in MODELS]
        min_fc = df_wide[fc_cols].min(axis=1)
        max_fc = df_wide[fc_cols].max(axis=1)
        blend_val = df_out[var]

        out_of_bounds = (blend_val < min_fc - 1e-9) | (blend_val > max_fc + 1e-9)
        if out_of_bounds.any():
            num_violations = out_of_bounds.sum()
            raise ValueError(
                f"Blend values for {var} fall outside [min_forecast, max_forecast] bounds in {num_violations} rows."
            )

    print("=" * 70)
    print("[SUCCESS] All Quality Assertions Passed for 6-Model Current Blend!")
    print("=" * 70)

    # Format datetime as string %Y-%m-%d %H:%M:%S
    df_out["datetime"] = df_out["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # Save to outputs/blended_forecast_6model.csv (never touch blended_forecast.csv)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    df_out.to_csv(output_file, index=False)
    print(f"\nSuccessfully written 6-model blended forecast to {output_file}")

    print("\n--- First 8 Rows of blended_forecast_6model.csv ---")
    print(df_out.head(8).to_string(index=False))


if __name__ == "__main__":
    main()
