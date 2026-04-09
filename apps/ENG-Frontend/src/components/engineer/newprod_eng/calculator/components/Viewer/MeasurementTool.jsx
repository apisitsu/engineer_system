/**
 * MeasurementTool - Click-to-measure distance between two points on the 3D model.
 * Shows visual markers at clicked points and displays the distance.
 */
import React, { useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Invisible click plane that captures raycaster hits on the bushing model
 */
function ClickCatcher({ onPointClick }) {
  const { scene, camera, raycaster, pointer } = useThree();

  const handleClick = useCallback((event) => {
    // Set up raycaster from camera through mouse position
    raycaster.setFromCamera(pointer, camera);

    // Find all mesh intersections in the scene
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Filter to only mesh objects (not helpers, lines, etc.)
    const meshHits = intersects.filter(hit =>
      hit.object.isMesh &&
      hit.object.geometry &&
      !hit.object.userData?.isMeasurementMarker
    );

    if (meshHits.length > 0) {
      onPointClick(meshHits[0].point);
    }
  }, [scene, camera, raycaster, pointer, onPointClick]);

  return (
    <mesh
      onClick={handleClick}
      visible={false}
      userData={{ isMeasurementHelper: true }}
    >
      <sphereGeometry args={[500, 8, 8]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Visual marker at a measured point
 */
function PointMarker({ position }) {
  return (
    <group position={position}>
      {/* Outer ring */}
      <mesh userData={{ isMeasurementMarker: true }}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial color="#ff3366" transparent opacity={0.9} />
      </mesh>
      {/* Inner glow */}
      <mesh userData={{ isMeasurementMarker: true }}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export default function MeasurementTool({ measurement, modelRef }) {
  const { points, distance, addPoint, measurements } = measurement;

  const handlePointClick = useCallback((point) => {
    addPoint(point);
  }, [addPoint]);

  return (
    <group>
      {/* Click catcher */}
      <ClickCatcher onPointClick={handlePointClick} />

      {/* Current measurement points */}
      {points.map((point, i) => (
        <PointMarker
          key={`current-${i}`}
          position={[point.x, point.y, point.z]}
        />
      ))}

      {/* Line between current points */}
      {points.length === 2 && (
        <>
          <Line
            points={[
              [points[0].x, points[0].y, points[0].z],
              [points[1].x, points[1].y, points[1].z],
            ]}
            color="#ff3366"
            lineWidth={2}
            dashed
            dashSize={1}
            dashScale={3}
          />
          {/* Distance label */}
          <Html
            position={[
              (points[0].x + points[1].x) / 2,
              (points[0].y + points[1].y) / 2 + 2,
              (points[0].z + points[1].z) / 2,
            ]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: 'rgba(255, 51, 102, 0.95)',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(255, 51, 102, 0.4)',
            }}>
              📏 {distance?.toFixed(3)} mm
            </div>
          </Html>
        </>
      )}

      {/* Historical measurements */}
      {measurements.map((m) => (
        <group key={m.id}>
          <PointMarker position={m.p1} />
          <PointMarker position={m.p2} />
          <Line
            points={[m.p1, m.p2]}
            color="#ff6699"
            lineWidth={1}
            transparent
            opacity={0.5}
            dashed
            dashSize={1}
            dashScale={3}
          />
          <Html
            position={[
              (m.p1[0] + m.p2[0]) / 2,
              (m.p1[1] + m.p2[1]) / 2 + 1.5,
              (m.p1[2] + m.p2[2]) / 2,
            ]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: 'rgba(100, 50, 70, 0.8)',
              color: '#ffaacc',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, Consolas, monospace',
            }}>
              {m.distance.toFixed(3)} mm
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
