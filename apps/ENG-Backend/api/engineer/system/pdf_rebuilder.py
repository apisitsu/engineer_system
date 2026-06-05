import sys
import fitz  # PyMuPDF

def rebuild_pdf(input_path, output_path):
    try:
        # Open the document
        doc = fitz.open(input_path)
        
        # Save it with options that rebuild and clean the internal structure
        # garbage=4: removes unused objects and compacts the xref table
        # clean=True: sanitizes content streams
        # deflate=True: compresses streams
        doc.save(
            output_path,
            garbage=4,
            clean=True,
            deflate=True
        )
        doc.close()
        print("Success")
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pdf_rebuilder.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)
        
    rebuild_pdf(sys.argv[1], sys.argv[2])
