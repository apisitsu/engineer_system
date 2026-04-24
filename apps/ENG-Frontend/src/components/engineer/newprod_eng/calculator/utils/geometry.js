import * as THREE from 'three';

// --- SPHERICAL BEARING ---
export function generateOuterSphereProfile(params, segments = 64) {
  const { width, outerSphereDia } = params;
  const R = outerSphereDia / 2;
  const halfW = Math.abs(width / 2);
  const safeHalfW = Math.min(halfW, R);
  const points = [];
  const startAngle = Math.asin(-safeHalfW / R);
  const endAngle = Math.asin(safeHalfW / R);
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (i / segments) * (endAngle - startAngle);
    points.push(new THREE.Vector2(R * Math.cos(angle), R * Math.sin(angle)));
  }
  return points;
}

export function generateBoreProfile(params) {
  const { width, innerBoreDia, chamferDia, chamferAngle } = params;
  const r_bore = innerBoreDia / 2;
  const r_chamfer = Math.max(r_bore, chamferDia / 2);
  const halfW = width / 2;
  const angleRad = (chamferAngle * Math.PI) / 180;
  const chamferDepth = Math.max(0, (r_chamfer - r_bore) / Math.tan(angleRad));
  const safeChamferDepth = Math.min(chamferDepth, halfW);
  const points = [];
  points.push(new THREE.Vector2(r_chamfer, -halfW));
  points.push(new THREE.Vector2(r_bore, -halfW + safeChamferDepth));
  points.push(new THREE.Vector2(r_bore, halfW - safeChamferDepth));
  points.push(new THREE.Vector2(r_chamfer, halfW));
  return points;
}

// --- FLANGE SLEEVE ---
export function generateFlangeMetalProfile(params) {
  const {
    flangeDia, flangeThickness, bodyDia, bodyLength, innerBoreDia,
    undercutLength, undercutDepth, linerSetbackFlange, linerSetbackEnd, linerGrooveDepth,
    endOuterChamferL, endOuterChamferD, flangeInnerChamfer
  } = params;

  const L = bodyLength;
  const T = flangeThickness;
  const totalL = L + T;
  
  // Center it over Y axis. Flange front face is at Y = totalL/2
  const topY = totalL / 2; // Flange face
  const botY = -totalL / 2; // Sleeve End face

  const rFlange = flangeDia / 2;
  const rBody = bodyDia / 2;
  const rBore = innerBoreDia / 2;
  
  // Create CCW Array of Vector2 Points representing the metal profile
  const pts = [];

  // 1. Bottom Inner bore (Sleeve end)
  pts.push(new THREE.Vector2(rBore, botY));
  
  // 2. Sleeve End Face
  pts.push(new THREE.Vector2(rBody - endOuterChamferD, botY));
  
  // 3. Sleeve End Outer Chamfer
  pts.push(new THREE.Vector2(rBody, botY + endOuterChamferL));
  
  // 4. Sleeve OD up to undercut
  pts.push(new THREE.Vector2(rBody, topY - T - undercutLength));
  
  // 5. Undercut radial
  pts.push(new THREE.Vector2(rBody - undercutDepth, topY - T - undercutLength));
  
  // 6. Undercut longitudinal
  pts.push(new THREE.Vector2(rBody - undercutDepth, topY - T));
  
  // 7. Back of Flange
  pts.push(new THREE.Vector2(rFlange, topY - T));
  
  // 8. Flange OD
  pts.push(new THREE.Vector2(rFlange, topY));
  
  // 9. Flange inner face flat (to chamfer)
  pts.push(new THREE.Vector2(rBore + flangeInnerChamfer, topY));
  
  // 10. Flange inner chamfer
  pts.push(new THREE.Vector2(rBore, topY - flangeInnerChamfer));

  // 11. Flange inner metal lip
  let p11 = new THREE.Vector2(rBore, topY - linerSetbackFlange);
  p11.hideSurface = true;
  pts.push(p11);

  // 12. Liner Groove start (radial outward)
  let p12 = new THREE.Vector2(rBore + linerGrooveDepth, topY - linerSetbackFlange);
  p12.hideSurface = true;
  pts.push(p12);

  // 13. Liner Groove bottom (longitudinal downward)
  let p13 = new THREE.Vector2(rBore + linerGrooveDepth, botY + linerSetbackEnd);
  p13.hideSurface = true;
  pts.push(p13);

  // 14. Sleeve end metal lip step (radial inward)
  pts.push(new THREE.Vector2(rBore, botY + linerSetbackEnd));

  // Closed back to 1.
  pts.push(new THREE.Vector2(rBore, botY));

  return pts;
}

