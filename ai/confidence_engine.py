"""
Explainable Confidence Engine (ECE)
Hybrid AI–NWP Multi-Model Forecast Blending System
Smart India Hackathon 2026 (PS: 26081)

Calculates an explainable confidence score (0–100%) for every blended forecast
using the exact formulation:
    Confidence = 0.5 * Skill + 0.3 * Agreement + 0.2 * Lead

Outputs:
    outputs/confidence_scores.csv
"""

import os
import numpy as np
import pandas as pd
from pathlib import Path


# Model name mapping from raw source naming to standardized identifiers
MODEL_MAP = {
    'ecmwf_ifs025': 'ecmwf',
    'gfs_seamless': 'gfs',
    'icon_seamless': 'icon',
    'gem_seamless': 'gem',
}

# Lead day scoring lookup: Day 1 -> 100, Day 2 -> 80, Day 3 -> 60, Day 4 -> 50, Day 5 -> 40, Day 6 -> 30
LEAD_SCORE_MAP = {
    1: 100.0,
    2: 80.0,
    3: 60.0,
    4: 50.0,
    5: 40.0,
    6: 30.0,
}


def compute_skill_scores(skill_scores_path: str) -> pd.DataFrame:
    """
    Step 1: Skill Score
    Reads skill_scores_lead.csv.
    Normalizes RMSE per variable into a 0-100 score using Min-Max normalization
    where lower RMSE yields a higher skill score:
        score = (rmse_max - rmse) / (rmse_max - rmse_min) * 100
    Computes average score across variables for each model and city-lead pair.
    The highest-performing model receives the highest skill score.
    Returns DataFrame with [city, lead_day, skill_score].
    """
    df_skill = pd.read_csv(skill_scores_path)

    # Standardize column naming if needed (lead_days -> lead_day)
    lead_col = 'lead_day' if 'lead_day' in df_skill.columns else 'lead_days'

    # Min-Max normalization per variable: lower RMSE = higher score
    df_skill['norm_skill'] = 0.0
    for var in df_skill['variable'].unique():
        mask = df_skill['variable'] == var
        rmse_min = df_skill.loc[mask, 'rmse'].min()
        rmse_max = df_skill.loc[mask, 'rmse'].max()
        if rmse_max > rmse_min:
            df_skill.loc[mask, 'norm_skill'] = (
                (rmse_max - df_skill.loc[mask, 'rmse']) / (rmse_max - rmse_min) * 100.0
            )
        else:
            df_skill.loc[mask, 'norm_skill'] = 100.0

    # Average score across variables for each (city, lead, model)
    model_skill = (
        df_skill.groupby(['city', lead_col, 'model'])['norm_skill']
        .mean()
        .reset_index()
    )

    # Highest performing model's skill score per (city, lead)
    best_skill = (
        model_skill.groupby(['city', lead_col])['norm_skill']
        .max()
        .reset_index()
        .rename(columns={lead_col: 'lead_day', 'norm_skill': 'skill_score'})
    )
    best_skill['skill_score'] = best_skill['skill_score'].round(2)
    return best_skill


def std_to_agreement(std_dev: float | np.ndarray) -> float | np.ndarray:
    """
    Piecewise linear interpolation mapping standard deviation to agreement score (0-100):
      Std Dev <= 0.5 -> 95 to 100
      0.5 - 1.0     -> 80 to 95
      1.0 - 2.0     -> 60 to 80
      > 2.0         -> below 60 (smoothly down to 30 at std=4.0, 5 at std=8.0)
    """
    xp = [0.0, 0.5, 1.0, 2.0, 4.0, 8.0]
    fp = [100.0, 95.0, 80.0, 60.0, 30.0, 5.0]
    return np.interp(std_dev, xp, fp)


