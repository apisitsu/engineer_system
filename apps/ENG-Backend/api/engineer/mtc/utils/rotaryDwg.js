'use strict';

/**
 * The rotary diamond dresser (DWG family 4800-42) is known on the shop floor and printed on
 * the SDS by its "DD####" number, which is exactly the 4800-42 suffix:
 *   4800-42-0226  ⇄  DD0226
 *
 * `tooling_partno_map` stores the DD form (engineer-facing) and the SDS PDF prints DD, but
 * the Machine Tool Config family and the factory process plan use the full 4800-42 form, so
 * matching must round-trip. These two helpers convert between the forms; any value that is
 * NOT a full 4800-42 dwg / DD number passes through unchanged (so non-rotary tools and the
 * bare "4800-42" family are untouched).
 */

// 4800-42-0226 → DD0226   (no-op for DD#### or anything else)
const toDD = (v) => {
  const s = String(v == null ? '' : v).trim();
  const m = /^4800-42-0*(\d+)$/.exec(s);
  return m ? `DD${m[1].padStart(4, '0')}` : s;
};

// DD0226 → 4800-42-0226   (no-op for 4800-42-#### or anything else)
const toDwg = (v) => {
  const s = String(v == null ? '' : v).trim();
  const m = /^DD0*(\d+)$/i.exec(s);
  return m ? `4800-42-${m[1].padStart(4, '0')}` : s;
};

module.exports = { toDD, toDwg };
