import sys
import os
import fitz  # PyMuPDF
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QLabel, 
                             QPushButton, QFileDialog, QLineEdit, QMessageBox,
                             QComboBox)
from PyQt6.QtCore import Qt

class PDFConverter(QWidget):
    def __init__(self):
        super().__init__()
        self.pdf_path = ""
        self.initUI()

    def initUI(self):
        self.setWindowTitle('โปรแกรมแปลง PDF เป็นรูปภาพ')
        self.resize(500, 420)
        # เปิดการรองรับ Drag & Drop สำหรับหน้าต่างนี้
        self.setAcceptDrops(True) 

        layout = QVBoxLayout()

        # ส่วนของ Drag & Drop / แสดงชื่อไฟล์
        self.lbl_file = QLabel('ลากไฟล์ PDF มาวางที่นี่\nหรือกดปุ่มด้านล่างเพื่อเลือกไฟล์', self)
        self.lbl_file.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.lbl_file.setStyleSheet("""
            QLabel { 
                border: 2px dashed #aaa; 
                border-radius: 8px; 
                padding: 30px; 
                background-color: #f9f9f9; 
                font-size: 14px;
            }
        """)
        layout.addWidget(self.lbl_file)

        # ปุ่มเลือกไฟล์
        self.btn_browse = QPushButton('ค้นหาไฟล์ PDF', self)
        self.btn_browse.clicked.connect(self.browse_file)
        self.btn_browse.setStyleSheet("padding: 8px;")
        layout.addWidget(self.btn_browse)

        # ส่วนของการเลือกหน้า
        self.lbl_pages = QLabel('ระบุหน้าที่ต้องการแปลง (เช่น 1, 3, 5-7) หรือปล่อยว่างเพื่อแปลงทุกหน้า:', self)
        self.lbl_pages.setStyleSheet("margin-top: 15px;")
        layout.addWidget(self.lbl_pages)

        self.input_pages = QLineEdit(self)
        self.input_pages.setPlaceholderText('ตัวอย่าง: 1, 2, 4-6 (หากต้องการแปลงทั้งหมด ไม่ต้องพิมพ์อะไร)')
        self.input_pages.setStyleSheet("padding: 8px; font-size: 14px;")
        layout.addWidget(self.input_pages)

        # --- เพิ่มส่วนตัวเลือกประเภทไฟล์ (JPG / PNG) ---
        self.lbl_format = QLabel('เลือกประเภทไฟล์รูปภาพที่ต้องการ:', self)
        self.lbl_format.setStyleSheet("margin-top: 15px;")
        layout.addWidget(self.lbl_format)

        self.combo_format = QComboBox(self)
        self.combo_format.addItems(['JPG', 'PNG']) # ตัวเลือกรูปแบบ
        self.combo_format.setStyleSheet("padding: 8px; font-size: 14px;")
        layout.addWidget(self.combo_format)
        # ----------------------------------------

        # ปุ่มเริ่มการแปลงไฟล์
        self.btn_convert = QPushButton('เริ่มการแปลงไฟล์', self)
        self.btn_convert.clicked.connect(self.convert_pdf)
        self.btn_convert.setStyleSheet("""
            QPushButton { 
                background-color: #4CAF50; 
                color: white; 
                padding: 12px; 
                font-weight: bold; 
                font-size: 14px;
                border-radius: 5px;
                margin-top: 15px;
            }
            QPushButton:hover { background-color: #45a049; }
        """)
        layout.addWidget(self.btn_convert)

        self.setLayout(layout)

    # --- ฟังก์ชันจัดการ Drag & Drop ---
    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.accept()
        else:
            event.ignore()

    def dropEvent(self, event):
        files = [u.toLocalFile() for u in event.mimeData().urls()]
        if files and files[0].lower().endswith('.pdf'):
            self.pdf_path = files[0]
            self.lbl_file.setText(f'ไฟล์ที่เลือก:\n{os.path.basename(self.pdf_path)}')
        else:
            QMessageBox.warning(self, "ข้อผิดพลาด", "โปรดเลือกไฟล์นามสกุล .pdf เท่านั้น")
    
    # --- ฟังก์ชันค้นหาไฟล์ผ่านระบบ ---
    def browse_file(self):
        fname, _ = QFileDialog.getOpenFileName(self, 'เลือกไฟล์ PDF', '', 'PDF Files (*.pdf)')
        if fname:
            self.pdf_path = fname
            self.lbl_file.setText(f'ไฟล์ที่เลือก:\n{os.path.basename(self.pdf_path)}')

    # --- ฟังก์ชันแปลงข้อความระบุหน้า ---
    def parse_pages(self, page_str, total_pages):
        if not page_str.strip():
            return list(range(total_pages))
        
        pages_to_convert = set()
        parts = page_str.replace(" ", "").split(",")
        for part in parts:
            if "-" in part:
                try:
                    start, end = map(int, part.split("-"))
                    pages_to_convert.update(range(start - 1, end)) 
                except ValueError:
                    pass 
            else:
                try:
                    pages_to_convert.add(int(part) - 1)
                except ValueError:
                    pass
        
        valid_pages = sorted([p for p in pages_to_convert if 0 <= p < total_pages])
        return valid_pages

    # --- ฟังก์ชันหลักในการแปลง PDF ---
    def convert_pdf(self):
        if not self.pdf_path:
            QMessageBox.warning(self, "แจ้งเตือน", "กรุณาเลือกไฟล์ PDF ก่อนทำการแปลง")
            return
            
        try:
            doc = fitz.open(self.pdf_path)
            total_pages = len(doc)
            
            page_str = self.input_pages.text()
            pages_to_convert = self.parse_pages(page_str, total_pages)
            
            if not pages_to_convert:
                QMessageBox.warning(self, "ข้อผิดพลาด", "ไม่พบหน้าที่ระบุในไฟล์นี้ หรือใส่รูปแบบหน้าไม่ถูกต้อง")
                return

            # ดึงนามสกุลไฟล์ที่ผู้ใช้เลือก (แปลงเป็นตัวพิมพ์เล็ก)
            selected_format = self.combo_format.currentText().lower()

            output_dir = QFileDialog.getExistingDirectory(self, f"เลือกโฟลเดอร์สำหรับบันทึกไฟล์ {selected_format.upper()}")
            if not output_dir:
                return 

            base_name = os.path.splitext(os.path.basename(self.pdf_path))[0]
            
            for page_num in pages_to_convert:
                page = doc.load_page(page_num)
                # dpi=300 สำหรับภาพคมชัด
                pix = page.get_pixmap(dpi=300) 
                
                # ประกอบชื่อไฟล์พร้อมนามสกุลที่เลือก
                output_path = os.path.join(output_dir, f"{base_name}_page_{page_num + 1}.{selected_format}")
                
                # บันทึกไฟล์ (PyMuPDF จะจัดการ Format ตามนามสกุลที่ต่อท้ายอัตโนมัติ)
                pix.save(output_path)
                
            doc.close()
            QMessageBox.information(self, "สำเร็จ", f"แปลงไฟล์เสร็จสิ้น!\nไฟล์ถูกบันทึกไว้ที่:\n{output_dir}")
            
        except Exception as e:
            QMessageBox.critical(self, "ข้อผิดพลาด", f"เกิดข้อผิดพลาดขณะแปลงไฟล์:\n{str(e)}")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    app.setStyle('Fusion') 
    ex = PDFConverter()
    ex.show()
    sys.exit(app.exec())