// Shared DWG-number display helpers for the MTC tooling pages.

// Rotary-dresser tools are referred to by their DD#### short form
// (4800-42-0226 → DD0226); every other tool shows its raw DWG no.
export const ddForm = (no) => {
  const m = String(no || '').match(/^4800-42-0*(\d+)$/);
  return m ? `DD${m[1].padStart(4, '0')}` : String(no || '');
};
