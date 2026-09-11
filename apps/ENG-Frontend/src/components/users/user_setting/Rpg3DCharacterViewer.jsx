import React, { useState, useRef, useEffect, Suspense, useMemo, Component } from 'react';
import { Canvas, useFrame, useThree, events } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import {
  Button, Modal, Input, Radio, Space, Typography, Tag, Tooltip,
  Upload, message, Card, Row, Col, Spin, Segmented
} from 'antd';
import {
  ReloadOutlined,
  CompassOutlined,
  SearchOutlined,
  UploadOutlined,
  CheckCircleFilled,
  LinkOutlined,
  ThunderboltFilled,
  ClearOutlined,
  EyeOutlined
} from '@ant-design/icons';
import {
  CHARACTER_PRESETS,
  SAMPLE_3D_MODELS,
  ELEMENT_CONFIGS
} from './rpgConstants';

const { Text, Title, Paragraph } = Typography;

// ── Safe Pointer Events Factory (Protects against React 19 timing null connect) ─
const safePointerEvents = (store) => {
  const pointerEvents = events(store);
  const origConnect = pointerEvents.connect;
  const origDisconnect = pointerEvents.disconnect;
  pointerEvents.connect = (target) => {
    if (!target) return;
    try {
      origConnect(target);
    } catch (err) {
      console.warn("safePointerEvents: connect error safely handled:", err);
    }
  };
  pointerEvents.disconnect = () => {
    try {
      origDisconnect?.();
    } catch (err) {
      console.warn("safePointerEvents: disconnect error safely handled:", err);
    }
  };
  return pointerEvents;
};

// ── WebGL / Three.js Error Boundary ──────────────────────────────────────────
class ThreeCanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ThreeCanvasErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1f2e',
          color: '#cbd5e1',
          padding: '20px',
          textAlign: 'center'
        }}>
          <ThunderboltFilled style={{ fontSize: '36px', color: '#ff7875', marginBottom: '12px' }} />
          <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff', margin: '0 0 6px 0' }}>
            3D Character Stage Temporarily Unavailable
          </p>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0' }}>
            WebGL context or model resource encountered a reload state.
          </p>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ borderRadius: '8px' }}
          >
            Reload 3D Stage
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Camera Fit Helper ────────────────────────────────────────────────────────
function fitCameraToObject(object, camera, controls, offset = 1.6) {
  if (!object || !camera) return;
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * offset;
  cameraZ = Math.max(cameraZ, 2.5);

  camera.position.set(center.x, center.y + maxDim * 0.25, center.z + cameraZ);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
}

// ── Glowing Elemental Pedestal ────────────────────────────────────────────────
function ElementalPedestal({ elementColor }) {
  const outerRingRef = useRef();
  const innerRingRef = useRef();

  useFrame((_, delta) => {
    if (outerRingRef.current) outerRingRef.current.rotation.z += delta * 0.4;
    if (innerRingRef.current) innerRingRef.current.rotation.z -= delta * 0.6;
  });

  return (
    <group position={[0, -1.2, 0]}>
      {/* Base cylinder platform */}
      <mesh receiveShadow position={[0, -0.05, 0]}>
        <cylinderGeometry args={[1.5, 1.65, 0.1, 32]} />
        <meshStandardMaterial color="#2c3349" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Outer energy ring */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.25, 1.38, 32]} />
        <meshBasicMaterial color={elementColor} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Inner energy ring */}
      <mesh ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.85, 0.95, 24]} />
        <meshBasicMaterial color={elementColor} transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* Center glowing glyph plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.65, 24]} />
        <meshBasicMaterial color={elementColor} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Soft upward spotlight onto character */}
      <pointLight position={[0, 0.5, 0]} color={elementColor} intensity={2.5} distance={3.5} />
    </group>
  );
}

