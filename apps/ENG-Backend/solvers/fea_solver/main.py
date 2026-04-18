"""
FEA Solver Wrapper — Swage Analysis (Axisymmetric Flanged Sleeve Bushing)

Generates a parametric 2D cross-section mesh (R-Z plane) of a flanged sleeve bushing,
computes analytical Von Mises stress under radial compression, and outputs both
2D cross-section data and 3D revolved mesh for visualization.
"""
import os
import sys
import argparse
import time
import json
import gzip
import math
import csv


# ─────────────────────────────────────────────────────────────
# 1. CSV Parsing
# ─────────────────────────────────────────────────────────────
def parse_csv(filepath):
    """Parse a CSV file into a dict of {key: value} from the first two columns."""
    data = {}
    if not os.path.exists(filepath):
        return data
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader, None)  # Skip header row
        for row in reader:
            if len(row) >= 2:
                data[row[0].strip()] = row[1].strip()
    return data


# ─────────────────────────────────────────────────────────────
# 2. Parametric Bushing Mesh Generator (2D Axisymmetric)
# ─────────────────────────────────────────────────────────────
def generate_bushing_mesh(params):
    """
    Generates a structured quad mesh for a flanged sleeve bushing cross-section.
    
    The cross-section in the R-Z plane looks like:
    
         ┌──────────────────────┐  ← Flange top (R_flange, Z_top)
         │      FLANGE          │
         │                      │
         └───────┐              │
                 │   FILLET      │
                 │              ┌┘  ← Body-Flange junction
                 │  BODY        │
                 │              │
                 │              │
                 └──────────────┘  ← Bottom (R_inner, 0)
           R_inner    R_outer
    """
    print("PROGRESS:Meshing... (Generating axisymmetric bushing cross-section)", flush=True)
    
    # Extract parameters with defaults (mm)
    r_inner = float(params.get('InnerDiameter', '10.0')) / 2.0
    r_outer = float(params.get('OuterDiameter', '20.0')) / 2.0
    length = float(params.get('Length', '15.0'))
    r_flange = float(params.get('FlangeDiameter', '25.0')) / 2.0
    t_flange = float(params.get('FlangeThickness', '2.0'))
    mesh_size = float(params.get('MeshSize', '1.0'))

    # Ensure valid geometry
    r_flange = max(r_flange, r_outer + 0.5)
    
    # Body length = total length minus flange
    body_length = length - t_flange
    if body_length < 1.0:
        body_length = length * 0.8
        t_flange = length * 0.2

    # Calculate grid divisions based on mesh size
    n_r_body = max(4, int((r_outer - r_inner) / mesh_size))
    n_z_body = max(6, int(body_length / mesh_size))
    n_r_flange = max(3, int((r_flange - r_inner) / mesh_size))
    n_z_flange = max(2, int(t_flange / mesh_size))

    nodes = []  # List of [r, z]
    elements = []  # List of [n0, n1, n2, n3] (quad4, CCW)
    node_map = {}  # (region, i, j) -> node_index

    def add_node(r, z):
        idx = len(nodes)
        nodes.append([round(r, 6), round(z, 6)])
        return idx

    # ─── Region 1: Body (Rectangle) ───
    # Nodes from bottom-left (r_inner, 0) to top-right (r_outer, body_length)
    print("PROGRESS:Meshing Body region...", flush=True)
    for j in range(n_z_body + 1):
        z = (j / n_z_body) * body_length
        for i in range(n_r_body + 1):
            r = r_inner + (i / n_r_body) * (r_outer - r_inner)
            idx = add_node(r, z)
            node_map[('body', i, j)] = idx

    # Elements for body
    for j in range(n_z_body):
        for i in range(n_r_body):
            n0 = node_map[('body', i, j)]
            n1 = node_map[('body', i + 1, j)]
            n2 = node_map[('body', i + 1, j + 1)]
            n3 = node_map[('body', i, j + 1)]
            elements.append([n0, n1, n2, n3])

    # ─── Region 2: Flange (extends outward from body top) ───
    print("PROGRESS:Meshing Flange region...", flush=True)
    z_flange_bottom = body_length
    z_flange_top = body_length + t_flange

    for j in range(n_z_flange + 1):
        z = z_flange_bottom + (j / n_z_flange) * t_flange
        for i in range(n_r_flange + 1):
            r = r_inner + (i / n_r_flange) * (r_flange - r_inner)
            
            # Check if this node already exists at the body-flange boundary
            if j == 0 and i <= n_r_body:
                # Reuse body top row nodes for inner portion
                frac = i / n_r_flange
                body_i = int(frac * n_r_body)
                body_i = min(body_i, n_r_body)
                # Only reuse if radial position matches closely
                existing_idx = node_map.get(('body', body_i, n_z_body))
                if existing_idx is not None:
                    existing_r = nodes[existing_idx][0]
                    if abs(existing_r - r) < mesh_size * 0.3:
                        node_map[('flange', i, j)] = existing_idx
                        continue
            
            idx = add_node(r, z)
            node_map[('flange', i, j)] = idx

    # Elements for flange
    for j in range(n_z_flange):
        for i in range(n_r_flange):
            n0 = node_map.get(('flange', i, j))
            n1 = node_map.get(('flange', i + 1, j))
            n2 = node_map.get(('flange', i + 1, j + 1))
            n3 = node_map.get(('flange', i, j + 1))
            if n0 is not None and n1 is not None and n2 is not None and n3 is not None:
                elements.append([n0, n1, n2, n3])

    time.sleep(0.3)  # Brief pause for UX
    print(f"PROGRESS:Mesh complete: {len(nodes)} nodes, {len(elements)} elements", flush=True)
    
    return {
        "nodes": nodes,
        "elements": elements,
        "params": {
            "r_inner": r_inner,
            "r_outer": r_outer,
            "r_flange": r_flange,
            "body_length": body_length,
            "t_flange": t_flange,
            "length": length
        }
    }


