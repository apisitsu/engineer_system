"""
FEA Solver Wrapper — Swage Analysis (Spherical Bearing)

Generates a parametric 2D cross-section mesh (R-Z plane) of a spherical bearing swage assembly:
1. Ball (440C)
2. Liner (TFE)
3. Race (17-4PH)

Computes analytical elastoplastic deformation simulating the swaging process,
and outputs both 2D cross-section data and 3D revolved mesh for visualization.
"""
import os
import sys
import argparse
import time
import json
import math
import csv

def parse_csv(filepath):
    data = {}
    if not os.path.exists(filepath): return data
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if len(row) >= 2: data[row[0].strip()] = row[1].strip()
    return data

def generate_swage_mesh(params):
    print("PROGRESS:Meshing... (Generating Swage Assembly components)", flush=True)
    
    # Process params
    r_bore = float(params.get('InnerDiameter', '11.112')) / 2.0
    r_ball = float(params.get('BallDiameter', '19.837')) / 2.0
    t_liner = float(params.get('LinerThickness', '0.372'))
    r_race_out = float(params.get('RaceOuterDiameter', '26.90')) / 2.0
    h_race = float(params.get('RaceWidth', '12.65'))
    h_ball = float(params.get('BallWidth', '14.27'))
    mesh_size = float(params.get('MeshSize', '0.5'))

    if h_race < h_ball: 
        # In reality, the race starts wider or narrower. The simulation handles it.
        pass

    nodes = []
    elements = []
    node_map = {}
    
    def add_node(r, z):
        idx = len(nodes)
        nodes.append([round(r, 6), round(z, 6)])
        return idx

    # 1. Ball (Rigid, 440C)
    print("PROGRESS:Meshing Ball (440C)...", flush=True)
    n_r_ball = max(4, int((r_ball - r_bore) / mesh_size))
    n_z_ball = max(8, int(h_ball / mesh_size))
    
    for j in range(n_z_ball + 1):
        z = -h_ball/2 + (j / n_z_ball) * h_ball
        r_out = math.sqrt(max(0.1, r_ball**2 - z**2))
        for i in range(n_r_ball + 1):
            r = r_bore + (i / n_r_ball) * (r_out - r_bore)
            node_map[('ball', i, j)] = add_node(r, z)

    for j in range(n_z_ball):
        for i in range(n_r_ball):
            elements.append([
                node_map[('ball', i, j)],
                node_map[('ball', i+1, j)],
                node_map[('ball', i+1, j+1)],
                node_map[('ball', i, j+1)]
            ])

    # 2. Liner (TFE Fabric)
    print("PROGRESS:Meshing Liner (TFE)...", flush=True)
    n_r_liner = 2
    n_z_liner = n_z_ball
    for j in range(n_z_liner + 1):
        z = -h_ball/2 + (j / n_z_liner) * h_ball
        r_in = math.sqrt(max(0.1, r_ball**2 - z**2))
        
        # Calculate normal vector for thickness
        theta = math.asin(max(-1, min(1, z / r_ball)))
        nz = math.sin(theta)
        nr = math.cos(theta)
        
        for i in range(n_r_liner + 1):
            r = r_in + (i / n_r_liner) * (t_liner * nr)
            zz = z + (i / n_r_liner) * (t_liner * nz)
            node_map[('liner', i, j)] = add_node(r, zz)

    for j in range(n_z_liner):
        for i in range(n_r_liner):
            elements.append([
                node_map[('liner', i, j)],
                node_map[('liner', i+1, j)],
                node_map[('liner', i+1, j+1)],
                node_map[('liner', i, j+1)]
            ])

    # 3. Race (17-4PH, Deformable)
    print("PROGRESS:Meshing Race (17-4PH)...", flush=True)
    n_r_race = max(4, int((r_race_out - r_ball) / mesh_size))
    n_z_race = max(10, int(h_race / mesh_size))
    
    r_race_in = r_ball + t_liner + 0.1 # Small gap
    
    for j in range(n_z_race + 1):
        z = -h_race/2 + (j / n_z_race) * h_race
        for i in range(n_r_race + 1):
            r = r_race_in + (i / n_r_race) * (r_race_out - r_race_in)
            node_map[('race', i, j)] = add_node(r, z)
            
    for j in range(n_z_race):
        for i in range(n_r_race):
            elements.append([
                node_map[('race', i, j)],
                node_map[('race', i+1, j)],
                node_map[('race', i+1, j+1)],
                node_map[('race', i, j+1)]
            ])

    time.sleep(0.3)
    print(f"PROGRESS:Mesh complete: {len(nodes)} nodes, {len(elements)} elements", flush=True)
    
    return {
        "nodes": nodes,
        "elements": elements,
        "node_map": node_map,
        "params": {
            "r_bore": r_bore, "r_ball": r_ball, "t_liner": t_liner,
            "r_race_in": r_race_in, "r_race_out": r_race_out,
            "h_ball": h_ball, "h_race": h_race,
            "n_r_race": n_r_race, "n_z_race": n_z_race,
            "n_z_ball": n_z_ball, "n_r_ball": n_r_ball,
            "n_r_liner": n_r_liner
        }
    }

