import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { generateOuterSphereProfile, generateBoreProfile, generateFlangeMetalProfile, generateFlangeLinerProfile, generateSleeveMetalProfile, generateSleeveLinerProfile } from '../../utils/geometry';
import { VIEWER_CONFIG, MODEL_TYPES } from '../../constants';

// --- FLANGE SLEEVE COMPONENT ---
function FlangeSleeveModel({ params, materialColor, wireframe }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
    }
  });

  const metalGeometry = useMemo(() => {
    const profile = generateFlangeMetalProfile(params);
    return new THREE.LatheGeometry(profile, VIEWER_CONFIG.latheSegments, 0, Math.PI * 2);
  }, [params]);

  const linerGeometry = useMemo(() => {
    const profile = generateFlangeLinerProfile(params);
    return new THREE.LatheGeometry(profile, VIEWER_CONFIG.latheSegments, 0, Math.PI * 2);
  }, [params]);

  return (
    <group ref={groupRef}>
      <mesh geometry={metalGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} metalness={0.7} roughness={0.25} wireframe={wireframe} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={linerGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#080808" metalness={0.1} roughness={0.9} wireframe={wireframe} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// --- SPHERICAL BEARING (BALL) COMPONENT ---
function BallModel({ params, materialColor, wireframe }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
    }
  });

  const outerGeometry = useMemo(() => {
    const profile = generateOuterSphereProfile(params, VIEWER_CONFIG.sphereSegments);
    return new THREE.LatheGeometry(profile, VIEWER_CONFIG.latheSegments, 0, Math.PI * 2);
  }, [params]);

  const boreGeometry = useMemo(() => {
    const profile = generateBoreProfile(params);
    return new THREE.LatheGeometry(profile, VIEWER_CONFIG.latheSegments, 0, Math.PI * 2);
  }, [params]);

  const faceGeometry = useMemo(() => {
    const R = params.outerSphereDia / 2;
    const halfW = params.width / 2;
    const r_cut = Math.sqrt(Math.max(0, R * R - halfW * halfW));
    const r_chamfer = Math.max(params.innerBoreDia / 2, params.chamferDia / 2);
    const innerR = Math.min(r_chamfer, Math.max(0, r_cut - 0.01));
    const outerR = Math.max(innerR + 0.01, r_cut);
    return new THREE.RingGeometry(innerR, outerR, 64);
  }, [params]);

  const boreColor = useMemo(() => new THREE.Color(materialColor).multiplyScalar(0.6).getHex(), [materialColor]);

  return (
    <group ref={groupRef}>
      <mesh geometry={outerGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} metalness={0.7} roughness={0.25} wireframe={wireframe} />
      </mesh>
      <mesh geometry={boreGeometry}>
        <meshStandardMaterial color={boreColor} metalness={0.8} roughness={0.15} side={THREE.BackSide} wireframe={wireframe} />
      </mesh>
      <mesh geometry={faceGeometry} position={[0, -params.width / 2, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color={materialColor} metalness={0.7} roughness={0.25} wireframe={wireframe} />
      </mesh>
      <mesh geometry={faceGeometry} position={[0, params.width / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color={materialColor} metalness={0.7} roughness={0.25} wireframe={wireframe} />
      </mesh>
      <mesh>
        <sphereGeometry args={[params.outerSphereDia / 2, 32, 32]} />
        <meshStandardMaterial color={materialColor} transparent opacity={0.05} wireframe depthWrite={false} />
      </mesh>
    </group>
  );
}

// --- SLEEVE COMPONENT ---
function SleeveModel({ params, materialColor, wireframe }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
    }
  });

  const metalGeometry = useMemo(() => {
    const profile = generateSleeveMetalProfile(params);
    return new THREE.LatheGeometry(profile, VIEWER_CONFIG.latheSegments, 0, Math.PI * 2);
  }, [params]);

  const linerGeometry = useMemo(() => {
    const profile = generateSleeveLinerProfile(params);
    return new THREE.LatheGeometry(profile, VIEWER_CONFIG.latheSegments, 0, Math.PI * 2);
  }, [params]);

  return (
    <group ref={groupRef}>
      <mesh geometry={metalGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} metalness={0.7} roughness={0.25} wireframe={wireframe} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={linerGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#080808" metalness={0.1} roughness={0.9} wireframe={wireframe} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// --- MAIN EXPORT ENTRANCE ---
export default function BushingModel(props) {
  // To avoid breaking React Hook Rules, we split into distinct components. 
  // Conditional hook rendering inside a single component throws "fewer hooks than expected" on switch.
  
  if (props.params.modelType === MODEL_TYPES.FLANGE) {
    return <FlangeSleeveModel {...props} />;
  }
  
  if (props.params.modelType === MODEL_TYPES.SLEEVE) {
    return <SleeveModel {...props} />;
  }
  
  return <BallModel {...props} />;
}
