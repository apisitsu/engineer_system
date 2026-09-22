import sys
import os

def unlock_pdf(input_path, output_path):
    """
    Unlocks an encrypted or permissions-locked PDF document.
    Decompresses ciphertext streams so downstream PDF libraries (like pdf-lib)
    can read and modify page contents without producing blank pages.
    """
    # Strategy 1: PyMuPDF (fitz) - High performance, transparent permissions decryption, robust stream decompressor
    try:
        import fitz
        doc = fitz.open(input_path)
        if doc.needs_pass:
            # Attempt to authenticate with empty string (standard permissions lock / owner password)
            doc.authenticate('')
        
        if not doc.is_encrypted:
            # Rebuild and save decrypted document with clean xrefs and deflated streams
            doc.save(output_path, garbage=3, deflate=True)
            doc.close()
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print("Success (PyMuPDF)")
                return
    except Exception as e:
        print(f"PyMuPDF unlock attempt failed: {str(e)}", file=sys.stderr)

    # Strategy 2: pypdf - Fallback for standard PDF security
    try:
        import pypdf
        reader = pypdf.PdfReader(input_path)
        if reader.is_encrypted:
            res = reader.decrypt('')
            if res == 0:
                print("Error: Document requires a non-empty password.", file=sys.stderr)
                sys.exit(1)

        writer = pypdf.PdfWriter()
        try:
            writer.clone_document_from_reader(reader)
        except Exception:
            for page in reader.pages:
                writer.add_page(page)

        with open(output_path, 'wb') as f:
            writer.write(f)

        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print("Success (pypdf)")
            return
    except Exception as e:
        print(f"pypdf unlock attempt failed: {str(e)}", file=sys.stderr)
        sys.exit(1)

    print("Error: Could not unlock document with available engines.", file=sys.stderr)
    sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pdf_unlocker.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    unlock_pdf(sys.argv[1], sys.argv[2])
