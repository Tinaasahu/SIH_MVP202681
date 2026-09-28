import os
import joblib
import numpy as np
import pandas as pd

# Top-level named constants
TRAIN = 'train'
TEST = 'test'

VARIABLES = {
    'temperature': 'actual_temperature',
    'rainfall': 'actual_rainfall',
    'wind_speed': 'actual_wind'
}

FEATURE_COLS = [
    'latitude', 'longitude', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]

EXPECTED_HYBRID_RMSE = {
    'temperature': {1: 0.8802, 2: 0.9609, 3: 1.0250},
    'rainfall': {1: 0.6760, 2: 0.6859, 3: 0.6942},
    'wind_speed': {1: 2.3376, 2: 2.4766, 3: 2.5819}
}

METHODS = [
    'ecmwf', 'gfs', 'icon', 'gem',
    'equal_avg', 'weighted_blend', 'bias_corrected', 'hybrid_rf'
]


def main():
    data_path = 'outputs/interim/ml_table.csv'
    df = pd.read_csv(data_path)
    df['datetime'] = pd.to_datetime(df['datetime'])

    train_df = df[df['split'] == TRAIN].copy()
    test_df = df[df['split'] == TEST].copy()

    records = []

    print("=== HYBRID RF CROSS-CHECK & PERFORMANCE EXPORT ===")

    for var, actual_col in VARIABLES.items():
        blend_col = f'blend_{var}'
        resid_col = f'resid_{var}'
        model_cols = [f'{var}_ecmwf', f'{var}_gfs', f'{var}_icon', f'{var}_gem']

        # Load trained RandomForest model
        model_path = f'outputs/models/rf_{var}.joblib'
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        rf = joblib.load(model_path)

        # Predict residuals on TEST split
        pred_test_resid = rf.predict(test_df[FEATURE_COLS])
        hybrid_test = test_df[blend_col] + pred_test_resid
        if var in ['rainfall', 'wind_speed']:
            hybrid_test = np.maximum(0, hybrid_test)

        # Compute TRAIN bias for blend
        bias_blend_df = train_df.groupby(['city', 'lead_days'])[resid_col].mean().reset_index()
        bias_blend_dict = bias_blend_df.set_index(['city', 'lead_days'])[resid_col].to_dict()
        keys_test = list(zip(test_df['city'], test_df['lead_days']))
        bias_blend_test = pd.Series([bias_blend_dict[k] for k in keys_test], index=test_df.index)

        bc_forecast = test_df[blend_col] + bias_blend_test
        if var in ['rainfall', 'wind_speed']:
            bc_forecast = np.maximum(0, bc_forecast)

        # Baseline & model forecasts on TEST split
        test_forecasts = {
            'ecmwf': test_df[f'{var}_ecmwf'],
            'gfs': test_df[f'{var}_gfs'],
            'icon': test_df[f'{var}_icon'],
            'gem': test_df[f'{var}_gem'],
            'equal_avg': test_df[model_cols].mean(axis=1),
            'weighted_blend': test_df[blend_col],
            'bias_corrected': bc_forecast,
            'hybrid_rf': hybrid_test,
        }

        # Clip rainfall and wind at 0
        if var in ['rainfall', 'wind_speed']:
            for m in ['ecmwf', 'gfs', 'icon', 'gem', 'equal_avg', 'weighted_blend']:
                test_forecasts[m] = np.maximum(0, test_forecasts[m])

        actual_test = test_df[actual_col]

        for lead in [1, 2, 3]:
            mask = test_df['lead_days'] == lead
            act = actual_test[mask]

            for m in METHODS:
                fc = test_forecasts[m][mask]
                err = act - fc
                rmse = float(np.sqrt(np.mean(err ** 2)))
                mae = float(np.mean(np.abs(err)))

                records.append({
                    'variable': var,
                    'lead_days': lead,
                    'method': m,
                    'rmse': round(rmse, 4),
                    'mae': round(mae, 4)
                })

                if m == 'hybrid_rf':
                    exp = EXPECTED_HYBRID_RMSE[var][lead]
                    status = "MATCH" if abs(rmse - exp) <= 0.001 else "MISMATCH"
                    print(f"[{var}] hybrid_rf lead {lead}: computed={rmse:.4f}, expected={exp:.4f} -> {status}")

    # Write outputs/performance_summary.csv
    out_df = pd.DataFrame(records)
    out_path = 'outputs/performance_summary.csv'
    out_df.to_csv(out_path, index=False)
    print(f"\nSuccessfully wrote {len(out_df)} rows to {out_path}")


if __name__ == '__main__':
    main()
