import os
import sys
import argparse
import logging
import tkinter as tk
from tkinter import filedialog
from playwright.sync_api import sync_playwright, Error as PlaywrightError
from PIL import Image

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HTMLToPDFConverter:
    def __init__(self):
        pass

    def _remove_watermark(self, html_content: str) -> str:
        target_css = ".ias-watermark {"
        replacement_css = ".ias-watermark { display: none !important; "
        if target_css in html_content:
            logger.info("พบ CSS class .ias-watermark ทำการแก้ไขเพื่อซ่อนลายน้ำ")
            return html_content.replace(target_css, replacement_css)
        return html_content

    def convert(self, input_html_path: str, output_pdf_path: str) -> bool:
        if not os.path.exists(input_html_path):
            logger.error(f"ไม่พบไฟล์ต้นฉบับ: {input_html_path}")
            return False

        temp_html_path = f"{input_html_path}.temp.html"

        try:
            with open(input_html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            modified_html_content = self._remove_watermark(html_content)

            with open(temp_html_path, 'w', encoding='utf-8') as f:
                f.write(modified_html_content)

            with sync_playwright() as p:
                logger.info(f"เริ่มการทำงาน Playwright (โหมด Screenshot ความคมชัดสูง)...")
                browser = p.chromium.launch(headless=False)
                
                # บังคับ Viewport เป็น A4 แนวนอน (1123x794) และความคมชัด 3x
                context = browser.new_context(
                    viewport={'width': 1123, 'height': 794},
                    device_scale_factor=3
                )
                page = context.new_page()
                abs_path = os.path.abspath(temp_html_path)
                
                # โหลดหน้าหลักด้วย Parameter ?pa=0
                page.goto(f"file:///{abs_path}?pa=0")
                page.wait_for_timeout(8000) # รอโหลดโมเดลและ Thumbnails
                
                num_pages = page.evaluate("window.PA_DATA ? window.PA_DATA.length : 1")
                if num_pages == 0: num_pages = 1
                logger.info(f"ค้นพบเอกสารทั้งหมด {num_pages} หน้า")

                image_files = []

                for i in range(num_pages):
                    logger.info(f"กำลังจัดการหน้าที่ {i+1}/{num_pages}...")
                    page_url = f"file:///{abs_path}?pa={i}"
                    page.goto(page_url)
                    page.wait_for_timeout(8000)
                    
                    # ตรวจสอบจำนวนภาพย่อย (Thumbnails) ในหน้านั้น
                    cells = page.locator('.carousel-cell')
                    num_cells = cells.count()
                    if num_cells == 0:
                        num_cells = 1
                        
                    logger.info(f"ค้นพบภาพย่อยทั้งหมด {num_cells} ภาพในหน้านี้")
                    
                    for j in range(num_cells):
                        if cells.count() > 0:
                            logger.info(f"กำลังคลิกภาพย่อยที่ {j+1}/{num_cells}...")
                            try:
                                cells.nth(j).click()
                                page.wait_for_timeout(4000) # รอให้ภาพขยายเต็มจอ
                            except Exception as e:
                                logger.warning(f"ไม่สามารถคลิก Thumbnail ที่ {j+1} ได้: {e}")

                        temp_img = f"{output_pdf_path}_temp_page_{i}_{j}.png"
                        page.screenshot(path=temp_img, full_page=True)
                        image_files.append(temp_img)

                browser.close()
                
                if image_files:
                    logger.info("รวมภาพ Screenshot เข้าเป็น PDF...")
                    images = [Image.open(img).convert("RGB") for img in image_files]
                    images[0].save(output_pdf_path, save_all=True, append_images=images[1:], resolution=288.0)
                    for img in image_files:
                        try: os.remove(img)
                        except: pass
                    return True
                return False

        except Exception as e:
            logger.error(f"เกิดข้อผิดพลาด: {e}")
            raise
        finally:
            if os.path.exists(temp_html_path):
                try: os.remove(temp_html_path)
                except: pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert HTML to PDF")
    parser.add_argument("-i", "--input", help="ไฟล์ HTML หรือโฟลเดอร์ต้นฉบับ", nargs='?', default=None)
    args = parser.parse_args()

    target_path = args.input

    # ถ้าไม่ได้ระบุพาธทาง command line ให้เด้งหน้าต่าง GUI ขึ้นมาให้เลือก
    if not target_path:
        root = tk.Tk()
        root.withdraw() # ซ่อนหน้าต่างหลักของ tkinter
        # เด้งหน้าต่างให้เลือกไฟล์แบบ Windows (สามารถลากเมาส์คลุมเลือกได้หลายไฟล์พร้อมกัน)
        selected_files = filedialog.askopenfilenames(
            title="เลือกไฟล์ HTML ที่ต้องการแปลง (เลือกได้หลายไฟล์)",
            filetypes=[("HTML Files", "*.html *.HTML"), ("All Files", "*.*")]
        )
        if not selected_files:
            logger.info("ยกเลิกการทำงาน (ไม่ได้เลือกไฟล์)")
            sys.exit(0)
            
        html_files = list(selected_files)
    else:
        # กรณีใช้งานผ่าน command line
        html_files = []
        if os.path.isfile(target_path):
            if target_path.lower().endswith(".html"):
                html_files.append(target_path)
        elif os.path.isdir(target_path):
            logger.info(f"กำลังค้นหาไฟล์ HTML ในโฟลเดอร์: {target_path}")
            for f in os.listdir(target_path):
                if f.lower().endswith(".html"):
                    html_files.append(os.path.join(target_path, f))
    
    if not html_files:
        logger.warning(f"ไม่พบไฟล์ HTML ใน {target_path}")
        sys.exit(0)

    converter = HTMLToPDFConverter()
    
    # วนลูปแปลงทีละไฟล์
    for file_path in html_files:
        base_name = os.path.splitext(file_path)[0]
        output_pdf = f"{base_name}_output.pdf"
        
        logger.info(f"{"="*40}")
        logger.info(f"เริ่มการแปลงไฟล์: {os.path.basename(file_path)}")
        logger.info(f"{"="*40}")
        
        converter.convert(file_path, output_pdf)
        
    logger.info("🎉 ทำงานเสร็จสมบูรณ์ทุกไฟล์!")