/**
 * BushingScene - Main 3D canvas component with lighting, controls, and grid.
 */
import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Environment, ContactShadows } from '@react-three/drei';
import BushingModel from './BushingModel';
import DimensionLines from './DimensionLines';
import MeasurementTool from './MeasurementTool';
import { VIEWER_CONFIG } from '../../constants';

function SceneContents({
  params,
  materialColor,
  showDimensions,
  showGrid,
  showAxes,
  wireframe,
  measurement,
}) {
  const modelRef = useRef();

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={VIEWER_CONFIG.ambientIntensity} />
      <directionalLight
        position={[50, 80, 50]}
        intensity={VIEWER_CONFIG.directionalIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight
        position={[-30, 40, -30]}
        intensity={0.3}
        color="#b4c6ff"
      />

      {/* Environment for reflections */}
      <Environment preset="studio" />

      {/* Global Rotation to align geometry to X-Axis instead of default Y */}
      <group rotation={[0, 0, -Math.PI / 2]}>
        {/* 3D Bushing Model */}
        <Suspense fallback={null}>
          <group ref={modelRef} position={[0, 0, 0]}>
            <BushingModel
              params={params}
              materialColor={materialColor}
              wireframe={wireframe}
            />
          </group>
        </Suspense>

        {/* Dimension Lines */}
        {showDimensions && (
          <DimensionLines params={params} />
        )}

        {/* Measurement Tool */}
        {measurement.isActive && (
          <MeasurementTool
            measurement={measurement}
            modelRef={modelRef}
          />
        )}
      </group>

      {/* Ground Grid */}
      {showGrid && (
        <Grid
          args={[VIEWER_CONFIG.gridSize, VIEWER_CONFIG.gridSize]}
          cellSize={5}
          cellThickness={0.5}
          cellColor="#6f6f6f"
          sectionSize={10}
          sectionThickness={1}
          sectionColor="#9d4b4b"
          fadeDistance={150}
          fadeStrength={1}
          followCamera={false}
          position={[0, -0.01, 0]}
        />
      )}

      {/* Contact shadows for grounding */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={80}
        blur={2}
        far={20}
      />

      {/* Camera Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        panSpeed={0.8}
        minDistance={10}
        maxDistance={300}
        target={[0, 0, 0]}
      />

      {/* Navigation Gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport
          axisColors={['#ff4d6a', '#4dff6a', '#4d6aff']}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}

export default function BushingScene({
  params,
  materialColor = '#CD7F32',
  showDimensions = true,
  showGrid = true,
  showAxes = true,
  wireframe = false,
  measurement,
}) {
  return (
    <Canvas
      camera={{
        position: VIEWER_CONFIG.cameraPosition,
        fov: VIEWER_CONFIG.cameraFov,
        near: VIEWER_CONFIG.cameraNear,
        far: VIEWER_CONFIG.cameraFar,
      }}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '12px',
      }}
    >
      <SceneContents
        params={params}
        materialColor={materialColor}
        showDimensions={showDimensions}
        showGrid={showGrid}
        showAxes={showAxes}
        wireframe={wireframe}
        measurement={measurement}
      />
    </Canvas>
  );
}
