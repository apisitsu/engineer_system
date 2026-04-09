import React from 'react';
import { Line, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { MODEL_TYPES } from '../../constants';

const ARROW_SIZE = 1.2;
const LINE_COLOR = '#00ff88';

function DimensionLine({ start, end, label, offset = [0, 0, 0], color = LINE_COLOR }) {
  const midPoint = [(start[0] + end[0]) / 2 + offset[0], (start[1] + end[1]) / 2 + offset[1], (start[2] + end[2]) / 2 + offset[2]];
  const direction = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  direction.normalize();

  const arrowStart1 = [
    start[0] + direction.x * ARROW_SIZE + offset[0] * 0.1,
    start[1] + direction.y * ARROW_SIZE + offset[1] * 0.1,
    start[2] + direction.z * ARROW_SIZE + offset[2] * 0.1,
  ];
  const arrowEnd1 = [
    end[0] - direction.x * ARROW_SIZE + offset[0] * 0.1,
    end[1] - direction.y * ARROW_SIZE + offset[1] * 0.1,
    end[2] - direction.z * ARROW_SIZE + offset[2] * 0.1,
  ];

  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={1.5} transparent opacity={0.8} />
      <Line points={[start, arrowStart1]} color={color} lineWidth={2} />
      <Line points={[end, arrowEnd1]} color={color} lineWidth={2} />
      <Html position={midPoint} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.85)', color: color, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, border: `1px solid ${color}4d`, backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function ExtensionLine({ points, color = 'rgba(0,255,136,0.3)' }) {
  return <Line points={points} color={color} lineWidth={0.8} transparent opacity={0.5} dashed dashSize={1} dashScale={2} />;
}

