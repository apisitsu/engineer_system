import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk
import base64
import io

# พยายาม import tkinterdnd2 สำหรับฟีเจอร์ลากไฟล์มาวาง
try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    dnd_available = True
    RootClass = TkinterDnD.Tk
except ImportError:
    dnd_available = False
    RootClass = tk.Tk

class ProfileResizerApp(RootClass):
    def __init__(self):
        super().__init__()

        self.title("Profile Resizer & Base64 (Ready for React)")
        self.geometry("600x800") # เพิ่มความสูงนิดหน่อยเพื่อแสดง info
        self.resizable(False, False)

        # --- ตัวแปร ---
        self.original_image = None
        self.display_image = None
        self.tk_image = None
        self.image_pos_x = 0
        self.image_pos_y = 0
        self.last_mouse_x = 0
        self.last_mouse_y = 0

        # ขนาดมาตรฐาน
        self.sizes = {
            "เล็ก (Thumbnail - 128x128)": 128,
            "กลาง (Standard - 300x300)": 300,
            "ใหญ่ (HD - 500x500)": 500
        }
        self.target_size = 300

        self.create_widgets()

    def create_widgets(self):
        # 1. ส่วนหัว
        top_frame = ttk.Frame(self, padding=10)
        top_frame.pack(fill=tk.X)

        ttk.Label(top_frame, text="1. เลือกรูปภาพ (หรือลากไฟล์มาวาง)", font=("Arial", 10, "bold")).pack(anchor=tk.W)
        
        btn_select = ttk.Button(top_frame, text="เลือกรูปภาพ...", command=self.select_image)
        btn_select.pack(pady=5, fill=tk.X)

        if dnd_available:
            self.drop_target_register(DND_FILES)
            self.dnd_bind('<<Drop>>', self.drop_image)
            ttk.Label(top_frame, text="💡 Tip: ลากรูปมาวางที่หน้าต่างนี้ได้เลย", foreground="gray").pack()

        # 2. ส่วนเลือกขนาด
        opts_frame = ttk.Frame(self, padding=10)
        opts_frame.pack(fill=tk.X)

        ttk.Label(opts_frame, text="2. เลือกขนาด (Output Size)", font=("Arial", 10, "bold")).pack(anchor=tk.W)
        
        self.size_var = tk.StringVar(value="กลาง (Standard - 300x300)")
        self.combo_size = ttk.Combobox(opts_frame, textvariable=self.size_var, values=list(self.sizes.keys()), state="readonly")
        self.combo_size.pack(fill=tk.X, pady=5)
        self.combo_size.bind("<<ComboboxSelected>>", self.change_size)

        # 3. Canvas
        canvas_frame = ttk.LabelFrame(self, text="3. จัดตำแหน่ง (คลิกและลาก)", padding=10)
        canvas_frame.pack(fill=tk.BOTH, expand=True, padx=10)

        self.canvas_container = tk.Frame(canvas_frame, bg="#e1e1e1")
        self.canvas_container.pack(fill=tk.BOTH, expand=True)

        self.canvas = tk.Canvas(self.canvas_container, bg="white", highlightthickness=1, highlightbackground="black")
        self.canvas.place(relx=0.5, rely=0.5, anchor=tk.CENTER)
        
        self.canvas.bind("<ButtonPress-1>", self.on_mouse_down)
        self.canvas.bind("<B1-Motion>", self.on_mouse_drag)

        # 4. ส่วน Output และ Info
        bottom_frame = ttk.Frame(self, padding=10)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM)

        # ปุ่ม Generate
        ttk.Button(bottom_frame, text="แปลงเป็น Base64 (รวม Prefix) และคัดลอก", command=self.generate_base64).pack(fill=tk.X, pady=5)
        
        # Label แสดงสถานะและขนาดไฟล์
        self.lbl_status = ttk.Label(bottom_frame, text="รอการดำเนินการ...", foreground="blue")
        self.lbl_status.pack(pady=2)

        self.lbl_size_info = ttk.Label(bottom_frame, text="", font=("Arial", 9))
        self.lbl_size_info.pack(pady=2)

    def select_image(self):
        file_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg;*.gif")])
        if file_path:
            self.load_image(file_path)

    def drop_image(self, event):
        file_path = event.data
        if file_path.startswith('{') and file_path.endswith('}'):
            file_path = file_path[1:-1]
        self.load_image(file_path)

    def load_image(self, path):
        try:
            self.original_image = Image.open(path)
            self.update_canvas_view()
            self.lbl_status.config(text="โหลดรูปภาพสำเร็จ", foreground="black")
            self.lbl_size_info.config(text="")
        except Exception as e:
            messagebox.showerror("Error", f"ไม่สามารถเปิดรูปภาพได้: {e}")

    def change_size(self, event):
        selected = self.size_var.get()
        self.target_size = self.sizes[selected]
        if self.original_image:
            self.update_canvas_view()

    def update_canvas_view(self):
        if not self.original_image:
            return

        self.canvas.config(width=self.target_size, height=self.target_size)
        w, h = self.original_image.size
        ratio = max(self.target_size / w, self.target_size / h)
        new_w, new_h = int(w * ratio), int(h * ratio)

        self.display_image = self.original_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
        self.image_pos_x = (self.target_size - new_w) // 2
        self.image_pos_y = (self.target_size - new_h) // 2

        self.draw_image()

    def draw_image(self):
        if self.display_image:
            self.tk_image = ImageTk.PhotoImage(self.display_image)
            self.canvas.delete("all")
            self.canvas.create_image(self.image_pos_x, self.image_pos_y, anchor=tk.NW, image=self.tk_image)

    def on_mouse_down(self, event):
        self.last_mouse_x = event.x
        self.last_mouse_y = event.y

    def on_mouse_drag(self, event):
        if not self.display_image: return
        
        dx = event.x - self.last_mouse_x
        dy = event.y - self.last_mouse_y
        new_x, new_y = self.image_pos_x + dx, self.image_pos_y + dy

        img_w, img_h = self.display_image.size
        
        if new_x > 0: new_x = 0
        if new_x + img_w < self.target_size: new_x = self.target_size - img_w
        if new_y > 0: new_y = 0
        if new_y + img_h < self.target_size: new_y = self.target_size - img_h

        self.image_pos_x = new_x
        self.image_pos_y = new_y
        self.last_mouse_x, self.last_mouse_y = event.x, event.y
        self.draw_image()

    def generate_base64(self):
        if not self.display_image:
            messagebox.showwarning("Warning", "กรุณาเลือกรูปภาพก่อน")
            return

        # 1. สร้างภาพผลลัพธ์ (Crop)
        output_img = Image.new("RGB", (self.target_size, self.target_size))
        output_img.paste(self.display_image, (self.image_pos_x, self.image_pos_y))

        # 2. แปลงเป็น Base64
        buffered = io.BytesIO()
        # Quality=90 เป็นจุดสมดุลที่ดีระหว่างขนาดไฟล์และความชัด
        output_img.save(buffered, format="JPEG", quality=90) 
        
        raw_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        # --- ส่วนที่เพิ่มเข้ามา: เติม Prefix และคำนวณขนาด ---
        full_base64_string = f"data:image/jpeg;base64,{raw_base64}"
        
        # คำนวณขนาด String (1 ตัวอักษร = 1 Byte ใน ASCII/UTF-8 ทั่วไปสำหรับ Base64)
        size_bytes = len(full_base64_string)
        size_kb = size_bytes / 1024
        
        # 3. คัดลอกลง Clipboard
        self.clipboard_clear()
        self.clipboard_append(full_base64_string)
        self.update()

        # 4. อัปเดต UI แจ้งเตือนและแสดงขนาด
        self.lbl_status.config(text="✔ คัดลอก Base64 เรียบร้อยแล้ว!", foreground="green")
        
        # แสดงผลลัพธ์ขนาด
        info_text = (f"ขนาด String Base64: {size_kb:.2f} KB\n"
                     f"นี่คือขนาดที่จะถูกบันทึกลง Database จริงๆ")
        self.lbl_size_info.config(text=info_text, foreground="#555")
        
        messagebox.showinfo("สำเร็จ", 
                            f"คัดลอกเรียบร้อย!\n\n"
                            f"ขนาดข้อมูล: {size_kb:.2f} KB\n"
                            f"สามารถกด Ctrl+V วางใน React ได้เลย")

if __name__ == "__main__":
    app = ProfileResizerApp()
    app.mainloop()