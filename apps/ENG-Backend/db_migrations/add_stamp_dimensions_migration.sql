-- ============================================================================
-- PDF Hub: Add physical dimension columns to tt_user_stamps
-- Version: 1.0
-- Created: 2026-05-20
-- Description: Adds physical width/height metadata (in mm) for stamps and
--              signatures, enabling accurate mm→point rendering in pdf-lib.
-- ============================================================================

-- Stamp physical dimensions (default 40mm × 40mm — typical Thai company stamp)
ALTER TABLE tt_user_stamps
  ADD COLUMN IF NOT EXISTS stamp_width_mm   NUMERIC(6,2) DEFAULT 40.00,
  ADD COLUMN IF NOT EXISTS stamp_height_mm  NUMERIC(6,2) DEFAULT 40.00;

-- Signature physical dimensions (default 50mm × 20mm — typical signature area)
ALTER TABLE tt_user_stamps
  ADD COLUMN IF NOT EXISTS sig_width_mm     NUMERIC(6,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS sig_height_mm    NUMERIC(6,2) DEFAULT 20.00;

-- Comments for documentation
COMMENT ON COLUMN tt_user_stamps.stamp_width_mm  IS 'Physical width of company stamp in millimeters';
COMMENT ON COLUMN tt_user_stamps.stamp_height_mm IS 'Physical height of company stamp in millimeters';
COMMENT ON COLUMN tt_user_stamps.sig_width_mm    IS 'Physical width of signature in millimeters';
COMMENT ON COLUMN tt_user_stamps.sig_height_mm   IS 'Physical height of signature in millimeters';
