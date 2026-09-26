"""
alerts.py — Generates extreme weather alerts from hybrid_forecast.csv.

Reads:  outputs/hybrid_forecast.csv
Writes: outputs/extreme_alerts.csv

Usage: python ai/alerts.py
"""

import pandas as pd

# ---------------------------------------------------------------------------
# Threshold configuration
# ---------------------------------------------------------------------------

# Prototype thresholds calibrated for operational hackathon demonstration.
THRESHOLDS = {
    'Heavy Rain':       {'column': 'rainfall',    'moderate': 4,  'high': 8},
    'High Temperature': {'column': 'temperature',  'moderate': 35, 'high': 37},
    'High Wind':        {'column': 'wind_speed',   'moderate': 25, 'high': 32},
}

# ---------------------------------------------------------------------------
# File paths
# ---------------------------------------------------------------------------
INPUT_PATH  = 'outputs/hybrid_forecast.csv'
OUTPUT_PATH = 'outputs/extreme_alerts.csv'

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
df = pd.read_csv(INPUT_PATH, parse_dates=['datetime'])

# ---------------------------------------------------------------------------
# Generate alerts — one chunk per event type, then concatenate
# ---------------------------------------------------------------------------
chunks = []

for event, cfg in THRESHOLDS.items():
    col      = cfg['column']       # source column in the forecast
    moderate = cfg['moderate']     # lower threshold (row must exceed this)
    high     = cfg['high']         # upper threshold (determines severity)

    # Keep only rows that exceed the moderate threshold
    flagged = df[df[col] > moderate].copy()

    if flagged.empty:
        continue  # no alerts for this event; skip to avoid concat issues

    # Assign severity based on whether value also exceeds the high threshold
    flagged['severity']       = flagged[col].apply(
        lambda v: 'High' if v > high else 'Moderate'
    )
    flagged['event']          = event
    flagged['forecast_value'] = flagged[col].round(2)
    flagged['threshold']      = moderate   # the moderate threshold that was crossed

    chunks.append(flagged[['city', 'datetime', 'event', 'severity',
                            'forecast_value', 'threshold']])

# Combine all event chunks (a single city/datetime pair may appear >1 time)
if chunks:
    alerts = pd.concat(chunks, ignore_index=True)
else:
    # No rows exceeded any threshold — produce a correctly-structured empty file
    alerts = pd.DataFrame(columns=['city', 'datetime', 'event', 'severity',
                                   'forecast_value', 'threshold'])

# Sort as required
alerts.sort_values(['datetime', 'city', 'event'], inplace=True)
alerts.reset_index(drop=True, inplace=True)

# ---------------------------------------------------------------------------
# Assertions — raise a clear error, never auto-fix
# ---------------------------------------------------------------------------
if not alerts.empty:
    # 1. No NaN values allowed in output
    if alerts.isna().any().any():
        raise ValueError("Assertion failed: output contains NaN values — "
                         f"columns with NaN: {alerts.columns[alerts.isna().any()].tolist()}")

    # 2. Severity must only be 'Moderate' or 'High'
    bad_severity = set(alerts['severity'].unique()) - {'Moderate', 'High'}
    if bad_severity:
        raise ValueError(f"Assertion failed: unexpected severity values found: {bad_severity}")

    # 3. forecast_value must strictly exceed threshold for every row
    violated = alerts[alerts['forecast_value'] <= alerts['threshold']]
    if not violated.empty:
        raise ValueError(
            f"Assertion failed: {len(violated)} row(s) have forecast_value <= threshold:\n"
            f"{violated.head(5).to_string(index=False)}"
        )

# ---------------------------------------------------------------------------
# Write output
# ---------------------------------------------------------------------------
alerts.to_csv(OUTPUT_PATH, index=False)

# ---------------------------------------------------------------------------
# Summary report
# ---------------------------------------------------------------------------
print(f"Total Alerts: {len(alerts)}\n")

print("--- Counts per Event ---")
print(alerts['event'].value_counts() if not alerts.empty else "No alerts generated.")

print("\n--- Counts per Severity ---")
print(alerts['severity'].value_counts() if not alerts.empty else "No alerts generated.")

print("\n--- Top 10 Cities by Alert Count ---")
print(alerts['city'].value_counts().head(10) if not alerts.empty else "No alerts generated.")

print("\n--- First 10 Rows ---")
print(alerts.head(10).to_string(index=False))