// ── 1. Archetype: Cyborg Engineer (Blue #1890ff - Balanced & Core) ───────────
function CyborgEngineerAvatar({ preset, elementColor }) {
  const groupRef = useRef();
  const droneRef = useRef();
  const coreRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.position.y = -0.22 + Math.sin(t * 1.5) * 0.03;
    if (coreRef.current) {
      const scale = 1 + Math.sin(t * 3.5) * 0.12;
      coreRef.current.scale.set(scale, scale, scale);
    }
    if (droneRef.current) {
      droneRef.current.position.x = Math.sin(t * 1.8) * 1.05;
      droneRef.current.position.z = Math.cos(t * 1.8) * 1.05;
      droneRef.current.position.y = 0.5 + Math.sin(t * 2.5) * 0.12;
    }
  });

  const mainColor = preset?.color || "#1890ff";
  const accentColor = preset?.accentColor || elementColor;

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {/* Torso */}
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.24, 0.65, 8]} />
        <meshStandardMaterial color="#1f1f27" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.08, 0.16]}>
        <boxGeometry args={[0.38, 0.3, 0.1]} />
        <meshStandardMaterial color={mainColor} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh ref={coreRef} position={[0, 0.1, 0.22]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color={elementColor} />
      </mesh>
      {/* Head */}
      <group position={[0, 0.52, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
          <meshStandardMaterial color="#2a2b36" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.02, 0.17]}>
          <boxGeometry args={[0.26, 0.09, 0.05]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
        <mesh position={[0, 0.22, -0.04]}>
          <boxGeometry args={[0.06, 0.12, 0.24]} />
          <meshStandardMaterial color={mainColor} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      {/* Shoulders */}
      <mesh castShadow position={[-0.42, 0.22, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.24]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0.42, 0.22, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.24]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Left Arm */}
      <mesh castShadow position={[-0.38, -0.04, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.42, 8]} />
        <meshStandardMaterial color="#2d2e3d" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.38, -0.28, 0.04]}>
        <boxGeometry args={[0.11, 0.16, 0.11]} />
        <meshStandardMaterial color={mainColor} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Right Arm with Tablet */}
      <mesh castShadow position={[0.38, -0.04, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.42, 8]} />
        <meshStandardMaterial color="#2d2e3d" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0.38, -0.26, 0.1]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.16, 0.03, 0.22]} />
        <meshStandardMaterial color="#1a1a24" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.38, -0.24, 0.1]} rotation={[0.4, 0, 0]}>
        <planeGeometry args={[0.13, 0.18]} />
        <meshBasicMaterial color={elementColor} side={THREE.DoubleSide} />
      </mesh>
      {/* Legs & Feet */}
      <mesh castShadow position={[0, -0.38, 0]}>
        <cylinderGeometry args={[0.22, 0.25, 0.16, 8]} />
        <meshStandardMaterial color="#16161d" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.15, -0.66, 0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.46, 8]} />
        <meshStandardMaterial color="#262734" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.15, -0.92, 0.05]}>
        <boxGeometry args={[0.12, 0.08, 0.2]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0.15, -0.66, 0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.46, 8]} />
        <meshStandardMaterial color="#262734" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0.15, -0.92, 0.05]}>
        <boxGeometry args={[0.12, 0.08, 0.2]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Companion Drone */}
      <group ref={droneRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color="#141419" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <circleGeometry args={[0.04, 16]} />
          <meshBasicMaterial color={elementColor} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[Math.PI / 4, 0, 0]}>
          <torusGeometry args={[0.14, 0.012, 8, 24]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </group>
    </group>
  );
}

