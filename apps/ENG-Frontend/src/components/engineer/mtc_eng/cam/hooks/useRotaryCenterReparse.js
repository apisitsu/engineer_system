import { useEffect, useRef } from 'react';

// A separately loaded .nc's indexed (A-word) moves pivot about camPlanStore's
// rotary centre, which only reaches the interpreter through
// `camStore.machineOpts()` at parse time. That store must not import the plan
// store back (see camStore.js), so the re-parse when the centre moves is wired
// here — the same shape as `useAutoSimulate`. Only the centre
// needs it: `reverseX` and the A0-face pick move the model, not the toolpath,
// and the viewport already redraws the model for those.
export function useRotaryCenterReparse({ partDatum, gcode, parse }) {
  const rotaryCenterKey = JSON.stringify(partDatum.rotaryCenter ?? null);
  const lastRotaryCenterKey = useRef(rotaryCenterKey);
  useEffect(() => {
    if (rotaryCenterKey === lastRotaryCenterKey.current) return;
    lastRotaryCenterKey.current = rotaryCenterKey;
    if (gcode) parse();
  }, [rotaryCenterKey, gcode, parse]);
}