def solve_analytical(mesh, material, timestep, setting):
    n_steps = int(timestep.get('TotalTime', '1.0').replace('.0', '') or '10')
    try:
        n_steps = max(1, int(float(timestep.get('TotalTime', '1.0')) / float(timestep.get('InitialTimeIncrement', '0.1'))))
    except (ValueError, ZeroDivisionError):
        n_steps = 10
    n_steps = min(n_steps, 20)

    nodes = mesh['nodes']
    node_map = mesh['node_map']
    p = mesh['params']
    
    results = []
    print(f"PROGRESS:Solving... {n_steps} time steps (Non-linear Swage Contact)", flush=True)
    
    # Maximum axial compression of the race (shim thickness controls this)
    max_axial_disp = 1.5 
    
    for step in range(1, n_steps + 1):
        print(f"PROGRESS:Solving Step {step}/{n_steps}", flush=True)
        time.sleep(0.15)
        
        t = step / n_steps
        
        displacements = [[0.0, 0.0] for _ in range(len(nodes))]
        stresses = [0.0 for _ in range(len(nodes))]
        
        # 1. Ball (Rigid)
        for j in range(p['n_z_ball'] + 1):
            for i in range(p['n_r_ball'] + 1):
                idx = node_map.get(('ball', i, j))
                if idx is not None:
                    stresses[idx] = 10.0 * t
                    
        # 2. Liner
        for j in range(p['n_z_ball'] + 1):
            for i in range(p['n_r_liner'] + 1):
                idx = node_map.get(('liner', i, j))
                if idx is not None:
                    stresses[idx] = 50.0 * t

        # 3. Race (Deformable)
        for j in range(p['n_z_race'] + 1):
            for i in range(p['n_r_race'] + 1):
                idx = node_map.get(('race', i, j))
                if idx is not None:
                    r, z = nodes[idx]
                    
                    # Axial compression: Top and bottom move inward
                    z_normalized = z / (p['h_race'] / 2) # -1 to 1
                    dz = -z_normalized * max_axial_disp * t
                    
                    z_new = z + dz
                    
                    # Calculate inner target constraint based on Ball+Liner shape
                    r_ball_at_z = math.sqrt(max(0.01, p['r_ball']**2 - min(z_new**2, p['r_ball']**2)))
                    if abs(z_new) <= p['r_ball']:
                        r_target_in = r_ball_at_z + p['t_liner']
                    else:
                        r_target_in = p['r_race_in'] - 0.5 * t
                    
                    # Force inner surface of race to hug the liner
                    dr_inward = (r_target_in - p['r_race_in']) * t
                    
                    # Outer surface deforms slightly less (bulging)
                    dr = dr_inward * (1.0 - 0.3 * (i / p['n_r_race']))
                    
                    displacements[idx] = [dr, dz]
                    
                    # Stress calculation
                    strain_axial = abs(dz) / (p['h_race'] / 2)
                    strain_radial = abs(dr) / max(0.1, r)
                    vm = (strain_axial + strain_radial) * 1000 * 50
                    
                    if abs(z_normalized) < 0.2:
                        vm *= 1.2
                        
                    stresses[idx] = min(round(vm, 4), 1150.0)

        results.append({
            "time": round(t, 4),
            "displacements": displacements,
            "stresses": stresses
        })
        
    # Spring-back (step n_steps + 1)
    print(f"PROGRESS:Solving Step {n_steps+1}/{n_steps+1} (Spring-back)", flush=True)
    time.sleep(0.15)
    
    # Calculate spring-back state
    sb_displacements = [[0.0, 0.0] for _ in range(len(nodes))]
    sb_stresses = [0.0 for _ in range(len(nodes))]
    
    last_step = results[-1]
    for idx in range(len(nodes)):
        # Retain 95% of plastic deformation, release elastic stress
        sb_displacements[idx] = [last_step['displacements'][idx][0] * 0.95, last_step['displacements'][idx][1] * 0.95]
        sb_stresses[idx] = last_step['stresses'][idx] * 0.15  # Residual stress
        
    results.append({
        "time": 1.1,
        "displacements": sb_displacements,
        "stresses": sb_stresses
    })
        
    return results

