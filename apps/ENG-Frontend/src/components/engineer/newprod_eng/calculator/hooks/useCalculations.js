/**
 * useCalculations - Real-time surface area, volume, and weight computation.
 * Recomputes whenever parameters or material change.
 */
import { useMemo } from 'react';
import { calculateSurfaceArea, calculateVolume, calculateWeight } from '../utils/calculations';
import { MATERIALS } from '../constants';

/**
 * Hook that computes all derived values from bushing parameters
 * @param {Object} params - Bushing parameters
 * @param {string} materialKey - Selected material key
 * @returns {Object} { surfaceArea, volume, weight, material }
 */
export function useCalculations(params, materialKey) {
  const surfaceArea = useMemo(() => {
    try {
      return calculateSurfaceArea(params);
    } catch (e) {
      console.warn('Surface area calculation error:', e);
      return { total: 0, outerSpherical: 0, outerCylindrical: 0, innerBore: 0, bottomFace: 0, holes: 0, chamfers: 0, totalOuter: 0, totalInner: 0 };
    }
  }, [
    params.width, params.outerSphereDia, params.innerBoreDia,
    params.bodyOuterDia, params.holeCount, params.holeDia, params.chamfer,
  ]);

  const volume = useMemo(() => {
    try {
      return calculateVolume(params);
    } catch (e) {
      console.warn('Volume calculation error:', e);
      return { total: 0, cylinderBody: 0, sphericalCap: 0, holesRemoved: 0 };
    }
  }, [
    params.width, params.outerSphereDia, params.innerBoreDia,
    params.bodyOuterDia, params.holeCount, params.holeDia,
  ]);

  const material = useMemo(() => {
    return MATERIALS.find(m => m.key === materialKey) || MATERIALS[0];
  }, [materialKey]);

  const weight = useMemo(() => {
    return calculateWeight(volume.total, material.density);
  }, [volume.total, material.density]);

  return {
    surfaceArea,
    volume,
    weight,
    material,
  };
}

export default useCalculations;
