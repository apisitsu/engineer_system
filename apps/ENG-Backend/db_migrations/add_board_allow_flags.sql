-- Add allow_add_list and allow_add_card flags to kb_board
-- allow_add_list defaults to FALSE (disabled by default)
-- allow_add_card defaults to TRUE (enabled by default)

ALTER TABLE kb_board ADD COLUMN IF NOT EXISTS allow_add_list BOOLEAN DEFAULT FALSE;
ALTER TABLE kb_board ADD COLUMN IF NOT EXISTS allow_add_card BOOLEAN DEFAULT TRUE;
