const { engPool } = require('./instance/eng_db');

async function injectAdmin() {
    try {
        const users = [
            { id: 9999, code: '99999', name: 'Admin ECR', dept: 'AD', role: 'AD', pos: 'System Administrator' },
            { id: 9998, code: '99998', name: 'ENG User', dept: 'ENG', role: 'ENG', pos: 'Engineer' },
            { id: 9997, code: '99997', name: 'PC User', dept: 'PC', role: 'PC', pos: 'Production Control' },
            { id: 9996, code: '99996', name: 'QA User', dept: 'QA', role: 'QA', pos: 'Quality Assurance' },
            { id: 9995, code: '99995', name: 'QC User', dept: 'QC', role: 'QC', pos: 'Quality Control' },
            { id: 9994, code: '99994', name: 'PD1 User', dept: 'PD1', role: 'PD1', pos: 'Production 1' },
            { id: 9993, code: '99993', name: 'PD2 User', dept: 'PD2', role: 'PD2', pos: 'Production 2' },
            { id: 9992, code: '99992', name: 'MC User', dept: 'MC', role: 'MC', pos: 'Machining' },
            { id: 9991, code: '99991', name: 'MM User', dept: 'MM', role: 'MM', pos: 'Maintenance' },
            { id: 9990, code: '99990', name: 'ENG Manager', dept: 'ENG', role: 'ENG', pos: 'Manager' },
            { id: 9989, code: '99989', name: 'Thai Mgr', dept: 'Top Management', role: 'Thai Manager/Div. Head', pos: 'Thai Manager' },
            { id: 9988, code: '99988', name: 'JP Mgr', dept: 'Top Management', role: 'Japanese Manager', pos: 'Japanese Manager' },
            { id: 9987, code: '99987', name: 'PE User', dept: 'PE', role: 'PE', pos: 'Process Engineer' },
        ];

        for (const u of users) {
            const query = `
                INSERT INTO m_user_profile (
                    id, u_code, u_name, u_department, role, user_group, position, u_authority
                ) VALUES (
                    $1, $2, $3, $4, $5, $4, $6, 1
                )
                ON CONFLICT (id) DO UPDATE SET
                    u_name = EXCLUDED.u_name,
                    u_department = EXCLUDED.u_department,
                    role = EXCLUDED.role,
                    user_group = EXCLUDED.user_group,
                    u_authority = EXCLUDED.u_authority,
                    position = EXCLUDED.position;
            `;
            await engPool.query(query, [u.id, u.code, u.name, u.dept, u.role, u.pos]);
        }
        console.log("All test users injected successfully!");
    } catch (err) {
        console.error("Failed to inject users:", err);
    } finally {
        process.exit(0);
    }
}
injectAdmin();