export default function DimensionLines({ params }) {
  
  if (params.modelType === MODEL_TYPES.FLANGE) {
    const { flangeDia, flangeThickness, bodyDia, bodyLength, innerBoreDia } = params;
    const rFlange = flangeDia / 2;
    const rBody = bodyDia / 2;
    const rBore = innerBoreDia / 2;
    const totalL = flangeThickness + bodyLength;
    const topY = totalL / 2;
    const botY = -totalL / 2;

    return (
      <group>
        {/* TOTAL LENGTH (Virtual B) */}
        <DimensionLine
          start={[rFlange + 4, botY, 0]}
          end={[rFlange + 4, topY, 0]}
          label={`${totalL.toFixed(3)} mm`}
          offset={[3, 0, 0]}
        />
        <ExtensionLine points={[[rFlange + 1, botY, 0], [rFlange + 8, botY, 0]]} />
        <ExtensionLine points={[[rFlange + 1, topY, 0], [rFlange + 8, topY, 0]]} />

        {/* FLANGE THICKNESS */}
        <DimensionLine
          start={[rFlange + 4, topY - flangeThickness, 0]}
          end={[rFlange + 4, topY, 0]}
          label={`${flangeThickness.toFixed(2)}`}
          offset={[10, 0, 0]}
          color="#ffb366"
        />
        <ExtensionLine points={[[rFlange + 1, topY - flangeThickness, 0], [rFlange + 14, topY - flangeThickness, 0]]} color="#ffb366" />

        {/* FLANGE OD */}
        <DimensionLine
          start={[-rFlange, topY + 4, 0]} end={[rFlange, topY + 4, 0]}
          label={`Ø ${flangeDia.toFixed(3)}`} offset={[0, 2, 0]} color="#ff6b9d"
        />
        <ExtensionLine points={[[-rFlange, topY + 1, 0], [-rFlange, topY + 6, 0]]} />
        <ExtensionLine points={[[rFlange, topY + 1, 0], [rFlange, topY + 6, 0]]} />

        {/* BODY OD */}
        <DimensionLine
          start={[-rBody, botY - 4, 0]} end={[rBody, botY - 4, 0]}
          label={`Ø ${bodyDia.toFixed(3)}`} offset={[0, -2, 0]} color="#b388ff"
        />
        <ExtensionLine points={[[-rBody, botY - 1, 0], [-rBody, botY - 6, 0]]} />
        <ExtensionLine points={[[rBody, botY - 1, 0], [rBody, botY - 6, 0]]} />

        {/* INNER BORE ID */}
        <DimensionLine
          start={[-rBore, botY - 8, 0]} end={[rBore, botY - 8, 0]}
          label={`ID Ø ${innerBoreDia.toFixed(3)}`} offset={[0, -2, 0]} color="#6bb3ff"
        />
        <ExtensionLine points={[[-rBore, botY, 0], [-rBore, botY - 10, 0]]} />
        <ExtensionLine points={[[rBore, botY, 0], [rBore, botY - 10, 0]]} />

        <Line points={[[0, botY - 12, 0], [0, topY + 10, 0]]} color="rgba(255,255,255,0.15)" lineWidth={0.5} dashed dashSize={2} dashScale={3} />
      </group>
    );
  } // <--- This was the missing brace for FLANGE!

  if (params.modelType === MODEL_TYPES.SLEEVE) {
    const rBody = params.bodyDia / 2;
    const rBore = params.innerBoreDia / 2;
    const topY = params.bodyLength / 2;
    const botY = -params.bodyLength / 2;

    return (
      <group>
        {/* TOTAL LENGTH */}
        <DimensionLine
          start={[rBody + 4, botY, 0]}
          end={[rBody + 4, topY, 0]}
          label={`${params.bodyLength.toFixed(3)} mm`}
          offset={[3, 0, 0]}
        />
        <ExtensionLine points={[[rBody + 1, botY, 0], [rBody + 8, botY, 0]]} />
        <ExtensionLine points={[[rBody + 1, topY, 0], [rBody + 8, topY, 0]]} />

        {/* BODY OD */}
        <DimensionLine
          start={[-rBody, topY + 4, 0]} end={[rBody, topY + 4, 0]}
          label={`Ø ${params.bodyDia.toFixed(3)}`} offset={[0, 2, 0]} color="#b388ff"
        />
        <ExtensionLine points={[[-rBody, topY + 1, 0], [-rBody, topY + 6, 0]]} />
        <ExtensionLine points={[[rBody, topY + 1, 0], [rBody, topY + 6, 0]]} />

        {/* INNER BORE ID */}
        <DimensionLine
          start={[-rBore, botY - 8, 0]} end={[rBore, botY - 8, 0]}
          label={`ID Ø ${params.innerBoreDia.toFixed(3)}`} offset={[0, -2, 0]} color="#6bb3ff"
        />
        <ExtensionLine points={[[-rBore, botY, 0], [-rBore, botY - 10, 0]]} />
        <ExtensionLine points={[[rBore, botY, 0], [rBore, botY - 10, 0]]} />

        <Line points={[[0, botY - 12, 0], [0, topY + 10, 0]]} color="rgba(255,255,255,0.15)" lineWidth={0.5} dashed dashSize={2} dashScale={3} />
      </group>
    );
  }

  // --- BALL DIMENSIONS ---
  const { width, outerSphereDia, innerBoreDia, chamferDia } = params;
  const R = outerSphereDia / 2;
  const r_bore = innerBoreDia / 2;
  const halfW = width / 2;
  const r_cut = Math.sqrt(Math.max(0, R * R - halfW * halfW));

  return (
    <group>
      <DimensionLine
        start={[r_cut + 4, -halfW, 0]} end={[r_cut + 4, halfW, 0]}
        label={`${width.toFixed(3)} mm`} offset={[3, 0, 0]}
      />
      <ExtensionLine points={[[r_cut + 1, -halfW, 0], [r_cut + 8, -halfW, 0]]} />
      <ExtensionLine points={[[r_cut + 1, halfW, 0], [r_cut + 8, halfW, 0]]} />

      <DimensionLine
        start={[R + 6, -R/2, 0]} end={[R + 6, R/2, 0]}
        label={`SØ ${outerSphereDia.toFixed(3)} mm`} offset={[4, 0, 0]} color="#ff6b9d"
      />
      
      <DimensionLine
        start={[-r_bore, -halfW - 5, 0]} end={[r_bore, -halfW - 5, 0]}
        label={`Ø ${innerBoreDia.toFixed(3)} mm`} offset={[0, -2, 0]} color="#6bb3ff"
      />
      <ExtensionLine points={[[-r_bore, -halfW, 0], [-r_bore, -halfW - 7, 0]]} />
      <ExtensionLine points={[[r_bore, -halfW, 0], [r_bore, -halfW - 7, 0]]} />

      <DimensionLine
        start={[-chamferDia/2, halfW + 6, 0]} end={[chamferDia/2, halfW + 6, 0]}
        label={`2× Ø ${chamferDia.toFixed(2)}`} offset={[0, 2, 0]} color="#ffd93d"
      />
      <ExtensionLine points={[[-chamferDia/2, halfW, 0], [-chamferDia/2, halfW + 8, 0]]} />
      <ExtensionLine points={[[chamferDia/2, halfW, 0], [chamferDia/2, halfW + 8, 0]]} />

      <Line points={[[0, -R - 5, 0], [0, R + 5, 0]]} color="rgba(255,255,255,0.15)" lineWidth={0.5} dashed dashSize={2} dashScale={3} />
    </group>
  );
}
