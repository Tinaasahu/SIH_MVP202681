import numpy as np
import pandas as pd
from pathlib import Path

# 29 feature columns in exact specified order
FEATURE_COLS = [
    'latitude', 'longitude', 'elevation_m', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem', 'temperature_ukmo', 'temperature_jma',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem', 'rainfall_ukmo', 'rainfall_jma',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem', 'wind_speed_ukmo', 'wind_speed_jma',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]

ACTUAL_COLS = ['actual_temperature', 'actual_rainfall', 'actual_wind']

TARGET_COLS = ['resid_temperature', 'resid_rainfall', 'resid_wind_speed']

MODELS = ['ecmwf', 'gfs', 'icon', 'gem', 'ukmo', 'jma']


def main():
    base_dir = Path(__file__).resolve().parent.parent
    pairs_path = base_dir / 'outputs' / 'interim' / 'pairs_lead_6model_blend.csv'
    cities_path = base_dir / 'data' / 'cities.csv'
    output_path = base_dir / 'outputs' / 'interim' / 'ml_table_6model.csv'

    # 1. Load pairs_lead_6model_blend.csv and parse datetime. Load data/cities.csv
    print(f"Reading pairs data from {pairs_path}...")
    df = pd.read_csv(pairs_path, low_memory=False)
    df['datetime'] = pd.to_datetime(df['datetime'])

    print(f"Reading cities metadata from {cities_path}...")
    cities_df = pd.read_csv(cities_path)

    # Check required columns in cities.csv
    required_city_cols = {'city', 'latitude', 'longitude'}
    if not required_city_cols.issubset(cities_df.columns):
        missing = required_city_cols - set(cities_df.columns)
        raise ValueError(f"cities.csv is missing required columns: {missing}")

    # Check city sets match exactly (45 cities)
    pairs_cities = set(df['city'].unique())
    cities_file_cities = set(cities_df['city'].unique())
    if pairs_cities != cities_file_cities or len(cities_file_cities) != 45:
        raise ValueError(
            f"City sets differ or count is not 45. Pairs cities: {len(pairs_cities)}, Cities file: {len(cities_file_cities)}"
        )

    # 2. Left-merge latitude and longitude onto pairs by city
    df = df.merge(cities_df[['city', 'latitude', 'longitude']], on='city', how='left')

    # 3. Add hour = datetime.hour
    df['hour'] = df['datetime'].dt.hour

    # 4. Add 6-model spread (max - min) across all 6 models for temperature, rainfall, wind_speed
    for var in ['temperature', 'rainfall', 'wind_speed']:
        cols = [f'{var}_{m}' for m in MODELS]
        df[f'spread_{var}'] = df[cols].max(axis=1) - df[cols].min(axis=1)

    # 5. Add targets (actual - blend)
    df['resid_temperature'] = df['actual_temperature'] - df['blend_temperature']
    df['resid_rainfall'] = df['actual_rainfall'] - df['blend_rainfall']
    df['resid_wind_speed'] = df['actual_wind'] - df['blend_wind_speed']

    # 6. Set exact output column ordering
    output_cols = ['city', 'datetime', 'split'] + FEATURE_COLS + ACTUAL_COLS + TARGET_COLS
    df = df[output_cols]

    # --- ASSERTIONS ---
    # Assertion 1: Shape check - exactly 197640 rows, 38 columns (3 metadata + 29 features + 3 actuals + 3 targets)
    if df.shape != (197640, 38):
        raise ValueError(f"Expected shape (197640, 38), got {df.shape}")

    # Assertion 2: No NaN anywhere
    if df.isna().any().any():
        raise ValueError("DataFrame contains NaN values")

    # Assertion 3: No name in FEATURE_COLS starts with 'actual' or 'resid'
    for col in FEATURE_COLS:
        if col.startswith('actual') or col.startswith('resid'):
            raise ValueError(f"Feature column '{col}' starts with 'actual' or 'resid'")

    # Assertion 4: Split counts unchanged (train 136080, test 61560)
    train_count = (df['split'] == 'train').sum()
    test_count = (df['split'] == 'test').sum()
    if train_count != 136080 or test_count != 61560:
        raise ValueError(f"Invalid split counts: train={train_count}, test={test_count}")

    # Assertion 5: Unique on (city, datetime, lead_days)
    if df.duplicated(subset=['city', 'datetime', 'lead_days']).any():
        raise ValueError("(city, datetime, lead_days) contains duplicate combinations")

    # Assertion 6: Every spread >= 0
    spread_cols = ['spread_temperature', 'spread_rainfall', 'spread_wind_speed']
    if (df[spread_cols] < 0).any().any():
        raise ValueError("Found negative spread values")

    print("=" * 70)
    print("[SUCCESS] All Quality Assertions Passed!")
    print("=" * 70)

    # --- CROSS-CHECK RMSE ON TEST SPLIT PER LEAD_DAYS ---
    expected_rmse = {
        'resid_temperature': {1: 0.9950, 2: 1.0809, 3: 1.1350},
        'resid_rainfall': {1: 0.7256, 2: 0.7382, 3: 0.7513},
        'resid_wind_speed': {1: 2.6307, 2: 2.8457, 3: 2.9784},
    }

    test_df = df[df['split'] == 'test']
    print("\n" + "=" * 70)
    print("CROSS-CHECK: TEST SPLIT RESIDUAL RMSE vs 6-MODEL BLEND RMSE")
    print("=" * 70)
    all_match = True
    for target_col, expected in expected_rmse.items():
        for lead in [1, 2, 3]:
            sub = test_df[test_df['lead_days'] == lead]
            rmse = np.sqrt(np.mean(sub[target_col] ** 2))
            exp_val = expected[lead]
            diff = abs(rmse - exp_val)
            status = "MATCH" if diff <= 0.001 else "MISMATCH"
            if status != "MATCH":
                all_match = False
            print(f" {target_col:18s} | Lead {lead} | Computed: {rmse:.4f} | Expected: {exp_val:.4f} | Status: {status}")

    print("=" * 70)
    print(f"Overall Cross-Check Result: [{'ALL MATCH' if all_match else 'MISMATCH DETECTED'}]")
    print("=" * 70)

    # --- PRINT SUMMARY ---
    print("\n--- Output Summary ---")
    print(f"Shape: {df.shape}")
    print(f"\n{len(df.columns)} Column Names:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i:2d}. {col}")

    print("\n--- Target Residual Statistics (Mean & Std) ---")
    train_df = df[df['split'] == 'train']
    for target in TARGET_COLS:
        tr_mean, tr_std = train_df[target].mean(), train_df[target].std()
        te_mean, te_std = test_df[target].mean(), test_df[target].std()
        print(f"{target}:")
        print(f"  Train -> mean: {tr_mean:.4f}, std: {tr_std:.4f}")
        print(f"  Test  -> mean: {te_mean:.4f}, std: {te_std:.4f}")

    # --- SAVE OUTPUT ---
    df['datetime'] = df['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
    df.to_csv(output_path, index=False)
    print(f"\nWrote {output_path} successfully.")


if __name__ == '__main__':
    main()
