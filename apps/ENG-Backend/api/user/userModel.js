const { pool } = require("../../instance/instance");
const { engPool } = require('../../instance/eng_db');
const bcrypt = require('bcryptjs');

const GetUserByEmpno = async (empno) => {
    try {
        const result = await engPool.query("SELECT * FROM m_user_profile WHERE u_code = $1", [empno]);
        // Handle renaming column for backwards compatibility
        if (result.rows[0]) {
            result.rows[0].profile_img_base64 = result.rows[0].profile_img_b64;
        }
        return result.rows[0];
    } catch (err) {
        console.error("PostgreSQL Error mapping (GetUserByEmpno):", err.message);
        throw err;
    }
};

const LoginUser = async (req, res) => {
    console.log('📥 รับค่าจาก User Login:', req.body);
    const { empno, password } = req.body;

    const failResponse = {
        result: 'false',
        name: '',
        auth: '',
        role: '',
        message: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง',
        userInfo: {},
    };

    try {
        let pgResult = null;
        if (empno === "admin" || empno.slice(-5) === "admin" || empno.slice(-3) === "mgr" || empno.slice(-4) === "user") {
            console.log("Admin login");
            pgResult = await engPool.query('SELECT * FROM m_user_profile WHERE u_code = $1', [empno]);
        } else {
            pgResult = await pool.query('SELECT * FROM m_user WHERE u_code = $1', [empno]);
        }
        const user = pgResult.rows[0];

        if (!user || !user.u_pass) {
            console.log("❌ ไม่พบ User ในระบบ PostgreSQL");
            return res.json(failResponse);
        }

        // 3. ตรวจสอบรหัสผ่าน
        // (รองรับ Hash เก่าของ PHP ที่ใช้ $2y$)
        const correctedHash = user.u_pass.replace("$2y$", "$2a$");
        const isMatch = await bcrypt.compare(password, correctedHash);

        if (isMatch) {
            let userInfo = null;
            try {
                const last_five = empno.slice(-5).toUpperCase();
                console.log(last_five)
                userInfo = await GetUserByEmpno(empno);
            } catch (pgErr) {
                console.warn("⚠️ ดึงข้อมูล PostgreSQL (profile) ไม่สำเร็จ แต่ให้ Login ต่อได้:", pgErr.message);
            }
            // console.log(userInfo)

            console.log('✅ Login สำเร็จ. ข้อมูล profile:', userInfo ? 'Found' : 'Not Found');

            const { generateToken } = require('../../middleware/auth');

            // Merge profile fields so generateToken assigns department and group
            const tokenPayload = {
                ...user,
                u_department: userInfo?.u_department || null,
                user_group: userInfo?.user_group || null,
                u_role: userInfo?.role || user.u_role || 'ENG', // Prefer role from profile if set
                perms: userInfo?.feature_perms || [] // granular feature permissions → JWT
            };

            const tokenData = generateToken(tokenPayload);

            const successResponse = {
                result: 'true',
                name: tokenPayload.u_name,
                auth: tokenPayload.u_authority,
                group: tokenPayload.user_group,
                role: tokenPayload.u_role,
                department: tokenPayload.u_department,
                perms: userInfo?.feature_perms || [],
                secondauth: user.permission_set,
                message: 'เข้าสู่ระบบสำเร็จ',
                userInfo: userInfo || {},
                token: tokenData.token,
                expiresAt: tokenData.expiresAt
            };

            return res.json(successResponse);

        } else {
            console.log("❌ รหัสผ่านไม่ถูกต้อง");
            return res.json(failResponse);
        }

    } catch (error) {
        console.error('💥 เกิดข้อผิดพลาดร้ายแรง:', error);
        return res.json({
            ...failResponse,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสพนักงาน (Internal Server Error)'
        });
    }
}

const GetUsersOrganization = async (req, res) => {
    try {
        const result = await engPool.query("SELECT * FROM m_user_profile");
        const formattedData = result.rows.map(row => {
            return {
                id: row.u_code, // u_code is PK now
                name: `${row.u_name || ''} (${row.u_nickname || '-'})`,
                position: row.position, // Mapping role -> position since we dropped legacy position in sqlite
                role: row.role,
                group: row.user_group,
                element: row.element,

                stats: {
                    atk: row.atk || 0,
                    def: row.def || 0,
                    hp: row.hp || 0,
                    mp: row.mp || 0
                },

                img: row.profile_img_b64 || "",
                desc: row.description || ""
            };
        });
        res.json(formattedData);
    } catch (err) {
        console.error("Error in GetUsersOrganization:", err.message);
        res.status(400).json({ "error": err.message });
    }
};

