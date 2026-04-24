import pathlib
import pandas as pd
import os
from dotenv import load_dotenv
import sqlalchemy
from sqlalchemy import text

# ==========================================
# 1. Extract data from folder and merge files
# ==========================================
base_dir = pathlib.Path(r"\\sanlb01\MPA-DIV\03-Purchase\02-Budget\INSP REC\2026")

# Ignore temporary Excel files (~$) that are currently open
all_files = [f for f in base_dir.rglob("*.xlsx") if not f.name.startswith("~$")]
print(f"\n=== Found excel file {len(all_files)} files: ===")

# for file in all_files:
    # print("-", file.name)

if len(all_files) > 0:
    first_file = all_files[0]
#    print(f"\n=== Reading file: {first_file.name} ===")
    df = pd.read_excel(first_file, header=1)
#    print(df.head())
else:
    print("\nxxx Cannot find any excel files in the folder. Please check the path again. xxx")

print("\n=== Starting to merge all Excel files =>=>=>")

all_data = []
for file in all_files:
#    print(f"Reading and merging file: {file.name}")
    df_temp = pd.read_excel(file, header=1)
    all_data.append(df_temp)

# ==========================================
# 2. Data Cleaning
# ==========================================
df_master = pd.concat(all_data, ignore_index=True)
df_master.columns = df_master.columns.str.strip()

df_master = df_master.rename(columns={'Date รับงาน': 'Receive Date', 'TIME': "Time", 'NAME': 'Item Name', 'Spec': 'DWG. No', 'วันที่ Insp เสร็จ': 'Issue Date'})
df_master = df_master.dropna(subset=['PO No.'])

# Fix Date parsing to avoid swapping Day and Month (using dayfirst=True)
if 'Receive Date' in df_master.columns:
    df_master['Receive Date'] = pd.to_datetime(df_master['Receive Date'], dayfirst=True, errors='coerce').dt.strftime('%Y-%m-%d')

# If 'Issue Date' exists, format it correctly as well
if 'Issue Date' in df_master.columns:
    df_master['Issue Date'] = pd.to_datetime(df_master['Issue Date'], dayfirst=True, errors='coerce').dt.strftime('%Y-%m-%d')

# Drop unused columns
cols_to_drop = ['V/D', 'Item NO', 'REJECT LIST', 'งานกลับมา', 'ORDER CONFIRM']
df_master = df_master.drop(columns=cols_to_drop, errors='ignore')

# Format Work Center with leading zeros (e.g., '6' -> '06')
if 'W/C' in df_master.columns:
    df_master['W/C'] = pd.to_numeric(df_master['W/C'], errors='coerce')
    df_master['W/C'] = df_master['W/C'].apply(lambda x: f"{int(x):02d}" if pd.notnull(x) else "")

# Format Quantity to remove decimals
if "Q'ty" in df_master.columns:
    df_master["Q'ty"] = pd.to_numeric(df_master["Q'ty"], errors='coerce')
    df_master["Q'ty"] = df_master["Q'ty"].apply(lambda x: f"{int(x)}" if pd.notnull(x) else "")

# Rearrange columns (move TIME and W/C to the front)
if 'Time' in df_master.columns:
    temp_time = df_master.pop('Time')
    df_master.insert(1, 'Time', temp_time)

if 'W/C' in df_master.columns:
    temp_wc = df_master.pop('W/C')
    df_master.insert(2, 'W/C', temp_wc)
    
# NOTE: Removed the line `df_master = df_master.loc[:, :"Q'ty"]` 
# to keep all trailing columns for the Web Application.

print(f"\n=>=>=> Merge complete! Total {len(df_master)} rows. ===")

# ==========================================
# 3. Save to CSV (Backup)
# ==========================================
print("\n=== Saving to CSV ===")
output_filename = "ToolingInspection.csv"
path_csv = pathlib.Path(r"G:\Shared drives\ROD-Engineer\ToolingInspection")

# Save to local directory
df_master.to_csv(output_filename, index=False, encoding='utf-8-sig')
print(f"CSV saved successfully! File name: {output_filename}")

# Save to Drive G (Backup)
try:
    df_master.to_csv(path_csv / output_filename, index=False, encoding='utf-8-sig')
    print(f"Backup CSV saved to Drive G! File name: {output_filename}")
except Exception as e:
    print(f"Warning: Cannot save to Drive G. Error: {e}")

# ==========================================
# 4. Prepare data for Database
# ==========================================
# Mapping to exact PostgreSQL column names
rename_mapping = {
    'Receive Date': 'receive_date',
    'Time': 'time',
    'W/C': 'w_c',
    'PO No.': 'po_no',
    'Item Name': 'item_name',
    'DWG. No': 'dwg_no',
    "Q'ty": 'qty'
}
df_master = df_master.rename(columns=rename_mapping)

if 'qty' in df_master.columns:
    df_master = df_master.loc[:, :"qty"]

if 'qty' in df_master.columns:
    df_master['qty'] = pd.to_numeric(df_master['qty'], errors='coerce').astype('Int64')