export function generateFlangeLinerProfile(params) {
  const { flangeThickness, bodyLength, innerBoreDia, linerSetbackFlange, linerSetbackEnd, linerGrooveDepth } = params;
  const totalL = bodyLength + flangeThickness;
  const topY = totalL / 2;
  const botY = -totalL / 2;
  const rBore = innerBoreDia / 2;

  const pts = [];
  // Build CCW loop for the liner 
  pts.push(new THREE.Vector2(rBore, botY + linerSetbackEnd));
  pts.push(new THREE.Vector2(rBore + linerGrooveDepth, botY + linerSetbackEnd));
  pts.push(new THREE.Vector2(rBore + linerGrooveDepth, topY - linerSetbackFlange));
  pts.push(new THREE.Vector2(rBore, topY - linerSetbackFlange));
  pts.push(new THREE.Vector2(rBore, botY + linerSetbackEnd));
  return pts;
}

// --- STRAIGHT SLEEVE ---
export function generateSleeveMetalProfile(params) {
  const { bodyDia, bodyLength, innerBoreDia, linerSetback, linerGrooveDepth, endOuterChamferL, endOuterChamferD } = params;
  
  const L = bodyLength;
  const topY = L / 2;
  const botY = -L / 2;
  const rBody = bodyDia / 2;
  const rBore = innerBoreDia / 2;

  const pts = [];
  
  // 1. Bottom Inner bore (Sleeve end)
  pts.push(new THREE.Vector2(rBore, botY));
  
  // 2. Bottom Sleeve End Face (to chamfer)
  pts.push(new THREE.Vector2(rBody - endOuterChamferD, botY));
  
  // 3. Bottom Outer Chamfer
  pts.push(new THREE.Vector2(rBody, botY + endOuterChamferL));
  
  // 4. Sleeve OD
  pts.push(new THREE.Vector2(rBody, topY - endOuterChamferL));
  
  // 5. Top Outer Chamfer
  pts.push(new THREE.Vector2(rBody - endOuterChamferD, topY));
  
  // 6. Top Sleeve End Face
  pts.push(new THREE.Vector2(rBore, topY));
  
  // 7. Top inner metal lip
  let p7 = new THREE.Vector2(rBore, topY - linerSetback);
  p7.hideSurface = true;
  pts.push(p7);
  
  // 8. Groove start
  let p8 = new THREE.Vector2(rBore + linerGrooveDepth, topY - linerSetback);
  p8.hideSurface = true;
  pts.push(p8);
  
  // 9. Groove bottom
  let p9 = new THREE.Vector2(rBore + linerGrooveDepth, botY + linerSetback);
  p9.hideSurface = true;
  pts.push(p9);
  
  // 10. Bottom inner metal lip
  pts.push(new THREE.Vector2(rBore, botY + linerSetback));
  
  // Closed back to 1.
  pts.push(new THREE.Vector2(rBore, botY));

  return pts;
}

export function generateSleeveLinerProfile(params) {
  const { bodyLength, innerBoreDia, linerSetback, linerGrooveDepth } = params;
  const topY = bodyLength / 2;
  const botY = -bodyLength / 2;
  const rBore = innerBoreDia / 2;

  const pts = [];
  pts.push(new THREE.Vector2(rBore, botY + linerSetback));
  pts.push(new THREE.Vector2(rBore + linerGrooveDepth, botY + linerSetback));
  pts.push(new THREE.Vector2(rBore + linerGrooveDepth, topY - linerSetback));
  pts.push(new THREE.Vector2(rBore, topY - linerSetback));
  pts.push(new THREE.Vector2(rBore, botY + linerSetback));
  return pts;
}

/**
 * Computes exact Surface Area and Volume assuming the profile forms a closed CCW loop.
 * Pappus's centroid theorem for 2D cross sections.
 */
export function computePolygonMetrics(points) {
  let volume = 0;
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    
    // Surface Area: 2 * PI * R_centroid * length
    if (!p1.hideSurface) {
      const MathArea = 2 * Math.PI * ((p1.x + p2.x) / 2) * d;
      area += MathArea;
    }

    // Volume integration
    const vol = (Math.PI * dy / 3) * (p1.x * p1.x + p1.x * p2.x + p2.x * p2.x);
    volume -= vol;
  }
  
  return {
    volume: Math.abs(volume),
    area: Math.abs(area) // Total exposed surface area.
  };
}
