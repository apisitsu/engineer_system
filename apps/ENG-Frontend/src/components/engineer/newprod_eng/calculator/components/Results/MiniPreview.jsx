import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { generateOuterSphereProfile, generateBoreProfile, generateFlangeMetalProfile, generateFlangeLinerProfile, generateSleeveMetalProfile, generateSleeveLinerProfile } from '../../utils/geometry';
import { MODEL_TYPES } from '../../constants';

function MiniScene({ children, cameraPosition = [30, 20, 30] }) {
  return (
    <Canvas camera={{ position: cameraPosition, fov: 40 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ width: '100%', height: '100%', background: 'transparent', borderRadius: 8 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[20, 30, 20]} intensity={0.8} />
      <directionalLight position={[-20, 0, -20]} intensity={0.4} />
      <Environment preset="city" />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={2} target={[0,0,0]} />
      {/* Align MiniPreview to X-Axis globally since models are oriented X */}
      <group rotation={[0, 0, -Math.PI / 2]}>
        {children}
      </group>
    </Canvas>
  );
}

function OuterShellPreview({ params, color }) {
  const geometry = useMemo(() => {
    const profile = params.modelType === MODEL_TYPES.FLANGE ? generateFlangeMetalProfile(params)
                  : params.modelType === MODEL_TYPES.SLEEVE ? generateSleeveMetalProfile(params)
                  : generateOuterSphereProfile(params, 32);
    return new THREE.LatheGeometry(profile, 64, 0, Math.PI * 2);
  }, [params]);

  return <mesh geometry={geometry}><meshStandardMaterial color={color} metalness={0.6} roughness={0.3} side={THREE.DoubleSide} /></mesh>;
}

function BorePreview({ params, color }) {
  const geometry = useMemo(() => {
    const profile = params.modelType === MODEL_TYPES.FLANGE ? generateFlangeLinerProfile(params)
                  : params.modelType === MODEL_TYPES.SLEEVE ? generateSleeveLinerProfile(params)
                  : generateBoreProfile(params);
    return new THREE.LatheGeometry(profile, 64, 0, Math.PI * 2);
  }, [params]);

  return <mesh geometry={geometry}><meshStandardMaterial color={color} metalness={0.6} roughness={0.3} side={THREE.DoubleSide} /></mesh>;
}

function CrossSectionPreview({ params, color }) {
  const geometry = useMemo(() => {
    const profile = params.modelType === MODEL_TYPES.FLANGE ? generateFlangeMetalProfile(params)
                  : params.modelType === MODEL_TYPES.SLEEVE ? generateSleeveMetalProfile(params)
                  : generateOuterSphereProfile(params, 32);
    return new THREE.LatheGeometry(profile, 64, 0, Math.PI);
  }, [params]);

  return (
    <group>
      <mesh geometry={geometry}><meshStandardMaterial color={color} metalness={0.5} roughness={0.4} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

export default function MiniPreview({ params, materialColor = '#CD7F32' }) {
  const isPoly = params.modelType === MODEL_TYPES.FLANGE || params.modelType === MODEL_TYPES.SLEEVE;
  return (
    <div className="mini-preview-container">
      <div className="mini-preview-item">
        <div className="mini-preview-canvas"><MiniScene><OuterShellPreview params={params} color={materialColor} /></MiniScene></div>
        <span className="mini-preview-label">{isPoly ? 'Metal Outline' : 'Outer Shell'}</span>
      </div>
      <div className="mini-preview-item">
        <div className="mini-preview-canvas"><MiniScene><BorePreview params={params} color={materialColor} /></MiniScene></div>
        <span className="mini-preview-label">{isPoly ? 'TFE Liner' : 'Inner Bore'}</span>
      </div>
      <div className="mini-preview-item">
        <div className="mini-preview-canvas"><MiniScene cameraPosition={[0, 0, 35]}><CrossSectionPreview params={params} color={materialColor} /></MiniScene></div>
        <span className="mini-preview-label">Cross Section</span>
      </div>
    </div>
  );
}