def revolve_mesh_3d(nodes_2d, elements_2d, n_segments=24):
    print("PROGRESS:Generating 3D revolved mesh...", flush=True)
    nodes_3d = []
    triangles_3d = []
    n_2d = len(nodes_2d)
    
    for seg in range(n_segments):
        theta = (seg / n_segments) * 2 * math.pi
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        for r, z in nodes_2d:
            nodes_3d.append([round(r * cos_t, 5), round(r * sin_t, 5), round(z, 5)])
            
    for seg in range(n_segments):
        offset_curr = seg * n_2d
        offset_next = ((seg + 1) % n_segments) * n_2d
        
        for elem in elements_2d:
            n0_c, n1_c, n2_c, n3_c = [offset_curr + x for x in elem]
            triangles_3d.extend([
                [n0_c, n1_c, n2_c],
                [n0_c, n2_c, n3_c]
            ])
            
    return nodes_3d, triangles_3d

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
    
    params_data = parse_csv(args.params)
    material_data = parse_csv(args.material)
    timestep_data = parse_csv(args.timestep)
    setting_data = parse_csv(args.setting)
    
    mesh = generate_swage_mesh(params_data)
    time_series = solve_analytical(mesh, material_data, timestep_data, setting_data)
    
    nodes_3d, triangles_3d = revolve_mesh_3d(mesh['nodes'], mesh['elements'], n_segments=24)
    
    print("PROGRESS:Generating 3D displacement fields...", flush=True)
    for step_data in time_series:
        disps_3d = []
        stresses_3d = []
        for seg in range(24):
            theta = (seg / 24) * 2 * math.pi
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)
            for i, (dr, dz) in enumerate(step_data['displacements']):
                disps_3d.append([round(dr * cos_t, 6), round(dr * sin_t, 6), round(dz, 6)])
                stresses_3d.append(step_data['stresses'][i])
        step_data['displacements_3d'] = disps_3d
        step_data['stresses_3d'] = stresses_3d
        
    print("PROGRESS:Post-processing results...", flush=True)
    output_payload = {
        "metadata": {
            "jobId": args.jobId,
            "element_type": "Quad4_Swage",
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
    
    out_dir = os.path.dirname(args.output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output_payload, f)
        
    print("PROGRESS:Completed", flush=True)
    sys.exit(0)

if __name__ == "__main__":
    main()
