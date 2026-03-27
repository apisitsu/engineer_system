-- Backend DB Schema Migration Script

BEGIN;

-- 1. Project Management -> Project Membership
ALTER TABLE kb_project_manager RENAME TO kb_project_membership;

-- 2. Convert is_owner to role
ALTER TABLE kb_project_membership ADD COLUMN role VARCHAR(20) DEFAULT 'viewer';
UPDATE kb_project_membership SET role = 'owner' WHERE is_owner = TRUE;
UPDATE kb_project_membership SET role = 'editor' WHERE is_owner = FALSE; -- Map legacy non-owners to editors for now
ALTER TABLE kb_project_membership DROP COLUMN is_owner;

-- 3. Boards -> add is_private
ALTER TABLE kb_board ADD COLUMN is_private BOOLEAN DEFAULT FALSE;

-- 4. Cards -> add is_private
ALTER TABLE kb_card ADD COLUMN is_private BOOLEAN DEFAULT FALSE;

-- 5. Card Memberships -> add role
ALTER TABLE kb_card_membership ADD COLUMN role VARCHAR(20) DEFAULT 'editor';

COMMIT;