# ─────────────────────────────────────────────────────────────
# 3. Revolve 2D Mesh to 3D
# ─────────────────────────────────────────────────────────────
def revolve_mesh_3d(nodes_2d, elements_2d, n_segments=24):
    """Revolve 2D axisymmetric cross-section (R,Z) around the Z-axis to produce 3D triangulated surface."""
    print("PROGRESS:Generating 3D revolved mesh...", flush=True)
    
    nodes_3d = []
    triangles_3d = []
    n_2d = len(nodes_2d)
    
    # Generate revolved nodes
    for seg in range(n_segments):
        theta = (seg / n_segments) * 2 * math.pi
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        for node in nodes_2d:
            r, z = node[0], node[1]
            x = r * cos_t
            y = r * sin_t
            nodes_3d.append([round(x, 5), round(y, 5), round(z, 5)])
    
    # Generate revolved triangles from quad elements
    for seg in range(n_segments):
        next_seg = (seg + 1) % n_segments
        offset_curr = seg * n_2d
        offset_next = next_seg * n_2d
        
        for elem in elements_2d:
            # Each 2D quad becomes a 3D "tube segment" with 4 quads (8 triangles)
            # But for rendering, we only need the outer surface.
            # For simplicity, each 2D quad edge on outer/inner surface becomes 2 triangles
            n0_curr = offset_curr + elem[0]
            n1_curr = offset_curr + elem[1]
            n2_curr = offset_curr + elem[2]
            n3_curr = offset_curr + elem[3]
            
            n0_next = offset_next + elem[0]
            n1_next = offset_next + elem[1]
            n2_next = offset_next + elem[2]
            n3_next = offset_next + elem[3]
            
            # Front face (current segment quad → 2 triangles)
            triangles_3d.append([n0_curr, n1_curr, n2_curr])
            triangles_3d.append([n0_curr, n2_curr, n3_curr])
            
            # We skip the back face / connecting faces to reduce triangle count
            # The revolved geometry will be rendered per-segment
    
    return nodes_3d, triangles_3d


