import sys
import pypdf

def unlock_pdf(input_path, output_path):
    try:
        reader = pypdf.PdfReader(input_path)
        if reader.is_encrypted:
            # Try to decrypt with empty password (for owner-locked PDFs)
            result = reader.decrypt('')
            if result == 0:
                print("Error: Document requires a user password.", file=sys.stderr)
                sys.exit(1)
                
        writer = pypdf.PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
            
        with open(output_path, 'wb') as f:
            writer.write(f)
            
        print("Success")
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pdf_unlocker.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)
        
    unlock_pdf(sys.argv[1], sys.argv[2])
