import pathlib
import pandas as pd

# Set up directory file path
base_dir = pathlib.Path(r"\\10.121.34.19\data_rod\08-Engineer\14. Share file Back up\KUNPREAW\PC - Engineer\2026")
file_name = "2026 Record for drawing printed.xlsm"
full_path = base_dir / file_name

# Set up output path
output_filename = "RecordForDrawingPrinted.csv"
path_csv = pathlib.Path(r"G:\Shared drives\ROD-Engineer\ToolingInspection")
csv_file_path = path_csv / output_filename

print("=== In processing ===")

if full_path.exists():
    print(f"Meet: {full_path.name}")
    print("Loading...")

    df_dp = pd.read_excel(full_path, header=0)
    df_dp.columns = df_dp.columns.str.strip()
    df_dp = df_dp.dropna(subset=['LOT NO.'])

    cols_to_drop = ['NO.', 'Unnamed: 11']
    df_dp = df_dp.drop(columns=cols_to_drop, errors='ignore')

    if "ชุด" in df_dp.columns:
        df_dp["ชุด"] = pd.to_numeric(df_dp["ชุด"], errors='coerce')
        df_dp["ชุด"] = df_dp["ชุด"].apply(lambda x: f"{int(x)}" if pd.notnull(x) else "")

    print("\n=== Sample 5 rows data ===")
    print(df_dp.head())
    print(f"\n=== Loading complete ===")
    print(f"Total current Excel rows: {len(df_dp)}")

    if csv_file_path.exists():
        try:
            df_old = pd.read_csv(csv_file_path)
            new_records_count = len(df_dp) - len(df_old)
            
            if new_records_count > 0:
                print(f"\n=== Found {new_records_count} NEW records! ===")
            elif new_records_count == 0:
                print("\n=== No new records. Data count is the same as backup. ===")
            else:
                print(f"\n=== Warning: Current Excel has {abs(new_records_count)} FEWER rows than the backup. ===")
        except Exception as e:
            print(f"\n=== Could not read old CSV to check for new records. Error: {e} ===")
    else:
        print(f"\n=== First time saving. All {len(df_dp)} records are new! ===")
    # ==========================================

    # 3. Save to Drive G
    path_csv.mkdir(parents=True, exist_ok=True)
    df_dp.to_csv(csv_file_path, index=False, encoding='utf-8-sig')
    print(f"\n=== Complete csv to Drive G! File name: {output_filename} ===")

else:
    print(f"=== xxx Can not find {file_name} at {base_dir} xxx ===")