# ─────────────────────────────────────────────────────────────
# 4. Analytical Von Mises Stress Solver
# ─────────────────────────────────────────────────────────────
def solve_analytical(mesh, material, timestep, setting):
    """
    Compute approximate Von Mises stress for a thick-walled cylinder
    under radial pressure using Lamé equations.
    """
    n_steps = int(timestep.get('TotalTime', '1.0').replace('.0', '') or '10')
    try:
        n_steps = max(1, int(float(timestep.get('TotalTime', '1.0')) / float(timestep.get('InitialTimeIncrement', '0.1'))))
    except (ValueError, ZeroDivisionError):
        n_steps = 10
    n_steps = min(n_steps, 20)  # Cap at 20 for performance

    E = float(material.get('YoungsModulus', '210000'))  # MPa
    nu = float(material.get('PoissonRatio', '0.3'))

    # Get max displacement from settings
    max_disp = 2.0  # Default 2mm compression
    for key, val in setting.items():
        if 'Displacement' in key or 'Load' in key:
            try:
                max_disp = abs(float(val))
            except ValueError:
                pass
    # Try to get from Direction column value
    # Parse setting.csv more carefully
    
    r_inner = mesh['params']['r_inner']
    r_outer = mesh['params']['r_outer']
    r_flange = mesh['params']['r_flange']
    body_length = mesh['params']['body_length']
    
    nodes = mesh['nodes']
    results = []
    
    print(f"PROGRESS:Solving... {n_steps} time steps (Analytical Lame)", flush=True)
    
    for step in range(1, n_steps + 1):
        print(f"PROGRESS:Solving Step {step}/{n_steps}", flush=True)
        time.sleep(0.15)  # Brief pause for progress visualization
        
        # Load factor increases linearly
        load_factor = step / n_steps
        
        # Equivalent internal pressure from displacement
        # p = E * δ / r_inner (simplified)
        p_equiv = E * (max_disp * load_factor) / r_inner * 0.001  # Scale down for realism
        
        displacements = []
        stresses = []
        
        for node in nodes:
            r, z = node[0], node[1]
            
            # Avoid division by zero at centerline
            r_eff = max(r, 0.01)
            
            # Lamé equations for thick-walled cylinder
            # σ_r = A - B/r²,  σ_θ = A + B/r²
            # With internal pressure p_i:
            # A = p_i * r_i² / (r_o² - r_i²)
            # B = p_i * r_i² * r_o² / (r_o² - r_i²)
            
            r_i = r_inner
            r_o = r_outer
            
            # Use different r_o for flange region
            if z > body_length:
                r_o = r_flange
            
            denom = r_o**2 - r_i**2
            if denom < 0.01:
                denom = 0.01
            
            A = p_equiv * r_i**2 / denom
            B = p_equiv * r_i**2 * r_o**2 / denom
            
            sigma_r = A - B / (r_eff**2)
            sigma_theta = A + B / (r_eff**2)
            sigma_z = nu * (sigma_r + sigma_theta)  # Plane strain approximation
            
            # Von Mises stress
            vm = math.sqrt(0.5 * (
                (sigma_r - sigma_theta)**2 +
                (sigma_theta - sigma_z)**2 +
                (sigma_z - sigma_r)**2
            ))
            
            stresses.append(round(vm, 4))
            
            # Radial displacement: u_r = (1/E) * [(1+ν)*A*r - (1-ν)*B/r]
            u_r = (1.0 / E) * ((1 + nu) * A * r_eff - (1 - nu) * B / r_eff)
            u_z = -nu * p_equiv * z / E * 0.1  # Small axial contraction
            
            displacements.append([round(u_r, 6), round(u_z, 6)])
        
        results.append({
            "time": round(step / n_steps, 4),
            "displacements": displacements,
            "stresses": stresses
        })
    
    return results


# ─────────────────────────────────────────────────────────────
# 5. Main Entry Point
# ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="FEA Solver — Swage Analysis")
    parser.add_argument('--jobId', required=True)
    parser.add_argument('--params', required=True)
    parser.add_argument('--material', required=True)
    parser.add_argument('--timestep', required=True)
    parser.add_argument('--setting', required=True)
    parser.add_argument('--output', required=True)
    
    args = parser.parse_args()
    
    print(f"PROGRESS:Initializing Job {args.jobId}", flush=True)
    
    # 1. Parse CSV Inputs
    params_data = parse_csv(args.params)
    material_data = parse_csv(args.material)
    timestep_data = parse_csv(args.timestep)
    setting_data = parse_csv(args.setting)
    
    # 2. Generate 2D Mesh
    mesh = generate_bushing_mesh(params_data)
    
    # 3. Solve (Analytical)
    time_series = solve_analytical(mesh, material_data, timestep_data, setting_data)
    
    # 4. Generate 3D revolved mesh
    nodes_3d, triangles_3d = revolve_mesh_3d(mesh['nodes'], mesh['elements'], n_segments=24)
    
    # 5. Generate 3D displacements for each time step
    print("PROGRESS:Generating 3D displacement fields...", flush=True)
    n_2d = len(mesh['nodes'])
    n_segments = 24
    
    for step_data in time_series:
        disps_3d = []
        stresses_3d = []
        for seg in range(n_segments):
            theta = (seg / n_segments) * 2 * math.pi
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)
            for i, node in enumerate(mesh['nodes']):
                dr = step_data['displacements'][i][0]
                dz = step_data['displacements'][i][1]
                dx = dr * cos_t
                dy = dr * sin_t
                disps_3d.append([round(dx, 6), round(dy, 6), round(dz, 6)])
                stresses_3d.append(step_data['stresses'][i])
        step_data['displacements_3d'] = disps_3d
        step_data['stresses_3d'] = stresses_3d
    
    # 6. Assemble output payload
    print("PROGRESS:Post-processing results...", flush=True)
    output_payload = {
        "metadata": {
            "jobId": args.jobId,
            "element_type": "Quad4",
            "nodes_count": len(mesh['nodes']),
            "elements_count": len(mesh['elements']),
            "nodes_3d_count": len(nodes_3d),
            "triangles_3d_count": len(triangles_3d)
        },
        "mesh": {
            "nodes": mesh['nodes'],
            "elements": mesh['elements'],
            "nodes_3d": nodes_3d,
            "elements_3d_triangles": triangles_3d
        },
        "geometry_params": mesh['params'],
        "time_series": time_series
    }
    
    # 7. Save as JSON (not gzipped for simplicity in dev)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output_payload, f)
    
    print("PROGRESS:Completed", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
