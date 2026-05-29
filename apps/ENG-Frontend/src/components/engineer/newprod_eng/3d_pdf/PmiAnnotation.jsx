/**
 * PmiAnnotation — 3D PMI (Product Manufacturing Information) Overlay
 * 
 * Renders GD&T symbols, dimensions, tolerances, surface finish markers
 * as screen-space annotations anchored to 3D coordinates using drei's <Html>.
 */
import React from 'react';
import { Html } from '@react-three/drei';

const PMI_TYPE_ICONS = {
  dimension: '⟷',
  tolerance: '⊕',
  datum: '▲',
  surface_finish: '√',
  parameter: '◇',
  text: '📝',
  welding: '⚡',
  flag: '🚩',
  annotation: '📌'
};

export default function PmiAnnotation({ annotation, visible = true }) {
  if (!visible || !annotation) return null;

  const {
    type = 'annotation',
    text = '',
    name = '',
    position = { x: 0, y: 0, z: 0 }
  } = annotation;

  const icon = PMI_TYPE_ICONS[type] || PMI_TYPE_ICONS.annotation;
  const displayText = text || name;

  return (
    <group position={[position.x, position.y, position.z]}>
      <Html
        distanceFactor={8}
        zIndexRange={[100, 0]}
        className="pmi-annotation"
        occlude={false}
        sprite
      >
        <div className={`pmi-bubble ${type}`} title={name}>
          <span className="pmi-icon">{icon}</span>
          <span className="pmi-text">{displayText}</span>
          <div className="pmi-leader-line" />
        </div>
      </Html>
    </group>
  );
}
