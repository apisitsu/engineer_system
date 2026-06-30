const { engPool } = require('../../../../instance/eng_db');
const moment = require('moment');
const { exec } = require('child_process');
const { TABLES, PATHS } = require('../mtcConstants');

const ToolingInspectGetlist = async (req, res) => {
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const currentMonthStr = req.query.currentMonth;

    let baseSql = `FROM ${TABLES.TI_LIST} WHERE 1=1`;
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
        baseSql += ` AND (NULLIF(TRIM(receive_date::TEXT), '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1} OR NULLIF(TRIM(issue_date::TEXT), '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1})`;
        params.push(startDate, endDate);
        paramCount += 2;
    }

    try {
        const countSql = `SELECT COUNT(*) as total ${baseSql}`;
        const countRes = await engPool.query(countSql, params);
        const total = parseInt(countRes.rows[0].total);

        const dataSql = `SELECT * ${baseSql} ORDER BY receive_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        const dataRes = await engPool.query(dataSql, [...params, limitNum, offset]);

        let dateActivity = null;
        if (startDate && endDate) {
            const actParams = [startDate, endDate];
            let actWhere = `WHERE (NULLIF(TRIM(receive_date::TEXT), '')::DATE BETWEEN $1 AND $2 OR NULLIF(TRIM(issue_date::TEXT), '')::DATE BETWEEN $1 AND $2)`;
            if (search) {
                actWhere += ` AND (po_no ILIKE $3 OR item_name ILIKE $3)`;
                actParams.push(`%${search}%`);
            }
            const actSql = `SELECT
                COUNT(CASE WHEN NULLIF(TRIM(receive_date::TEXT), '')::DATE BETWEEN $1 AND $2 THEN 1 END) as received,
                COUNT(CASE WHEN NULLIF(TRIM(issue_date::TEXT), '')::DATE BETWEEN $1 AND $2 THEN 1 END) as issued
                FROM ${TABLES.TI_LIST} ${actWhere}`;
            const actRes = await engPool.query(actSql, actParams);
            dateActivity = { received: Number(actRes.rows[0].received), issued: Number(actRes.rows[0].issued) };
        }

        res.json({
            data: dataRes.rows,
            pagination: { total, page: pageNum, limit: limitNum },
            dateActivity
        });
    } catch (err) {
        console.error('Error fetching tooling inspect list:', err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const ToolDWGRequestGetList = async (req, res) => {
    try {
        const [dataRes, countRes] = await Promise.all([
            engPool.query(`SELECT * FROM ${TABLES.TI_DWG_JOB} ORDER BY date_req DESC`),
            engPool.query(`SELECT COUNT(*) as total FROM ${TABLES.TI_DWG_JOB}`),
        ]);
        const total = parseInt(countRes.rows[0].total);
        res.json({
            data: dataRes.rows,
            pagination: { total, page: 1, limit: 1, totalPages: 1 },
        });
    } catch (err) {
        console.error('Error fetching tool DWG request list:', err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const GetWCCodes = async (req, res) => {
    try {
        const sql = `
            SELECT code, name AS description, department
            FROM ${TABLES.WORK_CENTERS}
            ORDER BY code ASC
        `;
        const result = await engPool.query(sql);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error in GetWCCodes:', err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const ToolDWGRequestAdd = async (req, res) => {
    try {
        const { date_req, item, status, remark } = req.body;
        if (!date_req || !item) {
            return res.json({
                result: "false",
                message: "Please fill in the date and Item completely"
            });
        }

        const initialStatus = status || 'Pending';
        const params = [date_req ? moment.utc(date_req).format('YYYY-MM-DD') : null, item, initialStatus, remark];
        const result = await engPool.query(`INSERT INTO ${TABLES.TI_DWG_JOB} (date_req, item, status, remark) VALUES ($1, $2, $3, $4) RETURNING id`, params);

        res.json({
            result: "true",
            message: "Data saved successfully!",
            id: result.rows[0].id
        });

    } catch (error) {
        console.error("Error Adding DWG Request:", error.message);
        res.status(500).json({
            result: "false",
            message: "An error occurred while saving"
        });
    }
}

const ToolDWGRequestUpdate = async (req, res) => {
    try {
        const { id, status } = req.body;
        if (!id) {
            return res.json({ result: "false", message: "Please specify an ID" });
        }

        const finalStatus = status || 'Complete';
        const result = await engPool.query(`UPDATE ${TABLES.TI_DWG_JOB} SET status = $1 WHERE id = $2 RETURNING id`, [finalStatus, id]);

        if (result.rowCount === 0) {
            return res.json({ result: "false", message: "Data not found" });
        }

        res.json({
            result: "true",
            message: "Status updated successfully!"
        });
    } catch (error) {
        console.error("Error Updating DWG Request:", error.message);
        res.status(500).json({
            result: "false",
            message: "An error occurred while updating"
        });
    }
}

const getPreviousWorkingDay = async (fromDate) => {
    try {
        const sql = `SELECT ${TABLES.HOLIDAY_COLUMN} as holiday_date FROM ${TABLES.HOLIDAYS}`;
        const result = await engPool.query(sql);

        const holidays = result.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD'));
        let day = moment(fromDate);

        do {
            day.subtract(1, 'days');
        } while (
            day.isoWeekday() === 7 || // 7 = Sunday only (Saturday is a working day)
            (holidays && holidays.includes(day.format('YYYY-MM-DD')))
        );

        return day.format('YYYY-MM-DD');
    } catch (error) {
        console.warn(`Table ${TABLES.HOLIDAYS} might be missing, defaulting to yesterday:`, error.message);
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

        const holidayQuery = await engPool.query(`SELECT ${TABLES.HOLIDAY_COLUMN} as holiday_date FROM ${TABLES.HOLIDAYS}`);
        const holidays = holidayQuery.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD'));

        let diffDays = 0;
        let current = start.clone();

        while (current.isSameOrBefore(end)) {
            const isWeekend = current.isoWeekday() === 7; // Only Sunday is weekend
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
                            FROM ${TABLES.TI_RETURN} 
                            WHERE return_date IS NOT NULL AND TRIM(return_date) != ''
                        `;

                        const sqlBreakdown = `
                            SELECT 
                                wc_code, 
                                MAX(wc_name) as wc_name, 
                                SUM(qty) as total_qty
                            FROM ${TABLES.TI_RETURN} 
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
                            FROM ${TABLES.TI_DWG_JOB} 
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
                            FROM ${TABLES.TI_LIST}
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
                            FROM ${TABLES.TI_LIST}
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
            return res.json({ result: "false", message: "Please fill in all required fields" });
        }

        // Keep raw digit string to preserve leading zeros (e.g., "09" stays "09")
        const stringCode = wc_code ? wc_code.toString().replace(/\D/g, '') : '';

        const getWcName = async (code) => {
            // work_centers stores code as "WC-09", "WC-25" etc.
            // but ti_return stores wc_code as "09", "25" (digits only)
            // So build the formatted lookup key: "09" → "WC-09"
            const paddedCode = code.padStart(2, '0');
            const wcCode = `WC-${paddedCode}`;

            const query = `SELECT department FROM ${TABLES.WORK_CENTERS} WHERE code = $1 LIMIT 1`;
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
            INSERT INTO ${TABLES.TI_RETURN} 
            (return_date, wc_code, wc_name, qty, measuring_tools, remark) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        const params = [
            date_return ? moment.utc(date_return).format('YYYY-MM-DD') : null,
            stringCode,   // wc_code
            wc_name,      // wc_name (lookup จากตาราง work_centers)
            qty,
            measuring_tool,  // measuring_tools
            remark
        ];

        const result = await engPool.query(sql, params);

        console.log(`✅ บันทึกข้อมูล ${TABLES.TI_RETURN} -> ID: ${result.rows[0].id} เรียบร้อย`);
        res.json({
            result: "true",
            message: "Saved successfully",
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
            UPDATE ${TABLES.TI_LIST} 
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
            return res.status(404).json({ result: "false", message: "Record to edit not found" });
        }

        res.json({ result: "true", message: "Updated successfully", changes: result.rowCount });
    } catch (err) {
        console.error("SQL Error:", err.message);
        return res.status(500).json({ result: "false", message: "Database error: " + err.message });
    }
}

// GET status preview — single source of truth for the Delay decision, used by
// the update form to gate the reason prompt. Mirrors ToolingInspectUpdate's
// calculation exactly (calculateDiffAndStatus: excludes Sundays + holidays,
// Delay when diff > 3) so the prompt can never drift from the saved status.
const ToolingStatusPreview = async (req, res) => {
    const { receive_date, issue_date } = req.query;
    try {
        const { diff, status } = await calculateDiffAndStatus(receive_date, issue_date);
        res.json({ result: "true", diff, status });
    } catch (err) {
        console.error("Status preview error:", err.message);
        res.status(500).json({ result: "false", message: "Database error: " + err.message });
    }
};

const ToolingSyncCSV = async (req, res) => {
    try {
        console.log(`Executing Python script: ${PATHS.TOOLING_IMPORT_SCRIPT} using venv`);

        exec(`"${PATHS.PYTHON_EXE}" "${PATHS.TOOLING_IMPORT_SCRIPT}"`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, (error, stdout, stderr) => {
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

// FYE helper: FYE = start_year - 1999 (e.g. FYE27 = Apr 2026–Mar 2027)
const fyeToRange = (fye) => ({
    start: `${fye + 1999}-04-01`,
    end:   `${fye + 2000}-03-31`,
});

const currentFye = () => {
    const m = moment().month() + 1; // 1-12
    const y = moment().year();
    return m >= 4 ? y - 1999 : y - 2000;
};

const ToolingAvailableFYE = async (req, res) => {
    try {
        const r = await engPool.query(`
            SELECT DISTINCT
                CASE
                    WHEN EXTRACT(MONTH FROM issue_date::DATE) >= 4
                    THEN EXTRACT(YEAR FROM issue_date::DATE)::int - 1999
                    ELSE EXTRACT(YEAR FROM issue_date::DATE)::int - 2000
                END AS fye
            FROM ${TABLES.TI_LIST}
            WHERE issue_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            ORDER BY fye DESC
        `);
        res.json(r.rows.map(row => Number(row.fye)));
    } catch (error) {
        console.error('ToolingAvailableFYE Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const ToolingResultDashboard = async (req, res) => {
    try {
        const fye   = parseInt(req.query.fye) || currentFye();
        const month = req.query.month ? parseInt(req.query.month) : null; // 1-12 calendar

        const { start: fyeStart, end: fyeEnd } = fyeToRange(fye);

        // Period filter — full FYE or one specific calendar month within it
        let periodStart, periodEnd;
        if (month) {
            const calYear = month >= 4 ? fye + 1999 : fye + 2000;
            const ms = moment(`${calYear}-${String(month).padStart(2, '0')}-01`);
            periodStart = ms.startOf('month').format('YYYY-MM-DD');
            periodEnd   = ms.endOf('month').format('YYYY-MM-DD');
        } else {
            periodStart = fyeStart;
            periodEnd   = fyeEnd;
        }

        // issued = received in period AND already has an issue_date (not pending)
        const rcvFilter   = `receive_date ~ '^\\d{4}-\\d{2}-\\d{2}' AND receive_date::DATE BETWEEN $1 AND $2
                              AND NULLIF(TRIM(issue_date::TEXT), '') IS NOT NULL`;
        const issueFilter = `issue_date  ~ '^\\d{4}-\\d{2}-\\d{2}' AND issue_date::DATE  BETWEEN $1 AND $2`;

        const [kpiRes, delayCausesRes, measuringToolsRes, wcRes, monthlyRes, dailyRes, detailRowsRes] = await Promise.all([
            engPool.query(`
                SELECT
                    COUNT(*) as total_po,
                    COALESCE(SUM(qty), 0) as total_qty,
                    SUM(CASE WHEN status = 'On time' THEN 1 ELSE 0 END) as on_time,
                    SUM(CASE WHEN status = 'Delay'   THEN 1 ELSE 0 END) as delay,
                    SUM(CASE WHEN judgement = 'Accept' THEN 1 ELSE 0 END) as accept,
                    SUM(CASE WHEN judgement = 'Reject' THEN 1 ELSE 0 END) as reject,
                    COUNT(*) as total_items
                FROM ${TABLES.TI_LIST}
                WHERE ${rcvFilter}
            `, [periodStart, periodEnd]),

            engPool.query(`
                SELECT reason, COUNT(*) as cnt
                FROM ${TABLES.TI_LIST}
                WHERE ${rcvFilter} AND status = 'Delay'
                  AND reason IS NOT NULL AND TRIM(reason) != ''
                GROUP BY reason ORDER BY cnt DESC
            `, [periodStart, periodEnd]),

            engPool.query(`
                SELECT measuring_tools, COUNT(*) as cnt
                FROM ${TABLES.TI_LIST}
                WHERE ${rcvFilter}
                  AND measuring_tools IS NOT NULL AND TRIM(measuring_tools) != ''
                GROUP BY measuring_tools ORDER BY cnt DESC
            `, [periodStart, periodEnd]),

            engPool.query(`
                SELECT w_c, COUNT(*) as cnt
                FROM ${TABLES.TI_LIST}
                WHERE ${rcvFilter}
                  AND w_c IS NOT NULL AND TRIM(w_c) != ''
                GROUP BY w_c ORDER BY cnt DESC LIMIT 15
            `, [periodStart, periodEnd]),

            // Monthly trend — issue_date, always full FYE
            engPool.query(`
                SELECT
                    TO_CHAR(issue_date::DATE, 'YYYY-MM') as month_key,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'On time' THEN 1 ELSE 0 END) as on_time,
                    SUM(CASE WHEN status = 'Delay'   THEN 1 ELSE 0 END) as delay
                FROM ${TABLES.TI_LIST}
                WHERE ${issueFilter}
                GROUP BY month_key ORDER BY month_key
            `, [fyeStart, fyeEnd]),

            // Daily — group by day-of-month (1–31), sum across all months in period
            engPool.query(`
                SELECT EXTRACT(DAY FROM issue_date::DATE)::int as day_num,
                       COALESCE(SUM(qty), 0) as received
                FROM ${TABLES.TI_LIST}
                WHERE ${issueFilter}
                GROUP BY day_num ORDER BY day_num
            `, [periodStart, periodEnd]),

            // Detail rows for bottom table
            engPool.query(`
                SELECT id, receive_date, po_no, item_name, dwg_no, qty,
                       issue_date, diff, w_c, status, reason, measuring_tools, judgement
                FROM ${TABLES.TI_LIST}
                WHERE ${rcvFilter}
                ORDER BY receive_date DESC
                LIMIT 500
            `, [periodStart, periodEnd])
        ]);

        const kpi = kpiRes.rows[0];
        const totalItems = Number(kpi.total_items) || 0;
        const totalQty   = Number(kpi.total_qty)   || 0;
        const onTime     = Number(kpi.on_time)      || 0;
        const onTimePct  = totalItems > 0
            ? parseFloat(((onTime / totalItems) * 100).toFixed(1)) : 0;

        res.json({
            kpi: { totalPO: Number(kpi.total_po)||0, totalQty, onTime,
                   delay: Number(kpi.delay)||0, accept: Number(kpi.accept)||0,
                   reject: Number(kpi.reject)||0, totalItems, onTimePct },
            judgementRatio: [
                { name: 'Accept', value: Number(kpi.accept)||0 },
                { name: 'Reject', value: Number(kpi.reject)||0 }
            ],
            statusRatio: [
                { name: 'On time', value: onTime },
                { name: 'Delay',   value: Number(kpi.delay)||0 }
            ],
            monthlyTrend: monthlyRes.rows.map(r => ({
                month:  r.month_key,
                total:  Number(r.total),
                onTime: Number(r.on_time),
                delay:  Number(r.delay)
            })),
            delayCauses:   delayCausesRes.rows.map(r => ({ reason: r.reason, count: Number(r.cnt) })),
            measuringTools: measuringToolsRes.rows.map(r => ({
                tool:  r.measuring_tools,
                count: Number(r.cnt),
                pct:   totalItems > 0 ? parseFloat(((Number(r.cnt)/totalItems)*100).toFixed(1)) : 0
            })),
            wcBreakdown: wcRes.rows.map(r => ({ wc: r.w_c, count: Number(r.cnt) })),
            dailyData:   dailyRes.rows.map(r => ({ day: Number(r.day_num), received: Number(r.received) })),
            detailRows:  detailRowsRes.rows
        });
    } catch (error) {
        console.error('ToolingResultDashboard Error:', error);
        res.status(500).json({ error: error.message });
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
    ToolingStatusPreview,
    ToolDWGRequestUpdate,
    ToolingSyncCSV,
    ToolingAvailableFYE,
    ToolingResultDashboard
};

