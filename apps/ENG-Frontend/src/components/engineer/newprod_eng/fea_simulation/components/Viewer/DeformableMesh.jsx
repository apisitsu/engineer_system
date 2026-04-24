import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';


/**
 * Creates a Heatmap color based on a normalized scalar value (0 to 1)
 * Blue → Cyan → Green → Yellow → Red
 */
function getHeatmapColor(value) {
    const v = Math.max(0, Math.min(1, value));
    let r, g, b;
    if (v < 0.25) {
        r = 0; g = v / 0.25; b = 1;
    } else if (v < 0.5) {
        r = 0; g = 1; b = 1 - (v - 0.25) / 0.25;
    } else if (v < 0.75) {
        r = (v - 0.5) / 0.25; g = 1; b = 0;
    } else {
        r = 1; g = 1 - (v - 0.75) / 0.25; b = 0;
    }
    return new THREE.Color(r, g, b);
}

export default function DeformableMesh({ meshData, timeStepData, maxStress }) {
    const meshRef = useRef();
    const wireRef = useRef();

    // Build 3D geometry from triangulated data
    const baseGeometry = useMemo(() => {
        if (!meshData || !meshData.nodes_3d || !meshData.elements_3d_triangles) return null;

        const geometry = new THREE.BufferGeometry();
        const nodes = meshData.nodes_3d;
        
        // Flatten nodes: [[x,y,z], ...] -> Float32Array
        const vertices = new Float32Array(nodes.length * 3);
        nodes.forEach((node, i) => {
            vertices[i * 3] = node[0];
            vertices[i * 3 + 1] = node[2]; // Z becomes Y (up) in Three.js
            vertices[i * 3 + 2] = node[1]; // Y becomes Z
        });

        // Triangle indices
        const indices = [];
        meshData.elements_3d_triangles.forEach(tri => {
            indices.push(tri[0], tri[1], tri[2]);
        });

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Initialize vertex colors
        const colors = new Float32Array(nodes.length * 3);
        colors.fill(0.8); // Default grey
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        return geometry;
    }, [meshData]);

    // Apply deformations and stress colors
    useEffect(() => {
        if (!baseGeometry || !timeStepData || !meshRef.current) return;
        if (!meshData?.nodes_3d) return;

        const geometry = meshRef.current.geometry;
        const positions = geometry.attributes.position;
        const colors = geometry.attributes.color;

        const disps = timeStepData.displacements_3d;
        const stresses = timeStepData.stresses_3d;
        const nodes = meshData.nodes_3d;
        const dispScale = 50.0; // Exaggeration factor

        if (!disps || !stresses) return;

        for (let i = 0; i < nodes.length; i++) {
            const baseNode = nodes[i];
            const disp = disps[i] || [0, 0, 0];
            const stress = stresses[i] || 0;

            // Apply displacement (swap Y/Z for Three.js coordinate system)
            positions.setXYZ(i,
                baseNode[0] + disp[0] * dispScale,
                baseNode[2] + disp[2] * dispScale,  // Z→Y
                baseNode[1] + disp[1] * dispScale   // Y→Z
            );

            // Heatmap color
            const normalizedStress = maxStress > 0 ? stress / maxStress : 0;
            const color = getHeatmapColor(normalizedStress);
            colors.setXYZ(i, color.r, color.g, color.b);
        }

        positions.needsUpdate = true;
        colors.needsUpdate = true;
        geometry.computeVertexNormals();

    }, [baseGeometry, timeStepData, meshData, maxStress]);

    if (!baseGeometry) return null;

    return (
        <group>
            <mesh ref={meshRef} geometry={baseGeometry}>
                <meshStandardMaterial 
                    vertexColors={true} 
                    side={THREE.DoubleSide} 
                    metalness={0.1}
                    roughness={0.6}
                />
            </mesh>
            {/* Wireframe overlay for FEA look */}
            <mesh ref={wireRef} geometry={baseGeometry}>
                <meshBasicMaterial color="#000000" wireframe={true} transparent opacity={0.15} />
            </mesh>
        </group>
    );
}