// ── 2. Archetype: Mech Vanguard (Red #ff4d4f - Heavy Machining & Force) ────────
function MechVanguardAvatar({ preset, elementColor }) {
  const groupRef = useRef();
  const drillRef = useRef();

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.position.y = -0.22 + Math.sin(t * 1.2) * 0.02;
    if (drillRef.current) drillRef.current.rotation.y += delta * 6;
  });

  const mainColor = preset?.color || "#ff4d4f";
  const accentColor = preset?.accentColor || "#ffa39e";

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {/* Heavy Armored Angular Torso */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.48, 0.65, 0.36]} />
        <meshStandardMaterial color="#1e1e24" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Front Heavy Blast Plate */}
      <mesh castShadow position={[0, 0.05, 0.19]}>
        <boxGeometry args={[0.42, 0.36, 0.08]} />
        <meshStandardMaterial color={mainColor} metalness={0.75} roughness={0.35} />
      </mesh>
      {/* Glowing Power Core Slit */}
      <mesh position={[0, 0.05, 0.24]}>
        <boxGeometry args={[0.18, 0.06, 0.02]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>

      {/* Dual Back Exhaust Chimneys */}
      <mesh castShadow position={[-0.16, 0.38, -0.2]}>
        <cylinderGeometry args={[0.06, 0.07, 0.35, 8]} />
        <meshStandardMaterial color="#16161a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-0.16, 0.56, -0.2]}>
        <circleGeometry args={[0.04, 8]} />
        <meshBasicMaterial color="#ff4d4f" />
      </mesh>
      <mesh castShadow position={[0.16, 0.38, -0.2]}>
        <cylinderGeometry args={[0.06, 0.07, 0.35, 8]} />
        <meshStandardMaterial color="#16161a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.16, 0.56, -0.2]}>
        <circleGeometry args={[0.04, 8]} />
        <meshBasicMaterial color="#ff4d4f" />
      </mesh>

      {/* Heavy Combat Helmet */}
      <group position={[0, 0.52, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.3, 0.34]} />
          <meshStandardMaterial color="#25252e" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Aggressive Red Slit Visor */}
        <mesh position={[0, 0.03, 0.18]}>
          <boxGeometry args={[0.26, 0.045, 0.02]} />
          <meshBasicMaterial color="#ff4d4f" />
        </mesh>
        {/* Heavy Chin Guard */}
        <mesh position={[0, -0.1, 0.17]}>
          <boxGeometry args={[0.2, 0.08, 0.06]} />
          <meshStandardMaterial color={mainColor} metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* Massive Spiked Pauldrons */}
      <group position={[-0.46, 0.22, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.24, 0.22, 0.28]} />
          <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <coneGeometry args={[0.06, 0.14, 4]} />
          <meshStandardMaterial color="#1a1a20" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      <group position={[0.46, 0.22, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.24, 0.22, 0.28]} />
          <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <coneGeometry args={[0.06, 0.14, 4]} />
          <meshStandardMaterial color="#1a1a20" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Left Arm: Heavy Hydraulic Crusher Fist */}
      <mesh castShadow position={[-0.44, -0.06, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.42, 8]} />
        <meshStandardMaterial color="#22222a" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.44, -0.32, 0.04]}>
        <boxGeometry args={[0.16, 0.18, 0.18]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Right Arm: Kinetic Rotary Drill */}
      <mesh castShadow position={[0.44, -0.06, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.42, 8]} />
        <meshStandardMaterial color="#22222a" metalness={0.7} roughness={0.4} />
      </mesh>
      <group ref={drillRef} position={[0.44, -0.35, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.02, 0.32, 6]} />
          <meshStandardMaterial color="#f0f0f0" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>

      {/* Heavy Legs & Wide Stabilizer Boots */}
      <mesh castShadow position={[-0.18, -0.66, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.46, 8]} />
        <meshStandardMaterial color="#202028" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.18, -0.92, 0.06]}>
        <boxGeometry args={[0.18, 0.08, 0.26]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0.18, -0.66, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.46, 8]} />
        <meshStandardMaterial color="#202028" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0.18, -0.92, 0.06]}>
        <boxGeometry args={[0.18, 0.08, 0.26]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── 3. Archetype: Techno-Alchemist (Purple #722ed1 - High MP & CAD Wizardry) ───
function TechnoAlchemistAvatar({ preset, elementColor }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const crystalLeftRef = useRef();
  const crystalRightRef = useRef();

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.position.y = -0.22 + Math.sin(t * 1.8) * 0.04;
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.8;
    if (crystalLeftRef.current) {
      crystalLeftRef.current.rotation.x += delta * 1.5;
      crystalLeftRef.current.rotation.y += delta * 1.8;
      crystalLeftRef.current.position.y = -0.26 + Math.sin(t * 3) * 0.05;
    }
    if (crystalRightRef.current) {
      crystalRightRef.current.rotation.x -= delta * 1.5;
      crystalRightRef.current.rotation.z += delta * 1.8;
      crystalRightRef.current.position.y = -0.26 + Math.cos(t * 3) * 0.05;
    }
  });

  const mainColor = preset?.color || "#722ed1";
  const accentColor = preset?.accentColor || "#b37feb";

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {/* Slender Robe-Like Torso */}
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.38, 0.72, 8]} />
        <meshStandardMaterial color="#1a1824" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Front Alchemical Robe Stole */}
      <mesh position={[0, -0.05, 0.16]}>
        <boxGeometry args={[0.24, 0.6, 0.04]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Floating Holographic Waist Rune Ring */}
      <group ref={ringRef} position={[0, -0.15, 0]} rotation={[Math.PI / 3, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.44, 0.014, 8, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.85} />
        </mesh>
      </group>

      {/* Pointed Alchemist Helm */}
      <group position={[0, 0.54, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.3, 0.28]} />
          <meshStandardMaterial color="#252233" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Crested Crown Tip */}
        <mesh position={[0, 0.24, 0]}>
          <coneGeometry args={[0.1, 0.25, 4]} />
          <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Third Eye Sensor Crystal */}
        <mesh position={[0, 0.04, 0.15]}>
          <octahedronGeometry args={[0.05, 0]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </group>

      {/* Pauldrons (Floating Crescent Mantle) */}
      <mesh castShadow position={[-0.38, 0.24, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.16, 0.1, 0.24]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0.38, 0.24, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.16, 0.1, 0.24]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Left Arm & Floating Crystal */}
      <mesh castShadow position={[-0.34, -0.04, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.42, 8]} />
        <meshStandardMaterial color="#252233" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={crystalLeftRef} position={[-0.34, -0.26, 0.1]}>
        <octahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial color={accentColor} emissive={mainColor} emissiveIntensity={0.8} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Right Arm & Floating Crystal */}
      <mesh castShadow position={[0.34, -0.04, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.42, 8]} />
        <meshStandardMaterial color="#252233" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={crystalRightRef} position={[0.34, -0.26, 0.1]}>
        <octahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial color={accentColor} emissive={mainColor} emissiveIntensity={0.8} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Slender Legs */}
      <mesh castShadow position={[-0.14, -0.66, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.46, 8]} />
        <meshStandardMaterial color="#201d2c" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.14, -0.92, 0.04]}>
        <boxGeometry args={[0.1, 0.08, 0.18]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0.14, -0.66, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.46, 8]} />
        <meshStandardMaterial color="#201d2c" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0.14, -0.92, 0.04]}>
        <boxGeometry args={[0.1, 0.08, 0.18]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── 4. Archetype: Aegis Sentinel (Gold #faad14 - High DEF & Fortress Shield) ───
function AegisSentinelAvatar({ preset, elementColor }) {
  const groupRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.position.y = -0.22 + Math.sin(t * 1.0) * 0.02;
  });

  const mainColor = preset?.color || "#faad14";
  const accentColor = preset?.accentColor || "#ffe58f";

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {/* Heavy Fortress Torso */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.44, 0.65, 0.32]} />
        <meshStandardMaterial color="#22211c" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.06, 0.17]}>
        <boxGeometry args={[0.4, 0.32, 0.06]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Fortress Knight Helm */}
      <group position={[0, 0.52, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
          <meshStandardMaterial color="#2b2923" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Golden T-Visor */}
        <mesh position={[0, 0.02, 0.17]}>
          <boxGeometry args={[0.22, 0.05, 0.02]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
        <mesh position={[0, -0.04, 0.17]}>
          <boxGeometry args={[0.05, 0.1, 0.02]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
        {/* Dual Horn Crests */}
        <mesh position={[-0.14, 0.22, 0]} rotation={[0, 0, -0.25]}>
          <boxGeometry args={[0.04, 0.16, 0.18]} />
          <meshStandardMaterial color={mainColor} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.14, 0.22, 0]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.04, 0.16, 0.18]} />
          <meshStandardMaterial color={mainColor} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Layered Fortress Pauldrons */}
      <mesh castShadow position={[-0.44, 0.24, 0]}>
        <boxGeometry args={[0.24, 0.2, 0.28]} />
        <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[0.44, 0.24, 0]}>
        <boxGeometry args={[0.24, 0.2, 0.28]} />
        <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Left Arm: Massive Tower Riot Shield */}
      <mesh castShadow position={[-0.4, -0.04, 0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.42, 8]} />
        <meshStandardMaterial color="#2d2b24" metalness={0.7} roughness={0.4} />
      </mesh>
      <group position={[-0.42, -0.22, 0.18]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.64, 0.05]} />
          <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Shield Glowing Emblem */}
        <mesh position={[0, 0.04, 0.03]}>
          <octahedronGeometry args={[0.1, 0]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </group>

      {/* Right Arm: Armored Fist */}
      <mesh castShadow position={[0.4, -0.04, 0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.42, 8]} />
        <meshStandardMaterial color="#2d2b24" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0.4, -0.3, 0.04]}>
        <boxGeometry args={[0.13, 0.16, 0.13]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Broad Fortress Boots */}
      <mesh castShadow position={[-0.16, -0.66, 0]}>
        <cylinderGeometry args={[0.1, 0.08, 0.46, 8]} />
        <meshStandardMaterial color="#24221c" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.16, -0.92, 0.06]}>
        <boxGeometry args={[0.16, 0.08, 0.24]} />
        <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0.16, -0.66, 0]}>
        <cylinderGeometry args={[0.1, 0.08, 0.46, 8]} />
        <meshStandardMaterial color="#24221c" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0.16, -0.92, 0.06]}>
        <boxGeometry args={[0.16, 0.08, 0.24]} />
        <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── 5. Archetype: Nano Scout (Green #52c41a - High HP & Aerodynamic Velocity) ─
function NanoScoutAvatar({ preset, elementColor }) {
  const groupRef = useRef();
  const leftBladeRef = useRef();
  const rightBladeRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.position.y = -0.22 + Math.sin(t * 2.4) * 0.035;
    if (leftBladeRef.current) {
      leftBladeRef.current.scale.z = 1 + Math.sin(t * 6) * 0.1;
    }
    if (rightBladeRef.current) {
      rightBladeRef.current.scale.z = 1 + Math.cos(t * 6) * 0.1;
    }
  });

  const mainColor = preset?.color || "#52c41a";
  const accentColor = preset?.accentColor || "#b7eb8f";

  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      {/* Streamlined Lightweight Torso */}
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.18, 0.62, 8]} />
        <meshStandardMaterial color="#1a2218" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.06, 0.12]}>
        <boxGeometry args={[0.3, 0.28, 0.08]} />
        <meshStandardMaterial color={mainColor} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Twin Swept-Back Aerodynamic Wings */}
      <mesh castShadow position={[-0.24, 0.18, -0.16]} rotation={[-0.4, 0.3, -0.5]}>
        <boxGeometry args={[0.42, 0.08, 0.02]} />
        <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[-0.42, 0.26, -0.24]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      <mesh castShadow position={[0.24, 0.18, -0.16]} rotation={[-0.4, -0.3, 0.5]}>
        <boxGeometry args={[0.42, 0.08, 0.02]} />
        <meshStandardMaterial color={mainColor} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.42, 0.26, -0.24]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>

      {/* Streamlined Speedster Helm with Dual Antennae */}
      <group position={[0, 0.52, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.26, 0.28, 0.3]} />
          <meshStandardMaterial color="#212b1e" metalness={0.75} roughness={0.3} />
        </mesh>
        {/* Insectoid Angular Visor */}
        <mesh position={[0, 0.02, 0.16]}>
          <boxGeometry args={[0.22, 0.08, 0.03]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
        {/* Dual Flexible Antennae */}
        <mesh position={[-0.1, 0.24, -0.06]} rotation={[-0.3, 0, -0.3]}>
          <cylinderGeometry args={[0.015, 0.015, 0.24, 6]} />
          <meshBasicMaterial color={mainColor} />
        </mesh>
        <mesh position={[0.1, 0.24, -0.06]} rotation={[-0.3, 0, 0.3]}>
          <cylinderGeometry args={[0.015, 0.015, 0.24, 6]} />
          <meshBasicMaterial color={mainColor} />
        </mesh>
      </group>

      {/* Left Arm: Wrist Energy Blade */}
      <mesh castShadow position={[-0.34, -0.04, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.42, 8]} />
        <meshStandardMaterial color="#212b1e" metalness={0.6} roughness={0.4} />
      </mesh>
      <group position={[-0.34, -0.26, 0.08]}>
        <mesh castShadow>
          <boxGeometry args={[0.08, 0.14, 0.08]} />
          <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh ref={leftBladeRef} position={[0, -0.15, 0.06]}>
          <boxGeometry args={[0.02, 0.32, 0.05]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </group>

      {/* Right Arm: Wrist Energy Blade */}
      <mesh castShadow position={[0.34, -0.04, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.42, 8]} />
        <meshStandardMaterial color="#212b1e" metalness={0.6} roughness={0.4} />
      </mesh>
      <group position={[0.34, -0.26, 0.08]}>
        <mesh castShadow>
          <boxGeometry args={[0.08, 0.14, 0.08]} />
          <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh ref={rightBladeRef} position={[0, -0.15, 0.06]}>
          <boxGeometry args={[0.02, 0.32, 0.05]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </group>

      {/* High-Mobility Kinetic Sprint Legs */}
      <mesh castShadow position={[-0.12, -0.66, 0]}>
        <cylinderGeometry args={[0.07, 0.05, 0.46, 8]} />
        <meshStandardMaterial color="#1f281d" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.12, -0.92, 0.04]}>
        <boxGeometry args={[0.09, 0.08, 0.18]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0.12, -0.66, 0]}>
        <cylinderGeometry args={[0.07, 0.05, 0.46, 8]} />
        <meshStandardMaterial color="#1f281d" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0.12, -0.92, 0.04]}>
        <boxGeometry args={[0.09, 0.08, 0.18]} />
        <meshStandardMaterial color={mainColor} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── Master Switcher: Procedural 3D Character Avatar (5 Archetypes / 5 Colors) ──
