const { engPool } = require('d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/instance/eng_db');

const sql = `
-- 1. สร้างตาราง kb_system_settings
CREATE TABLE IF NOT EXISTS kb_system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    setting_value TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('boolean', 'number', 'string')),
    description TEXT
);

-- 2. Insert ค่าเริ่มต้นตามผลการ Audit
INSERT INTO kb_system_settings (setting_key, category, setting_value, value_type, description) VALUES
-- Storage
('enable_google_drive_sync', 'storage', 'true', 'boolean', 'Toggles whether file uploads go to Google Drive via GAS or local storage.'),
('max_attachment_mb', 'storage', '50', 'number', 'Maximum file size in MB allowed for attachments.'),
('max_attachments_per_card', 'storage', '20', 'number', 'Maximum number of attachments allowed on a single card.'),
-- Features
('enable_time_tracking', 'features', 'true', 'boolean', 'Enables the stopwatch and estimated hours features on cards.'),
('enable_task_dependencies', 'features', 'true', 'boolean', 'Enables Parent/Child task locking and logic.'),
('enable_card_priorities', 'features', 'true', 'boolean', 'Enables the priority system on cards.'),
('enable_cover_images', 'features', 'true', 'boolean', 'Allows users to set backgrounds for boards and cover images for cards.'),
('enable_email_notifications', 'features', 'true', 'boolean', 'Global toggle to enable/disable automated email notifications.'),
-- Limits
('allow_permanent_projects', 'limits', 'true', 'boolean', 'Allows managers to create non-closable Permanent Projects.'),
('max_boards_per_project', 'limits', '10', 'number', 'Restricts the maximum number of boards allowed within a single project.'),
('max_lists_per_board', 'limits', '15', 'number', 'Restricts how many lists a board can have.'),
('activity_log_limit_ui', 'limits', '50', 'number', 'The number of recent actions to fetch and display per card.'),
('report_log_limit_ui', 'limits', '500', 'number', 'The number of actions fetched during report generation.')
ON CONFLICT (setting_key) DO NOTHING;
`;

async function main() {
    try {
        await engPool.query(sql);
        console.log("SQL executed successfully!");
    } catch (e) {
        console.error(e);
    } finally {
        engPool.end();
    }
}

main();

