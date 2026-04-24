import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei';
import DeformableMesh from './DeformableMesh';

export default function FeaScene({ meshData, timeStepData, maxStress }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
      <Canvas camera={{ position: [25, 15, 25], fov: 45, near: 0.1, far: 1000 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        <directionalLight position={[-10, 5, -10]} intensity={0.3} />
        
        <Environment preset="city" />

        <Grid 
            infiniteGrid 
            fadeDistance={50} 
            sectionColor="#333" 
            cellColor="#222" 
            position={[0, -0.5, 0]} 
        />

        {meshData && timeStepData && (
            <DeformableMesh 
                meshData={meshData} 
                timeStepData={timeStepData} 
                maxStress={maxStress} 
            />
        )}

        <OrbitControls makeDefault />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="white" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
