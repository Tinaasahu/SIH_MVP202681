import os
import joblib
import numpy as np
import pandas as pd

# Top-level named constants
FEATURE_COLS = [
    'latitude', 'longitude', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]

VARIABLES = {
    'temperature': 'actual_temperature',
    'rainfall': 'actual_rainfall',
    'wind_speed': 'actual_wind'
}


def predict_hybrid(df):
    """
    For each variable, load its trained RF model, predict residuals,
    and add residual to blend_<variable>. Clip rainfall & wind_speed at 0.
    """
    hybrids = {}
    residuals = {}
    for var in VARIABLES.keys():
        model_path = f'outputs/models/rf_{var}.joblib'
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
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
    Cross-check hybrid RF predictions on TEST split of ml_table.csv.
    Print RMSE per variable and lead_days next to expected values.
    """
    print("=== CROSS-CHECK TEST RMSE (HYBRID RF) ===")
    df = pd.read_csv(ml_table_path)
    test_df = df[df['split'] == 'test'].copy()

    expected_rmse = {
        'temperature': {1: 0.8802, 2: 0.9609, 3: 1.0250},
        'rainfall':    {1: 0.6760, 2: 0.6859, 3: 0.6942},
        'wind_speed':  {1: 2.3376, 2: 2.4766, 3: 2.5819}
    }

    hybrids, _ = predict_hybrid(test_df)

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
            print(f" {var:<11} lead{lead}: computed={computed_rmse:.4f}, expected={exp_rmse:.4f} -> {status}")
    print("=" * 60 + "\n")


def build_current_features():
    """
    Build feature matrix for today's forecast from forecast_current_clean.csv,
    data/cities.csv, and outputs/blended_forecast.csv.
    """
    # 1. Read & parse forecast_current_clean
    fc_path = 'outputs/interim/forecast_current_clean.csv'
    fc_df = pd.read_csv(fc_path)
    fc_df['datetime'] = pd.to_datetime(fc_df['datetime'])

    min_datetime_clean = fc_df['datetime'].min()

    # Pivot to one row per (city, datetime) with 12 model columns
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

    # 3. Merge latitude, longitude from data/cities.csv
    cities_df = pd.read_csv('data/cities.csv')
    df = pd.merge(df, cities_df[['city', 'latitude', 'longitude']], on='city', how='left')

    if df['latitude'].isna().any() or df['longitude'].isna().any():
        raise ValueError("Some cities could not be matched with data/cities.csv")
    if df['city'].nunique() != 45:
        raise ValueError(f"Expected 45 unique cities, got {df['city'].nunique()}")

    # 4. Extract hour
    df['hour'] = df['datetime'].dt.hour

    # 5. Compute spread_<variable> = max - min of the 4 model forecasts
    for var in ['temperature', 'rainfall', 'wind_speed']:
        mod_cols = [f'{var}_{m}' for m in ['ecmwf', 'gfs', 'icon', 'gem']]
        df[f'spread_{var}'] = df[mod_cols].max(axis=1) - df[mod_cols].min(axis=1)

    # 6. Merge blend_temperature, blend_rainfall, blend_wind_speed from outputs/blended_forecast.csv
    blended_path = 'outputs/blended_forecast.csv'
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


def main():
    # 1. Feature sanity assertion
    for col in FEATURE_COLS:
        if col.startswith('actual') or col.startswith('resid'):
            raise ValueError(f"Feature column '{col}' starts with 'actual' or 'resid'")

    # 2. Step 3: Cross-check first
    cross_check_test('outputs/interim/ml_table.csv')

    # 3. Step 4: Build features for current forecast
    curr_df, min_datetime_clean = build_current_features()

    # 4. Step 5: Apply predict_hybrid
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

    # Format datetime column as %Y-%m-%d %H:%M:%S without rounding float values
    out_df['datetime'] = out_df['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')

    # 6. Save output file
    os.makedirs('outputs', exist_ok=True)
    out_path = 'outputs/hybrid_forecast.csv'
    out_df.to_csv(out_path, index=False)

    # 7. Print summary statistics: (hybrid - blend) per variable & lead_days
    print("=== HYBRID VS BLEND DIFFERENCE STATISTICS (hybrid - blend) ===")
    raw_datetime_out = pd.to_datetime(out_df['datetime'])
    for var in ['temperature', 'rainfall', 'wind_speed']:
        diff = out_df[var] - out_df[f'blend_{var}']
        print(f"\n-- Variable: {var} --")
        for lead in [1, 2, 3]:
            mask = out_df['lead_days'] == lead
            sub_diff = diff[mask]
            print(f" Lead {lead}: mean={sub_diff.mean():+.4f}, std={sub_diff.std():.4f}, min={sub_diff.min():+.4f}, max={sub_diff.max():+.4f}")

    # 8. Print first 8 rows
    print("\n=== FIRST 8 ROWS OF OUTPUT (outputs/hybrid_forecast.csv) ===")
    print(out_df.head(8).to_string(index=False))


if __name__ == '__main__':
    main()
