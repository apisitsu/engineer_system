import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
import pandas as pd
import sqlite3
import os

class DataManagerPro(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Ultimate Data Manager (Edit Row, Add Col, Switch Table)")
        self.geometry("1200x800")

        # --- Data State ---
        self.df = pd.DataFrame()
        self.current_file_path = None
        self.current_file_type = None # 'csv', 'excel', 'db'
        self.current_table_name = None
        self.all_tables = [] # รายชื่อตารางทั้งหมดใน DB (สำหรับสลับไปมา)

        # --- Setup UI ---
        self.create_ui()
        
        # --- NEW: Setup Global Context Menu (Cut/Copy/Paste) ---
        self.setup_context_menu()

    def create_ui(self):
        # --- Toolbar ส่วนบน ---
        toolbar_frame = ttk.Frame(self, padding=5, relief=tk.RAISED)
        toolbar_frame.pack(fill=tk.X, side=tk.TOP)

        # 1. File Controls
        files_lf = ttk.LabelFrame(toolbar_frame, text="1. ไฟล์ (File)", padding=5)
        files_lf.pack(side=tk.LEFT, padx=5, fill=tk.Y)
        
        ttk.Button(files_lf, text="📂 เปิดไฟล์", command=self.open_file).pack(side=tk.LEFT, padx=2)
        ttk.Button(files_lf, text="💾 บันทึก", command=self.save_current).pack(side=tk.LEFT, padx=2)
        ttk.Button(files_lf, text="💾 บันทึกเป็น...", command=self.save_as_new).pack(side=tk.LEFT, padx=2)

        # 2. Table Switcher (ฟีเจอร์ใหม่)
        table_lf = ttk.LabelFrame(toolbar_frame, text="2. เลือกตาราง (Switch Table)", padding=5)
        table_lf.pack(side=tk.LEFT, padx=5, fill=tk.Y)

        self.table_var = tk.StringVar()
        self.combo_tables = ttk.Combobox(table_lf, textvariable=self.table_var, state="readonly", width=20)
        self.combo_tables.pack(side=tk.LEFT, padx=5, pady=2)
        self.combo_tables.bind("<<ComboboxSelected>>", self.on_switch_table)
        
        ttk.Button(table_lf, text="🔄 สร้างตารางใหม่", command=self.create_new_table_dialog).pack(side=tk.LEFT, padx=2)

        # 3. Column & Row Management (ฟีเจอร์ใหม่)
        edit_lf = ttk.LabelFrame(toolbar_frame, text="3. แก้ไขข้อมูล (Edit)", padding=5)
        edit_lf.pack(side=tk.LEFT, padx=5, fill=tk.Y)

        ttk.Button(edit_lf, text="➕ เพิ่มคอลัมน์ (Add Col)", command=self.add_column_dialog).pack(side=tk.LEFT, padx=2)
        ttk.Button(edit_lf, text="➕ เพิ่มแถว (Add Row)", command=self.add_row_dialog).pack(side=tk.LEFT, padx=2)
        ttk.Button(edit_lf, text="✏️ แก้ไขแถว (Edit Row)", command=self.edit_selected_row).pack(side=tk.LEFT, padx=2)
        ttk.Button(edit_lf, text="❌ ลบแถว (Del Row)", command=self.delete_row).pack(side=tk.LEFT, padx=2)
        ttk.Button(edit_lf, text="⇄ สลับคอลัมน์", command=self.reorder_columns_dialog).pack(side=tk.LEFT, padx=2)
        # --- Status Bar ---
        self.status_var = tk.StringVar(value="พร้อมทำงาน")
        lbl_status = tk.Label(self, textvariable=self.status_var, bg="#eee", anchor="w", padx=10)
        lbl_status.pack(fill=tk.X, side=tk.BOTTOM)

        # --- Main Table (Treeview) ---
        tree_frame = ttk.Frame(self)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Scrollbars
        sc_y = ttk.Scrollbar(tree_frame)
        sc_y.pack(side=tk.RIGHT, fill=tk.Y)
        sc_x = ttk.Scrollbar(tree_frame, orient=tk.HORIZONTAL)
        sc_x.pack(side=tk.BOTTOM, fill=tk.X)

        self.tree = ttk.Treeview(tree_frame, yscrollcommand=sc_y.set, xscrollcommand=sc_x.set, selectmode="extended")
        self.tree.pack(fill=tk.BOTH, expand=True)
        
        sc_y.config(command=self.tree.yview)
        sc_x.config(command=self.tree.xview)

        # Bind Double Click เพื่อแก้ไข
        self.tree.bind("<Double-1>", self.on_double_click)

    # ==========================
    # NEW FUNCTION: Context Menu & Shortcuts
    # ==========================
    def setup_context_menu(self):
        """สร้างเมนูคลิกขวาและตั้งค่า Clipboard"""
        # สร้างเมนู Pop-up
        self.context_menu = tk.Menu(self, tearoff=0)
        self.context_menu.add_command(label="Cut (ตัด)        Ctrl+X", command=lambda: self.focus_get().event_generate("<<Cut>>"))
        self.context_menu.add_command(label="Copy (คัดลอก)  Ctrl+C", command=lambda: self.focus_get().event_generate("<<Copy>>"))
        self.context_menu.add_command(label="Paste (วาง)      Ctrl+V", command=lambda: self.focus_get().event_generate("<<Paste>>"))
        self.context_menu.add_separator()
        self.context_menu.add_command(label="Select All (เลือกทั้งหมด)", command=lambda: self.focus_get().event_generate("<<SelectAll>>"))

        # ใช้ bind_class เพื่อผูก Event คลิกขวาให้กับ Widget ประเภท Entry ทั้งหมดในแอป
        # ไม่ว่าจะสร้างตอนไหน หรืออยู่ในหน้าต่าง Popup ไหน ก็จะใช้ได้ทันที
        self.bind_class("Entry", "<Button-3>", self.show_context_menu)
        self.bind_class("TEntry", "<Button-3>", self.show_context_menu) # สำหรับ ttk.Entry

    def show_context_menu(self, event):
        """แสดงเมนูเมื่อคลิกขวา"""
        try:
            # ย้าย Focus มาที่ช่องที่ถูกคลิกก่อน (สำคัญมาก ไม่งั้นจะ Paste ผิดที่)
            event.widget.focus()
            self.context_menu.tk_popup(event.x_root, event.y_root)
        finally:
            self.context_menu.grab_release()

    # ==========================
    # 1. File Loading & Table Switching
    # ==========================
    def open_file(self):
        path = filedialog.askopenfilename(filetypes=[("All", "*.db;*.sqlite;*.csv;*.xlsx"), ("DB", "*.db"), ("CSV", "*.csv"), ("Excel", "*.xlsx")])
        if not path: return

        self.current_file_path = path
        ext = os.path.splitext(path)[1].lower()

        if ext in ['.db', '.sqlite']:
            self.current_file_type = 'db'
            self.load_db_tables(path) # โหลดรายชื่อตารางมาก่อน
        elif ext == '.csv':
            self.current_file_type = 'csv'
            self.all_tables = ['CSV_Data']
            self.df = pd.read_csv(path)
            self.update_ui_after_load()
        elif ext in ['.xlsx', '.xls']:
            self.current_file_type = 'excel'
            self.all_tables = ['Excel_Sheet1'] # ปกติ Excel มีหลาย Sheet แต่เอาเบื้องต้นก่อน
            self.df = pd.read_excel(path)
            self.update_ui_after_load()

    def load_db_tables(self, db_path):
        """อ่านรายชื่อตารางทั้งหมดใน DB เพื่อใส่ใน Combobox"""
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [r[0] for r in cursor.fetchall()]
            conn.close()

            self.all_tables = tables
            if tables:
                self.combo_tables['values'] = tables
                self.combo_tables.current(0) # เลือกตารางแรก
                self.load_table_data(tables[0]) # โหลดข้อมูลตารางแรก
            else:
                messagebox.showwarning("Warning", "ไม่พบตารางใน Database นี้")
                self.df = pd.DataFrame()
                self.refresh_treeview()

        except Exception as e:
            messagebox.showerror("Error", str(e))

    def on_switch_table(self, event):
        """เมื่อผู้ใช้เลือกตารางใหม่ใน Dropdown"""
        selected_table = self.table_var.get()
        if self.current_file_type == 'db' and selected_table:
            # TODO: อาจจะเพิ่มการเช็คว่า Save ข้อมูลเก่าหรือยังตรงนี้
            self.load_table_data(selected_table)

    def load_table_data(self, table_name):
        """โหลดข้อมูลจาก Table ที่ระบุ ลง Pandas DataFrame"""
        try:
            conn = sqlite3.connect(self.current_file_path)
            self.df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            conn.close()
            
            self.current_table_name = table_name
            self.update_ui_after_load()
            self.status_var.set(f"กำลังทำงานกับตาราง: {table_name}")
        except Exception as e:
            messagebox.showerror("Error", f"โหลดตาราง {table_name} ไม่สำเร็จ: {e}")

    def update_ui_after_load(self):
        # อัปเดต Dropdown (กรณี CSV/Excel)
        self.combo_tables['values'] = self.all_tables
        if self.current_table_name in self.all_tables:
            self.combo_tables.set(self.current_table_name)
        elif self.all_tables:
            self.combo_tables.set(self.all_tables[0])
            self.current_table_name = self.all_tables[0]

        self.refresh_treeview()

    def refresh_treeview(self):
        """วาดตารางใหม่"""
        self.tree.delete(*self.tree.get_children())
        
        cols = list(self.df.columns)
        self.tree["columns"] = cols
        self.tree["show"] = "headings"
        
        for col in cols:
            self.tree.heading(col, text=col)
            self.tree.column(col, width=120, anchor=tk.W)

        for idx, row in self.df.iterrows():
            vals = [str(v) for v in row]
            self.tree.insert("", "end", iid=idx, values=vals)

    # ==========================
    # 2. Add Column (New Feature)
    # ==========================
    def add_column_dialog(self):
        if self.df.empty and len(self.df.columns) == 0:
            messagebox.showwarning("Warning", "กรุณาสร้างหรือเปิดตารางก่อน")
            return

        # สร้างหน้าต่าง Popup
        win = tk.Toplevel(self)
        win.title("เพิ่มคอลัมน์ใหม่")
        win.geometry("300x200")

        tk.Label(win, text="ชื่อคอลัมน์ (Column Name):").pack(pady=5)
        ent_name = tk.Entry(win)
        ent_name.pack(pady=5)

        tk.Label(win, text="ประเภทข้อมูล (Data Type):").pack(pady=5)
        type_var = tk.StringVar(value="String (Text)")
        combo_type = ttk.Combobox(win, textvariable=type_var, values=["String (Text)", "Integer (Number)", "Float (Decimal)"], state="readonly")
        combo_type.pack(pady=5)

        def confirm():
            col_name = ent_name.get().strip()
            dtype = type_var.get()
            
            if not col_name:
                messagebox.showwarning("!", "ใส่ชื่อคอลัมน์ด้วยครับ")
                return
            if col_name in self.df.columns:
                messagebox.showerror("!", "ชื่อคอลัมน์ซ้ำ!")
                return

            # เพิ่ม Column ลง DataFrame พร้อมค่า Default
            if "Integer" in dtype:
                self.df[col_name] = 0
            elif "Float" in dtype:
                self.df[col_name] = 0.0
            else:
                self.df[col_name] = "" # Text

            self.refresh_treeview()
            win.destroy()
            self.status_var.set(f"เพิ่มคอลัมน์ '{col_name}' แล้ว (อย่าลืมกด Save)")

        tk.Button(win, text="เพิ่มคอลัมน์", command=confirm, bg="#4CAF50", fg="white").pack(pady=10)

    # ==========================
    # 3. Edit Row Logic
    # ==========================
    def on_double_click(self, event):
        """เมื่อดับเบิ้ลคลิกที่แถว -> เรียกฟังก์ชันแก้ไข"""
        self.edit_selected_row()

    def edit_selected_row(self):
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("Warning", "กรุณาเลือกแถวที่จะแก้ไข")
            return

        # เอาแถวแรกที่เลือก (กรณีเลือกหลายแถว)
        idx = int(selected[0])
        row_data = self.df.iloc[idx]

        # สร้าง Popup Form
        win = tk.Toplevel(self)
        win.title(f"แก้ไขข้อมูลแถวที่ {idx}")
        win.geometry("400x400")

        # สร้าง Canvas + Scrollbar ในกรณี Columns เยอะ
        canvas = tk.Canvas(win)
        scrollbar = ttk.Scrollbar(win, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        entries = {}
        for i, col in enumerate(self.df.columns):
            lbl = tk.Label(scrollable_frame, text=col, font=("Arial", 9, "bold"))
            lbl.grid(row=i, column=0, sticky="e", padx=5, pady=5)
            
            ent = tk.Entry(scrollable_frame, width=40)
            ent.insert(0, str(row_data[col])) # ใส่ค่าเดิม
            ent.grid(row=i, column=1, padx=5, pady=5)
            entries[col] = ent

        def save_edit():
            # อัปเดตข้อมูลกลับลง DataFrame
            for col, ent in entries.items():
                val = ent.get()
                # พยายามคง Type เดิมถ้าทำได้ (เช่น เดิมเป็น int ก็พยายามแปลงกลับเป็น int)
                # แต่ง่ายสุดคือเก็บเป็น string หรือให้ pandas auto detect ตอนเซฟ
                self.df.at[idx, col] = val
            
            self.refresh_treeview()
            win.destroy()
            self.status_var.set(f"แก้ไขแถว {idx} เรียบร้อย")

        tk.Button(win, text="บันทึกการแก้ไข", command=save_edit, bg="#2196F3", fg="white", font=("Arial", 10, "bold")).pack(side="bottom", fill="x", pady=10)

    def add_row_dialog(self):
        # คล้าย Edit แต่เป็นแถวเปล่า
        if self.df.empty and len(self.df.columns) == 0: return

        win = tk.Toplevel(self)
        win.title("เพิ่มแถวใหม่")
        entries = {}
        for i, col in enumerate(self.df.columns):
            tk.Label(win, text=col).grid(row=i, column=0, padx=5, pady=5)
            ent = tk.Entry(win, width=30)
            ent.grid(row=i, column=1, padx=5, pady=5)
            entries[col] = ent
        
        def confirm():
            new_data = {col: ent.get() for col, ent in entries.items()}
            self.df = pd.concat([self.df, pd.DataFrame([new_data])], ignore_index=True)
            self.refresh_treeview()
            win.destroy()
        
        tk.Button(win, text="ยืนยัน", command=confirm).grid(row=len(self.df.columns), columnspan=2, pady=10)

    def delete_row(self):
        selected = self.tree.selection()
        if not selected: return
        if messagebox.askyesno("Confirm", "ลบแถวที่เลือก?"):
            indices = [int(x) for x in selected]
            self.df = self.df.drop(indices).reset_index(drop=True)
            self.refresh_treeview()

    # ==========================
    # 4. Save & Create Logic
    # ==========================
    def create_new_table_dialog(self):
        name = simpledialog.askstring("New Table", "ตั้งชื่อตารางใหม่ (ถ้าเป็น DB เดิม จะสร้าง Table เพิ่ม):")
        if name:
            self.df = pd.DataFrame(columns=["ID", "Name"]) # สร้างคอลัมน์ตั้งต้น
            self.current_table_name = name
            
            # ถ้าเป็น DB ให้เพิ่มชื่อเข้า List ชั่วคราว (ยังไม่เซฟลงไฟล์จริงจนกว่าจะกด Save)
            if self.current_file_type == 'db':
                if name not in self.all_tables:
                    self.all_tables.append(name)
                    self.combo_tables['values'] = self.all_tables
                    self.combo_tables.set(name)
            
            self.refresh_treeview()
            self.status_var.set(f"สร้างตาราง {name} (Memory Only - อย่าลืมกด Save)")

    def save_current(self):
        if not self.current_file_path:
            self.save_as_new()
            return
        
        try:
            if self.current_file_type == 'db':
                conn = sqlite3.connect(self.current_file_path)
                # if_exists='replace' คือทับตารางเดิมด้วยข้อมูลใหม่ (รวมถึงคอลัมน์ใหม่ที่เพิ่มด้วย)
                self.df.to_sql(self.current_table_name, conn, if_exists='replace', index=False)
                conn.close()
                messagebox.showinfo("Success", f"บันทึกตาราง {self.current_table_name} ลง DB เรียบร้อย")
            elif self.current_file_type == 'csv':
                self.df.to_csv(self.current_file_path, index=False, encoding='utf-8-sig')
                messagebox.showinfo("Success", "บันทึก CSV เรียบร้อย")
            elif self.current_file_type == 'excel':
                self.df.to_excel(self.current_file_path, index=False)
                messagebox.showinfo("Success", "บันทึก Excel เรียบร้อย")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def save_as_new(self):
        path = filedialog.asksaveasfilename(defaultextension=".db", filetypes=[("DB", "*.db"), ("CSV", "*.csv"), ("Excel", "*.xlsx")])
        if not path: return
        
        # ... (Logic Save As เหมือนเดิม แต่เพิ่มการจัดการ file type) ...
        # เพื่อความกระชับ ขอละไว้ในส่วนนี้ แต่หลักการเหมือน save_current 
        # แค่เปลี่ยน self.current_file_path เป็น path ใหม่
        self.current_file_path = path
        ext = os.path.splitext(path)[1].lower()
        
        try:
            if ext == '.db':
                self.current_file_type = 'db'
                table_name = simpledialog.askstring("Table Name", "ตั้งชื่อตาราง:") or "Table1"
                self.current_table_name = table_name
                conn = sqlite3.connect(path)
                self.df.to_sql(table_name, conn, if_exists='replace', index=False)
                conn.close()
                self.all_tables = [table_name]
                self.combo_tables['values'] = self.all_tables
                self.combo_tables.set(table_name)
                
            elif ext == '.csv':
                self.current_file_type = 'csv'
                self.df.to_csv(path, index=False, encoding='utf-8-sig')
                
            elif ext == '.xlsx':
                self.current_file_type = 'excel'
                self.df.to_excel(path, index=False)
                
            messagebox.showinfo("Success", "บันทึกไฟล์ใหม่เรียบร้อย")
            self.status_var.set(f"บันทึกไฟล์: {os.path.basename(path)}")
            
        except Exception as e:
             messagebox.showerror("Error", str(e))

    # ==========================
    # 5. Reorder Columns Logic (New)
    # ==========================
    def reorder_columns_dialog(self):
        """หน้าต่างสำหรับจัดเรียงลำดับคอลัมน์ใหม่"""
        if self.df.empty:
            messagebox.showwarning("Warning", "ไม่มีข้อมูลให้จัดเรียง")
            return

        win = tk.Toplevel(self)
        win.title("จัดเรียงคอลัมน์ (Reorder Columns)")
        win.geometry("300x400")

        # Listbox แสดงชื่อคอลัมน์
        lb_frame = ttk.Frame(win)
        lb_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        lb = tk.Listbox(lb_frame, selectmode=tk.SINGLE, height=15)
        lb.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Scrollbar
        sc = ttk.Scrollbar(lb_frame, orient=tk.VERTICAL, command=lb.yview)
        sc.pack(side=tk.RIGHT, fill=tk.Y)
        lb.config(yscrollcommand=sc.set)

        # ใส่ชื่อคอลัมน์ปัจจุบันลงไป
        current_cols = list(self.df.columns)
        for col in current_cols:
            lb.insert(tk.END, col)

        # ฟังก์ชันเลื่อนขึ้น
        def move_up():
            idx = lb.curselection()
            if not idx: return
            i = idx[0]
            if i == 0: return # บนสุดแล้ว
            text = lb.get(i)
            lb.delete(i)
            lb.insert(i-1, text)
            lb.selection_set(i-1)

        # ฟังก์ชันเลื่อนลง
        def move_down():
            idx = lb.curselection()
            if not idx: return
            i = idx[0]
            if i == lb.size() - 1: return # ล่างสุดแล้ว
            text = lb.get(i)
            lb.delete(i)
            lb.insert(i+1, text)
            lb.selection_set(i+1)

        # ปุ่มควบคุมด้านขวา
        btn_frame = ttk.Frame(win)
        btn_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Button(btn_frame, text="🔼 เลื่อนขึ้น", command=move_up).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        ttk.Button(btn_frame, text="🔽 เลื่อนลง", command=move_down).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)

        def confirm():
            # ดึงลำดับใหม่จาก Listbox
            new_order = list(lb.get(0, tk.END))
            
            # สลับคอลัมน์ใน DataFrame
            self.df = self.df[new_order]
            
            # อัปเดตหน้าจอ
            self.refresh_treeview()
            self.status_var.set("จัดเรียงคอลัมน์ใหม่แล้ว (กด Save เพื่อบันทึกลงไฟล์)")
            win.destroy()

        ttk.Button(win, text="✅ ยืนยัน (Apply)", command=confirm).pack(fill=tk.X, padx=10, pady=10)

if __name__ == "__main__":
    app = DataManagerPro()
    app.mainloop()