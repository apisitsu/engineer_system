/**
 * Export utilities for the bushing configurator.
 * Supports STL export from Three.js mesh geometry.
 */

import * as THREE from 'three';

/**
 * Export a Three.js mesh to binary STL format and trigger download
 * @param {THREE.Mesh|THREE.Group} object3D - The 3D object to export
 * @param {string} filename - Download filename
 */
export function exportToSTL(object3D, filename = 'bushing.stl') {
  const geometry = getMergedGeometry(object3D);
  if (!geometry) {
    console.error('No geometry found to export');
    return;
  }

  const stlBinary = generateBinarySTL(geometry);
  downloadBlob(stlBinary, filename, 'application/octet-stream');
}

/**
 * Merge all geometries in a group into a single BufferGeometry
 * @param {THREE.Object3D} object3D
 * @returns {THREE.BufferGeometry|null}
 */
function getMergedGeometry(object3D) {
  const geometries = [];

  object3D.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const cloned = child.geometry.clone();
      cloned.applyMatrix4(child.matrixWorld);
      geometries.push(cloned);
    }
  });

  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];

  // Merge all geometries
  return mergeBufferGeometries(geometries);
}

/**
 * Simple buffer geometry merge
 * @param {THREE.BufferGeometry[]} geometries
 * @returns {THREE.BufferGeometry}
 */
function mergeBufferGeometries(geometries) {
  const positions = [];
  const normals = [];

  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const index = geo.getIndex();

    if (index) {
      // Indexed geometry - expand
      for (let i = 0; i < index.count; i++) {
        const idx = index.getX(i);
        positions.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
        if (norm) {
          normals.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
        } else {
          normals.push(0, 0, 1);
        }
      }
    } else {
      // Non-indexed
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (norm) {
          normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        } else {
          normals.push(0, 0, 1);
        }
      }
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}

/**
 * Generate binary STL data from a BufferGeometry
 * @param {THREE.BufferGeometry} geometry
 * @returns {Blob}
 */
function generateBinarySTL(geometry) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const index = geometry.getIndex();

  let triangleCount;
  if (index) {
    triangleCount = index.count / 3;
  } else {
    triangleCount = positions.count / 3;
  }

  // Binary STL format:
  // 80 bytes header + 4 bytes triangle count + (50 bytes per triangle)
  const bufferLength = 84 + triangleCount * 50;
  const buffer = new ArrayBuffer(bufferLength);
  const view = new DataView(buffer);

  // Header (80 bytes) - can be anything
  const header = 'Bushing Configurator STL Export';
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }

  // Triangle count
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  const tempNormal = new THREE.Vector3();
  const tempV1 = new THREE.Vector3();
  const tempV2 = new THREE.Vector3();
  const tempV3 = new THREE.Vector3();

  for (let i = 0; i < triangleCount; i++) {
    let i1, i2, i3;
    if (index) {
      i1 = index.getX(i * 3);
      i2 = index.getX(i * 3 + 1);
      i3 = index.getX(i * 3 + 2);
    } else {
      i1 = i * 3;
      i2 = i * 3 + 1;
      i3 = i * 3 + 2;
    }

    // Vertices
    tempV1.fromBufferAttribute(positions, i1);
    tempV2.fromBufferAttribute(positions, i2);
    tempV3.fromBufferAttribute(positions, i3);

    // Calculate face normal
    const edge1 = new THREE.Vector3().subVectors(tempV2, tempV1);
    const edge2 = new THREE.Vector3().subVectors(tempV3, tempV1);
    tempNormal.crossVectors(edge1, edge2).normalize();

    // Write normal
    view.setFloat32(offset, tempNormal.x, true); offset += 4;
    view.setFloat32(offset, tempNormal.y, true); offset += 4;
    view.setFloat32(offset, tempNormal.z, true); offset += 4;

    // Write vertices
    view.setFloat32(offset, tempV1.x, true); offset += 4;
    view.setFloat32(offset, tempV1.y, true); offset += 4;
    view.setFloat32(offset, tempV1.z, true); offset += 4;

    view.setFloat32(offset, tempV2.x, true); offset += 4;
    view.setFloat32(offset, tempV2.y, true); offset += 4;
    view.setFloat32(offset, tempV2.z, true); offset += 4;

    view.setFloat32(offset, tempV3.x, true); offset += 4;
    view.setFloat32(offset, tempV3.y, true); offset += 4;
    view.setFloat32(offset, tempV3.z, true); offset += 4;

    // Attribute byte count (unused, set to 0)
    view.setUint16(offset, 0, true); offset += 2;
  }

  return new Blob([buffer], { type: 'application/octet-stream' });
}

/**
 * Trigger a file download from a Blob
 * @param {Blob} blob
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadBlob(blob, filename, mimeType) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Save configuration to localStorage
 * @param {string} name - Configuration name
 * @param {Object} params - Bushing parameters
 * @param {string} material - Selected material key
 */
export function saveConfig(name, params, material) {
  const storageKey = 'bushing-configurator-saved-configs';
  const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');

  const config = {
    id: Date.now().toString(36),
    name,
    params,
    material,
    savedAt: new Date().toISOString(),
  };

  existing.unshift(config);

  // Keep max 50 configs
  if (existing.length > 50) existing.length = 50;

  localStorage.setItem(storageKey, JSON.stringify(existing));
  return config;
}

/**
 * Load saved configurations from localStorage
 * @returns {Array} saved configs
 */
export function loadConfigs() {
  const storageKey = 'bushing-configurator-saved-configs';
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch {
    return [];
  }
}

/**
 * Delete a saved configuration
 * @param {string} id - Config id to delete
 */
export function deleteConfig(id) {
  const storageKey = 'bushing-configurator-saved-configs';
  const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const filtered = existing.filter(c => c.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(filtered));
}
