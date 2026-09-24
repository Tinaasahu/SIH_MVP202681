import numpy as np
import pandas as pd

# Named constants at top of file
TRAIN = 'train'
TEST = 'test'

ACTUAL_COLS = {
    'temperature': 'actual_temperature',
    'rainfall': 'actual_rainfall',
    'wind_speed': 'actual_wind'
}


def main():
    # 1. Load ml_table.csv and parse datetime
    data_path = 'outputs/interim/ml_table.csv'
    df = pd.read_csv(data_path)
    df['datetime'] = pd.to_datetime(df['datetime'])

    train_df = df[df['split'] == TRAIN]
    test_df = df[df['split'] == TEST]

    # --- Assertions ---
    # Assert row counts
    if len(train_df) != 136080 or len(test_df) != 61560:
        raise ValueError(f"Invalid split counts: TRAIN={len(train_df)}, TEST={len(test_df)}")

    # Assert max datetime in TRAIN is earlier than 2026-08-29
    max_train_dt = train_df['datetime'].max()
    if max_train_dt >= pd.Timestamp('2026-08-29'):
        raise ValueError(f"Max TRAIN datetime ({max_train_dt}) is not earlier than 2026-08-29")

    # Expected weighted_blend RMSE on TEST for cross-checking
    expected_blend_rmse = {
        'temperature': {1: 1.0607, 2: 1.1501, 3: 1.2194},
        'rainfall': {1: 0.7475, 2: 0.7915, 3: 0.8012},
        'wind_speed': {1: 2.9883, 2: 3.2254, 3: 3.3334},
    }

    print("=== CROSS-CHECK WEIGHTED_BLEND TEST RMSE ===")
    for var in ['temperature', 'rainfall', 'wind_speed']:
        actual = test_df[ACTUAL_COLS[var]]
        blend = test_df[f'blend_{var}']
        for lead in [1, 2, 3]:
            mask = test_df['lead_days'] == lead
            rmse = np.sqrt(np.mean((actual[mask] - blend[mask]) ** 2))
            exp = expected_blend_rmse[var][lead]
            diff = abs(rmse - exp)
            status = "MATCH" if diff <= 0.001 else "MISMATCH"
            print(f" {var} lead{lead}: computed={rmse:.4f}, expected={exp:.4f} -> {status}")

    print("\n" + "=" * 60)

    # Process each variable
    for var in ['temperature', 'rainfall', 'wind_speed']:
        actual_col = ACTUAL_COLS[var]
        blend_col = f'blend_{var}'
        resid_col = f'resid_{var}'
        model_cols = [f'{var}_ecmwf', f'{var}_gfs', f'{var}_icon', f'{var}_gem']

        # 3. Compute bias table on TRAIN rows only (mean of resid_<variable> by city, lead_days)
        bias_df = train_df.groupby(['city', 'lead_days'])[resid_col].mean().reset_index()
        bias_df = bias_df.rename(columns={resid_col: 'bias'})

        # Assert bias table row count and no NaN
        if len(bias_df) != 135 or bias_df['bias'].isna().any():
            raise ValueError(f"Bias table for {var} has invalid row count ({len(bias_df)}) or contains NaNs")

        # Map bias to TEST rows
        bias_dict = bias_df.set_index(['city', 'lead_days'])['bias'].to_dict()
        keys = list(zip(test_df['city'], test_df['lead_days']))
        bias_series = pd.Series([bias_dict[k] for k in keys], index=test_df.index)

        # 4. Generate forecasts for TEST split
        forecasts = {}
        forecasts['ecmwf'] = test_df[f'{var}_ecmwf']
        forecasts['equal_avg'] = test_df[model_cols].mean(axis=1)
        forecasts['weighted_blend'] = test_df[blend_col]

        bc_forecast = test_df[blend_col] + bias_series
        if var in ['rainfall', 'wind_speed']:
            bc_forecast = np.maximum(0, bc_forecast)
        forecasts['bias_corrected'] = bc_forecast

        actual = test_df[actual_col]

        # Compute metrics per method and lead_days
        methods = ['ecmwf', 'equal_avg', 'weighted_blend', 'bias_corrected']
        metrics = {m: {'rmse': {}, 'mae': {}} for m in methods}

        for m in methods:
            fc = forecasts[m]
            for lead in [1, 2, 3]:
                mask = test_df['lead_days'] == lead
                err = actual[mask] - fc[mask]
                rmse = np.sqrt(np.mean(err ** 2))
                mae = np.mean(np.abs(err))
                metrics[m]['rmse'][lead] = rmse
                metrics[m]['mae'][lead] = mae

        # Print metrics table
        print(f"\n--- EVALUATION SUMMARY TABLE FOR: {var.upper()} ---")
        headers = ["Method", "RMSE_L1", "RMSE_L2", "RMSE_L3", "MAE_L1", "MAE_L2", "MAE_L3"]
        print(f"{headers[0]:<16} | {headers[1]:<8} | {headers[2]:<8} | {headers[3]:<8} | {headers[4]:<8} | {headers[5]:<8} | {headers[6]:<8}")
        print("-" * 75)
        for m in methods:
            r1 = metrics[m]['rmse'][1]
            r2 = metrics[m]['rmse'][2]
            r3 = metrics[m]['rmse'][3]
            m1 = metrics[m]['mae'][1]
            m2 = metrics[m]['mae'][2]
            m3 = metrics[m]['mae'][3]
            print(f"{m:<16} | {r1:<8.4f} | {r2:<8.4f} | {r3:<8.4f} | {m1:<8.4f} | {m2:<8.4f} | {m3:<8.4f}")

        # Print bias_corrected relative improvements
        print(f"\n--- BIAS CORRECTED COMPARISONS ({var.upper()}) ---")
        for lead in [1, 2, 3]:
            rmse_bc = metrics['bias_corrected']['rmse'][lead]
            rmse_wb = metrics['weighted_blend']['rmse'][lead]
            rmse_ec = metrics['ecmwf']['rmse'][lead]

            diff_wb = rmse_bc - rmse_wb
            pct_wb = (diff_wb / rmse_wb) * 100

            diff_ec = rmse_bc - rmse_ec
            pct_ec = (diff_ec / rmse_ec) * 100

            print(f"Lead {lead}:")
            print(f"  bias_corrected vs weighted_blend RMSE diff: {diff_wb:+.4f} ({pct_wb:+.2f}%)")
            print(f"  bias_corrected vs ecmwf          RMSE diff: {diff_ec:+.4f} ({pct_ec:+.2f}%)")

        print("=" * 60)


if __name__ == '__main__':
    main()
