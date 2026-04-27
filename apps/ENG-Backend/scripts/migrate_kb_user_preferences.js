const { engPool } = require('../instance/eng_db');

const sql = `
ALTER TABLE m_user_profile 
DROP COLUMN IF EXISTS kanban_tab_order, 
DROP COLUMN IF EXISTS board_tab_orders, 
DROP COLUMN IF EXISTS cf_group_preferences, 
DROP COLUMN IF EXISTS board_groups, 
DROP COLUMN IF EXISTS active_board_group;

CREATE TABLE IF NOT EXISTS kb_user_preferences (
    u_code VARCHAR(50) PRIMARY KEY, 
    kanban_tab_order JSONB, 
    board_tab_orders JSONB, 
    cf_group_preferences JSONB, 
    board_groups JSONB, 
    active_board_group JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

engPool.query(sql).then(() => { 
    console.log('Done creating table kb_user_preferences and dropping columns.'); 
    process.exit(0); 
}).catch(e => { 
    console.error(e); 
    process.exit(1); 
});
