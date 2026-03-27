-- =================================================================
--  Migration: Add all Planka feature tables & columns
--  Run this against the LIVE eng_system database
-- =================================================================

-- ─── 1. m_user_profile: Add preference columns ─────────────────────
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS subscribe_to_own_cards              BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS subscribe_to_card_when_commenting   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS turn_off_recent_card_highlighting   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS enable_favorites_by_default         BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS default_editor_mode                 VARCHAR(10) NOT NULL DEFAULT 'wysiwyg';
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS default_home_view                   VARCHAR(20) NOT NULL DEFAULT 'groupedProjects';
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS default_projects_order              VARCHAR(20) NOT NULL DEFAULT 'byDefault';
-- Additional columns for frontend compatibility
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS is_notification_off                 BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS pref_language                       VARCHAR(10) NOT NULL DEFAULT 'en';

-- ─── 2. kb_board: Add display + background columns ─────────────────
ALTER TABLE kb_board ADD COLUMN IF NOT EXISTS always_display_card_creator  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE kb_board ADD COLUMN IF NOT EXISTS expand_task_lists_by_default BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE kb_board ADD COLUMN IF NOT EXISTS background_type             VARCHAR(20);
ALTER TABLE kb_board ADD COLUMN IF NOT EXISTS background_value            TEXT;

-- ─── 3. kb_task_list: Add hide_completed column ────────────────────
ALTER TABLE kb_task_list ADD COLUMN IF NOT EXISTS hide_completed_tasks BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 4. kb_task: Add linked_card_id ────────────────────────────────
ALTER TABLE kb_task ADD COLUMN IF NOT EXISTS linked_card_id BIGINT REFERENCES kb_card(id) ON DELETE SET NULL;

-- ─── 5. kb_attachment: Add attachment_type + link_data ──────────────
ALTER TABLE kb_attachment ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(10) NOT NULL DEFAULT 'file';
ALTER TABLE kb_attachment ADD COLUMN IF NOT EXISTS link_data      JSONB;

-- ─── 6. kb_action: Add board_id ────────────────────────────────────
ALTER TABLE kb_action ADD COLUMN IF NOT EXISTS board_id BIGINT REFERENCES kb_board(id) ON DELETE SET NULL;

-- ─── 7. kb_notification: Add extra columns ─────────────────────────
ALTER TABLE kb_notification ADD COLUMN IF NOT EXISTS board_id    BIGINT REFERENCES kb_board(id) ON DELETE SET NULL;
ALTER TABLE kb_notification ADD COLUMN IF NOT EXISTS comment_id  BIGINT REFERENCES kb_comment(id) ON DELETE SET NULL;
ALTER TABLE kb_notification ADD COLUMN IF NOT EXISTS notif_data  JSONB;

