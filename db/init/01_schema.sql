-- =================================================================
--  Engineering System: eng_system Database Schema
--  PostgreSQL 15 | Auto-run by Docker on first start
--  Tables: User Profile, PM System, Kanban Board
-- =================================================================

-- ─────────────────────────────────────────────────────────────────
-- SECTION 1: USER PROFILE
-- (m_user ตัวจริงอยู่ใน PostgreSQL legacy port 5432, ตารางนี้เก็บ profile)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS m_user_profile (
    u_code          VARCHAR(20)  PRIMARY KEY,
    u_nickname      VARCHAR(50),
    element         VARCHAR(20),
    theme           VARCHAR(50)  NOT NULL DEFAULT 'lavenderRose',
    profile_img_b64 TEXT,
    description     TEXT,
    atk             INT          NOT NULL DEFAULT 0,
    def             INT          NOT NULL DEFAULT 0,
    hp              INT          NOT NULL DEFAULT 0,
    mp              INT          NOT NULL DEFAULT 0,
    -- Kanban user preferences (Planka parity)
    subscribe_to_own_cards              BOOLEAN      NOT NULL DEFAULT FALSE,
    subscribe_to_card_when_commenting   BOOLEAN      NOT NULL DEFAULT TRUE,
    turn_off_recent_card_highlighting   BOOLEAN      NOT NULL DEFAULT FALSE,
    enable_favorites_by_default         BOOLEAN      NOT NULL DEFAULT TRUE,
    default_editor_mode                 VARCHAR(10)  NOT NULL DEFAULT 'wysiwyg',
    default_home_view                   VARCHAR(20)  NOT NULL DEFAULT 'groupedProjects',
    default_projects_order              VARCHAR(20)  NOT NULL DEFAULT 'byDefault',
    is_notification_off                 BOOLEAN      NOT NULL DEFAULT FALSE,
    pref_language                       VARCHAR(10)  NOT NULL DEFAULT 'en',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- SECTION 2: PROJECT MANAGEMENT (ย้ายจาก SQLite)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_project (
    id              BIGSERIAL    PRIMARY KEY,
    parent_id       BIGINT       REFERENCES pm_project(id) ON DELETE SET NULL,
    owner_u_code    VARCHAR(20)  NOT NULL,
    name            VARCHAR(255) NOT NULL,
    p_type          SMALLINT     NOT NULL DEFAULT 0,
    status          SMALLINT     NOT NULL DEFAULT 1,
    priority        SMALLINT     NOT NULL DEFAULT 2,
    project_group   VARCHAR(50),
    is_private      BOOLEAN      NOT NULL DEFAULT FALSE,
    due_date        TIMESTAMPTZ,
    start_date      TIMESTAMPTZ,
    checked_date    TIMESTAMPTZ,
    finished_date   TIMESTAMPTZ,
    create_date     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_project_owner  ON pm_project(owner_u_code);
CREATE INDEX IF NOT EXISTS idx_pm_project_status ON pm_project(status);
CREATE INDEX IF NOT EXISTS idx_pm_project_group  ON pm_project(project_group);


CREATE TABLE IF NOT EXISTS pm_project_member (
    id          BIGSERIAL   PRIMARY KEY,
    project_id  BIGINT      NOT NULL REFERENCES pm_project(id) ON DELETE CASCADE,
    u_code      VARCHAR(20) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'member',
    added_date  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_pm_proj_member ON pm_project_member(project_id, u_code);
CREATE INDEX IF NOT EXISTS idx_pm_proj_member_ucode ON pm_project_member(u_code);


CREATE TABLE IF NOT EXISTS pm_task (
    id                  BIGSERIAL    PRIMARY KEY,
    project_id          BIGINT       NOT NULL REFERENCES pm_project(id) ON DELETE CASCADE,
    assignee_u_code     VARCHAR(20),
    wait_for_task_id    BIGINT       REFERENCES pm_task(id) ON DELETE SET NULL,
    name                VARCHAR(500) NOT NULL,
    description         TEXT,
    memo                TEXT,
    problem             TEXT,
    solution            TEXT,
    task_type           SMALLINT     NOT NULL DEFAULT 0,
    status              SMALLINT     NOT NULL DEFAULT 1,
    priority            SMALLINT     NOT NULL DEFAULT 2,
    position            FLOAT        NOT NULL DEFAULT 65536,
    wait_status_required SMALLINT,
    due_date            TIMESTAMPTZ,
    start_date          TIMESTAMPTZ,
    checked_date        TIMESTAMPTZ,
    finished_date       TIMESTAMPTZ,
    create_date         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_task_project  ON pm_task(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_task_assignee ON pm_task(assignee_u_code);
CREATE INDEX IF NOT EXISTS idx_pm_task_status   ON pm_task(status);


CREATE TABLE IF NOT EXISTS pm_template (
    id              BIGSERIAL    PRIMARY KEY,
    created_by_code VARCHAR(20),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    project_group   VARCHAR(50),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pm_template_item (
    id                  BIGSERIAL    PRIMARY KEY,
    template_id         BIGINT       NOT NULL REFERENCES pm_template(id) ON DELETE CASCADE,
    wait_for_item_id    BIGINT       REFERENCES pm_template_item(id) ON DELETE SET NULL,
    name                VARCHAR(500) NOT NULL,
    description         TEXT,
    position            FLOAT        NOT NULL DEFAULT 65536,
    priority            SMALLINT     NOT NULL DEFAULT 2
);
CREATE INDEX IF NOT EXISTS idx_pm_tmpl_item ON pm_template_item(template_id);


-- ─────────────────────────────────────────────────────────────────
-- SECTION 3: KANBAN BOARD
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_project (
    id              BIGSERIAL    PRIMARY KEY,
    owner_u_code    VARCHAR(20)  NOT NULL,
    pm_project_id   BIGINT       REFERENCES pm_project(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    background_type VARCHAR(20)  CHECK (background_type IN ('gradient', 'image')),
    background_value VARCHAR(100),
    icon            VARCHAR(50),
    is_hidden       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_project_owner ON kb_project(owner_u_code);


CREATE TABLE IF NOT EXISTS kb_project_manager (
    id          BIGSERIAL   PRIMARY KEY,
    project_id  BIGINT      NOT NULL REFERENCES kb_project(id) ON DELETE CASCADE,
    u_code      VARCHAR(20) NOT NULL,
    is_owner    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_proj_mgr ON kb_project_manager(project_id, u_code);
CREATE INDEX IF NOT EXISTS idx_kb_proj_mgr_ucode ON kb_project_manager(u_code);


CREATE TABLE IF NOT EXISTS kb_project_favorite (
    id          BIGSERIAL   PRIMARY KEY,
    project_id  BIGINT      NOT NULL REFERENCES kb_project(id) ON DELETE CASCADE,
    u_code      VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_proj_fav ON kb_project_favorite(project_id, u_code);
CREATE INDEX IF NOT EXISTS idx_kb_proj_fav_ucode ON kb_project_favorite(u_code);


CREATE TABLE IF NOT EXISTS kb_board (
    id                BIGSERIAL    PRIMARY KEY,
    project_id        BIGINT       NOT NULL REFERENCES kb_project(id) ON DELETE CASCADE,
    position          FLOAT        NOT NULL DEFAULT 65536,
    name              VARCHAR(128) NOT NULL,
    default_view      VARCHAR(20)  NOT NULL DEFAULT 'kanban'
                          CHECK (default_view IN ('kanban', 'grid', 'list')),
    default_card_type VARCHAR(20)  NOT NULL DEFAULT 'task'
                          CHECK (default_card_type IN ('task', 'story')),
    limit_card_types  BOOLEAN      NOT NULL DEFAULT FALSE,
    always_display_card_creator  BOOLEAN NOT NULL DEFAULT FALSE,
    expand_task_lists_by_default BOOLEAN NOT NULL DEFAULT FALSE,
    background_type              VARCHAR(20),
    background_value             TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_board_project  ON kb_board(project_id);
CREATE INDEX IF NOT EXISTS idx_kb_board_position ON kb_board(position);


CREATE TABLE IF NOT EXISTS kb_board_membership (
    id          BIGSERIAL   PRIMARY KEY,
    board_id    BIGINT      NOT NULL REFERENCES kb_board(id) ON DELETE CASCADE,
    project_id  BIGINT      NOT NULL,
    u_code      VARCHAR(20) NOT NULL,
    role        VARCHAR(10) NOT NULL DEFAULT 'editor'
                    CHECK (role IN ('editor', 'viewer')),
    can_comment BOOLEAN,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_board_mbr    ON kb_board_membership(board_id, u_code);
CREATE INDEX IF NOT EXISTS idx_kb_board_mbr_ucode      ON kb_board_membership(u_code);
CREATE INDEX IF NOT EXISTS idx_kb_board_mbr_project    ON kb_board_membership(project_id);


CREATE TABLE IF NOT EXISTS kb_list (
    id          BIGSERIAL   PRIMARY KEY,
    board_id    BIGINT      NOT NULL REFERENCES kb_board(id) ON DELETE CASCADE,
    list_type   VARCHAR(10) NOT NULL DEFAULT 'active'
                    CHECK (list_type IN ('active', 'closed', 'archive', 'trash')),
    position    FLOAT,
    name        VARCHAR(255),
    color       VARCHAR(30),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_list_board    ON kb_list(board_id);
CREATE INDEX IF NOT EXISTS idx_kb_list_type     ON kb_list(list_type);
CREATE INDEX IF NOT EXISTS idx_kb_list_position ON kb_list(position);


CREATE TABLE IF NOT EXISTS kb_card (
    id                  BIGSERIAL     PRIMARY KEY,
    board_id            BIGINT        NOT NULL,
    list_id             BIGINT        NOT NULL REFERENCES kb_list(id) ON DELETE CASCADE,
    creator_u_code      VARCHAR(20),
    prev_list_id        BIGINT        REFERENCES kb_list(id),
    cover_attachment_id BIGINT,
    card_type           VARCHAR(10)   NOT NULL DEFAULT 'task'
                            CHECK (card_type IN ('task', 'story')),
    position            FLOAT,
    name                VARCHAR(1024) NOT NULL,
    description         TEXT,
    due_date            TIMESTAMPTZ,
    is_due_completed    BOOLEAN,
    stopwatch           JSONB,
    comments_count      INT           NOT NULL DEFAULT 0,
    is_closed           BOOLEAN       NOT NULL DEFAULT FALSE,
    list_changed_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_card_board    ON kb_card(board_id);
CREATE INDEX IF NOT EXISTS idx_kb_card_list     ON kb_card(list_id);
CREATE INDEX IF NOT EXISTS idx_kb_card_creator  ON kb_card(creator_u_code);
CREATE INDEX IF NOT EXISTS idx_kb_card_position ON kb_card(position);


CREATE TABLE IF NOT EXISTS kb_card_membership (
    id          BIGSERIAL   PRIMARY KEY,
    card_id     BIGINT      NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    u_code      VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_card_mbr   ON kb_card_membership(card_id, u_code);
CREATE INDEX IF NOT EXISTS idx_kb_card_mbr_ucode     ON kb_card_membership(u_code);


CREATE TABLE IF NOT EXISTS kb_card_subscription (
    id           BIGSERIAL   PRIMARY KEY,
    card_id      BIGINT      NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    u_code       VARCHAR(20) NOT NULL,
    is_permanent BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_card_sub  ON kb_card_subscription(card_id, u_code);
CREATE INDEX IF NOT EXISTS idx_kb_card_sub_ucode    ON kb_card_subscription(u_code);


CREATE TABLE IF NOT EXISTS kb_label (
    id          BIGSERIAL   PRIMARY KEY,
    board_id    BIGINT      NOT NULL REFERENCES kb_board(id) ON DELETE CASCADE,
    position    FLOAT       NOT NULL DEFAULT 65536,
    name        VARCHAR(128),
    color       VARCHAR(30) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_label_board ON kb_label(board_id);


CREATE TABLE IF NOT EXISTS kb_card_label (
    id          BIGSERIAL   PRIMARY KEY,
    card_id     BIGINT      NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    label_id    BIGINT      NOT NULL REFERENCES kb_label(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_card_label   ON kb_card_label(card_id, label_id);
CREATE INDEX IF NOT EXISTS idx_kb_card_label_label     ON kb_card_label(label_id);


CREATE TABLE IF NOT EXISTS kb_task_list (
    id            BIGSERIAL    PRIMARY KEY,
    card_id       BIGINT       NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    position      FLOAT        NOT NULL DEFAULT 65536,
    name          VARCHAR(255) NOT NULL,
    show_on_front BOOLEAN      NOT NULL DEFAULT FALSE,
    hide_completed_tasks BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_task_list_card ON kb_task_list(card_id);


CREATE TABLE IF NOT EXISTS kb_task (
    id              BIGSERIAL    PRIMARY KEY,
    task_list_id    BIGINT       NOT NULL REFERENCES kb_task_list(id) ON DELETE CASCADE,
    assignee_u_code VARCHAR(20),
    linked_card_id  BIGINT       REFERENCES kb_card(id) ON DELETE SET NULL,
    position        FLOAT        NOT NULL DEFAULT 65536,
    name            VARCHAR(255) NOT NULL,
    is_completed    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_task_list     ON kb_task(task_list_id);
CREATE INDEX IF NOT EXISTS idx_kb_task_assignee ON kb_task(assignee_u_code);


CREATE TABLE IF NOT EXISTS kb_comment (
    id          BIGSERIAL   PRIMARY KEY,
    card_id     BIGINT      NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    u_code      VARCHAR(20),
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_comment_card  ON kb_comment(card_id);
CREATE INDEX IF NOT EXISTS idx_kb_comment_ucode ON kb_comment(u_code);


CREATE TABLE IF NOT EXISTS kb_attachment (
    id              BIGSERIAL    PRIMARY KEY,
    card_id         BIGINT       NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    creator_u_code  VARCHAR(20),
    attachment_type  VARCHAR(10)  NOT NULL DEFAULT 'file'
                        CHECK (attachment_type IN ('file', 'link')),
    file_name       VARCHAR(255) NOT NULL,
    file_path       TEXT         NOT NULL,
    file_size       BIGINT       NOT NULL DEFAULT 0,
    mime_type       VARCHAR(128),
    is_image        BOOLEAN      NOT NULL DEFAULT FALSE,
    thumbnail_path  TEXT,
    link_data       JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_attachment_card ON kb_attachment(card_id);

-- FK back to attachment (after table exists)
ALTER TABLE kb_card ADD CONSTRAINT fk_kb_card_cover
    FOREIGN KEY (cover_attachment_id) REFERENCES kb_attachment(id) ON DELETE SET NULL;


CREATE TABLE IF NOT EXISTS kb_action (
    id          BIGSERIAL   PRIMARY KEY,
    card_id     BIGINT      NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
    board_id    BIGINT      REFERENCES kb_board(id) ON DELETE SET NULL,
    u_code      VARCHAR(20),
    action_type VARCHAR(50) NOT NULL,
    action_data JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_action_card ON kb_action(card_id);
CREATE INDEX IF NOT EXISTS idx_kb_action_type ON kb_action(action_type);


CREATE TABLE IF NOT EXISTS kb_board_subscription (
    id         BIGSERIAL   PRIMARY KEY,
    board_id   BIGINT      NOT NULL REFERENCES kb_board(id) ON DELETE CASCADE,
    u_code     VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_kb_board_sub ON kb_board_subscription(board_id, u_code);
CREATE INDEX IF NOT EXISTS idx_kb_board_sub_ucode ON kb_board_subscription(u_code);


CREATE TABLE IF NOT EXISTS kb_notification (
    id                  BIGSERIAL   PRIMARY KEY,
    recipient_u_code    VARCHAR(20) NOT NULL,
    actor_u_code        VARCHAR(20),
    card_id             BIGINT      REFERENCES kb_card(id) ON DELETE CASCADE,
    board_id            BIGINT      REFERENCES kb_board(id) ON DELETE SET NULL,
    comment_id          BIGINT      REFERENCES kb_comment(id) ON DELETE SET NULL,
    action_id           BIGINT      REFERENCES kb_action(id) ON DELETE CASCADE,
    notif_type          VARCHAR(50) NOT NULL,
    notif_data          JSONB,
    is_read             BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_notif_recipient ON kb_notification(recipient_u_code);
CREATE INDEX IF NOT EXISTS idx_kb_notif_read      ON kb_notification(is_read);
CREATE INDEX IF NOT EXISTS idx_kb_notif_card      ON kb_notification(card_id);


-- ─────────────────────────────────────────────────────────────────
-- SECTION: FILE UPLOAD & BACKGROUND IMAGE (Feature 10)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_uploaded_file (
    id               BIGSERIAL    PRIMARY KEY,
    type             VARCHAR(30)  NOT NULL DEFAULT 'attachment'
                        CHECK (type IN ('userAvatar', 'backgroundImage', 'attachment')),
    references_total INT          NOT NULL DEFAULT 0,
    mime_type        VARCHAR(128),
    size             BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS kb_storage_usage (
    id                BIGSERIAL   PRIMARY KEY,
    total             BIGINT      NOT NULL DEFAULT 0,
    user_avatars      BIGINT      NOT NULL DEFAULT 0,
    background_images BIGINT      NOT NULL DEFAULT 0,
    attachments       BIGINT      NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- SECTION: NOTIFICATION SERVICE (Feature 11)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_notification_service (
    id         BIGSERIAL   PRIMARY KEY,
    u_code     VARCHAR(20) NOT NULL,
    board_id   BIGINT      REFERENCES kb_board(id) ON DELETE CASCADE,
    url        TEXT        NOT NULL,
    format     VARCHAR(10) NOT NULL DEFAULT 'text'
                   CHECK (format IN ('text', 'markdown', 'html')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_notif_svc_ucode  ON kb_notification_service(u_code);
CREATE INDEX IF NOT EXISTS idx_kb_notif_svc_board  ON kb_notification_service(board_id);


-- ─────────────────────────────────────────────────────────────────
-- SECTION: CUSTOM FIELDS SYSTEM (Feature 12)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_base_custom_field_group (
    id         BIGSERIAL    PRIMARY KEY,
    project_id BIGINT       NOT NULL REFERENCES kb_project(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_bcfg_project ON kb_base_custom_field_group(project_id);

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


-- ─────────────────────────────────────────────────────────────────
-- SECTION: WEBHOOK INTEGRATION (Feature 13)
-- ─────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────
-- TRIGGERS: auto updated_at
-- ─────────────────────────────────────────────────────────────────
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
    'm_user_profile','pm_project','pm_task',
    'kb_project','kb_board','kb_board_membership',
    'kb_list','kb_card','kb_label','kb_task_list','kb_task',
    'kb_comment','kb_attachment',
    'kb_uploaded_file','kb_background_image','kb_storage_usage',
    'kb_notification_service',
    'kb_base_custom_field_group','kb_custom_field_group',
    'kb_custom_field','kb_custom_field_value',
    'kb_webhook'
  ] LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', tbl, tbl);
  END LOOP;
END;
$$;

-- Done
SELECT 'eng_system schema initialized successfully' AS status;