const GetUserAlldata = async (req, res) => {
    try {
        const result = await engPool.query("SELECT *, u_code as user_empid, u_nickname as u_nick, profile_img_b64 as profile_img_base64 FROM m_user_profile WHERE section = 1");
        res.json({
            result: 'true',
            data: result.rows
        });
    } catch (err) {
        console.error("Error in GetUserAlldata:", err.message);
        res.status(500).json({ "error": err.message });
    }
}

const GetAllUsers = async (req, res) => {
    try {
        const { type } = req.query;

        switch (type) {
            case "ORG":
                return GetUsersOrganization(req, res);
            default:
            case "ALL":
                return GetUserAlldata(req, res);
        }
    }
    catch (error) {
        console.log("💥 Error in GetAllUsers : " + error.message)
        return res.json({
            result: 'false',
            message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสพนักงาน (Internal Server Error)'
        });
    }
}

const UpdateUserTheme = async (req, res) => {
    const { empno, theme } = req.body;

    if (!empno || !theme) {
        return res.status(400).json({
            result: 'false',
            message: 'Employee number and theme are required'
        });
    }

    try {
        const sql = "UPDATE m_user_profile SET theme = $1 WHERE u_code = $2";
        const result = await engPool.query(sql, [theme, empno]);

        if (result.rowCount === 0) {
            return res.json({
                result: 'false',
                message: 'User profile not found or no changes made'
            });
        }

        res.json({
            result: 'true',
            message: 'Theme updated successfully'
        });
    } catch (err) {
        console.error("PostgreSQL Error:", err.message);
        return res.status(500).json({
            result: 'false',
            message: 'Database error: ' + err.message
        });
    }
};

const UpdateUserProfile = async (req, res) => {
    const { empno, u_nickname, element, theme, profile_img_base64 } = req.body;

    if (!empno) {
        return res.status(400).json({
            result: 'false',
            message: 'Employee number is required'
        });
    }

    try {
        const checkSql = "SELECT * FROM m_user_profile WHERE u_code = $1";
        const result = await engPool.query(checkSql, [empno]);

        if (result.rows.length > 0) {
            // Update existing
            const updateSql = `
                UPDATE m_user_profile 
                SET u_nickname = $1, element = $2, theme = $3, profile_img_b64 = $4, updated_at = NOW()
                WHERE u_code = $5
            `;
            const params = [u_nickname, element, theme, profile_img_base64, empno];
            await engPool.query(updateSql, params);
            res.json({ result: 'true', message: 'Profile updated successfully' });
        } else {
            // Insert new
            const insertSql = `
                INSERT INTO m_user_profile (u_code, u_nickname, element, theme, profile_img_b64)
                VALUES ($1, $2, $3, $4, $5)
            `;
            const params = [empno, u_nickname, element, theme, profile_img_base64];
            await engPool.query(insertSql, params);
            res.json({ result: 'true', message: 'Profile created successfully' });
        }
    } catch (err) {
        console.error("PostgreSQL Error:", err.message);
        return res.status(500).json({ result: 'false', message: 'Database error: ' + err.message });
    }
};

const GetUserInfo = async (req, res) => {
    const { empno } = req.body;

    if (!empno) {
        return res.status(400).json({ result: 'false', message: 'Employee number is required' });
    }

    try {
        const row = await GetUserByEmpno(empno);
        if (row) {
            res.json({ result: 'true', userInfo: row });
        } else {
            res.json({ result: 'false', message: 'User not found', userInfo: null });
        }
    } catch (err) {
        res.status(500).json({ result: 'false', message: 'Database error: ' + err.message });
    }
};

const RefreshToken = async (req, res) => {
    const { generateToken, JWT_SECRET } = require('../../middleware/auth');
    const jwt = require('jsonwebtoken');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ result: 'false', message: 'Token required for refresh' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Generate new token
        const newTokenData = generateToken({
            u_code: decoded.empno,
            u_name: decoded.name,
            u_department: decoded.department,
            user_group: decoded.group,
            u_role: decoded.role,
            perms: decoded.perms || []
        });

        return res.json({
            result: 'true',
            message: 'Token refreshed',
            token: newTokenData.token,
            expiresAt: newTokenData.expiresAt
        });

    } catch (err) {
        return res.status(401).json({ result: 'false', message: 'Token invalid or expired. Cannot refresh.' });
    }
};

module.exports = {
    LoginUser,
    GetAllUsers,
    UpdateUserTheme,
    UpdateUserProfile,
    GetUserInfo,
    RefreshToken
};