# ==========================================
# 5. Sync data to PostgreSQL
# ==========================================
print("\n=== Syncing to PostgreSQL Database ===")

# Only check records from the last 2 months to improve performance
today = pd.Timestamp.now()
first_day_this_month = today.replace(day=1)
first_day_last_month = first_day_this_month - pd.DateOffset(months=1)
target_date_str = first_day_last_month.strftime('%Y-%m-%d')

print(f"=== Filtering data from: {target_date_str} to present ===")

df_master = df_master[df_master['receive_date'] >= target_date_str].copy()
print(f"=== Records to check (Last 2 months): {len(df_master)} rows ===")

# Load DB configuration
load_dotenv()
DB_USER = os.getenv('DB_USER')
DB_PASS = os.getenv('DB_PASS')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')

conn_string = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    engine = sqlalchemy.create_engine(conn_string)

    # -------------------------------------------------------------
    # Robust UID Generator: Handles time padding (9:00 -> 09:00), nulls, and trailing spaces
    # -------------------------------------------------------------
    def generate_robust_uid(df_to_process):
        clean_time = df_to_process['time'].fillna('').astype(str).str.strip()
        clean_time = clean_time.apply(lambda x: x.zfill(5) if len(x) == 4 and ':' in x else x)
        
        return (df_to_process['po_no'].fillna('').astype(str).str.strip() + '_' + \
                df_to_process['receive_date'].fillna('').astype(str).str.strip() + '_' + \
                clean_time + '_' + \
                df_to_process['item_name'].fillna('').astype(str).str.strip()).str.lower()

    # --- Step 5.1: Check existing data in the database ---
    try:
        query = f"SELECT po_no, receive_date, time, item_name FROM ti_list WHERE receive_date >= '{target_date_str}'"
        existing_data = pd.read_sql(query, con=engine)
        
        existing_data['uid'] = generate_robust_uid(existing_data)
        existing_uid_list = existing_data['uid'].tolist()
        print(f"=== Existing records in database (Last 2 months): {len(existing_uid_list)} ===")
    except Exception:
        existing_uid_list = []
        print("xxx Table not found or empty (First run). xxx")

    # --- Step 5.2: Create UID to filter new records ---
    df_master['uid'] = generate_robust_uid(df_master)
    
    # [Debug] Print the first pair of UIDs to verify exact match
    if len(existing_uid_list) > 0 and len(df_master) > 0:
        print("\n[Debug] Comparing the first UID:")
        print(f"=== Database : {existing_uid_list[0]} ===")
        print(f"=== Excel    : {df_master['uid'].iloc[0]} ===")
        print("\n")

    # Anti-join to keep only records that are NOT in the database
    df_new_records = df_master[~df_master['uid'].isin(existing_uid_list)].copy()
    print(f"=== New records found to update: {len(df_new_records)} ===")

    # --- Step 5.3: Insert only new records into the Database ---
    if len(df_new_records) > 0:
        #print("Saving new records to the database...")
        df_new_records = df_new_records.drop(columns=['uid'])

        db_columns = ['receive_date', 'time', 'w_c', 'po_no', 'item_name', 'dwg_no', 'qty']
        df_new_records = df_new_records[db_columns]

        # Sync PostgreSQL auto-increment sequence ID to prevent UniqueViolation error
        try:
            with engine.connect() as connection:
                sync_seq_query = text("""
                    SELECT setval(pg_get_serial_sequence('ti_list', 'id'), COALESCE(MAX(id), 1)) 
                    FROM ti_list;
                """)
                connection.execute(sync_seq_query)
                connection.commit()
                #print("Synced sequence ID successfully.")
        except Exception as sync_e:
            print(f"xxx Could not sync sequence: {sync_e} xxx")

        # Insert to DB
        df_new_records.to_sql(name='ti_list', con=engine, if_exists='append', index=False)
        #print("Successfully saved new records!")
    else:
        print("=== No new records to update (Database is already up to date). ===")

except Exception as e:
    print(f"xxx Database connection error:\n{e} xxx")

# ==========================================
# 6. Export Data FROM Database to CSV for Google Sheets
# ==========================================
print("\n=== Exporting Data FROM Database to CSV in Drive G =>=>=>")

output_filename = "ToolingInspection_LookerStudio.csv"
path_csv = pathlib.Path(r"G:\Shared drives\ROD-Engineer\ToolingInspection")

try:
    path_csv.mkdir(parents=True, exist_ok=True)

    query_export = "SELECT * FROM ti_list ORDER BY id ASC"
    df_export = pd.read_sql(query_export, con=engine)

    cols_to_exclude = ['id', 'updated_at']
    df_export = df_export.drop(columns=cols_to_exclude, errors='ignore')

    df_export.to_csv(path_csv / output_filename, index=False, encoding='utf-8-sig')
    print(f"=>=>=> Successfully exported {len(df_export)} rows from Database to Drive G! ===")

except Exception as e:
    print(f"xxx Warning: Cannot export from Database. Error: {e} xxx")