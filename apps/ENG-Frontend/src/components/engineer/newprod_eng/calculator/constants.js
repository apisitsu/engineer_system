/**
 * Bushing Configurator Constants
 * Default values derived from technical drawings
 */

export const MODEL_TYPES = {
  BALL: 'ball',
  FLANGE: 'flange_sleeve',
  SLEEVE: 'sleeve'
};

export const DEFAULT_PARAMS = {
  modelType: MODEL_TYPES.BALL,
  width: 12.735,             // B dimension (mm)
  widthTolPlus: 0.025,       
  widthTolMinus: -0.025,     
  outerSphereDia: 17.525,    // SØ outer spherical diameter (mm)
  sphereTolPlus: 0.025,
  sphereTolMinus: -0.025,
  innerBoreDia: 9.405,       // ID inner bore diameter (mm)
  boreTolPlus: 0.025,
  boreTolMinus: -0.025,
  chamferDia: 10.09,         
  chamferDiaTolPlus: 0.10,
  chamferDiaTolMinus: -0.10,
  chamferAngle: 45,          
};

export const DEFAULT_FLANGE_PARAMS = {
  modelType: MODEL_TYPES.FLANGE,
  flangeDia: 22.22,
  flangeThickness: 1.58,
  bodyDia: 12.73,
  bodyLength: 11.09,
  innerBoreDia: 9.563,
  linerSetbackFlange: 1.14,
  linerSetbackEnd: 0.38,
  undercutLength: 1.57,
  undercutDepth: 0.50,
  linerGrooveDepth: 0.50,
  endOuterChamferL: 0.63,
  endOuterChamferD: 0.12,
  flangeInnerChamfer: 0.50,
};

export const DEFAULT_SLEEVE_PARAMS = {
  modelType: MODEL_TYPES.SLEEVE,
  bodyDia: 15.913,
  bodyLength: 12.7,
  innerBoreDia: 12.738,
  linerSetback: 0.38,
  linerGrooveDepth: 0.50,
  endOuterChamferL: 0.63,
  endOuterChamferD: 0.12,
  innerTaperAngle: 15,
};

export const PARAM_LIMITS = {
  width:          { min: 1,    max: 100,  step: 0.001 },
  outerSphereDia: { min: 5,    max: 200,  step: 0.001 },
  innerBoreDia:   { min: 1,    max: 190,  step: 0.001 },
  chamferDia:     { min: 1.1,  max: 195,  step: 0.001 },
  chamferAngle:   { min: 10,   max: 80,   step: 1 },
  tolerance:      { min: -1,   max: 1,    step: 0.001 },
  // Flange/Sleeve limits
  flangeDia:      { min: 5,    max: 200,  step: 0.001 },
  flangeThickness:{ min: 0.1,  max: 50,   step: 0.001 },
  bodyDia:        { min: 2,    max: 190,  step: 0.001 },
  bodyLength:     { min: 1,    max: 200,  step: 0.001 },
  linerSetbackFlange: { min: 0, max: 10, step: 0.01 },
  linerSetbackEnd: { min: 0, max: 10, step: 0.01 },
  linerSetback:   { min: 0,    max: 10,   step: 0.01 },
  undercutLength: { min: 0,    max: 50,   step: 0.01 },
  undercutDepth:  { min: 0,    max: 10,   step: 0.01 },
  linerGrooveDepth:{min: 0,    max: 10,   step: 0.01 },
  endOuterChamferL:{min: 0,    max: 10,   step: 0.01 },
  endOuterChamferD:{min: 0,    max: 10,   step: 0.01 },
  flangeInnerChamfer:{min:0,   max: 10,   step: 0.01 },
  innerTaperAngle:{ min: 0,    max: 45,   step: 1 },
};

export const MATERIALS = [
  { key: 'bronze',         name: 'Bronze (CuSn8)',       density: 8.80, color: '#CD7F32' },
  { key: 'steel',          name: 'Steel (AISI 1045)',    density: 7.85, color: '#71797E' },
  { key: 'stainless',      name: 'Stainless Steel 304',  density: 8.00, color: '#C0C0C0' },
  { key: 'aluminum',       name: 'Aluminum 6061',        density: 2.70, color: '#A8A9AD' },
  { key: 'brass',          name: 'Brass (CuZn39Pb3)',    density: 8.47, color: '#E1C16E' },
  { key: 'ptfe',           name: 'PTFE (Teflon)',        density: 2.20, color: '#F5F5F5' },
  { key: 'nylon',          name: 'Nylon 6/6',            density: 1.14, color: '#F0EAD6' },
  { key: 'titanium',       name: 'Titanium Grade 5',     density: 4.43, color: '#878681' },
];

export const DEFAULT_MATERIAL = 'steel';

export const VIEWER_CONFIG = {
  cameraPosition: [30, 20, 30],
  cameraFov: 45,
  cameraNear: 0.1,
  cameraFar: 1000,
  ambientIntensity: 0.4,
  directionalIntensity: 0.8,
  gridSize: 100,
  gridDivisions: 20,
  latheSegments: 128,
  sphereSegments: 64,
};

export const GDT_SYMBOLS = {
  diameter: 'Ø',
  sphereDiameter: 'SØ',
  plusMinus: '±',
};
