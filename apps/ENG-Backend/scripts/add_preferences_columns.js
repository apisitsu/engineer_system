const { engPool } = require('../instance/eng_db');
engPool.query(`
    ALTER TABLE m_user_profile 
    ADD COLUMN IF NOT EXISTS kanban_tab_order JSONB, 
    ADD COLUMN IF NOT EXISTS board_tab_orders JSONB, 
    ADD COLUMN IF NOT EXISTS cf_group_preferences JSONB, 
    ADD COLUMN IF NOT EXISTS board_groups JSONB, 
    ADD COLUMN IF NOT EXISTS active_board_group JSONB;
`).then(() => {
    console.log('Columns added successfully');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
