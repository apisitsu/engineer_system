import pathlib
import pandas as pd

#Set up directory flie path
base_dir = pathlib.Path(r"\\10.121.34.19\data_rod\08-Engineer\14. Share file Back up\KUNPREAW\PC - Engineer\2026")
file_name = "2026 Record for drawing printed.xlsm"
full_path = base_dir / file_name

print("=== In processing ===")

if full_path.exists():
    print(f"Meet: {full_path.name}")
    print("Loading...")

    df_dp = pd.read_excel(full_path, header=0)
    df_dp.columns = df_dp.columns.str.strip()
    df_dp = df_dp.dropna(subset=['LOT NO.'])

    cols_to_drop = ['NO.', 'Unnamed: 11']
    df_dp = df_dp.drop(columns=cols_to_drop, errors='ignore')

    print("\n === Sample 5 rows data ===")
    print(df_dp.head())
    print(f"\n === Loading complete ===")
    print(f"\n Total {len(df_dp)} rows")

if "ชุด" in df_dp.columns:
    df_dp["ชุด"] = pd.to_numeric(df_dp["ชุด"], errors='coerce')
    df_dp["ชุด"] = df_dp["ชุด"].apply(lambda x: f"{int(x)}" if pd.notnull(x) else "")

else:
    print(f"Can not find {file_name}")

output_filename = "RecordForDrawingPrinted.csv"
path_csv = pathlib.Path(r"G:\Shared drives\ROD-Engineer\ToolingInspection")
#df_dp.to_csv(output_filename, index=False, encoding='utf-8-sig')
#print(f"Complete csv! File name: {output_filename}")
df_dp.to_csv(path_csv / output_filename, index=False, encoding='utf-8-sig')
print(f"Complete csv to Drive G! File name: {output_filename}")