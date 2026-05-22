#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CATIA V5-6R2023 COM Automation Controller
==========================================
Controls CATIA V5 via pywin32 COM API for:
  - Opening .CATPart / .CATProduct files
  - Updating parameters via Design Tables (Excel) or direct parameter modification
  - Triggering global Part/Product update (rebuild)
  - Setting camera for optimal export view (Fit All, Isometric)
  - Exporting to STEP AP242 and/or 3D XML
  - Proper COM cleanup to prevent memory leaks

Usage:
  python catia_controller.py --input <path> --params <json_file> --output <dir> [--format both|step|3dxml]

Progress markers (parsed by Node.js worker):
  stdout lines starting with "PROGRESS:" are captured by BullMQ worker.
  Final result is a JSON object printed to stdout prefixed with "RESULT:".
"""

import sys
import os
import json
import argparse
import time
import gc
import traceback
import shutil
from pathlib import Path

# Lazy imports for pywin32 — only available on Windows with CATIA installed
win32com_client = None
pythoncom_module = None


def lazy_import_com():
    """Lazy import COM libraries so the script can be syntax-checked on non-Windows systems."""
    global win32com_client, pythoncom_module
    try:
        import win32com.client as _w32
        import pythoncom as _pycom
        win32com_client = _w32
        pythoncom_module = _pycom
    except ImportError:
        print("ERROR: pywin32 is not installed. Run: pip install pywin32", file=sys.stderr)
        sys.exit(1)


def progress(message):
    """Emit a progress message that the Node.js BullMQ worker captures."""
    print(f"PROGRESS: {message}", flush=True)


def result_output(data):
    """Emit the final result JSON for the Node.js worker to parse."""
    print(f"RESULT: {json.dumps(data, ensure_ascii=False)}", flush=True)


def error_output(message, details=None):
    """Emit an error result."""
    result_output({
        "success": False,
        "error": message,
        "details": details or ""
    })


# =============================================================================
# CATIA Connection
# =============================================================================

def connect_catia(visible=False, timeout=30):
    """
    Connect to a running CATIA V5 instance or launch a new one.
    
    Args:
        visible: If True, CATIA window is shown. False for background processing.
        timeout: Seconds to wait for CATIA to initialize.
    
    Returns:
        CATIA Application COM object
    """
    progress("Connecting to CATIA V5-6R2023...")
    pythoncom_module.CoInitialize()
    
    catia = None
    
    # Try to connect to existing instance first
    try:
        catia = win32com_client.GetActiveObject("CATIA.Application")
        progress("Connected to existing CATIA instance")
    except Exception:
        # No running instance, launch new one
        progress("Launching new CATIA instance...")
        try:
            catia = win32com_client.Dispatch("CATIA.Application")
        except Exception as e:
            raise RuntimeError(f"Failed to launch CATIA V5: {e}")
    
    # Configure CATIA for background processing
    catia.Visible = visible
    catia.DisplayFileAlerts = False  # Suppress file dialogs
    
    # Wait for CATIA to be ready
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # Test if CATIA is responsive
            _ = catia.SystemService
            progress("CATIA is ready")
            return catia
        except Exception:
            time.sleep(1)
    
    raise RuntimeError(f"CATIA did not respond within {timeout} seconds")


# =============================================================================
# Document Operations
# =============================================================================

def open_document(catia, file_path):
    """
    Open a .CATPart or .CATProduct file.
    
    Args:
        catia: CATIA Application COM object
        file_path: Absolute path to the CATIA file
    
    Returns:
        Opened Document COM object
    """
    file_path = os.path.abspath(file_path)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CATIA file not found: {file_path}")
    
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in ('.catpart', '.catproduct'):
        raise ValueError(f"Unsupported file type: {ext}. Expected .CATPart or .CATProduct")
    
    progress(f"Opening document: {os.path.basename(file_path)}")
    
    try:
        doc = catia.Documents.Open(file_path)
        progress(f"Document opened successfully: {doc.Name}")
        
        # If it's a Product (Assembly), force Design Mode to ensure geometry loads for export
        if ext == '.catproduct':
            progress("Assembly detected: Forcing Design Mode for all components...")
            try:
                doc.Product.ApplyWorkMode(2) # 2 = DESIGN_MODE
                progress("Design Mode applied.")
            except Exception as wme:
                progress(f"WARNING: Could not apply Design Mode: {wme}")
                
        return doc
    except Exception as e:
        raise RuntimeError(f"Failed to open document: {e}")


# =============================================================================
# Parameter Update — Direct CATIA Parameters
# =============================================================================

def update_parameters_direct(document, params):
    """
    Update CATIA parameters directly (not via Design Table).
    
    Args:
        document: CATIA Document COM object
        params: Dict of {parameter_name: new_value}
    
    Returns:
        Dict of updated parameters with old/new values
    """
    progress("Updating parameters directly...")
    is_product = document.Name.lower().endswith('.catproduct')
    root_obj = document.Product if is_product else document.Part
    
    parameters = root_obj.Parameters
    updated = {}
    
    for name, value in params.items():
        try:
            param = parameters.Item(name)
            old_value = param.Value
            
            # Set value based on type
            if isinstance(value, (int, float)):
                param.Value = float(value)
            elif isinstance(value, str):
                param.Value = value
            else:
                param.Value = value
            
            updated[name] = {
                "old": old_value,
                "new": param.Value,
                "unit": getattr(param, 'Unit', 'N/A')
            }
            progress(f"  Updated {name}: {old_value} → {param.Value}")
            
        except Exception as e:
            progress(f"  WARNING: Could not update parameter '{name}': {e}")
            updated[name] = {"error": str(e)}
    
    return updated


# =============================================================================
# Parameter Update — Design Table (Excel)
# =============================================================================

def update_design_table(document, params, excel_path=None):
    """
    Update CATIA parameters via an Excel Design Table.
    Matches the F01-02283 pattern: parameters like OD_2_2(mm), W_2_2(mm), etc.
    
    The Design Table Excel has two columns:
      - Column A: Parameter name (e.g., "W_2_2(mm)")
      - Column B: Value (e.g., 15.062)
    
    Args:
        document: CATIA Document COM object
        params: Dict of {parameter_name: new_value}
        excel_path: Optional explicit path to the Excel file.
                    If None, tries to find linked Design Table.
    
    Returns:
        Dict of updated parameters
    """
    progress("Updating parameters via Design Table...")
    
    # Determine if Part or Product
    is_product = document.Name.lower().endswith('.catproduct')
    root_obj = document.Product if is_product else document.Part
    
    updated = {}
    
    # Try to find existing Design Table in the document
    design_tables = None
    try:
        design_tables = root_obj.Relations.GetItem("DesignTable")
    except Exception:
        pass
    
    if design_tables is None:
        # Try iterating relations to find design tables
        try:
            relations = root_obj.Relations
            for i in range(1, relations.Count + 1):
                rel = relations.Item(i)
                if hasattr(rel, 'FilePath'):
                    design_tables = rel
                    progress(f"  Found Design Table: {rel.Name}")
                    break
        except Exception:
            pass
    
    if excel_path and os.path.exists(excel_path):
        # Direct Excel modification approach
        progress(f"  Modifying Excel file: {os.path.basename(excel_path)}")
        updated = _modify_excel_design_table(excel_path, params)
        
        # Refresh the Design Table in CATIA if it exists
        if design_tables:
            try:
                design_tables.Synchronize()
                progress("  Design Table synchronized")
            except Exception as e:
                progress(f"  WARNING: Could not synchronize Design Table: {e}")
    else:
        # Modify via CATIA Design Table API
        if design_tables:
            try:
                dt_path = design_tables.FilePath
                progress(f"  Found linked Excel: {dt_path}")
                updated = _modify_excel_design_table(dt_path, params)
                design_tables.Synchronize()
                progress("  Design Table synchronized")
            except Exception as e:
                progress(f"  Falling back to direct parameter update: {e}")
                updated = update_parameters_direct(document, params)
        else:
            progress("  No Design Table found, using direct parameter update")
            updated = update_parameters_direct(document, params)
    
    return updated


def _modify_excel_design_table(excel_path, params):
    """
    Modify an Excel Design Table file directly.
    Handles the two-column format: [ParamName, Value].
    
    Uses openpyxl for .xlsx files.
    """
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("openpyxl is required for Excel Design Table editing. Run: pip install openpyxl")
    
    # Create backup before modifying
    backup_path = excel_path + ".bak"
    shutil.copy2(excel_path, backup_path)
    progress(f"  Created backup: {os.path.basename(backup_path)}")
    
    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active
    
    updated = {}
    
    # Iterate through rows to find matching parameter names
    for row in ws.iter_rows(min_row=1, max_col=2, values_only=False):
        cell_name = row[0]
        cell_value = row[1]
        
        if cell_name.value and str(cell_name.value) in params:
            param_name = str(cell_name.value)
            old_value = cell_value.value
            new_value = params[param_name]
            
            cell_value.value = new_value
            updated[param_name] = {
                "old": old_value,
                "new": new_value
            }
            progress(f"  Excel: {param_name}: {old_value} → {new_value}")
    
    wb.save(excel_path)
    wb.close()
    
    return updated


# =============================================================================
# Model Rebuild
# =============================================================================

def rebuild_model(document):
    """
    Trigger a global update (rebuild) of the CATIA Part or Product.
    
    Args:
        document: CATIA Document COM object
    
    Returns:
        True if rebuild succeeded
    """
    progress("Rebuilding model (global update)...")
    
    try:
        part = document.Part
        part.Update()
        progress("Model rebuild completed successfully")
        return True
    except Exception as e:
        progress(f"WARNING: Part.Update() failed, trying Product.Update(): {e}")
        try:
            product = document.Product
            product.Update()
            progress("Product rebuild completed successfully")
            return True
        except Exception as e2:
            raise RuntimeError(f"Model rebuild failed: {e2}")


# =============================================================================
# Camera Manipulation
# =============================================================================

def set_camera_fit_all(catia, view_preset="isometric"):
    """
    Manipulate the CATIA camera to center the model with annotations
    within the bounding box, suitable for export/screenshot.
    
    Args:
        catia: CATIA Application COM object
        view_preset: One of 'isometric', 'front', 'top', 'right'
    
    Returns:
        Dict with camera info
    """
    progress(f"Setting camera view: {view_preset}...")
    
    try:
        viewer = catia.ActiveWindow.ActiveViewer
        vp = viewer.Viewpoint3D
        
        # Define view directions
        view_configs = {
            "isometric": {
                "sight": (1, -1, 1),
                "up": (0, 0, 1)
            },
            "front": {
                "sight": (0, -1, 0),
                "up": (0, 0, 1)
            },
            "top": {
                "sight": (0, 0, -1),
                "up": (0, 1, 0)
            },
            "right": {
                "sight": (1, 0, 0),
                "up": (0, 0, 1)
            }
        }
        
        config = view_configs.get(view_preset, view_configs["isometric"])
        
        # Set sight direction and up vector
        sight = config["sight"]
        up = config["up"]
        
        vp.PutSightDirection(list(sight))
        vp.PutUpDirection(list(up))
        
        # Fit All — reframe to show entire model
        viewer.Reframe()
        
        # Zoom out slightly (15%) to ensure PMI annotations are visible
        try:
            current_fov = vp.FieldOfView
            vp.FieldOfView = current_fov * 1.15
        except Exception:
            pass  # FieldOfView may not be available on all viewer types
        
        progress("Camera set successfully")
        
        return {
            "view": view_preset,
            "sight_direction": list(sight),
            "up_direction": list(up)
        }
        
    except Exception as e:
        progress(f"WARNING: Camera manipulation failed (may be in background mode): {e}")
        return {"view": view_preset, "warning": str(e)}


# =============================================================================
# Export Functions
# =============================================================================

def export_step_ap242(document, output_path):
    """
    Export the document to STEP AP242 format (preserves PMI/3D Annotations).
    
    Args:
        document: CATIA Document COM object
        output_path: Output file path (.stp)
    
    Returns:
        Absolute path to exported file
    """
    progress("Exporting to STEP AP242...")
    
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Ensure .stp extension
    if not output_path.lower().endswith(('.stp', '.step')):
        output_path += '.stp'
        
    # Delete if exists to prevent SaveAs conflicts
    if os.path.exists(output_path):
        try: os.remove(output_path)
        except: pass
    
    try:
        document.ExportData(output_path, "stp")
        progress(f"STEP exported via Document.ExportData: {os.path.basename(output_path)}")
        return output_path
    except Exception as e:
        progress(f"ExportData failed, trying SaveAs alternative: {e}")
        try:
            document.SaveAs(output_path)
            progress(f"STEP exported via Document.SaveAs: {os.path.basename(output_path)}")
            return output_path
        except Exception as e2:
            raise RuntimeError(f"STEP export failed completely: {e2}")


def export_3dxml(document, output_path):
    """
    Export the document to 3D XML format (Dassault native, preserves PMI).
    
    Args:
        document: CATIA Document COM object
        output_path: Output file path (.3dxml)
    
    Returns:
        Absolute path to exported file
    """
    progress("Exporting to 3D XML...")
    
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    if not output_path.lower().endswith('.3dxml'):
        output_path += '.3dxml'
        
    if os.path.exists(output_path):
        try: os.remove(output_path)
        except: pass
    
    try:
        document.ExportData(output_path, "3dxml")
        progress(f"3D XML exported via Document.ExportData: {os.path.basename(output_path)}")
        return output_path
    except Exception as e:
        progress(f"ExportData failed, trying SaveAs alternative: {e}")
        try:
            document.SaveAs(output_path)
            progress(f"3D XML exported via Document.SaveAs: {os.path.basename(output_path)}")
            return output_path
        except Exception as e2:
            raise RuntimeError(f"3D XML export failed completely: {e2}")

def export_stl(document, output_path):
    """
    Export the document to STL format for web visualization.
    """
    progress("Exporting to STL for web viewer...")
    
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    if not output_path.lower().endswith('.stl'):
        output_path += '.stl'
        
    if os.path.exists(output_path):
        try: os.remove(output_path)
        except: pass
    
    try:
        document.SaveAs(output_path)
        progress(f"STL exported via Document.SaveAs: {os.path.basename(output_path)}")
        return output_path
    except Exception as e:
        progress(f"STL export failed: {e}")
        return None

def capture_viewport_image(catia, output_path, width=1920, height=1080):
    """
    Capture a high-resolution image of the current CATIA viewport.
    Used as a fallback for PDF generation if WebGL rendering is problematic.
    
    Args:
        catia: CATIA Application COM object
        output_path: Output image path (.png or .jpg)
        width: Image width in pixels
        height: Image height in pixels
    
    Returns:
        Absolute path to captured image
    """
    progress("Capturing viewport image...")
    
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        viewer = catia.ActiveWindow.ActiveViewer
        viewer.CaptureToFile(1, output_path)  # catCaptureFormatPNG = 1
        progress(f"Viewport captured: {os.path.basename(output_path)}")
        return output_path
    except Exception as e:
        progress(f"WARNING: Viewport capture failed: {e}")
        return None


# =============================================================================
# PMI/Annotation Extraction
# =============================================================================

def extract_pmi_data(document):
    """
    Extract PMI (Product Manufacturing Information) / 3D Annotations from the document.
    Returns annotation data that can be overlaid in the web viewer.
    
    Args:
        document: CATIA Document COM object
    
    Returns:
        List of PMI annotation dicts
    """
    progress("Extracting PMI annotations...")
    
    pmi_list = []
    
    try:
        part = document.Part
        
        # Try to access Annotation Set
        try:
            annotation_set = part.AnnotationSets
            for i in range(1, annotation_set.Count + 1):
                ann_set = annotation_set.Item(i)
                annotations = ann_set.Annotations
                
                for j in range(1, annotations.Count + 1):
                    ann = annotations.Item(j)
                    pmi_entry = {
                        "id": f"pmi_{i}_{j}",
                        "name": getattr(ann, 'Name', f'Annotation_{j}'),
                        "type": _get_annotation_type(ann),
                        "text": _get_annotation_text(ann),
                        "position": _get_annotation_position(ann),
                        "visible": True
                    }
                    pmi_list.append(pmi_entry)
            
            progress(f"Extracted {len(pmi_list)} PMI annotations")
            
        except Exception as e:
            progress(f"  No Annotation Sets found or access error: {e}")
        
        # Also extract parameters as pseudo-PMI for display
        try:
            parameters = part.Parameters
            param_pmi = []
            for i in range(1, min(parameters.Count + 1, 200)):  # Limit to 200
                try:
                    param = parameters.Item(i)
                    if hasattr(param, 'Value'):
                        param_pmi.append({
                            "id": f"param_{i}",
                            "name": param.Name,
                            "type": "parameter",
                            "text": f"{param.Name} = {param.Value}",
                            "value": param.Value,
                            "visible": False  # Hidden by default, toggleable
                        })
                except Exception:
                    continue
            
            if param_pmi:
                progress(f"Extracted {len(param_pmi)} parameter annotations")
                pmi_list.extend(param_pmi)
                
        except Exception as e:
            progress(f"  Parameter extraction skipped: {e}")
    
    except Exception as e:
        progress(f"WARNING: PMI extraction failed: {e}")
    
    return pmi_list


def _get_annotation_type(annotation):
    """Determine the type of a CATIA annotation."""
    type_name = type(annotation).__name__
    type_map = {
        "Dimension": "dimension",
        "DatumTarget": "datum",
        "GeometricTolerance": "tolerance",
        "Roughness": "surface_finish",
        "Text": "text",
        "Flag": "flag",
        "Welding": "welding"
    }
    return type_map.get(type_name, "annotation")


def _get_annotation_text(annotation):
    """Extract text content from an annotation."""
    try:
        return annotation.Text if hasattr(annotation, 'Text') else str(annotation.Name)
    except Exception:
        return "N/A"


def _get_annotation_position(annotation):
    """Extract 3D position of an annotation."""
    try:
        if hasattr(annotation, 'GetPosition'):
            pos = annotation.GetPosition()
            return {"x": pos[0], "y": pos[1], "z": pos[2]}
    except Exception:
        pass
    return {"x": 0, "y": 0, "z": 0}


# =============================================================================
# Metadata Generation
# =============================================================================

def generate_metadata_xml(document, params, output_path):
    """
    Generate an XML metadata file for the drawing title block.
    Contains part info, parameter values, tolerances, and revision data.
    
    Args:
        document: CATIA Document COM object
        params: The parameters that were updated
        output_path: Output XML path
    
    Returns:
        Path to generated XML file
    """
    progress("Generating metadata XML...")
    
    import xml.etree.ElementTree as ET
    
    root = ET.Element("DrawingMetadata")
    root.set("generated", time.strftime("%Y-%m-%dT%H:%M:%S"))
    
    # Part Info
    part_info = ET.SubElement(root, "PartInfo")
    try:
        part = document.Part
        ET.SubElement(part_info, "PartNumber").text = getattr(part, 'PartNumber', 'N/A')
        ET.SubElement(part_info, "Name").text = document.Name
        ET.SubElement(part_info, "Revision").text = getattr(part, 'Revision', 'A')
    except Exception:
        ET.SubElement(part_info, "Name").text = document.Name
    
    # Parameters
    params_elem = ET.SubElement(root, "Parameters")
    for name, info in (params or {}).items():
        param_elem = ET.SubElement(params_elem, "Parameter")
        param_elem.set("name", name)
        if isinstance(info, dict):
            for key, val in info.items():
                param_elem.set(key, str(val))
        else:
            param_elem.set("value", str(info))
    
    # Title Block defaults
    title_block = ET.SubElement(root, "TitleBlock")
    ET.SubElement(title_block, "Scale").text = "1:1"
    ET.SubElement(title_block, "Sheet").text = "1/1"
    ET.SubElement(title_block, "DrawingSize").text = "A4"
    ET.SubElement(title_block, "Material").text = ""
    ET.SubElement(title_block, "Weight").text = ""
    ET.SubElement(title_block, "Tolerance").text = "ISO 2768-mK"
    ET.SubElement(title_block, "DrawnBy").text = ""
    ET.SubElement(title_block, "CheckedBy").text = ""
    ET.SubElement(title_block, "ApprovedBy").text = ""
    ET.SubElement(title_block, "Date").text = time.strftime("%Y-%m-%d")
    
    # Write XML
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(output_path, encoding="utf-8", xml_declaration=True)
    
    progress(f"Metadata XML generated: {os.path.basename(output_path)}")
    return output_path


# =============================================================================
# Cleanup
# =============================================================================

def cleanup(document=None, catia=None, close_catia=False):
    """
    Properly close document and release all COM objects.
    Critical for preventing memory leaks in server environments.
    
    Args:
        document: Document to close (optional)
        catia: CATIA Application to release (optional)
        close_catia: If True, quit CATIA entirely
    """
    progress("Cleaning up resources...")
    
    try:
        if document:
            try:
                document.Close()
                progress("  Document closed")
            except Exception as e:
                progress(f"  WARNING: Could not close document: {e}")
        
        if catia and close_catia:
            try:
                catia.Quit()
                progress("  CATIA application closed")
            except Exception:
                pass
        
        # Release COM objects
        if document:
            del document
        if catia and close_catia:
            del catia
        
        # Force garbage collection
        gc.collect()
        
        # Uninitialize COM
        try:
            pythoncom_module.CoUninitialize()
        except Exception:
            pass
        
        progress("Cleanup completed")
        
    except Exception as e:
        progress(f"WARNING: Cleanup error (non-fatal): {e}")


# =============================================================================
# Main Orchestration
# =============================================================================

def load_config():
    """Load configuration from config.json."""
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}


def main():
    """Main entry point — orchestrates the full CATIA automation pipeline."""
    
    parser = argparse.ArgumentParser(description='CATIA V5-6R2023 COM Automation Controller')
    parser.add_argument('--input', required=True, help='Path to .CATPart or .CATProduct file')
    parser.add_argument('--params', required=True, help='Path to JSON file with parameter values')
    parser.add_argument('--output', required=True, help='Output directory for exported files')
    parser.add_argument('--format', default='both', choices=['both', 'step', '3dxml'],
                        help='Export format (default: both)')
    parser.add_argument('--excel', default=None, help='Explicit path to Design Table Excel file')
    parser.add_argument('--mode', default='design_table', choices=['design_table', 'direct'],
                        help='Parameter update mode (default: design_table)')
    parser.add_argument('--view', default='isometric', 
                        choices=['isometric', 'front', 'top', 'right'],
                        help='Camera view preset for export (default: isometric)')
    parser.add_argument('--visible', action='store_true', help='Show CATIA window')
    parser.add_argument('--close-catia', action='store_true', help='Close CATIA after processing')
    parser.add_argument('--jobId', default=None, help='BullMQ job ID for tracking')
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config()
    
    # Lazy import COM libraries
    lazy_import_com()
    
    catia = None
    document = None
    start_time = time.time()
    
    try:
        # Step 1: Load parameters
        progress("Loading parameters from JSON...")
        with open(args.params, 'r', encoding='utf-8') as f:
            params = json.load(f)
        progress(f"Loaded {len(params)} parameters")
        
        # Step 2: Connect to CATIA
        catia = connect_catia(
            visible=args.visible,
            timeout=config.get('catia_timeout', 30)
        )
        
        # Step 3: Open document
        document = open_document(catia, args.input)
        
        # Step 4: Update parameters
        if args.mode == 'design_table':
            updated = update_design_table(document, params, excel_path=args.excel)
        else:
            updated = update_parameters_direct(document, params)
        
        # Step 5: Rebuild model
        rebuild_model(document)
        
        # Step 6: Set camera
        camera_info = set_camera_fit_all(catia, view_preset=args.view)
        
        # Step 7: Export
        output_dir = os.path.abspath(args.output)
        os.makedirs(output_dir, exist_ok=True)
        
        base_name = os.path.splitext(os.path.basename(args.input))[0]
        job_suffix = f"_{args.jobId}" if args.jobId else ""
        
        exports = {}
        
        if args.format in ('both', 'step'):
            step_path = os.path.join(output_dir, f"{base_name}{job_suffix}.stp")
            exports['step'] = export_step_ap242(document, step_path)
        
        if args.format in ('both', '3dxml'):
            xml3d_path = os.path.join(output_dir, f"{base_name}{job_suffix}.3dxml")
            exports['3dxml'] = export_3dxml(document, xml3d_path)
        
        # Always export STL for the web viewer fallback
        stl_path = os.path.join(output_dir, f"{base_name}{job_suffix}.stl")
        stl_result = export_stl(document, stl_path)
        if stl_result:
            exports['stl'] = stl_result
        
        # Step 8: Capture viewport image (for PDF fallback)
        img_path = os.path.join(output_dir, f"{base_name}{job_suffix}_viewport.png")
        viewport_img = capture_viewport_image(catia, img_path)
        if viewport_img:
            exports['viewport_image'] = viewport_img
        
        # Step 9: Extract PMI data
        pmi_data = extract_pmi_data(document)
        pmi_path = os.path.join(output_dir, f"{base_name}{job_suffix}_pmi.json")
        with open(pmi_path, 'w', encoding='utf-8') as f:
            json.dump(pmi_data, f, indent=2, ensure_ascii=False)
        exports['pmi_data'] = pmi_path
        
        # Step 10: Generate metadata XML
        metadata_path = os.path.join(output_dir, f"{base_name}{job_suffix}_metadata.xml")
        generate_metadata_xml(document, updated, metadata_path)
        exports['metadata_xml'] = metadata_path
        
        # Step 11: Save updated document
        progress("Saving updated document...")
        try:
            document.Save()
            progress("Document saved")
        except Exception as e:
            progress(f"WARNING: Could not save document: {e}")
        
        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Final result
        result_output({
            "success": True,
            "jobId": args.jobId,
            "input_file": args.input,
            "parameters_updated": updated,
            "exports": exports,
            "pmi_count": len(pmi_data),
            "camera": camera_info,
            "duration_ms": duration_ms
        })
        
    except Exception as e:
        error_output(str(e), traceback.format_exc())
        sys.exit(1)
        
    finally:
        # Step 12: Cleanup
        cleanup(document, catia, close_catia=args.close_catia)


if __name__ == '__main__':
    main()
