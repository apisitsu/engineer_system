/**
 * CadViewer — 3D CAD Model Viewer with PMI Support
 * 
 * Uses @react-three/fiber + @react-three/drei for Three.js rendering.
 * Loads glTF/glb models, supports STL fallback, and renders PMI annotations.
 */
import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Center,
  Html,
  GradientTexture,
  useProgress
} from '@react-three/drei';
import { Spin } from 'antd';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import PmiAnnotation from './PmiAnnotation';
import ViewerToolbar from './ViewerToolbar';
import './CadViewer.css';

// ============================================================================
// Model Loader Component — Handles glTF, GLB, and STL
// ============================================================================
function ModelLoader({ url, onLoaded, wireframe }) {
  const meshRef = useRef();
  const { camera, scene } = useThree();

  useEffect(() => {
    if (!url) return;

    const ext = url.split('.').pop().toLowerCase();

    if (ext === 'stl') {
      const loader = new STLLoader();
      loader.load(url, (geometry) => {
        geometry.computeVertexNormals();
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
          color: 0x8899aa,
          metalness: 0.6,
          roughness: 0.4,
          wireframe: wireframe || false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (meshRef.current) {
          meshRef.current.clear();
          meshRef.current.add(mesh);
        }

        fitCameraToObject(mesh, camera);
        onLoaded?.({ type: 'stl', mesh });
      });
    } else {
      // glTF/GLB
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        const model = gltf.scene;
        
        if (wireframe) {
          model.traverse((child) => {
            if (child.isMesh) {
              child.material.wireframe = true;
            }
          });
        }

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (meshRef.current) {
          meshRef.current.clear();
          meshRef.current.add(model);
        }

        fitCameraToObject(model, camera);
        onLoaded?.({ type: 'gltf', scene: model });
      });
    }
  }, [url, wireframe, camera, onLoaded]);

  return <group ref={meshRef} />;
}

// ============================================================================
// Viewport Image Fallback — For when no 3D model is available
// ============================================================================
function ViewportImage({ imageUrl }) {
  if (!imageUrl) return null;

  return (
    <Html fullscreen>
      <div className="viewport-image-container">
        <img src={imageUrl} alt="CAD Viewport" className="viewport-image" />
      </div>
    </Html>
  );
}

// ============================================================================
// Camera Fit Helper
// ============================================================================
function fitCameraToObject(object, camera, offset = 1.5) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * offset;

  camera.position.set(
    center.x + cameraDistance * 0.7,
    center.y + cameraDistance * 0.5,
    center.z + cameraDistance * 0.7
  );
  camera.lookAt(center);
  camera.near = cameraDistance / 100;
  camera.far = cameraDistance * 100;
  camera.updateProjectionMatrix();
}

// ============================================================================
// Loading Indicator
// ============================================================================
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="viewer-loading">
        <Spin size="large" />
        <p>{progress.toFixed(0)}% loaded</p>
      </div>
    </Html>
  );
}

// ============================================================================
// Main CadViewer Component
// ============================================================================
export default function CadViewer({
  modelUrl,
  viewportImageUrl,
  pmiData = [],
  onLoaded,
  style
}) {
  const [showPMI, setShowPMI] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [currentView, setCurrentView] = useState('isometric');
  const controlsRef = useRef();
  const canvasRef = useRef();

  const handleModelLoaded = useCallback((data) => {
    setModelLoaded(true);
    onLoaded?.(data);
  }, [onLoaded]);

  const handleViewChange = useCallback((view) => {
    setCurrentView(view);
    // Camera presets are handled by the toolbar component
  }, []);

  const handleScreenshot = useCallback(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `cad_screenshot_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    }
  }, []);

  const hasModel = modelUrl || viewportImageUrl;

  return (
    <div
      className="cad-viewer-wrapper"
      style={style}
      data-model-loaded={modelLoaded ? 'true' : 'false'}
      ref={canvasRef}
    >
      {/* Toolbar */}
      <ViewerToolbar
        showPMI={showPMI}
        onTogglePMI={() => setShowPMI(!showPMI)}
        wireframe={wireframe}
        onToggleWireframe={() => setWireframe(!wireframe)}
        currentView={currentView}
        onViewChange={handleViewChange}
        onScreenshot={handleScreenshot}
        onFitAll={() => controlsRef.current?.reset()}
      />

      {/* Three.js Canvas */}
      {modelUrl ? (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [5, 3, 5], fov: 50, near: 0.1, far: 10000 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          className="cad-canvas"
        >
          {/* Background gradient */}
          <mesh scale={100}>
            <planeGeometry />
            <meshBasicMaterial side={THREE.DoubleSide}>
              <GradientTexture
                stops={[0, 0.5, 1]}
                colors={['#1a1a2e', '#16213e', '#0f3460']}
              />
            </meshBasicMaterial>
          </mesh>

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <directionalLight position={[-5, 5, -5]} intensity={0.3} />
          <pointLight position={[0, 10, 0]} intensity={0.2} />

          <Suspense fallback={<Loader />}>
            {/* Environment for reflections */}
            <Environment preset="studio" />

            {/* Model */}
            <Center>
              <ModelLoader
                url={modelUrl}
                wireframe={wireframe}
                onLoaded={handleModelLoaded}
              />
            </Center>

            {/* Ground shadow */}
            <ContactShadows
              position={[0, -1, 0]}
              opacity={0.4}
              scale={20}
              blur={2}
              far={10}
            />
          </Suspense>

          {/* PMI Annotations */}
          {showPMI && Array.isArray(pmiData) && pmiData.map((annotation) => (
            <PmiAnnotation
              key={annotation.id}
              annotation={annotation}
              visible={annotation.visible !== false}
            />
          ))}

          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.1}
            minDistance={0.5}
            maxDistance={1000}
          />
        </Canvas>
      ) : viewportImageUrl ? (
        /* Fallback: static viewport image from CATIA */
        <div className="viewport-fallback">
          <img src={viewportImageUrl} alt="CAD Viewport" className="viewport-image" />
          {!modelLoaded && (
            <div className="viewport-loading-overlay">
              <Spin size="large" tip="Loading viewport..." />
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="viewer-empty">
          <div className="viewer-empty-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <p>No model loaded</p>
            <span>Submit a CAD job to see the 3D preview here</span>
          </div>
        </div>
      )}
    </div>
  );
}
