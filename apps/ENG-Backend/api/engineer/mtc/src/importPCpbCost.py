import pathlib
import pandas as pd

#Set up directory flie path
base_dir = pathlib.Path(r"\\sanlb01\MPA-DIV\03-Purchase\02-Budget\PB ring project")
file_name = "OrderRequest_PB.xlsb"
full_path = base_dir / file_name
print("=== In processing ===")

if full_path.exists():
    print(f"Meet: {full_path.name}")
    print("Loading...")

    df_pb = pd.read_excel(full_path, engine='pyxlsb', usecols="F:U", header=0)
    df_pb.columns = df_pb.columns.str.strip()
    df_pb = df_pb.dropna(subset=['ITEM NAME'])
    df_pb = df_pb.rename(columns={'PURPOSE.1': 'Purpose'})

    # cols_to_drop = ['PURPOSE.1']
    # df_pb = df_pb.drop(columns=cols_to_drop, errors='ignore')

if 'REQ.DUE DATE' in df_pb.columns:
    df_pb['REQ.DUE DATE'] = pd.to_datetime(df_pb['REQ.DUE DATE'], unit='D', origin='1899-12-30')

if "LEAD TIME(DAYS)" in df_pb.columns:
    df_pb["LEAD TIME(DAYS)"] = pd.to_numeric(df_pb["LEAD TIME(DAYS)"], errors='coerce')
    df_pb["LEAD TIME(DAYS)"] = df_pb["LEAD TIME(DAYS)"].apply(lambda x: f"{int(x)}" if pd.notnull(x) else "")

if "Q'TY" in df_pb.columns:
    df_pb["Q'TY"] = pd.to_numeric(df_pb["Q'TY"], errors='coerce')
    df_pb["Q'TY"] = df_pb["Q'TY"].apply(lambda x: f"{int(x)}" if pd.notnull(x) else "")

    print("\n === Sample 5 rows data ===")
    print(df_pb.head())
    print(f"\n === Loading complete ===")
    print(f"\n Total {len(df_pb)} rows")

else:
    print(f"Can not find {file_name}")

output_filename = "PBcost.csv"
path_csv = pathlib.Path(r"G:\Shared drives\ROD-Engineer\ToolingInspection")
#df_pb.to_csv(output_filename, index=False, encoding='utf-8-sig')
#print(f"Complete csv! File name: {output_filename}")
df_pb.to_csv(path_csv / output_filename, index=False, encoding='utf-8-sig')
print(f"Complete csv to Drive G! File name: {output_filename}")