function ProceduralCharacterAvatar({ preset, elementColor }) {
  const presetId = preset?.id || "cyborg_engineer";
  if (presetId === "mech_vanguard") {
    return <MechVanguardAvatar preset={preset} elementColor={elementColor} />;
  }
  if (presetId === "techno_alchemist") {
    return <TechnoAlchemistAvatar preset={preset} elementColor={elementColor} />;
  }
  if (presetId === "aegis_sentinel") {
    return <AegisSentinelAvatar preset={preset} elementColor={elementColor} />;
  }
  if (presetId === "nano_scout") {
    return <NanoScoutAvatar preset={preset} elementColor={elementColor} />;
  }
  return <CyborgEngineerAvatar preset={preset} elementColor={elementColor} />;
}

// ── External glTF / GLB Model Loader (Feet Aligned to Pedestal Floor & Animation)
function CustomGlbModel({ modelUrl, modelData, onError, onLoaded }) {
  const groupRef = useRef();
  const mixerRef = useRef();
  const { camera, controls } = useThree();

  useFrame((_, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  useEffect(() => {
    if (!modelUrl && !modelData) return;

    const loader = new GLTFLoader();
    const handleSuccess = (gltf) => {
      if (!groupRef.current) return;
      groupRef.current.clear();
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }

      const model = gltf.scene || gltf.scenes[0];
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // 1. Initial scale to target height ~1.85
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetHeight = 1.85;
      const scale = targetHeight / maxDim;
      model.scale.set(scale, scale, scale);

      // 2. Recompute bounding box after scale to get exact center & floor contact
      box.setFromObject(model);
      const scaledCenter = box.getCenter(new THREE.Vector3());

      // 3. Center model horizontally on X and Z
      model.position.x = -scaledCenter.x;
      model.position.z = -scaledCenter.z;

      // 4. Ground feet flush on pedestal top surface (floorY = -1.18)
      const floorY = -1.18;
      model.position.y += (floorY - box.min.y);

      // 5. Setup AnimationMixer if model has animations (e.g. RobotExpressive idle animation)
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        const idleAnim = gltf.animations.find(a => /idle|stand|wait|wave/i.test(a.name)) || gltf.animations[0];
        if (idleAnim) {
          const action = mixer.clipAction(idleAnim);
          action.play();
        }
      }

      groupRef.current.add(model);
      fitCameraToObject(model, camera, controls);
      onLoaded?.();
    };

    if (modelData) {
      loader.parse(
        modelData,
        "",
        handleSuccess,
        (err) => {
          console.error("Failed to parse 3D model buffer:", err);
          onError?.(err.message || "Failed to parse 3D file");
        }
      );
    } else if (modelUrl) {
      loader.load(
        modelUrl,
        handleSuccess,
        undefined,
        (err) => {
          console.error("Failed to load 3D model URL:", err);
          onError?.(err.message || "Failed to load model from URL");
        }
      );
    }

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
    };
  }, [modelUrl, modelData, camera, controls, onError, onLoaded]);

  return <group ref={groupRef} />;
}

