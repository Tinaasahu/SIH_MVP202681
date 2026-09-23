import pandas as pd
from pathlib import Path

# List of target input files to inspect
target_files = [
    "data/forecast_raw.csv",
    "data/actual_raw.csv",
    "data/actual_weather.csv",
    "data/cities.csv",
]

# Resolve base project directory (supports execution from project root or ai/ directory)
base_dir = Path(__file__).resolve().parent.parent

for rel_path in target_files:
    file_path = base_dir / rel_path
    print("=" * 60)
    print(f"INSPECTING FILE: {rel_path}")
    print("=" * 60)

    # Check if the file exists; print message if missing
    if not file_path.exists():
        print("FILE NOT FOUND\n")
        continue

    # Load CSV data into pandas DataFrame
    df = pd.read_csv(file_path)

    # 1. Print Shape and Column Names
    print("\n--- Shape ---")
    print(df.shape)
    print("\n--- Column Names ---")
    print(df.columns.tolist())

    # 2. Print First 8 and Last 8 Rows
    print("\n--- First 8 Rows ---")
    print(df.head(8))
    print("\n--- Last 8 Rows ---")
    print(df.tail(8))

    # 3. Print Data Types
    print("\n--- Data Types ---")
    print(df.dtypes)

    # 4. Print Missing Values per Column
    print("\n--- Missing Values Per Column ---")
    print(df.isnull().sum())

    # 5. Print Number of Fully Duplicated Rows
    print("\n--- Number of Fully Duplicated Rows ---")
    print(df.duplicated().sum())

    # 6. Min and Max of Date/Time Columns (detected dynamically)
    print("\n--- Date/Time Columns Min & Max ---")
    datetime_found = False
    for col in df.columns:
        col_lower = str(col).lower()
        if any(k in col_lower for k in ["date", "time", "timestamp"]) or pd.api.types.is_datetime64_any_dtype(df[col]):
            try:
                dt_series = pd.to_datetime(df[col], errors="coerce")
                print(f"Column '{col}': Min = {dt_series.min()}, Max = {dt_series.max()}")
                datetime_found = True
            except Exception:
                pass
    if not datetime_found:
        print("No date/time columns detected.")

    # 7. Value Counts of City and Model Columns (if they exist)
    print("\n--- Value Counts for City / Model Columns ---")
    city_model_found = False
    for col in df.columns:
        col_lower = str(col).lower()
        if "city" in col_lower or "model" in col_lower:
            print(f"\nValue counts for column '{col}':")
            print(df[col].value_counts(dropna=False))
            city_model_found = True
    if not city_model_found:
        print("No city or model columns detected.")

    print("\n")
