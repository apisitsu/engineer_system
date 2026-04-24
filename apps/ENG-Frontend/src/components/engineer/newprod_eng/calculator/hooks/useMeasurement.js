/**
 * useMeasurement - Click-to-measure distance tool for the 3D viewer.
 * Allows users to click two points on the model and see the distance.
 */
import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hook for 3D measurement tool state and logic
 * @returns {Object} measurement state and handlers
 */
export function useMeasurement() {
  const [isActive, setIsActive] = useState(false);
  const [points, setPoints] = useState([]);        // Array of THREE.Vector3
  const [distance, setDistance] = useState(null);   // Measured distance in mm
  const [measurements, setMeasurements] = useState([]); // History of measurements
  const raycasterRef = useRef(new THREE.Raycaster());

  const toggleActive = useCallback(() => {
    setIsActive(prev => {
      if (prev) {
        // Deactivating - clear current measurement
        setPoints([]);
        setDistance(null);
      }
      return !prev;
    });
  }, []);

  const addPoint = useCallback((point) => {
    if (!isActive) return;

    setPoints(prev => {
      const newPoints = [...prev, point.clone()];

      if (newPoints.length === 2) {
        // Calculate distance
        const dist = newPoints[0].distanceTo(newPoints[1]);
        setDistance(dist);

        // Save to history
        setMeasurements(prev => [
          ...prev,
          {
            id: Date.now(),
            p1: newPoints[0].toArray(),
            p2: newPoints[1].toArray(),
            distance: dist,
          },
        ]);
      }

      if (newPoints.length > 2) {
        // Reset for new measurement, keep the latest point as first
        setDistance(null);
        return [point.clone()];
      }

      return newPoints;
    });
  }, [isActive]);

  const clearMeasurements = useCallback(() => {
    setPoints([]);
    setDistance(null);
    setMeasurements([]);
  }, []);

  const deleteMeasurement = useCallback((id) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  }, []);

  const reset = useCallback(() => {
    setPoints([]);
    setDistance(null);
  }, []);

  return {
    isActive,
    points,
    distance,
    measurements,
    raycasterRef,
    toggleActive,
    addPoint,
    clearMeasurements,
    deleteMeasurement,
    reset,
  };
}

export default useMeasurement;