// ── Main 3D Character Viewer Component ────────────────────────────────────────
const Rpg3DCharacterViewer = ({
  user,
  element = "Light",
  initialPresetId = "cyborg_engineer",
  onPresetChange
}) => {
  const elementCfg = ELEMENT_CONFIGS[element] || ELEMENT_CONFIGS.Light;
  const storageKey = `rpg_3d_char_${user?.u_code || "guest"}`;

  // State: Loaded model config
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);
  const [customModelUrl, setCustomModelUrl] = useState("");
  const [customModelData, setCustomModelData] = useState(null);
  const [activeModelName, setActiveModelName] = useState("Cyborg Engineer");
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Controls & Camera View state
  const [autoRotate, setAutoRotate] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const containerRef = useRef(null);
  const [stageReady, setStageReady] = useState(false);

  useEffect(() => {
    setStageReady(true);
  }, []);

  // Modal State for Choosing / Searching 3D Models
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [searchUrlInput, setSearchUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sampleCategory, setSampleCategory] = useState("all");

  const filteredSampleModels = useMemo(() => {
    return SAMPLE_3D_MODELS.filter(m => {
      const matchCat = sampleCategory === "all" || m.category === sampleCategory;
      const matchSearch = !searchQuery || 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [sampleCategory, searchQuery]);

  // Load saved character preferences on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isCustom && parsed.url) {
          const filename = parsed.url.split('/').pop();
          const matchedModel = SAMPLE_3D_MODELS.find(m => m.name === parsed.name || m.url === parsed.url || m.url.endsWith(filename));
          if (matchedModel) {
            setCustomModelUrl(matchedModel.url);
            setActiveModelName(matchedModel.name);
            setIsCustomMode(true);
          } else if (parsed.url.startsWith('blob:') || parsed.url.startsWith('data:')) {
            setCustomModelUrl(parsed.url);
            setActiveModelName(parsed.name || "Custom 3D Model");
            setIsCustomMode(true);
          } else {
            setSelectedPresetId(initialPresetId);
            const found = CHARACTER_PRESETS.find(p => p.id === initialPresetId);
            setActiveModelName(found?.name || "Cyborg Engineer");
            setIsCustomMode(false);
          }
        } else if (parsed.presetId) {
          setSelectedPresetId(parsed.presetId);
          const found = CHARACTER_PRESETS.find(p => p.id === parsed.presetId);
          setActiveModelName(found?.name || "Cyborg Engineer");
          setIsCustomMode(false);
        }
      }
    } catch (e) {
      console.warn("Failed to read 3D character storage:", e);
    }
  }, [storageKey, initialPresetId]);

  const activePreset = useMemo(() => {
    return CHARACTER_PRESETS.find(p => p.id === selectedPresetId) || CHARACTER_PRESETS[0];
  }, [selectedPresetId]);

  // Handle Preset Select
  const handleSelectPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setIsCustomMode(false);
    setCustomModelUrl("");
    setCustomModelData(null);
    setActiveModelName(preset.name);
    onPresetChange?.(preset);

    localStorage.setItem(storageKey, JSON.stringify({
      presetId: preset.id,
      name: preset.name,
      isCustom: false
    }));
    message.success(`Equipped archetype: ${preset.name}`);
    setIsPickerModalOpen(false);
  };

  // Handle Custom URL Load
  const handleLoadCustomUrl = (urlToLoad, name = "Custom GLTF Model") => {
    if (!urlToLoad) {
      message.warning("Please enter a valid 3D model URL (.glb / .gltf)");
      return;
    }
    setLoadingModel(true);
    setCustomModelData(null);
    setCustomModelUrl(urlToLoad);
    setIsCustomMode(true);
    setActiveModelName(name);

    localStorage.setItem(storageKey, JSON.stringify({
      url: urlToLoad,
      name,
      isCustom: true
    }));

    message.loading({ content: "Loading 3D Model...", key: "load_model" });
    setIsPickerModalOpen(false);
  };

  // Handle Local File Upload (.glb/.gltf)
  const handleLocalFileUpload = (file) => {
    const reader = new FileReader();
    setLoadingModel(true);
    message.loading({ content: `Reading ${file.name}...`, key: "load_model" });

    reader.onload = (e) => {
      const buffer = e.target.result;
      setCustomModelUrl("");
      setCustomModelData(buffer);
      setIsCustomMode(true);
      setActiveModelName(file.name);
      setLoadingModel(false);
      message.success({ content: `Loaded 3D file: ${file.name}`, key: "load_model" });
      setIsPickerModalOpen(false);
    };

    reader.onerror = () => {
      setLoadingModel(false);
      message.error({ content: "Failed to read local 3D file.", key: "load_model" });
    };

    reader.readAsArrayBuffer(file);
    return false; // prevent default upload
  };

  const handleResetToDefault = () => {
    handleSelectPreset(CHARACTER_PRESETS[0]);
  };

  const filteredPresets = CHARACTER_PRESETS.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.archetype.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '520px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 35%, #2a3148 0%, #1e2233 100%)',
        border: `1px solid ${elementCfg.color}45`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.22), inset 0 0 40px ${elementCfg.glow}15`
      }}
    >
      {/* ── Top HUD Overlay ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 16,
        right: 16,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none'
      }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag color="black" style={{
            border: `1px solid ${elementCfg.color}`,
            borderRadius: '12px',
            padding: '4px 12px',
            fontSize: '13px',
            fontWeight: 700,
            color: elementCfg.color,
            boxShadow: `0 0 10px ${elementCfg.glow}`
          }}>
            {elementCfg.icon} {elementCfg.name} Core
          </Tag>
          <div style={{
            background: 'rgba(32, 38, 56, 0.88)',
            backdropFilter: 'blur(8px)',
            padding: '4px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.15)'
          }}>
            <Text style={{ color: '#fff', fontSize: '12px', fontWeight: 600 }}>
              {activeModelName}
            </Text>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: '8px' }}>
          <Tooltip title="Search or Upload 3D Models">
            <Button
              type="primary"
              size="small"
              icon={<SearchOutlined />}
              onClick={() => setIsPickerModalOpen(true)}
              style={{
                borderRadius: '8px',
                background: elementCfg.color,
                borderColor: elementCfg.color,
                fontWeight: 600
              }}
            >
              Change 3D Avatar
            </Button>
          </Tooltip>

          <Tooltip title={autoRotate ? "Pause Auto-Rotate" : "Auto-Rotate"}>
            <Button
              size="small"
              icon={<CompassOutlined />}
              onClick={() => setAutoRotate(!autoRotate)}
              style={{
                borderRadius: '8px',
                background: autoRotate ? `${elementCfg.color}22` : 'rgba(255,255,255,0.1)',
                borderColor: autoRotate ? elementCfg.color : 'rgba(255,255,255,0.2)',
                color: autoRotate ? elementCfg.color : '#fff'
              }}
            />
          </Tooltip>
        </div>
      </div>

      {/* ── Bottom Controls ──────────────────────────────────────────────────── */}
      {isCustomMode && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 16,
          zIndex: 10,
          pointerEvents: 'auto'
        }}>
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            onClick={handleResetToDefault}
            style={{
              color: '#ff7875',
              fontSize: '11px',
              background: 'rgba(32, 38, 56, 0.88)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px'
            }}
          >
            Reset Preset
          </Button>
        </div>
      )}

      {/* ── 3D Canvas Viewport ───────────────────────────────────────────────── */}
      <ThreeCanvasErrorBoundary>
        {stageReady && (
          <Canvas
            eventSource={containerRef}
            events={safePointerEvents}
            shadows
            camera={{ position: [0, 0.5, 3.4], fov: 45 }}
            style={{ width: '100%', height: '100%' }}
          >
          <color attach="background" args={['#202638']} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[5, 8, 5]} intensity={1.3} castShadow shadow-mapSize={1024} />
          <directionalLight position={[-5, 4, -5]} intensity={0.5} color={elementCfg.color} />
          <pointLight position={[0, 2, 2]} intensity={0.7} />

          {/* Orbit Controls */}
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            autoRotate={autoRotate}
            autoRotateSpeed={1.2}
            maxPolarAngle={Math.PI / 2 + 0.05}
            minDistance={1.4}
            maxDistance={6.0}
          />

          {/* Elemental Pedestal */}
          <ElementalPedestal elementColor={elementCfg.color} />

          {/* Contact floor shadows */}
          <ContactShadows position={[0, -1.2, 0]} opacity={0.75} scale={4} blur={1.5} far={2.5} />

          {/* Character Rendering */}
          <Suspense fallback={
            <Html center>
              <Spin tip="Summoning 3D Avatar..." />
            </Html>
          }>
            {isCustomMode ? (
              <CustomGlbModel
                modelUrl={customModelUrl}
                modelData={customModelData}
                onError={(err) => {
                  message.error({ content: `Model Error: ${err}`, key: "load_model" });
                  setLoadingModel(false);
                  setIsCustomMode(false);
                }}
                onLoaded={() => {
                  message.success({ content: "3D Character Ready!", key: "load_model" });
                  setLoadingModel(false);
                }}
              />
            ) : (
              <ProceduralCharacterAvatar preset={activePreset} elementColor={elementCfg.color} />
            )}
          </Suspense>
        </Canvas>
        )}
      </ThreeCanvasErrorBoundary>

      {/* ── 3D Model Picker & Search Modal ───────────────────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThunderboltFilled style={{ color: elementCfg.color, fontSize: '18px' }} />
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>Choose or Search 3D Character Model</span>
          </div>
        }
        open={isPickerModalOpen}
        onCancel={() => setIsPickerModalOpen(false)}
        footer={null}
        width={740}
        centered
        styles={{
          content: {
            backgroundColor: '#1a1f2e',
            border: '1px solid #3d4967',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            color: '#f8fafc'
          },
          header: {
            backgroundColor: '#1a1f2e',
            borderBottom: '1px solid #2d354a',
            paddingBottom: '12px'
          },
          body: {
            backgroundColor: '#1a1f2e',
            color: '#f8fafc'
          }
        }}
        closeIcon={<span style={{ color: '#94a3b8', fontSize: '18px' }}>✕</span>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '8px' }}>
          {/* Section 1: Presets Selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Text strong style={{ fontSize: '14px', color: '#f1f5f9' }}>Built-in RPG Character Archetypes</Text>
              <Input
                placeholder="Search archetypes..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: 220,
                  borderRadius: '8px',
                  background: '#242b3e',
                  borderColor: '#3f4b6d',
                  color: '#fff'
                }}
                size="small"
                allowClear
              />
            </div>

            <Row gutter={[12, 12]}>
              {filteredPresets.map((p) => {
                const isSelected = !isCustomMode && selectedPresetId === p.id;
                return (
                  <Col span={12} key={p.id}>
                    <Card
                      hoverable
                      size="small"
                      onClick={() => handleSelectPreset(p)}
                      style={{
                        borderRadius: '12px',
                        border: isSelected ? `2px solid ${elementCfg.color}` : '1px solid #3b4562',
                        background: isSelected ? `${elementCfg.color}25` : '#242b3e',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{
                          fontSize: '28px',
                          width: '46px',
                          height: '46px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${p.color}20`,
                          border: `1px solid ${p.color}40`,
                          flexShrink: 0
                        }}>
                          {p.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ color: '#fff', fontSize: '13px' }}>{p.name}</Text>
                            {isSelected && <CheckCircleFilled style={{ color: elementCfg.color, fontSize: '14px' }} />}
                          </div>
                          <Tag color="geekblue" style={{ fontSize: '10px', padding: '0 4px', margin: '3px 0' }}>
                            {p.tag}
                          </Tag>
                          <Paragraph
                            ellipsis={{ rows: 2 }}
                            style={{ color: '#cbd5e1', fontSize: '11px', margin: 0 }}
                          >
                            {p.description}
                          </Paragraph>
                        </div>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>

          {/* Section 2: Sample 3D GLB Models */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <Space>
                <Text strong style={{ fontSize: '14px', color: '#f1f5f9' }}>
                  Explore 3D GLB Models
                </Text>
                <Tag color="cyan" style={{ borderRadius: '6px', fontSize: '11px', margin: 0 }}>
                  {SAMPLE_3D_MODELS.length} Offline 3D Models
                </Tag>
              </Space>

              <Segmented
                size="small"
                value={sampleCategory}
                onChange={setSampleCategory}
                options={[
                  { label: "All", value: "all" },
                  { label: "🤖 Robots & Mecha", value: "Robots & Mecha" },
                  { label: "🏙️ Vehicles & Scenes", value: "Vehicles & Drones" }
                ]}
                style={{
                  background: '#242b3e',
                  color: '#fff',
                  borderRadius: '8px'
                }}
              />
            </div>

            <div
              className="themed-scrollbar-dark"
              style={{
                maxHeight: '340px',
                overflowY: 'auto',
                paddingRight: '6px'
              }}
            >
              <Row gutter={[10, 10]}>
                {filteredSampleModels.map((m, idx) => (
                  <Col span={8} key={idx}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => handleLoadCustomUrl(m.url, m.name)}
                      style={{
                        borderRadius: '10px',
                        background: '#242b3e',
                        border: '1px solid #3a4563',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '16px' }}>{m.icon || "📦"}</span>
                          <Text strong style={{ color: '#f1f5f9', fontSize: '12px' }}>{m.name}</Text>
                        </div>
                        <Text style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>{m.description}</Text>
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>{m.category}</Tag>
                        <Button size="small" type="primary" ghost style={{ borderRadius: '6px', fontSize: '11px' }}>
                          Load Model
                        </Button>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </div>

          {/* Section 3: Custom URL or Local File Upload */}
          <div style={{
            background: '#222839',
            borderRadius: '12px',
            padding: '16px',
            border: '1px dashed #3d4967'
          }}>
            <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px', color: '#f1f5f9' }}>
              Load Custom 3D Model (.glb / .gltf)
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* URL Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  placeholder="Paste direct .glb / .gltf URL (e.g. ReadyPlayerMe avatar link)"
                  prefix={<LinkOutlined style={{ color: '#94a3b8' }} />}
                  value={searchUrlInput}
                  onChange={(e) => setSearchUrlInput(e.target.value)}
                  style={{
                    borderRadius: '8px',
                    background: '#1a1f2e',
                    borderColor: '#3b4562',
                    color: '#fff'
                  }}
                />
                <Button
                  type="primary"
                  onClick={() => handleLoadCustomUrl(searchUrlInput, "Custom 3D URL Model")}
                  style={{ borderRadius: '8px', background: elementCfg.color, borderColor: elementCfg.color }}
                >
                  Load URL
                </Button>
              </div>

              {/* Local File Upload */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#cbd5e1', fontSize: '12px' }}>
                  Or upload a 3D model file directly from your computer:
                </Text>
                <Upload
                  accept=".glb,.gltf"
                  showUploadList={false}
                  beforeUpload={handleLocalFileUpload}
                >
                  <Button icon={<UploadOutlined />} style={{ borderRadius: '8px', background: '#2a3248', borderColor: '#3f4b6d', color: '#fff' }}>
                    Upload .glb / .gltf
                  </Button>
                </Upload>
              </div>
            </Space>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Rpg3DCharacterViewer;
