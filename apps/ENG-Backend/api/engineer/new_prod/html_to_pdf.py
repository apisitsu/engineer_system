import os
import sys
import argparse
import logging
import tkinter as tk
from tkinter import filedialog
from playwright.sync_api import sync_playwright, Error as PlaywrightError
from PIL import Image
import glob

logger = logging.getLogger(__name__)

class HTMLToPDFConverter:
    def __init__(self, log_file_path=None):
        self.error_occurred = False
        self.log_file_path = log_file_path

    def _remove_watermark(self, html_content: str) -> str:
        target_css = ".ias-watermark {"
        replacement_css = ".ias-watermark { display: none !important; "
        if target_css in html_content:
            logger.info("Found CSS class .ias-watermark, modifying to hide watermark.")
            return html_content.replace(target_css, replacement_css)
        return html_content

    def convert(self, input_html_path: str, output_pdf_path: str) -> bool:
        if not os.path.exists(input_html_path):
            logger.error(f"Source file not found: {input_html_path}")
            self.error_occurred = True
            return False

        temp_html_path = f"{input_html_path}.temp.html"

        try:
            with open(input_html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            modified_html_content = self._remove_watermark(html_content)

            with open(temp_html_path, 'w', encoding='utf-8') as f:
                f.write(modified_html_content)

            with sync_playwright() as p:
                logger.info(f"Starting Playwright (High resolution screenshot mode)...")
                browser = p.chromium.launch(headless=False)
                
                # Force Viewport to A4 Landscape (1123x794) and scale 3x
                context = browser.new_context(
                    viewport={'width': 1123, 'height': 794},
                    device_scale_factor=3
                )
                page = context.new_page()
                abs_path = os.path.abspath(temp_html_path)
                
                # Load main page with ?pa=0
                page.goto(f"file:///{abs_path}?pa=0")
                page.wait_for_timeout(8000) # Wait for model and thumbnails to load
                
                num_pages = page.evaluate("window.PA_DATA ? window.PA_DATA.length : 1")
                if num_pages == 0: num_pages = 1
                logger.info(f"Found a total of {num_pages} pages.")

                image_files = []

                for i in range(num_pages):
                    logger.info(f"Processing page {i+1}/{num_pages}...")
                    page_url = f"file:///{abs_path}?pa={i}"
                    page.goto(page_url)
                    page.wait_for_timeout(8000)
                    
                    # Check number of thumbnails
                    cells = page.locator('.carousel-cell')
                    num_cells = cells.count()
                    if num_cells == 0:
                        num_cells = 1
                        
                    logger.info(f"Found {num_cells} thumbnails on this page.")
                    
                    for j in range(num_cells):
                        if cells.count() > 0:
                            logger.info(f"Clicking thumbnail {j+1}/{num_cells}...")
                            try:
                                cells.nth(j).click()
                                page.wait_for_timeout(4000) # Wait for image to expand
                            except Exception as e:
                                logger.warning(f"Failed to click thumbnail {j+1}: {e}")

                        temp_img = f"{output_pdf_path}_temp_page_{i}_{j}.png"
                        page.screenshot(path=temp_img, full_page=True)
                        image_files.append(temp_img)

                browser.close()
                
                if image_files:
                    logger.info("Combining screenshots into PDF...")
                    
                    # Force PIL to load all image plugins (fixes KeyError: 'JPEG' during PDF save)
                    Image.init()
                    
                    images = [Image.open(img).convert("RGB") for img in image_files]
                    images[0].save(output_pdf_path, save_all=True, append_images=images[1:], resolution=288.0)
                    for img in image_files:
                        try: os.remove(img)
                        except: pass
                    return True
                return False

        except Exception as e:
            logger.error(f"An error occurred: {e}")
            self.error_occurred = True
            raise
        finally:
            if os.path.exists(temp_html_path):
                try: os.remove(temp_html_path)
                except: pass

def setup_logging(log_file_path):
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)

    file_handler = logging.FileHandler(log_file_path, encoding='utf-8')
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    logging.basicConfig(level=logging.INFO, handlers=[file_handler])
    return logging.getLogger(__name__)

def cleanup_old_logs(log_dir, keep_count=100):
    try:
        log_files = glob.glob(os.path.join(log_dir, "*.log"))
        log_files.sort(key=os.path.getmtime, reverse=True)
        files_to_delete = log_files[keep_count:]
        for f in files_to_delete:
            try:
                os.remove(f)
            except Exception:
                pass
    except Exception:
        pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert HTML to PDF")
    parser.add_argument("-i", "--input", help="Source HTML file or directory", nargs='?', default=None)
    args = parser.parse_args()

    target_path = args.input

    if not target_path:
        root = tk.Tk()
        root.withdraw()
        selected_files = filedialog.askopenfilenames(
            title="Select HTML files to convert",
            filetypes=[("HTML Files", "*.html *.HTML"), ("All Files", "*.*")]
        )
        if not selected_files:
            print("Operation cancelled (no files selected).")
            sys.exit(0)
            
        html_files = list(selected_files)
    else:
        html_files = []
        if os.path.isfile(target_path):
            if target_path.lower().endswith(".html"):
                html_files.append(target_path)
        elif os.path.isdir(target_path):
            for f in os.listdir(target_path):
                if f.lower().endswith(".html"):
                    html_files.append(os.path.join(target_path, f))
    
    if not html_files:
        print(f"No HTML files found in {target_path}")
        sys.exit(0)

    has_errors = False
    for file_path in html_files:
        base_name = os.path.splitext(file_path)[0]
        output_pdf = f"{base_name}_output.pdf"
        log_file = f"{base_name}_process.log"
        
        logger = setup_logging(log_file)
        
        logger.info("=" * 40)
        logger.info(f"Starting conversion for: {os.path.basename(file_path)}")
        logger.info("=" * 40)
        
        converter = HTMLToPDFConverter(log_file_path=log_file)
        try:
            success = converter.convert(file_path, output_pdf)
            if success:
                logger.info("🎉 Processing completed successfully for this file!")
            else:
                has_errors = True
        except Exception:
            has_errors = True
            
        for handler in logging.root.handlers[:]:
            handler.close()
            logging.root.removeHandler(handler)

        if not converter.error_occurred and not has_errors:
            try:
                os.remove(log_file)
            except Exception:
                pass

        cleanup_old_logs(os.path.dirname(os.path.abspath(file_path)), keep_count=100)
        
    if has_errors:
        sys.exit(1)