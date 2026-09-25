"""
alerts_demo_preview.py — Demo-only diagnostic for extreme weather alerts.

Reads:  outputs/hybrid_forecast.csv
Writes: NOTHING — print output only.

This script uses lowered thresholds for presentation/demo purposes.
Do NOT use these thresholds in production.
"""

import pandas as pd

# ---------------------------------------------------------------------------
# Demo banner — printed before anything else
# ---------------------------------------------------------------------------
print("=" * 72)
print("DEMO-ONLY thresholds for presentation purposes. NOT the production "
      "thresholds used in outputs/extreme_alerts.csv.")
print("=" * 72)
print()

# ---------------------------------------------------------------------------
# Threshold configuration
# DEMO-ONLY thresholds — for presentation purposes, not production values.
# ---------------------------------------------------------------------------
DEMO_THRESHOLDS = {
    'Heavy Rain':       {'column': 'rainfall',    'moderate': 3,  'high': 6},
    'High Temperature': {'column': 'temperature',  'moderate': 36, 'high': 38},
    'High Wind':        {'column': 'wind_speed',   'moderate': 20, 'high': 30},
}

# ---------------------------------------------------------------------------
# Load data (read-only)
# ---------------------------------------------------------------------------
df = pd.read_csv('outputs/hybrid_forecast.csv', parse_dates=['datetime'])

# ---------------------------------------------------------------------------
# Flag alerts — one chunk per event, then concatenate
# ---------------------------------------------------------------------------
chunks = []

for event, cfg in DEMO_THRESHOLDS.items():
    col      = cfg['column']
    moderate = cfg['moderate']
    high     = cfg['high']

    # Keep rows that exceed the moderate threshold
    flagged = df[df[col] > moderate].copy()

    if flagged.empty:
        continue

    # Severity: High if also above the high threshold, else Moderate
    flagged['severity'] = flagged[col].apply(
        lambda v: 'High' if v > high else 'Moderate'
    )
    flagged['event']          = event
    flagged['forecast_value'] = flagged[col].round(2)
    flagged['threshold']      = moderate

    chunks.append(flagged[['city', 'datetime', 'event', 'severity',
                            'forecast_value', 'threshold']])

# Combine all event chunks; sort by datetime
if chunks:
    alerts = pd.concat(chunks, ignore_index=True)
    alerts.sort_values('datetime', inplace=True)
    alerts.reset_index(drop=True, inplace=True)
else:
    alerts = pd.DataFrame(columns=['city', 'datetime', 'event', 'severity',
                                   'forecast_value', 'threshold'])

# ---------------------------------------------------------------------------
# Print summary — no files written
# ---------------------------------------------------------------------------
print(f"Total Alerts: {len(alerts)}\n")

print("--- Counts per Event ---")
print(alerts['event'].value_counts().to_string() if not alerts.empty
      else "No alerts generated.")

print("\n--- Counts per Severity ---")
print(alerts['severity'].value_counts().to_string() if not alerts.empty
      else "No alerts generated.")

print("\n--- First 15 Rows (sorted by datetime) ---")
print(alerts.head(15).to_string(index=False) if not alerts.empty
      else "No alerts generated.")
