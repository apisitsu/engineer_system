const { engPool } = require('../../../instance/eng_db');
const moment = require('moment');

const ToolingInspectGetlist = async (req, res) => {
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let baseSql = `FROM tooling_inspect WHERE 1=1`;
    let params = [];
    let paramCount = 1;

    if (search) {
        baseSql += ` AND (po_no ILIKE $${paramCount} OR item_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
    }

    if (status === 'pending') {
        baseSql += ` AND issue_date IS NULL`;
    }

    if (startDate && endDate) {
        baseSql += ` AND receive_date >= $${paramCount} AND receive_date <= $${paramCount + 1}`;
        params.push(startDate, endDate);
        paramCount += 2;
    }

    try {
        const countSql = `SELECT COUNT(*) as total ${baseSql}`;
        const countRes = await engPool.query(countSql, params);
        const total = parseInt(countRes.rows[0].total);

        const dataSql = `SELECT * ${baseSql} ORDER BY receive_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        const dataRes = await engPool.query(dataSql, [...params, limitNum, offset]);

        res.json({
            data: dataRes.rows,
            pagination: { total, page: pageNum, limit: limitNum }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

const ToolDWGRequestGetList = async (req, res) => {
    // const pageNum  = Math.max(1, parseInt(req.query.page)  || 1);
    // const limitNum = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    // const offset   = (pageNum - 1) * limitNum;
    try {
        const [dataRes, countRes] = await Promise.all([
            engPool.query(`SELECT * FROM tool_dwg_request ORDER BY req_date DESC`),
            engPool.query(`SELECT COUNT(*) as total FROM tool_dwg_request`),
        ]);
        const total = parseInt(countRes.rows[0].total);
        res.json({
            data: dataRes.rows,
            pagination: { total, page: 1, limit: 1, totalPages: 1 },
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
}

const GetWCCodes = async (req, res) => {
    try {
        // Try to fetch with multiple possible column names and format code to 2 digits
        const sql = `
            SELECT code, name AS description, department
            FROM work_centers
            ORDER BY code ASC
        `;
        const result = await engPool.query(sql);
        console.log(`📦 Fetched ${result.rows.length} Work Centers`);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error in GetWCCodes:', err.message);
        res.status(500).json({ error: err.message });
    }
}

const ToolDWGRequestAdd = async (req, res) => {
    console.log('Start Tooling DWG Request Add')
    try {
        const { date_request, item, status, remark } = req.body;
        if (!date_request || !item) {
            return res.json({
                result: "false",
                message: "กรุณากรอกข้อมูลวันที่และ Item ให้ครบถ้วน"
            });
        }

        const initialStatus = status || 'Pending';

        let sql = `
            INSERT INTO tool_dwg_request 
            (req_date, title, status, reason )
            VALUES 
            ($1, $2, $3, $4)
            RETURNING id
        `;
        // mapped from old schema mappings (date_request->req_date, item->title/reason)
        // Adjusting columns properly to match schema: req_date, tool_number/reason, status.
        // Will use tool_number as item since there's no item

        // Let's use correct columns based on migration script: req_date, reason, status.
        // Assuming item mapping to reason or detail
        const params = [date_request ? moment(date_request).format('YYYY-MM-DD HH:mm:ss') : null, item, initialStatus, remark];

        const result = await engPool.query(`INSERT INTO tool_dwg_request (req_date, tool_number, status, reason) VALUES ($1, $2, $3, $4) RETURNING id`, params);

        res.json({
            result: "true",
            message: "Data saved successfully!",
            id: result.rows[0].id
        });

    } catch (error) {
        console.error("Error Adding DWG Request:", error);
        res.json({
            result: "false",
            message: error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
        });
    }
}

const getPreviousWorkingDay = async (fromDate) => {
    try {
        const sql = `SELECT holiday_date FROM holidays_date`;
        const result = await engPool.query(sql);

        const holidays = result.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD'));
        let day = moment(fromDate);

        do {
            day.subtract(1, 'days');
        } while (
            day.isoWeekday() >= 6 ||
            (holidays && holidays.includes(day.format('YYYY-MM-DD')))
        );

        return day.format('YYYY-MM-DD');
    } catch (error) {
        console.warn("Table holidays_date might be missing, defaulting to yesterday:", error.message);
        return moment(fromDate).subtract(1, 'days').format('YYYY-MM-DD');
    }
};

const ToolingDashboadtGetlist = async (req, res) => {
    try {
        const today = moment();
        const prevWorkingDate = await getPreviousWorkingDay(today);

        const [toolingStats, dwgStats, rawStats] = await Promise.all([
            new Promise(async (resolve) => {
                const sql = `
                    SELECT 
                        SUM(qty) as total_all,
                        SUM(CASE WHEN date(return_date) = $1 THEN qty ELSE 0 END) as total_yesterday
                    FROM tb_tooling_return 
                `;
                try {
                    const res = await engPool.query(sql, [prevWorkingDate]);
                    resolve(res.rows[0] || { total_all: 0, total_yesterday: 0 });
                } catch (err) {
                    resolve({ total_all: 0, total_yesterday: 0 });
                }
            }),

            new Promise(async (resolve) => {
                const sql = `
                    SELECT 
                        COUNT(*) as total_all,
                        SUM(CASE WHEN date(req_date) = $1 THEN 1 ELSE 0 END) as total_yesterday,
                        SUM(CASE WHEN date(req_date) = $2 AND status = 'Complete' THEN 1 ELSE 0 END) as complete_yesterday,
                        SUM(CASE WHEN date(req_date) = $3 AND status = 'Pending' THEN 1 ELSE 0 END) as pending_yesterday
                    FROM tool_dwg_request 
                `;
                try {
                    const res = await engPool.query(sql, [prevWorkingDate, prevWorkingDate, prevWorkingDate]);
                    resolve(res.rows[0] || { total_all: 0, total_yesterday: 0, complete_yesterday: 0, pending_yesterday: 0 });
                } catch (err) {
                    resolve({ total_all: 0, total_yesterday: 0, complete_yesterday: 0, pending_yesterday: 0 });
                }
            }),

            new Promise(async (resolve) => {
                const sql = `
                    SELECT 
                        SUM(CASE WHEN date(receive_date) = $1 THEN 1 ELSE 0 END) as received_yesterday,
                        SUM(CASE WHEN date(issue_date) = $2 THEN 1 ELSE 0 END) as issued_yesterday
                    FROM tooling_inspect
                `;
                try {
                    const res = await engPool.query(sql, [prevWorkingDate, prevWorkingDate]);
                    resolve(res.rows[0] || { received_yesterday: 0, issued_yesterday: 0 });
                } catch (err) {
                    resolve({ received_yesterday: 0, issued_yesterday: 0 });
                }
            })
        ]);

        const result = {
            yesterdayDate: prevWorkingDate,

            toolingReturnTotal: toolingStats.total_all || 0,
            toolingReturnYesterday: toolingStats.total_yesterday || 0,

            dwgRequestTotal: dwgStats.total_all || 0,
            dwgRequestYesterday: dwgStats.total_yesterday || 0,
            dwgCompleteCount: dwgStats.complete_yesterday || 0,
            dwgPendingCount: dwgStats.pending_yesterday || 0,

            rawDataReceivedYesterday: rawStats.received_yesterday || 0,
            rawDataIssuedYesterday: rawStats.issued_yesterday || 0
        };

        res.json(result);

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ error: error.message });
    }
}

const ToolingReturnAdd = async (req, res) => {
    try {
        const { date_return, wc_code, qty, measuring_tool, remark } = req.body;

        if (!wc_code || !qty) {
            return res.json({ result: "false", message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
        }

        const getWcName = async (code) => {
            const query = "SELECT description FROM work_centers WHERE code = $1";
            const result = await engPool.query(query, [code.toString()]);
            return result.rows.length > 0 ? result.rows[0].description : '';
        };

        const wc_number = wc_code ? parseInt(wc_code.toString().replace(/\D/g, ''), 10) : 0;
        const stringCode = wc_number.toString();

        let wc_name = "";
        try {
            wc_name = await getWcName(stringCode);
        } catch (dbErr) {
            console.error("WC Code Lookup Error:", dbErr.message);
        }

        console.log(`🔎 ค้นหา WC Code: ${stringCode} -> ได้ชื่อ: ${wc_name}`);

        const sql = `
            INSERT INTO tb_tooling_return 
            (return_date, part_number, tool_number, qty, condition, reason) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        // Mapping values logically based on new schema
        const params = [
            date_return ? moment(date_return).format('YYYY-MM-DD HH:mm:ss') : null,
            stringCode, // mapped part_number -> wc_code locally since it has no direct column
            wc_name, // tool_number is used to store wc_name locally
            qty,
            measuring_tool,
            remark
        ];

        const result = await engPool.query(sql, params);

        console.log(`✅ บันทึกข้อมูล tb_tooling_return -> ID: ${result.rows[0].id} เรียบร้อย`);
        res.json({
            result: "true",
            message: "บันทึกสำเร็จ",
            id: result.rows[0].id
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ result: "false", message: "Server Error" });
    }
}

const ToolingInspectUpdate = async (req, res) => {
    const {
        po_no,
        item_name,
        issue_date,
        measuring_tools,
        judgement,
        reason,
        remark
    } = req.body;

    try {
        const sql = `
            UPDATE tooling_inspect 
            SET issue_date = $1, 
                measuring_tools = $2, 
                judgement = $3, 
                reason = $4, 
                remark = $5
            WHERE po_no = $6 AND item_name = $7
        `;

        const params = [issue_date ? moment(issue_date).format('YYYY-MM-DD HH:mm:ss') : null, measuring_tools, judgement, reason, remark, po_no, item_name];

        const result = await engPool.query(sql, params);

        if (result.rowCount === 0) {
            return res.status(404).json({
                result: "false",
                message: "ไม่พบข้อมูลที่ต้องการแก้ไข (ตรวจสอบ PO No หรือ Item Name)"
            });
        }

        res.json({
            result: "true",
            message: "อัพเดทข้อมูลเรียบร้อยแล้ว",
            changes: result.rowCount
        });
    } catch (err) {
        console.error("SQL Error:", err.message);
        return res.status(500).json({
            result: "false",
            message: "Database error: " + err.message
        });
    }
}

module.exports = {
    ToolingInspectGetlist,
    ToolDWGRequestGetList,
    ToolDWGRequestAdd,
    GetWCCodes,
    ToolingDashboadtGetlist,
    ToolingReturnAdd,
    ToolingInspectUpdate,
};