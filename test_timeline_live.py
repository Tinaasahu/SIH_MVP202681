import requests
from datetime import datetime

url = 'https://sih-mvp202681.onrender.com/api/forecast?city=Kanpur'
r = requests.get(url, timeout=10)
records = r.json()

now = datetime.now()
now_str = now.strftime('%Y-%m-%d %H:00')

current_idx = -1
for i, rec in enumerate(records):
    dt = rec.get('datetime', '').replace('T', ' ')
    if dt.startswith(now_str):
        current_idx = i
        break
if current_idx == -1:
    for i, rec in enumerate(records):
        dt = rec.get('datetime', '').replace('T', ' ')
        if dt >= now_str:
            current_idx = i
            break
if current_idx == -1:
    current_idx = 0

available_remaining = max(0, len(records) - 1 - current_idx)
if available_remaining >= 71:
    offsets = [0, 6, 12, 24, 48, 71]
elif available_remaining >= 48:
    offsets = [0, 6, 12, 24, 36, 48]
else:
    offsets = [0, int(available_remaining * 0.2), int(available_remaining * 0.4), int(available_remaining * 0.6), int(available_remaining * 0.8), available_remaining]

time_labels = ['NOW' if i == 0 else f"+{off}h" for i, off in enumerate(offsets)]

print("\n--- UPDATED FRONTEND TIMELINE POINTS (Live Kanpur) ---")
print(f"{'Label':<8} {'Idx':<5} {'Datetime':<20} {'Rain(mm)':<10} {'Temp(C)':<10} {'Wind(km/h)':<10}")
for off, lbl in zip(offsets, time_labels):
    idx = min(len(records) - 1, current_idx + off)
    rec = records[idx]
    raw_rain = rec.get('rainfall') or 0
    rain = round(raw_rain, 2) if (raw_rain > 0 and raw_rain < 1.0) else round(raw_rain, 1)
    temp = round((rec.get('temperature') or 30), 1)
    wind = round((rec.get('wind_speed') or 15), 1)
    print(f"{lbl:<8} {idx:<5} {rec.get('datetime'):<20} {rain:<10} {temp:<10} {wind:<10}")
