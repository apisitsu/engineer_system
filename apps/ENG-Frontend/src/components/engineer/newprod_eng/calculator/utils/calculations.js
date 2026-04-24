import { MODEL_TYPES } from '../constants';
import { generateFlangeMetalProfile, generateSleeveMetalProfile, computePolygonMetrics } from './geometry';

export function calculateSurfaceArea(params) {
  if (params.modelType === MODEL_TYPES.FLANGE || params.modelType === MODEL_TYPES.SLEEVE) {
    const metalProfile = params.modelType === MODEL_TYPES.FLANGE 
      ? generateFlangeMetalProfile(params) 
      : generateSleeveMetalProfile(params);
    const metrics = computePolygonMetrics(metalProfile);
    
    return {
      total: roundTo(metrics.area, 3),
      outerSpherical: 0,
      innerBore: 0,
      flatFaces: 0,
      chamfers: 0
    };
  }

  // --- BALL CALCULATIONS ---
  const { width, outerSphereDia, innerBoreDia, chamferDia, chamferAngle } = params;
  
  const R = outerSphereDia / 2;
  const halfW = width / 2;
  const r_bore = innerBoreDia / 2;
  const r_chamfer = chamferDia / 2;
  
  const angleRad = (chamferAngle * Math.PI) / 180;
  const chamferDepth = Math.max(0, (r_chamfer - r_bore) / Math.tan(angleRad));
  const safeChamferDepth = Math.min(chamferDepth, halfW);
  
  const outerSphericalArea = 2 * Math.PI * R * width;
  const boreHeight = Math.max(0, width - (2 * safeChamferDepth));
  const innerBoreArea = 2 * Math.PI * r_bore * boreHeight;
  const r_cut_sq = Math.max(0, R * R - halfW * halfW); 
  const flatFaceArea = Math.PI * Math.max(0, (r_cut_sq - Math.pow(r_chamfer, 2)));
  const totalFlatFacesArea = 2 * flatFaceArea;
  
  const slantHeight = Math.sqrt(Math.pow(r_chamfer - r_bore, 2) + Math.pow(safeChamferDepth, 2));
  const singleChamferArea = Math.PI * (r_chamfer + r_bore) * slantHeight;
  const totalChamferArea = 2 * singleChamferArea;
  
  return {
    outerSpherical: roundTo(outerSphericalArea, 3),
    innerBore: roundTo(innerBoreArea, 3),
    flatFaces: roundTo(totalFlatFacesArea, 3),
    chamfers: roundTo(totalChamferArea, 3),
    total: roundTo(outerSphericalArea + innerBoreArea + totalFlatFacesArea + totalChamferArea, 3),
  };
}

export function calculateVolume(params) {
  if (params.modelType === MODEL_TYPES.FLANGE || params.modelType === MODEL_TYPES.SLEEVE) {
    const metalProfile = params.modelType === MODEL_TYPES.FLANGE 
      ? generateFlangeMetalProfile(params) 
      : generateSleeveMetalProfile(params);
    const metrics = computePolygonMetrics(metalProfile);
    
    return {
      truncatedSphere: 0, 
      holeRemoved: 0,
      total: roundTo(metrics.volume, 3),
    };
  }

  // --- BALL CALCULATIONS ---
  const { width, outerSphereDia, innerBoreDia, chamferDia, chamferAngle } = params;
  const R = outerSphereDia / 2;
  const halfW = width / 2;
  const r_bore = innerBoreDia / 2;
  const r_chamfer = chamferDia / 2;
  
  const h_cap = Math.max(0, R - halfW);
  const capVolume = (Math.PI * Math.pow(h_cap, 2) * (3 * R - h_cap)) / 3;
  const sphereVolume = (4 / 3) * Math.PI * Math.pow(R, 3);
  const truncatedSphereVolume = sphereVolume - (2 * capVolume);
  
  const angleRad = (chamferAngle * Math.PI) / 180;
  const chamferDepth = Math.max(0, (r_chamfer - r_bore) / Math.tan(angleRad));
  const safeChamferDepth = Math.min(chamferDepth, halfW);
  const boreHeight = Math.max(0, width - (2 * safeChamferDepth));
  
  const cylinderVolume = Math.PI * Math.pow(r_bore, 2) * boreHeight;
  const singleChamferVolume = (Math.PI * safeChamferDepth / 3) * 
    (Math.pow(r_chamfer, 2) + r_chamfer * r_bore + Math.pow(r_bore, 2));
    
  const holeTotalVolume = cylinderVolume + (2 * singleChamferVolume);
  const totalVolume = Math.max(0, truncatedSphereVolume - holeTotalVolume);
  
  return {
    truncatedSphere: roundTo(truncatedSphereVolume, 3),
    holeRemoved: roundTo(holeTotalVolume, 3),
    total: roundTo(totalVolume, 3),
  };
}

export function calculateWeight(volumeMM3, densityGCM3) {
  const volumeCM3 = volumeMM3 / 1000;
  const weightGrams = volumeCM3 * densityGCM3;
  return {
    grams: roundTo(weightGrams, 2),
    kilograms: roundTo(weightGrams / 1000, 4),
    volumeCM3: roundTo(volumeCM3, 3),
  };
}

export function validateParams(params) {
  const errors = [];
  
  if (params.modelType === MODEL_TYPES.FLANGE) {
    if (params.flangeDia <= params.bodyDia) errors.push('Flange Diameter must be larger than Body Diameter.');
    if (params.bodyDia <= params.innerBoreDia) errors.push('Body Diameter must be larger than Inner Bore.');
    return { valid: errors.length === 0, errors };
  }

  // --- BALL CALCULATIONS ---
  const { outerSphereDia, innerBoreDia, width, chamferDia } = params;
  const R = outerSphereDia / 2;
  const halfW = width / 2;

  if (innerBoreDia >= chamferDia) {
    errors.push('Inner Bore limits exceeded (must be smaller than chamfer dia).');
  }
  if (chamferDia >= outerSphereDia) {
    errors.push('Chamfer diameter exceeds outer spherical dimension.');
  }
  if (width >= outerSphereDia) {
    errors.push(`Width (${width}mm) cannot exceed Outer Sphere Diameter (${outerSphereDia}mm).`);
  }
  const r_cut = Math.sqrt(Math.max(0, R * R - halfW * halfW));
  if (chamferDia / 2 > r_cut) {
    errors.push('Chamfer extends beyond the physical flat face area radius.');
  }

  return { valid: errors.length === 0, errors };
}

function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
