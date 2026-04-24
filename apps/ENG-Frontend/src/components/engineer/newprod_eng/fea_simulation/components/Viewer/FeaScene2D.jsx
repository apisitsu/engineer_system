import React, { useRef, useEffect, useCallback, useState } from 'react';

/**
 * FeaScene2D — Canvas-based 2D cross-section viewer for axisymmetric FEA results.
 * Renders quad elements with Von Mises stress heatmap in the R-Z plane.
 */

function getHeatmapColor(value) {
  // Blue → Cyan → Green → Yellow → Red
  const v = Math.max(0, Math.min(1, value));
  let r, g, b;
  if (v < 0.25) {
    r = 0; g = Math.round(255 * (v / 0.25)); b = 255;
  } else if (v < 0.5) {
    r = 0; g = 255; b = Math.round(255 * (1 - (v - 0.25) / 0.25));
  } else if (v < 0.75) {
    r = Math.round(255 * ((v - 0.5) / 0.25)); g = 255; b = 0;
  } else {
    r = 255; g = Math.round(255 * (1 - (v - 0.75) / 0.25)); b = 0;
  }
  return `rgb(${r},${g},${b})`;
}

export default function FeaScene2D({ meshData, timeStepData, maxStress }) {
  const canvasRef = useRef(null);
  const [transform, setTransform] = useState({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });

  // Calculate bounding box of the mesh
  const getBounds = useCallback(() => {
    if (!meshData || !meshData.nodes || meshData.nodes.length === 0) {
      return { minR: 0, maxR: 1, minZ: 0, maxZ: 1 };
    }
    let minR = Infinity, maxR = -Infinity, minZ = Infinity, maxZ = -Infinity;
    meshData.nodes.forEach(([r, z]) => {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });
    return { minR, maxR, minZ, maxZ };
  }, [meshData]);

  // Render the mesh
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !meshData) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const bounds = getBounds();
    const dr = bounds.maxR - bounds.minR;
    const dz = bounds.maxZ - bounds.minZ;
    if (dr === 0 || dz === 0) return;

    const padding = 60;
    const plotW = w - padding * 2;
    const plotH = h - padding * 2;

    // Scale to fit while maintaining aspect ratio
    const scaleR = plotW / (dr * 1.2);
    const scaleZ = plotH / (dz * 1.2);
    const baseScale = Math.min(scaleR, scaleZ);
    const scale = baseScale * transform.scale;

    // Center offset
    const centerR = (bounds.minR + bounds.maxR) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;

    const toCanvas = (r, z) => {
      const x = padding + plotW / 2 + (r - centerR) * scale + transform.offsetX;
      const y = padding + plotH / 2 - (z - centerZ) * scale + transform.offsetY; // Flip Z up
      return [x, y];
    };

    // Get displacements and stresses
    const disps = timeStepData?.displacements || null;
    const stresses = timeStepData?.stresses || null;
    const dispScale = 50.0; // Exaggeration factor for visualization

    // Helper: get deformed position
    const getNodePos = (idx) => {
      const [r, z] = meshData.nodes[idx];
      if (disps && disps[idx]) {
        return [r + disps[idx][0] * dispScale, z + disps[idx][1] * dispScale];
      }
      return [r, z];
    };

    // Draw filled elements with heatmap colors
    if (meshData.elements) {
      meshData.elements.forEach(elem => {
        if (elem.length < 3) return;

        // Calculate average stress for the element
        let avgStress = 0;
        if (stresses) {
          elem.forEach(nIdx => { avgStress += (stresses[nIdx] || 0); });
          avgStress /= elem.length;
        }
        const normalizedStress = maxStress > 0 ? avgStress / maxStress : 0;

        // Draw filled quad
        ctx.beginPath();
        const [x0, y0] = toCanvas(...getNodePos(elem[0]));
        ctx.moveTo(x0, y0);
        for (let i = 1; i < elem.length; i++) {
          const [x, y] = toCanvas(...getNodePos(elem[i]));
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = stresses ? getHeatmapColor(normalizedStress) : '#c9a840';
        ctx.fill();

        // Draw wireframe
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let i = 1; i < elem.length; i++) {
          const [x, y] = toCanvas(...getNodePos(elem[i]));
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    }

    // Draw undeformed outline (dashed red) if there are displacements
    if (disps) {
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Draw boundary edges of undeformed mesh
      // Collect outer boundary nodes (simple: leftmost, rightmost, top, bottom edges)
      const boundaryEdges = extractBoundaryEdges(meshData.elements, meshData.nodes.length);
      boundaryEdges.forEach(([n0, n1]) => {
        const [x0, y0] = toCanvas(meshData.nodes[n0][0], meshData.nodes[n0][1]);
        const [x1, y1] = toCanvas(meshData.nodes[n1][0], meshData.nodes[n1][1]);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // Draw axes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    // R axis (horizontal)
    ctx.beginPath();
    ctx.moveTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();
    // Z axis (vertical)
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#888';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('R (mm)', w / 2, h - 15);
    ctx.save();
    ctx.translate(15, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Z (mm)', 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cross-Section View (R-Z Plane)', padding, 25);

    // Time step info
    if (timeStepData) {
      ctx.fillStyle = '#888';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Time: ${timeStepData.time?.toFixed(3) || '0.000'}`, w - padding, 25);
    }

  }, [meshData, timeStepData, maxStress, transform, getBounds]);

  // Extract boundary edges from quad mesh
  function extractBoundaryEdges(elements, nNodes) {
    const edgeCount = {};
    const makeKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

    elements.forEach(elem => {
      const n = elem.length;
      for (let i = 0; i < n; i++) {
        const key = makeKey(elem[i], elem[(i + 1) % n]);
        edgeCount[key] = (edgeCount[key] || 0) + 1;
      }
    });

    // Boundary edges appear only once
    const boundary = [];
    Object.entries(edgeCount).forEach(([key, count]) => {
      if (count === 1) {
        const [a, b] = key.split('-').map(Number);
        boundary.push([a, b]);
      }
    });
    return boundary;
  }

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        draw();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  // Redraw on data change
  useEffect(() => { draw(); }, [draw]);

  // Mouse interactions for pan and zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(20, prev.scale * factor))
    }));
  }, []);

  const handleMouseDown = useCallback((e) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setTransform(prev => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0d1117', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
