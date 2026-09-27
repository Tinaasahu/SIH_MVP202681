"""
ai/make_3d_chart.py
Reads trained RF models and ml_table.csv, computes real RMSE metrics across
forecast methods and lead days, and generates a 3D performance matrix chart.

Outputs exactly one file: outputs/charts/chart4_3d_performance_matrix.png
Never modifies or retrains models, never writes to data/ or other outputs.
"""
import os
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 (registers 3d projection)

# Top-level named constants
TEST = 'test'
TRAIN = 'train'

# Variable mappings: variable -> actual column
VARIABLES = {
    'temperature': 'actual_temperature',
    'rainfall': 'actual_rainfall',
    'wind_speed': 'actual_wind'
}

# NWP models
MODELS = ['ecmwf', 'gfs', 'icon', 'gem']

# Methods and lead times
METHODS = ['ecmwf', 'equal_avg', 'weighted_blend', 'bias_corrected', 'hybrid_rf']
LEADS = [1, 2, 3]
LEAD_LABELS = {1: '24h', 2: '48h', 3: '72h'}

# Exact 22-column list copied character-for-character from ai/train.py
FEATURE_COLS = [
    'latitude', 'longitude', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]

# Benchmark hybrid_rf TEST RMSE for cross-check (tolerance: 0.001)
EXPECTED_HYBRID_RMSE = {
    'temperature': {1: 0.8802, 2: 0.9609, 3: 1.0250},
    'rainfall':    {1: 0.6760, 2: 0.6859, 3: 0.6942},
    'wind_speed':  {1: 2.3376, 2: 2.4766, 3: 2.5819}
}

METHOD_LABELS = {
    'ecmwf': 'ECMWF',
    'equal_avg': 'Equal Avg',
    'weighted_blend': 'Weighted Blend',
    'bias_corrected': 'Bias Corrected',
    'hybrid_rf': 'Hybrid RF'
}

METHOD_COLORS = {
    'ecmwf': '#4A90E2',          # Muted Blue
    'equal_avg': '#50B86C',       # Emerald Green
    'weighted_blend': '#9B59B6',  # Amethyst Purple
    'bias_corrected': '#34495E',  # Charcoal Navy
    'hybrid_rf': '#FF6F00'        # Distinct Vivid Amber / Orange Highlight
}


def compute_rmse(actual, forecast):
    """Compute Root Mean Squared Error."""
    return float(np.sqrt(np.mean((actual - forecast) ** 2)))


