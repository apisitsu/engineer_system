const { engPool } = require('../../../instance/eng_db');
const moment = require('moment');
const { exec } = require('child_process');

const ToolingInspectGetlist = async (req, res) => {
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const currentMonthStr = req.query.currentMonth;

    let baseSql = `FROM tooling_inspect WHERE 1=1`;
    let params = [];
    let paramCount = 1;

    if (search) {
        baseSql += ` AND (po_no ILIKE $${paramCount} OR item_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
    }

    if (status === 'all' && currentMonthStr) {
        const startOfMonth = moment(currentMonthStr, 'MM-YYYY').startOf('month').format('YYYY-MM-DD');
        const endOfMonth = moment(currentMonthStr, 'MM-YYYY').endOf('month').format('YYYY-MM-DD');

        baseSql += ` AND NULLIF(receive_date, '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1}`;
        params.push(startOfMonth, endOfMonth);
        paramCount += 2;
    }

    else if (status === 'pending' && currentMonthStr) {
        const startOfMonth = moment(currentMonthStr, 'MM-YYYY').startOf('month').format('YYYY-MM-DD');
        const endOfMonth = moment(currentMonthStr, 'MM-YYYY').endOf('month').format('YYYY-MM-DD');

        baseSql += ` AND (issue_date IS NULL OR TRIM(issue_date::TEXT) = '') 
                     AND NULLIF(receive_date, '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1}`;
        params.push(startOfMonth, endOfMonth);
        paramCount += 2;
    }

    else if (status === 'pending_all' || status === 'pendingAll') {
        baseSql += ` AND (issue_date IS NULL OR TRIM(issue_date::TEXT) = '')`;
    }

    if (startDate && endDate) {
        baseSql += ` AND NULLIF(TRIM(receive_date::TEXT), '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1}`;
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
            engPool.query(`SELECT * FROM tool_dwg_request ORDER BY date_req DESC`),
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
        const { date_req, item, status, remark } = req.body;
        if (!date_req || !item) {
            return res.json({
                result: "false",
                message: "กรุณากรอกข้อมูลวันที่และ Item ให้ครบถ้วน"
            });
        }

        const initialStatus = status || 'Pending';

        const params = [date_req ? moment(date_req).format('YYYY-MM-DD') : null, item, initialStatus, remark];

        const result = await engPool.query(`INSERT INTO tool_dwg_request (date_req, item, status, remark) VALUES ($1, $2, $3, $4) RETURNING id`, params);

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

const ToolDWGRequestUpdate = async (req, res) => {
    try {
        const { id, status } = req.body;
        if (!id) {
            return res.json({ result: "false", message: "กรุณาระบุ ID" });
        }

        const finalStatus = status || 'Complete';

        const result = await engPool.query(`UPDATE tool_dwg_request SET status = $1 WHERE id = $2 RETURNING id`, [finalStatus, id]);

        if (result.rowCount === 0) {
            return res.json({ result: "false", message: "ไม่พบข้อมูล" });
        }

        res.json({
            result: "true",
            message: "อัพเดทสถานะเรียบร้อยแล้ว!"
        });
    } catch (error) {
        console.error("Error Updating DWG Request:", error);
        res.json({
            result: "false",
            message: error.message || "เกิดข้อผิดพลาดในการอัพเดทข้อมูล"
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

const calculateDiffAndStatus = async (receiveDateVal, issueDateVal) => {
    if (!receiveDateVal || !issueDateVal) {
        return { diff: null, status: 'Pending' };
    }

    try {
        const start = moment(receiveDateVal).startOf('day');
        const end = moment(issueDateVal).startOf('day');

        const holidayQuery = await engPool.query(`SELECT holiday_date FROM holidays_date`);
        const holidays = holidayQuery.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD'));

        let diffDays = 0;
        let current = start.clone();

        while (current.isSameOrBefore(end)) {
            const isWeekend = current.isoWeekday() >= 6; // 6 = Sat, 7 = Sun
            const isHoliday = holidays.includes(current.format('YYYY-MM-DD'));

            if (!isWeekend && !isHoliday) {
                diffDays++;
            }
            current.add(1, 'days');
        }

        // diffDays = diffDays > 0 ? diffDays - 1 : 0;

        const status = diffDays > 3 ? 'Delay' : 'On time';

        return { diff: diffDays, status: status };

    } catch (error) {
        console.error("Error calculating working days:", error);
        return { diff: null, status: 'Pending' };
    }
};

const ToolingDashboadtGetlist = async (req, res) => {
    try {
        const today = moment();
        const prevWorkingDate = await getPreviousWorkingDay(today);
        const targetMonth = req.query.month ? moment(req.query.month, 'MM-YYYY') : moment();
        const startDate = targetMonth.clone().startOf('month').format('YYYY-MM-DD');

        const [toolingStats, dwgStats, rawStats, inspectMonthStats] = await Promise.all([

            // 1. toolingStats (การ์ด Tooling Return) — แสดงผลรวม qty สำหรับ Prev. Working Day และ Breakdown แยกตาม W/C
            new Promise(async (resolve) => {
                const sqlTotal = `
                    SELECT 
                        COUNT(*) as total_count,
                        COALESCE(SUM(CASE 
                            WHEN NULLIF(TRIM(return_date), '')::DATE = $1::DATE 
                            THEN qty 
                            ELSE 0 
                        END), 0) as total_yesterday
                    FROM tb_tooling_return 
                    WHERE return_date IS NOT NULL AND TRIM(return_date) != ''
                `;

                const sqlBreakdown = `
                    SELECT 
                        wc_code, 
                        MAX(wc_name) as wc_name, 
                        SUM(qty) as total_qty
                    FROM tb_tooling_return 
                    WHERE NULLIF(TRIM(return_date), '')::DATE = $1::DATE
                    GROUP BY wc_code
                    ORDER BY wc_code
                `;

                try {
                    const resTotal = await engPool.query(sqlTotal, [prevWorkingDate]);
                    const resBreakdown = await engPool.query(sqlBreakdown, [prevWorkingDate]);
                    resolve({ 
                        total_count: resTotal.rows[0]?.total_count || 0, 
                        total_yesterday: resTotal.rows[0]?.total_yesterday || 0,
                        breakdown: resBreakdown.rows || []
                    });
                } catch (err) {
                    console.error('toolingStats Error:', err.message);
                    resolve({ total_count: 0, total_yesterday: 0, breakdown: [] });
                }
            }),

            // 2. dwgStats (การ์ด DWG Request - คืนชีพกลับมาให้แล้วครับ!)
            new Promise(async (resolve) => {
                const sql = `
                    SELECT 
                        COUNT(*) as total_all,
                        SUM(CASE WHEN date_req::TEXT LIKE $1 || '%' THEN 1 ELSE 0 END) as total_yesterday,
                        SUM(CASE WHEN date_req::TEXT LIKE $1 || '%' AND status = 'Complete' THEN 1 ELSE 0 END) as complete_yesterday,
                        SUM(CASE WHEN date_req::TEXT LIKE $1 || '%' AND status = 'Pending' THEN 1 ELSE 0 END) as pending_yesterday
                    FROM tool_dwg_request 
                `;
                try {
                    const res = await engPool.query(sql, [prevWorkingDate]);
                    resolve(res.rows[0] || { total_all: 0, total_yesterday: 0, complete_yesterday: 0, pending_yesterday: 0 });
                } catch (err) {
                    resolve({ total_all: 0, total_yesterday: 0, complete_yesterday: 0, pending_yesterday: 0 });
                }
            }),

            // 3. rawStats (การ์ด Tooling Inspection Yesterday)
            new Promise(async (resolve) => {
                const sql = `
                    SELECT 
                        SUM(CASE WHEN receive_date ~ '^\\d{4}-\\d{2}-\\d{2}' AND receive_date::DATE = $1::DATE THEN 1 ELSE 0 END) as received_yesterday,
                        SUM(CASE WHEN issue_date ~ '^\\d{4}-\\d{2}-\\d{2}' AND issue_date::DATE = $1::DATE THEN 1 ELSE 0 END) as issued_yesterday
                    FROM tooling_inspect
                `;
                try {
                    const res = await engPool.query(sql, [prevWorkingDate]);
                    resolve(res.rows[0] || { received_yesterday: 0, issued_yesterday: 0 });
                } catch (err) {
                    console.error("Yesterday Stats Error:", err.message);
                    resolve({ received_yesterday: 0, issued_yesterday: 0 });
                }
            }),

            // 4. inspectMonthStats (กราฟ Performance ด้านบน)
            new Promise(async (resolve) => {
                const monthYear = startDate.substring(0, 7); // จะได้ '2026-04'
                const sql = `
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'On time' THEN 1 ELSE 0 END) as on_time,
                        SUM(CASE WHEN status = 'Delay' THEN 1 ELSE 0 END) as delay,
                        SUM(CASE WHEN (issue_date IS NULL OR TRIM(issue_date::TEXT) = '') THEN 1 ELSE 0 END) as pending
                    FROM tooling_inspect
                    WHERE receive_date::TEXT LIKE $1 || '%'
                `;
                try {
                    const res = await engPool.query(sql, [monthYear]);
                    const data = res.rows[0];
                    resolve({
                        total: Number(data.total) || 0,
                        on_time: Number(data.on_time) || 0,
                        delay: Number(data.delay) || 0,
                        pending: Number(data.pending) || 0
                    });
                } catch (err) {
                    console.error("Performance Stats Error:", err.message);
                    resolve({ total: 0, on_time: 0, delay: 0, pending: 0 });
                }
            })
        ]);

        // รวมร่างข้อมูลอย่างถูกต้อง
        const result = {
            yesterdayDate: prevWorkingDate,

            toolingReturnYesterday: toolingStats.total_yesterday || 0,
            toolingReturnCount: toolingStats.total_count || 0,
            toolingReturnBreakdown: toolingStats.breakdown || [],

            dwgRequestTotal: dwgStats.total_all || 0,
            dwgRequestYesterday: dwgStats.total_yesterday || 0,
            dwgCompleteCount: dwgStats.complete_yesterday || 0,
            dwgPendingCount: dwgStats.pending_yesterday || 0,

            rawDataReceivedYesterday: rawStats.received_yesterday || 0,
            rawDataIssuedYesterday: rawStats.issued_yesterday || 0,

            total: inspectMonthStats.total || 0,
            onTime: inspectMonthStats.on_time || 0,
            delay: inspectMonthStats.delay || 0,
            pending: inspectMonthStats.pending || 0
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

        // Keep raw digit string to preserve leading zeros (e.g., "09" stays "09")
        const stringCode = wc_code ? wc_code.toString().replace(/\D/g, '') : '';

        const getWcName = async (code) => {
            // work_centers stores code as "WC-09", "WC-25" etc.
            // but tb_tooling_return stores wc_code as "09", "25" (digits only)
            // So build the formatted lookup key: "09" → "WC-09"
            const paddedCode = code.padStart(2, '0');
            const wcCode = `WC-${paddedCode}`;

            const query = `SELECT department FROM work_centers WHERE code = $1 LIMIT 1`;
            const result = await engPool.query(query, [wcCode]);
            console.log(`🔎 WC Lookup: '${code}' -> '${wcCode}' -> found ${result.rows.length} rows`, result.rows[0] || '(none)');
            return result.rows.length > 0 ? (result.rows[0].department || '') : '';
        };

        let wc_name = "";
        try {
            wc_name = await getWcName(stringCode);
        } catch (dbErr) {
            console.error("WC Code Lookup Error:", dbErr.message);
        }

        console.log(`✅ WC Code: ${stringCode} -> wc_name: '${wc_name}'`);

        const sql = `
            INSERT INTO tb_tooling_return 
            (return_date, wc_code, wc_name, qty, measuring_tools, remark) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        const params = [
            date_return ? moment(date_return).format('YYYY-MM-DD') : null,
            stringCode,   // wc_code
            wc_name,      // wc_name (lookup จากตาราง work_centers)
            qty,
            measuring_tool,  // measuring_tools
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
        id,
        receive_date,
        issue_date,
        measuring_tools,
        judgement,
        reason,
        remark
    } = req.body;

    try {
        let finalStatus = 'Pending';
        let finalDiff = null;

        if (issue_date && receive_date) {
            const calcResult = await calculateDiffAndStatus(receive_date, issue_date);
            finalStatus = calcResult.status;
            finalDiff = calcResult.diff;
        }

        const sql = `
            UPDATE tooling_inspect 
            SET 
                issue_date = $1, 
                measuring_tools = $2, 
                judgement = $3, 
                reason = $4, 
                remark = $5,
                status = $6,
                diff = $7
            WHERE id = $8
        `;

        const params = [
            issue_date ? moment(issue_date).format('YYYY-MM-DD') : null,
            measuring_tools,
            judgement,
            reason,
            remark,
            finalStatus,
            finalDiff,
            id
        ];

        const result = await engPool.query(sql, params);

        if (result.rowCount === 0) {
            return res.status(404).json({ result: "false", message: "ไม่พบข้อมูลที่ต้องการแก้ไข" });
        }

        res.json({ result: "true", message: "อัพเดทข้อมูลเรียบร้อยแล้ว", changes: result.rowCount });
    } catch (err) {
        console.error("SQL Error:", err.message);
        return res.status(500).json({ result: "false", message: "Database error: " + err.message });
    }
}

const ToolingSyncCSV = async (req, res) => {
    try {
        const pythonExe = 'D:\\PythonProject\\env\\Scripts\\python.exe';
        const scriptPath = 'D:\\PythonProject\\importPCtooling.py';
        console.log(`Executing Python script: ${scriptPath} using venv`);

        exec(`"${pythonExe}" "${scriptPath}"`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Python script error: ${error.message}`);
                return res.status(500).json({ 
                    success: false, 
                    message: "Execution failed", 
                    error: error.message, 
                    stderr 
                });
            }
            if (stderr) {
                console.warn(`Python script stderr: ${stderr}`);
            }
            
            console.log(`Python script stdout: ${stdout}`);
            return res.json({ 
                success: true, 
                message: "CSV Synced Successfully", 
                output: stdout 
            });
        });
    } catch (error) {
        console.error("ToolingSyncCSV Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    ToolingInspectGetlist,
    ToolDWGRequestGetList,
    ToolDWGRequestAdd,
    GetWCCodes,
    ToolingDashboadtGetlist,
    ToolingReturnAdd,
    ToolingInspectUpdate,
    ToolDWGRequestUpdate,
    ToolingSyncCSV
};