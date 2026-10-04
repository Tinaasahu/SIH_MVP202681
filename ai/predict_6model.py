import os
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

# Top-level named constants: 29 features from features_6model.py
FEATURE_COLS = [
    'latitude', 'longitude', 'elevation_m', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem', 'temperature_ukmo', 'temperature_jma',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem', 'rainfall_ukmo', 'rainfall_jma',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem', 'wind_speed_ukmo', 'wind_speed_jma',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]

MODELS = ['ecmwf', 'gfs', 'icon', 'gem', 'ukmo', 'jma']
MODEL_MAP = {
    'ecmwf_ifs025': 'ecmwf',
    'gfs_seamless': 'gfs',
    'icon_seamless': 'icon',
    'gem_seamless': 'gem',
    'ukmo_seamless': 'ukmo',
    'jma_seamless': 'jma',
    'ecmwf': 'ecmwf',
    'gfs': 'gfs',
    'icon': 'icon',
    'gem': 'gem',
    'ukmo': 'ukmo',
    'jma': 'jma',
}

VARIABLES = {
    'temperature': 'actual_temperature',
    'rainfall': 'actual_rainfall',
    'wind_speed': 'actual_wind'
}


def predict_hybrid(df):
    """
    For each variable, load trained 6-model RF model, predict residuals,
    and add residual to blend_<variable>. Clip rainfall & wind_speed at 0.
    """
    hybrids = {}
    residuals = {}
    base_dir = Path(__file__).resolve().parent.parent
    for var in VARIABLES.keys():
        model_path = base_dir / 'outputs' / 'models' / f'rf_{var}_6model.joblib'
        if not model_path.exists():
            raise FileNotFoundError(f"6-model model file not found: {model_path}")
        model = joblib.load(model_path)

        resid = model.predict(df[FEATURE_COLS])
        hybrid = df[f'blend_{var}'].values + resid

        if var in ['rainfall', 'wind_speed']:
            hybrid = np.maximum(0, hybrid)

        hybrids[var] = hybrid
        residuals[var] = resid

    return hybrids, residuals


def cross_check_test(ml_table_path):
    """
    Cross-check 6-model hybrid RF predictions on TEST split of ml_table_6model.csv.
    Print RMSE per variable and lead_days next to expected values.
    """
    print("=== CROSS-CHECK TEST RMSE (6-MODEL HYBRID RF) ===")
    df = pd.read_csv(ml_table_path)
    test_df = df[df['split'] == 'test'].copy()

    expected_rmse = {
        'temperature': {1: 0.8662, 2: 0.9401, 3: 0.9971},
        'rainfall':    {1: 0.6702, 2: 0.6786, 3: 0.6856},
        'wind_speed':  {1: 2.2857, 2: 2.4390, 3: 2.5120}
    }

    hybrids, _ = predict_hybrid(test_df)
    all_match = True

    for var, actual_col in VARIABLES.items():
        actual = test_df[actual_col].values
        hybrid_pred = hybrids[var]
        for lead in [1, 2, 3]:
            mask = (test_df['lead_days'] == lead).values
            err = actual[mask] - hybrid_pred[mask]
            computed_rmse = np.sqrt(np.mean(err ** 2))
            exp_rmse = expected_rmse[var][lead]
            diff = abs(computed_rmse - exp_rmse)
            status = "MATCH" if diff <= 0.001 else "MISMATCH"
            if status != "MATCH":
                all_match = False
            print(f" {var:<11} lead{lead}: computed={computed_rmse:.4f}, expected={exp_rmse:.4f} -> {status}")

    print("=" * 60)
    print(f"Cross-Check Overall Status: [{'ALL 9 MATCH' if all_match else 'MISMATCH DETECTED'}]")
    print("=" * 60 + "\n")
    if not all_match:
        raise ValueError("Cross-check failed against expected test RMSE values!")


def build_current_features():
    """
    Build 29-feature matrix for today's forecast from forecast_current_6model.csv,
    data/cities_with_elevation.csv, and outputs/blended_forecast_6model.csv.
    """
    base_dir = Path(__file__).resolve().parent.parent
    fc_path = base_dir / 'data' / 'forecast_current_6model.csv'
    cities_elev_path = base_dir / 'data' / 'cities_with_elevation.csv'
    blended_path = base_dir / 'outputs' / 'blended_forecast_6model.csv'

    # 1. Read & parse forecast_current_6model.csv
    print(f"Reading current 6-model forecast from {fc_path}...")
    fc_df = pd.read_csv(fc_path)
    fc_df['datetime'] = pd.to_datetime(fc_df['datetime'])
    min_datetime_clean = fc_df['datetime'].min()

    # Standardize model names
    unknown_models = set(fc_df['model'].unique()) - set(MODEL_MAP.keys())
    if unknown_models:
        raise ValueError(f"Unknown model names in current forecast: {unknown_models}")
    fc_df['model'] = fc_df['model'].map(MODEL_MAP)

    # Clean float artifacts (< 0 -> 0.0) with magnitude guard
    neg_rain_mask = fc_df['rainfall'] < 0
    neg_wind_mask = fc_df['wind_speed'] < 0
    if neg_rain_mask.any() or neg_wind_mask.any():
        if (fc_df.loc[neg_rain_mask, 'rainfall'] <= -0.5).any():
            raise ValueError("Rainfall <= -0.5 detected in current forecast.")
        if (fc_df.loc[neg_wind_mask, 'wind_speed'] <= -0.5).any():
            raise ValueError("Wind speed <= -0.5 detected in current forecast.")
        fc_df['rainfall'] = np.maximum(0.0, fc_df['rainfall'])
        fc_df['wind_speed'] = np.maximum(0.0, fc_df['wind_speed'])

    # Pivot to one row per (city, datetime) with 18 model columns
    pivoted = fc_df.pivot(
        index=['city', 'datetime'],
        columns='model',
        values=['temperature', 'rainfall', 'wind_speed']
    )
    pivoted.columns = [f"{var}_{mod}" for var, mod in pivoted.columns]
    df = pivoted.reset_index()

    # 2. Lead days: start = min datetime in file; lead_days = (hours since start) // 24 + 1
    start_dt = df['datetime'].min()
    if start_dt != min_datetime_clean:
        raise ValueError(f"Min datetime mismatch: pivoted={start_dt}, raw={min_datetime_clean}")

    hours_since_start = (df['datetime'] - start_dt).dt.total_seconds() // 3600
    df['lead_days'] = (hours_since_start // 24 + 1).astype(int)

    lead_days_set = set(df['lead_days'].unique())
    if lead_days_set != {1, 2, 3}:
        raise ValueError(f"Expected lead_days set {{1, 2, 3}}, got {lead_days_set}")

    # 3. Merge latitude, longitude, and elevation_m from data/cities_with_elevation.csv
    print(f"Merging spatial & elevation data from {cities_elev_path}...")
    cities_df = pd.read_csv(cities_elev_path)
    df = pd.merge(df, cities_df[['city', 'latitude', 'longitude', 'elevation_m']], on='city', how='left')

    if df[['latitude', 'longitude', 'elevation_m']].isna().any().any():
        raise ValueError("Some cities could not be matched with data/cities_with_elevation.csv")
    if df['city'].nunique() != 45:
        raise ValueError(f"Expected 45 unique cities, got {df['city'].nunique()}")

    # 4. Extract hour
    df['hour'] = df['datetime'].dt.hour

    # 5. Compute spread_<variable> = max - min of all 6 model forecasts
    for var in ['temperature', 'rainfall', 'wind_speed']:
        mod_cols = [f'{var}_{m}' for m in MODELS]
        df[f'spread_{var}'] = df[mod_cols].max(axis=1) - df[mod_cols].min(axis=1)

    # 6. Merge blend_temperature, blend_rainfall, blend_wind_speed from outputs/blended_forecast_6model.csv
    print(f"Merging 6-model blend from {blended_path}...")
    blended_df = pd.read_csv(blended_path)
    blended_df['datetime'] = pd.to_datetime(blended_df['datetime'])
    blended_df = blended_df.rename(columns={
        'temperature': 'blend_temperature',
        'rainfall': 'blend_rainfall',
        'wind_speed': 'blend_wind_speed'
    })

    merged_df = pd.merge(
        df,
        blended_df[['city', 'datetime', 'lead_days', 'blend_temperature', 'blend_rainfall', 'blend_wind_speed']],
        on=['city', 'datetime'],
        how='inner',
        suffixes=('', '_blended')
    )

    if len(merged_df) != len(blended_df):
        raise ValueError(f"Unmatched rows merging blended forecast: got {len(merged_df)}, expected {len(blended_df)}")

    if 'lead_days_blended' in merged_df.columns:
        if not (merged_df['lead_days'] == merged_df['lead_days_blended']).all():
            raise ValueError("lead_days do not agree between calculated features and blended file")
        merged_df = merged_df.drop(columns=['lead_days_blended'])

    return merged_df, min_datetime_clean


def compare_with_live_production(new_df, output_path):
    """
    Computes and prints a detailed delta comparison against the current live
    outputs/hybrid_forecast.csv (the 4-model production file) across overlapping rows.
    """
    base_dir = Path(__file__).resolve().parent.parent
    live_path = base_dir / 'outputs' / 'hybrid_forecast.csv'

    if not live_path.exists():
        print(f"[Notice] Live production file {live_path} does not exist. Skipping delta comparison.")
        return

    print("\n" + "=" * 75)
    print("DELTA SANITY CHECK: 6-MODEL HYBRID vs CURRENT LIVE 4-MODEL HYBRID")
    print("=" * 75)

    live_df = pd.read_csv(live_path)
    live_df['datetime'] = pd.to_datetime(live_df['datetime'])
    new_cmp = new_df.copy()
    new_cmp['datetime'] = pd.to_datetime(new_cmp['datetime'])

    overlap = pd.merge(
        new_cmp,
        live_df,
        on=['city', 'datetime'],
        suffixes=('_6m', '_4m')
    )

    if overlap.empty:
        print("[Notice] No overlapping timestamps between live 4-model file and new 6-model file.")
        return

    print(f"Found {len(overlap):,} overlapping city/datetime forecasts across {overlap['city'].nunique()} cities.")
    print(f"Overlap Window: {overlap['datetime'].min()} to {overlap['datetime'].max()}\n")

    for var in ['temperature', 'rainfall', 'wind_speed']:
        col_6m = f'{var}_6m'
        col_4m = f'{var}_4m'

        diff = overlap[col_6m] - overlap[col_4m]
        abs_diff = np.abs(diff)

        mad = abs_diff.mean()
        mean_shift = diff.mean()
        max_diff = abs_diff.max()
        p95_diff = np.percentile(abs_diff, 95)

        print(f"[{var.upper()}] Overlap Statistics (6M minus 4M):")
        print(f"  * Mean Absolute Difference (MAD): {mad:.4f}")
        print(f"  * Mean Directional Shift (Bias):  {mean_shift:+.4f}")
        print(f"  * 95th Percentile Difference:     {p95_diff:.4f}")
        print(f"  * Max Absolute Difference:        {max_diff:.4f}")

        # Per lead-day breakdown on overlap
        lead_col = 'lead_days_6m' if 'lead_days_6m' in overlap.columns else 'lead_days'
        for ld in sorted(overlap[lead_col].unique()):
            sub = overlap[overlap[lead_col] == ld]
            sub_mad = np.abs(sub[col_6m] - sub[col_4m]).mean()
            sub_shift = (sub[col_6m] - sub[col_4m]).mean()
            print(f"    - Lead Day {ld}: MAD = {sub_mad:.4f}, Mean Shift = {sub_shift:+.4f} (N={len(sub):,})")
        print()
    print("=" * 75)


def main():
    base_dir = Path(__file__).resolve().parent.parent

    # 1. Feature sanity assertion
    for col in FEATURE_COLS:
        if col.startswith('actual') or col.startswith('resid'):
            raise ValueError(f"Feature column '{col}' starts with 'actual' or 'resid'")

    # 2. Cross-check against ml_table_6model.csv TEST split first
    ml_table_path = base_dir / 'outputs' / 'interim' / 'ml_table_6model.csv'
    cross_check_test(ml_table_path)

    # 3. Build features for current 6-model forecast
    curr_df, min_datetime_clean = build_current_features()

    # 4. Apply predict_hybrid with 6-model RF regressors
    hybrids, _ = predict_hybrid(curr_df)
    curr_df['temperature'] = hybrids['temperature']
    curr_df['rainfall'] = hybrids['rainfall']
    curr_df['wind_speed'] = hybrids['wind_speed']

    # Select final columns and sort
    out_cols = [
        'city', 'datetime', 'lead_days',
        'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
        'temperature', 'rainfall', 'wind_speed'
    ]
    out_df = curr_df[out_cols].sort_values(by=['city', 'datetime']).copy()

    # 5. Strict Assertions
    if len(out_df) != 3240:
        raise ValueError(f"Assertion failed: expected 3240 rows, got {len(out_df)}")
    if out_df['city'].nunique() != 45:
        raise ValueError(f"Assertion failed: expected 45 cities, got {out_df['city'].nunique()}")
    if out_df.isna().any().any():
        raise ValueError("Assertion failed: NaN values found in output dataframe")

    lead_counts = out_df.groupby('lead_days').size().to_dict()
    if lead_counts != {1: 1080, 2: 1080, 3: 1080}:
        raise ValueError(f"Assertion failed: expected 1080 rows per lead_days, got {lead_counts}")

    if (out_df['rainfall'] < 0).any():
        raise ValueError("Assertion failed: negative rainfall values present")
    if (out_df['wind_speed'] < 0).any():
        raise ValueError("Assertion failed: negative wind_speed values present")

    if pd.to_datetime(out_df['datetime']).min() != min_datetime_clean:
        raise ValueError(f"Assertion failed: min datetime ({out_df['datetime'].min()}) != clean min ({min_datetime_clean})")

    # Format datetime as string %Y-%m-%d %H:%M:%S
    out_df['datetime'] = out_df['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')

    # 6. Save to NEW shadow file outputs/hybrid_forecast_6model.csv (DO NOT TOUCH hybrid_forecast.csv)
    out_path = base_dir / 'outputs' / 'hybrid_forecast_6model.csv'
    out_df.to_csv(out_path, index=False)
    print(f"\n[SUCCESS] Saved 6-model hybrid forecast to: {out_path}")

    # 7. Print summary statistics: (hybrid - blend) per variable & lead_days
    print("\n=== 6-MODEL HYBRID VS BLEND DIFFERENCE STATISTICS (hybrid - blend) ===")
    for var in ['temperature', 'rainfall', 'wind_speed']:
        diff = out_df[var] - out_df[f'blend_{var}']
        print(f"\n-- Variable: {var} --")
        for lead in [1, 2, 3]:
            mask = out_df['lead_days'] == lead
            sub_diff = diff[mask]
            print(f" Lead {lead}: mean={sub_diff.mean():+.4f}, std={sub_diff.std():.4f}, min={sub_diff.min():+.4f}, max={sub_diff.max():+.4f}")

    # 8. Print first 8 rows
    print("\n=== FIRST 8 ROWS OF outputs/hybrid_forecast_6model.csv ===")
    print(out_df.head(8).to_string(index=False))

    # 9. DELTA Comparison vs CURRENT LIVE PRODUCTION (outputs/hybrid_forecast.csv)
    compare_with_live_production(out_df, out_path)


if __name__ == '__main__':
    main()