def main():
    # If run from workspace root instead of SIH_MVP202681, change to project root
    if not os.path.exists('outputs') and os.path.exists('SIH_MVP202681/outputs'):
        os.chdir('SIH_MVP202681')

    # 1. Load data and parse datetime
    data_path = 'outputs/interim/ml_table.csv'
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Cannot find ml_table.csv at '{data_path}'")

    df = pd.read_csv(data_path)
    df['datetime'] = pd.to_datetime(df['datetime'])

    train_df = df[df['split'] == TRAIN].copy()
    test_df = df[df['split'] == TEST].copy()

    # --- Assertions ---
    if len(test_df) != 61560:
        raise ValueError(f"Assertion failed: expected 61560 test rows, found {len(test_df)}")

    if test_df[FEATURE_COLS].isna().any().any():
        raise ValueError("Assertion failed: NaN values found in FEATURE_COLS for test split")

    # 2 & 3. Compute real test RMSE per lead_days for each variable and method
    results = {v: {m: {} for m in METHODS} for v in VARIABLES}
    cross_check_status = []

    for var, actual_col in VARIABLES.items():
        blend_col = f'blend_{var}'
        resid_col = f'resid_{var}'
        ecmwf_col = f'{var}_ecmwf'

        # Methods a, b, c: forecasts on test split
        ecmwf_fc = test_df[ecmwf_col].values
        nwp_model_cols = [f'{var}_{m}' for m in MODELS]
        equal_avg_fc = test_df[nwp_model_cols].mean(axis=1).values
        weighted_blend_fc = test_df[blend_col].values

        # Method d: bias_corrected
        # blend_<variable> + mean(resid_<variable> over TRAIN grouped by city + lead_days)
        train_bias_group = train_df.groupby(['city', 'lead_days'])[resid_col].mean()
        test_city_lead_keys = list(zip(test_df['city'], test_df['lead_days']))
        test_bias_correction = np.array([train_bias_group.loc[k] for k in test_city_lead_keys])

        bias_corrected_fc = weighted_blend_fc + test_bias_correction
        if var in ['rainfall', 'wind_speed']:
            bias_corrected_fc = np.maximum(0, bias_corrected_fc)

        # Method e: hybrid_rf
        # Load joblib model and predict residual on test_df[FEATURE_COLS]
        model_path = f'outputs/models/rf_{var}.joblib'
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: '{model_path}'")

        rf = joblib.load(model_path)
        pred_residual = rf.predict(test_df[FEATURE_COLS])

        # Assertion: model predicts successfully on test rows
        if len(pred_residual) != len(test_df):
            raise ValueError(f"Model {var} prediction length mismatch: {len(pred_residual)} vs {len(test_df)}")

        hybrid_rf_fc = weighted_blend_fc + pred_residual
        if var in ['rainfall', 'wind_speed']:
            hybrid_rf_fc = np.maximum(0, hybrid_rf_fc)

        # Forecast mapping for evaluation
        forecast_dict = {
            'ecmwf': ecmwf_fc,
            'equal_avg': equal_avg_fc,
            'weighted_blend': weighted_blend_fc,
            'bias_corrected': bias_corrected_fc,
            'hybrid_rf': hybrid_rf_fc
        }

        actual_test_series = test_df[actual_col].values

        # Compute RMSE per lead day
        for lead in LEADS:
            mask = (test_df['lead_days'] == lead).values
            act = actual_test_series[mask]

            for m in METHODS:
                fc = forecast_dict[m][mask]
                results[var][m][lead] = compute_rmse(act, fc)

            # Cross-check hybrid_rf RMSE
            computed_hybrid_rmse = results[var]['hybrid_rf'][lead]
            expected_hybrid_rmse = EXPECTED_HYBRID_RMSE[var][lead]
            diff = abs(computed_hybrid_rmse - expected_hybrid_rmse)
            status = "MATCH" if diff <= 0.001 else "MISMATCH"
            cross_check_status.append((var, lead, computed_hybrid_rmse, expected_hybrid_rmse, status))

    # 4. Print RMSE table per variable (rows = method, columns = lead_days)
    print("\n" + "=" * 76)
    print("  TEST RMSE PERFORMANCE MATRIX (REAL COMPUTATION)")
    print("=" * 76)

    for var in VARIABLES:
        var_name = var.replace('_', ' ').title()
        print(f"\n--- Variable: {var_name} ---")
        header = f"{'Method':<20}" + "".join([f"{LEAD_LABELS[l]:>15}" for l in LEADS])
        print(header)
        print("-" * len(header))
        for m in METHODS:
            row_str = f"{METHOD_LABELS[m]:<20}"
            for l in LEADS:
                row_str += f"{results[var][m][l]:>15.4f}"
            print(row_str)

    # Cross-check report
    print("\n" + "=" * 76)
    print("  CROSS-CHECK: HYBRID_RF TEST RMSE (TOLERANCE: 0.001)")
    print("=" * 76)
    mismatch_detected = False
    for var, lead, comp, exp, status in cross_check_status:
        msg = f"  {var:<12} lead_{lead} ({LEAD_LABELS[lead]}): computed = {comp:.4f}, expected = {exp:.4f} -> {status}"
        if status == "MISMATCH":
            mismatch_detected = True
            print(f"  [WARNING] {msg}")
        else:
            print(f"  {msg}")

    if mismatch_detected:
        print("\n  [WARNING] One or more MISMATCH values detected! Proceeding with real computed values.")

    # 5. Build 3D Bar Chart
    # Create outputs/charts/ folder if missing
    os.makedirs('outputs/charts', exist_ok=True)

    fig = plt.figure(figsize=(19, 7))
    fig.suptitle('Weather Forecast Error Matrix — 3D RMSE Comparison across Methods and Lead Days',
                 fontsize=14, fontweight='bold', y=0.98)

    dx_val = 0.45
    dy_val = 0.45

    for idx, (var, actual_col) in enumerate(VARIABLES.items(), start=1):
        ax = fig.add_subplot(1, 3, idx, projection='3d')

        x_coords = []
        y_coords = []
        z_coords = []
        dx_list = []
        dy_list = []
        dz_list = []
        bar_colors = []

        for m_idx, m in enumerate(METHODS):
            for l_idx, lead in enumerate(LEADS):
                rmse_val = results[var][m][lead]
                x_coords.append(m_idx - dx_val / 2)
                y_coords.append(l_idx - dy_val / 2)
                z_coords.append(0.0)
                dx_list.append(dx_val)
                dy_list.append(dy_val)
                dz_list.append(rmse_val)
                bar_colors.append(METHOD_COLORS[m])

        # Plot 3D bars
        ax.bar3d(x_coords, y_coords, z_coords, dx_list, dy_list, dz_list,
                 color=bar_colors, alpha=0.88, edgecolor='#333333', linewidth=0.5)

        # Annotate hybrid_rf bar heights with their numeric value
        hybrid_m_idx = METHODS.index('hybrid_rf')
        for l_idx, lead in enumerate(LEADS):
            val = results[var]['hybrid_rf'][lead]
            # Height offset slightly above the bar top
            ax.text(hybrid_m_idx, l_idx, val + (val * 0.04),
                    f"{val:.3f}",
                    ha='center', va='bottom', fontsize=8.5, fontweight='bold', color='#B33C00')

        # Formatting axes
        ax.set_xticks(range(len(METHODS)))
        ax.set_xticklabels([METHOD_LABELS[m] for m in METHODS], rotation=-15, ha='left', fontsize=7.5)

        ax.set_yticks(range(len(LEADS)))
        ax.set_yticklabels([LEAD_LABELS[l] for l in LEADS], fontsize=8)

        ax.set_zlabel('RMSE', fontsize=9, labelpad=5)
        ax.set_title(var.replace('_', ' ').title(), fontsize=12, fontweight='bold', pad=10)

        # Optimized viewing perspective
        ax.view_init(elev=24, azim=-55)

    # Shared legend
    legend_handles = [
        mpatches.Patch(facecolor=METHOD_COLORS[m], edgecolor='#333333', label=METHOD_LABELS[m])
        for m in METHODS
    ]
    fig.legend(handles=legend_handles, loc='upper center', bbox_to_anchor=(0.5, 0.93),
               ncol=len(METHODS), fontsize=9.5, frameon=True)

    plt.subplots_adjust(top=0.84, bottom=0.08, left=0.04, right=0.96, wspace=0.18)

    output_chart_path = 'outputs/charts/chart4_3d_performance_matrix.png'
    fig.savefig(output_chart_path, dpi=200, bbox_inches='tight')
    plt.close(fig)

    print(f"\n[SUCCESS] Exactly one new file written: {output_chart_path}")


if __name__ == '__main__':
    main()