def compute_agreement_scores(
    hybrid_forecast_path: str,
    forecast_current_path: str = 'data/forecast_current.csv'
) -> pd.DataFrame:
    """
    Step 2: Agreement Score
    For every city and datetime:
      Collects predictions from ECMWF, GFS, ICON, GEM.
      Calculates standard deviation of temperature, rainfall, and wind speed.
      Converts agreement into 0-100 using continuous interpolation.
      Computes composite agreement score across the variables.
    Returns DataFrame with [city, datetime, agreement_score].
    """
    # 1. Load multi-model forecasts (ECMWF, GFS, ICON, GEM)
    if os.path.exists(forecast_current_path):
        df_models = pd.read_csv(forecast_current_path)
        if 'model' in df_models.columns:
            df_models['model'] = df_models['model'].replace(MODEL_MAP)
        df_models['datetime'] = pd.to_datetime(df_models['datetime']).dt.strftime('%Y-%m-%d %H:%M:%S')
    else:
        raise FileNotFoundError(f"Multi-model forecast file not found: {forecast_current_path}")

    # Standardize column naming for wind
    wind_col = 'wind_speed' if 'wind_speed' in df_models.columns else 'wind'

    # Compute standard deviation across models for each (city, datetime)
    std_df = (
        df_models.groupby(['city', 'datetime'])[['temperature', 'rainfall', wind_col]]
        .std(ddof=1)
        .reset_index()
    )

    # Convert standard deviations to agreement scores via continuous interpolation
    agree_temp = std_to_agreement(std_df['temperature'].fillna(0).values)
    agree_rain = std_to_agreement(std_df['rainfall'].fillna(0).values)
    agree_wind = std_to_agreement(std_df[wind_col].fillna(0).values)

    # Composite agreement: mean of agreement across the three meteorological parameters
    std_df['agreement_score'] = np.round((agree_temp + agree_rain + agree_wind) / 3.0, 2)
    return std_df[['city', 'datetime', 'agreement_score']]


def get_lead_score(lead_day: int) -> float:
    """
    Step 3: Lead Score
      Day 1 -> 100
      Day 2 -> 80
      Day 3 -> 60
      Day 4 -> 50, Day 5 -> 40, Day 6 -> 30
    """
    if lead_day in LEAD_SCORE_MAP:
        return LEAD_SCORE_MAP[lead_day]
    return max(10.0, 30.0 - (lead_day - 6) * 10.0)


def compute_dominant_models(model_weights_path: str) -> pd.DataFrame:
    """
    Step 4: Dominant Model
    Reads model_weights_lead.csv.
    For each city and lead day, finds the model with the highest adaptive weight
    across the meteorological variables.
    Stores as dominant_model (e.g., ECMWF, ICON, GFS, GEM).
    Returns DataFrame with [city, lead_day, dominant_model].
    """
    df_weights = pd.read_csv(model_weights_path)
    lead_col = 'lead_day' if 'lead_day' in df_weights.columns else 'lead_days'

    # Compute mean adaptive weight across variables for each (city, lead, model)
    avg_weights = (
        df_weights.groupby(['city', lead_col, 'model'])['weight']
        .mean()
        .reset_index()
    )

    # Sort descending by weight and pick top model for each (city, lead)
    dominant = (
        avg_weights.sort_values(['city', lead_col, 'weight'], ascending=[True, True, False])
        .drop_duplicates(subset=['city', lead_col])
        .copy()
    )

    dominant['dominant_model'] = dominant['model'].str.upper()
    dominant = dominant.rename(columns={lead_col: 'lead_day'})
    return dominant[['city', 'lead_day', 'dominant_model']]


def get_confidence_label(confidence: float) -> str:
    """
    Step 5: Confidence Label
      90–100 -> Very High
      75–89  -> High
      60–74  -> Medium
      40–59  -> Low
      Below 40 -> Very Low
    """
    if confidence >= 89.5:
        return 'Very High'
    elif confidence >= 74.5:
        return 'High'
    elif confidence >= 59.5:
        return 'Medium'
    elif confidence >= 39.5:
        return 'Low'
    else:
        return 'Very Low'


def generate_explanation(
    confidence_label: str,
    dominant_model: str,
    skill_score: float,
    agreement_score: float,
    lead_day: int
) -> str:
    """
    Step 6: Explainability
    Automatically generates human-readable explanations based on model skill,
    ensemble agreement, lead time, and dominant model.
    Does NOT hardcode city names.
    """
    lead_text = "short-range forecast" if lead_day == 1 else (
        "48-hour forecast horizon" if lead_day == 2 else "extended Day 3 lead time"
    )

    if confidence_label == 'Very High':
        if agreement_score >= 80:
            return f"{dominant_model} has the highest historical skill, model agreement is strong, and this is a {lead_text}."
        else:
            return f"{dominant_model} exhibits outstanding regional skill, maintaining very high blend reliability for this {lead_text}."
    elif confidence_label == 'High':
        if agreement_score >= 80:
            return f"{dominant_model} and ensemble members agree closely, while RMSE remains low for this region."
        elif lead_day == 1:
            return f"{dominant_model} leads with strong short-range skill, with minor model spread in local precipitation."
        else:
            return f"Low regional RMSE supports {dominant_model} dominance, while the {lead_text} maintains stable predictability."
    elif confidence_label == 'Medium':
        if lead_day >= 3:
            return f"Models show moderate disagreement and the forecast lead time reduces reliability."
        elif agreement_score < 70:
            return f"Inter-model spread indicates divergence between NWP forecasts despite {dominant_model} weighting."
        else:
            return f"Moderate ensemble agreement and regional variability balance overall forecast confidence."
    elif confidence_label == 'Low':
        return "Large differences between models increase uncertainty despite blended prediction."
    else:  # Very Low
        return "Severe multi-model divergence and elevated historical error limit forecast confidence."