-- ─── 8. NEW TABLE: kb_board_subscription ───────────────────────────
CREATE TABLE IF NOT EXISTS kb_board_subscription (
    id         BIGSERIAL   PRIMARY KEY,
    board_id   BIGINT      NOT NULL REFERENCES kb_board(id) ON DELETE CASCADE,
    u_code     VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_board_sub ON kb_board_subscription(board_id, u_code);
CREATE INDEX IF NOT EXISTS idx_kb_board_sub_ucode ON kb_board_subscription(u_code);

-- ─── 9. NEW TABLE: kb_uploaded_file ────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_uploaded_file (
    id               BIGSERIAL    PRIMARY KEY,
    type             VARCHAR(30)  NOT NULL DEFAULT 'attachment',
    references_total INT          NOT NULL DEFAULT 0,
    mime_type        VARCHAR(128),
    size             BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 10. NEW TABLE: kb_background_image ────────────────────────────
CREATE TABLE IF NOT EXISTS kb_background_image (
    id               BIGSERIAL   PRIMARY KEY,
    uploaded_file_id BIGINT      NOT NULL REFERENCES kb_uploaded_file(id) ON DELETE CASCADE,
    project_id       BIGINT      NOT NULL REFERENCES kb_project(id) ON DELETE CASCADE,
    extension        VARCHAR(10),
    size             BIGINT      NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_bg_image_project ON kb_background_image(project_id);

-- ─── 11. NEW TABLE: kb_storage_usage ───────────────────────────────
CREATE TABLE IF NOT EXISTS kb_storage_usage (
    id                BIGSERIAL   PRIMARY KEY,
    total             BIGINT      NOT NULL DEFAULT 0,
    user_avatars      BIGINT      NOT NULL DEFAULT 0,
    background_images BIGINT      NOT NULL DEFAULT 0,
    attachments       BIGINT      NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 12. NEW TABLE: kb_notification_service ────────────────────────
CREATE TABLE IF NOT EXISTS kb_notification_service (
    id         BIGSERIAL   PRIMARY KEY,
    u_code     VARCHAR(20) NOT NULL,
    board_id   BIGINT      REFERENCES kb_board(id) ON DELETE CASCADE,
    url        TEXT        NOT NULL,
    format     VARCHAR(10) NOT NULL DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_notif_svc_ucode  ON kb_notification_service(u_code);
CREATE INDEX IF NOT EXISTS idx_kb_notif_svc_board  ON kb_notification_service(board_id);

-- ─── 13. NEW TABLE: kb_base_custom_field_group ─────────────────────
CREATE TABLE IF NOT EXISTS kb_base_custom_field_group (
    id         BIGSERIAL    PRIMARY KEY,
    project_id BIGINT       NOT NULL REFERENCES kb_project(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_bcfg_project ON kb_base_custom_field_group(project_id);

-- ─── 14. NEW TABLE: kb_custom_field_group ──────────────────────────
CREATE TABLE IF NOT EXISTS kb_custom_field_group (
    id                          BIGSERIAL    PRIMARY KEY,
    board_id                    BIGINT       REFERENCES kb_board(id) ON DELETE CASCADE,
    card_id                     BIGINT       REFERENCES kb_card(id) ON DELETE CASCADE,
    base_custom_field_group_id  BIGINT       NOT NULL REFERENCES kb_base_custom_field_group(id) ON DELETE CASCADE,
    position                    FLOAT        NOT NULL DEFAULT 65536,
    name                        VARCHAR(255),
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_cfg_board ON kb_custom_field_group(board_id);
CREATE INDEX IF NOT EXISTS idx_kb_cfg_card  ON kb_custom_field_group(card_id);

-- ─── 15. NEW TABLE: kb_custom_field ────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_custom_field (
    id                          BIGSERIAL    PRIMARY KEY,
    base_custom_field_group_id  BIGINT       REFERENCES kb_base_custom_field_group(id) ON DELETE CASCADE,
    custom_field_group_id       BIGINT       REFERENCES kb_custom_field_group(id) ON DELETE CASCADE,
    position                    FLOAT        NOT NULL DEFAULT 65536,
    name                        VARCHAR(255) NOT NULL,
    show_on_front_of_card       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_cf_base_group ON kb_custom_field(base_custom_field_group_id);
CREATE INDEX IF NOT EXISTS idx_kb_cf_group      ON kb_custom_field(custom_field_group_id);

-- ─── 16. NEW TABLE: kb_custom_field_value ──────────────────────────
CREATE TABLE IF NOT EXISTS kb_custom_field_value (
    id                    BIGSERIAL   PRIMARY KEY,
    card_id               BIGINT      NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    custom_field_group_id BIGINT      REFERENCES kb_custom_field_group(id) ON DELETE CASCADE,
    custom_field_id       BIGINT      NOT NULL REFERENCES kb_custom_field(id) ON DELETE CASCADE,
    content               TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_cfv_card  ON kb_custom_field_value(card_id);
CREATE INDEX IF NOT EXISTS idx_kb_cfv_field ON kb_custom_field_value(custom_field_id);

-- ─── 17. NEW TABLE: kb_webhook ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_webhook (
    id               BIGSERIAL    PRIMARY KEY,
    board_id         BIGINT       REFERENCES kb_board(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    url              TEXT         NOT NULL,
    access_token     VARCHAR(255),
    events           TEXT[]       NOT NULL DEFAULT '{}',
    excluded_events  TEXT[]       NOT NULL DEFAULT '{}',
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_webhook_board ON kb_webhook(board_id);

-- ─── 18. Triggers for new tables ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'kb_uploaded_file','kb_background_image','kb_storage_usage',
    'kb_notification_service',
    'kb_base_custom_field_group','kb_custom_field_group',
    'kb_custom_field','kb_custom_field_value',
    'kb_webhook'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = format('trg_%s_updated_at', tbl)
    ) THEN
      EXECUTE format('
        CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      ', tbl, tbl);
    END IF;
  END LOOP;
END;
$$;

SELECT 'Planka features migration completed successfully' AS status;