def generate_confidence_dataset(
    output_dir: str = 'outputs',
    data_dir: str = 'data'
) -> pd.DataFrame:
    """
    Orchestrates the Explainable Confidence Engine:
      1. Computes Skill Scores from skill_scores_lead.csv
      2. Computes Agreement Scores from multi-model forecasts
      3. Computes Lead Scores
      4. Identifies Dominant Models from model_weights_lead.csv
      5. Calculates Confidence = 0.5 * Skill + 0.3 * Agreement + 0.2 * Lead
      6. Assigns Confidence Labels
      7. Synthesizes Dynamic Explanations
      8. Exports outputs/confidence_scores.csv
    """
    hybrid_path = os.path.join(output_dir, 'hybrid_forecast.csv')
    weights_path = os.path.join(output_dir, 'model_weights_lead.csv')
    skill_path = os.path.join(output_dir, 'skill_scores_lead.csv')
    current_path = os.path.join(data_dir, 'forecast_current.csv')

    # Read base target hybrid forecast
    df_hybrid = pd.read_csv(hybrid_path)
    df_hybrid['datetime'] = pd.to_datetime(df_hybrid['datetime']).dt.strftime('%Y-%m-%d %H:%M:%S')

    lead_col = 'lead_day' if 'lead_day' in df_hybrid.columns else 'lead_days'
    df_base = df_hybrid[['city', 'datetime', lead_col]].copy()
    df_base = df_base.rename(columns={lead_col: 'lead_day'})

    # 1. Skill Scores
    df_skill = compute_skill_scores(skill_path)

    # 2. Agreement Scores
    df_agreement = compute_agreement_scores(hybrid_path, current_path)

    # 3. Dominant Models
    df_dominant = compute_dominant_models(weights_path)

    # Merge intermediate components
    df_conf = pd.merge(df_base, df_skill, on=['city', 'lead_day'], how='left')
    df_conf = pd.merge(df_conf, df_agreement, on=['city', 'datetime'], how='left')
    df_conf = pd.merge(df_conf, df_dominant, on=['city', 'lead_day'], how='left')

    # 4. Lead Score
    df_conf['lead_score'] = df_conf['lead_day'].apply(get_lead_score)

    # 5. Confidence Formula: 0.5 * Skill + 0.3 * Agreement + 0.2 * Lead
    raw_confidence = (
        0.5 * df_conf['skill_score'] +
        0.3 * df_conf['agreement_score'] +
        0.2 * df_conf['lead_score']
    )
    # Clip between 0 and 100
    df_conf['confidence'] = np.clip(np.round(raw_confidence, 1), 0.0, 100.0)

    # 6. Confidence Labels
    df_conf['confidence_label'] = df_conf['confidence'].apply(get_confidence_label)

    # 7. Human-Readable Explanations
    df_conf['explanation'] = [
        generate_explanation(
            row['confidence_label'],
            row['dominant_model'],
            row['skill_score'],
            row['agreement_score'],
            row['lead_day']
        )
        for _, row in df_conf.iterrows()
    ]

    # Required column order
    cols_order = [
        'city',
        'datetime',
        'lead_day',
        'confidence',
        'confidence_label',
        'skill_score',
        'agreement_score',
        'lead_score',
        'dominant_model',
        'explanation'
    ]
    df_final = df_conf[cols_order].copy()

    # Save to outputs/confidence_scores.csv
    out_file = os.path.join(output_dir, 'confidence_scores.csv')
    df_final.to_csv(out_file, index=False)
    print(f"✅ Generated {len(df_final)} explainable confidence records at {out_file}")

    return df_final


def main():
    print("=" * 70)
    print("🚀 EXPLAINABLE CONFIDENCE ENGINE (ECE) — RUNNING")
    print("=" * 70)

    df = generate_confidence_dataset()

    print("\n--- Summary Statistics ---")
    print(df[['confidence', 'skill_score', 'agreement_score', 'lead_score']].describe().round(2))

    print("\n--- Confidence Label Distribution ---")
    print(df['confidence_label'].value_counts())

    print("\n--- Dominant Model Distribution ---")
    print(df['dominant_model'].value_counts())

    print("\n--- Sample Explanations (First 5 Rows) ---")
    for _, row in df.head(5).iterrows():
        print(f"[{row['city']} | Day {row['lead_day']} | {row['confidence']}% ({row['confidence_label']}) | Dominant: {row['dominant_model']}]")
        print(f"  -> \"{row['explanation']}\"\n")


if __name__ == '__main__':
    main()
