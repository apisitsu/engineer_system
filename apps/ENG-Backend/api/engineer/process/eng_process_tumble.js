const { pool } = require('../../../instance/instance');

// ==========================================
// Tumble Model (tumble_model)
// ==========================================
const getTumbleModelByOldCn = async (req, res) => {
    const { old_cn } = req.query;
    // console.log(":: getTumbleModelByOldCn ::", old_cn);
    try {
        const query = `SELECT * FROM tumble_model WHERE old_cn = $1`;
        const result = await pool.query(query, [old_cn]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(":: error getTumbleModelByOldCn ::", err);
        res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
};

const getAllTumbleModel = async (req, res) => {
    try {
        const query = `SELECT * FROM tumble_model ORDER BY id ASC`;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(":: error getAllTumbleModel ::", err);
        res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
};

const createTumbleModel = async (req, res) => {
    const update_user = req.user?.empno || req.user?.u_code || req.body.update_user || 'System';
    const { new_cn, old_cn, part, class_name, material, process, condition_code } = req.body;

    const query = `
        INSERT INTO tumble_model (new_cn, old_cn, part, class_name, material, process, condition_code, create_user, create_date) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP) 
        RETURNING *;`;

    try {
        const results = await pool.query(query, [new_cn, old_cn, part, class_name, material, process, condition_code, update_user]);
        res.json({ success: true, message: "Added successfully", data: results.rows[0] });
    } catch (error) {
        console.error(":: error createTumbleModel ::", error);
        res.status(500).json({ success: false, message: "Failed to add data" });
    }
};

const updateTumbleModel = async (req, res) => {
    const { id } = req.params;
    const update_user = req.user?.empno || req.user?.u_code || req.body.update_user || 'System';
    const { new_cn, old_cn, part, class_name, material, process, condition_code } = req.body;

    const query = `UPDATE tumble_model 
        SET 
        new_cn = $1, 
        old_cn = $2, 
        part = $3, 
        class_name = $4, 
        material = $5, 
        process = $6, 
        prev_con_code = condition_code,
        condition_code = $7,
        update_user = $8,
        update_date = CURRENT_TIMESTAMP
        WHERE id = $9 
        RETURNING *;`;
    try {
        const results = await pool.query(query, [new_cn, old_cn, part, class_name, material, process, condition_code, update_user, id]);
        if (results.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Data not found" });
        }
        res.json({ success: true, message: "Updated successfully", data: results.rows[0] });
    } catch (error) {
        console.error(":: error updateTumbleModel ::", error);
        res.status(500).json({ success: false, message: "Failed to update data" });
    }
};

const deleteTumbleModel = async (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM tumble_model WHERE id = $1 RETURNING *";

    try {
        const results = await pool.query(query, [id]);
        if (results.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Data not found" });
        }
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        console.error(":: error deleteTumbleModel ::", error);
        res.status(500).json({ success: false, message: "Failed to delete data" });
    }
};

// ==========================================
// Tumble Condition (tumble_condition)
// ==========================================

const getTumbleConditionByCode = async (req, res) => {
    const { condition_code } = req.query;
    console.log(":: getTumbleConditionByCode ::", condition_code);
    try {
        const query = `SELECT * FROM tumble_condition WHERE code = $1`;
        const result = await pool.query(query, [condition_code]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(":: error getTumbleConditionByCode ::", err);
        res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
};

const getAllTumbleCondition = async (req, res) => {
    try {
        const query = `SELECT DISTINCT ON (code, process, mc_type_no) * FROM tumble_condition ORDER BY code ASC;`;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(":: error getAllTumbleCondition ::", err);
        res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
};

const createTumbleCondition = async (req, res) => {
    const update_user = req.user?.empno || req.user?.u_code || req.body.update_user || 'System';
    const { code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min, inspection_sampling, water_displacement_used, time, rust_protection_used, rust_protection_time } = req.body;

    const query = `
      INSERT INTO tumble_condition (code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min, inspection_sampling, water_displacement_used, time, rust_protection_used, rust_protection_time, create_user, create_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP) RETURNING *`;

    try {
        const results = await pool.query(query, [code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min, inspection_sampling, water_displacement_used, time, rust_protection_used, rust_protection_time, update_user]);
        res.json({ success: true, message: "Added successfully", data: results.rows[0] });
    } catch (error) {
        console.error(":: error createTumbleCondition ::", error);
        res.status(500).json({ success: false, message: "Failed to add data" });
    }
};

const updateTumbleCondition = async (req, res) => {
    const { id } = req.params;
    const update_user = req.user?.empno || req.user?.u_code || req.body.update_user || 'System';
    const {
        code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max,
        media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min,
        inspection_sampling, water_displacement_used, time, rust_protection_used,
        rust_protection_time
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const currentData = await client.query('SELECT * FROM tumble_condition WHERE id = $1', [id]);
        if (currentData.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Data not found" });
        }

        const row = currentData.rows[0];

        const insertHistoryQuery = `
        INSERT INTO tumble_condition_history (
            code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max,
            media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min,
            inspection_sampling, water_displacement_used, time, rust_protection_used,
            rust_protection_time, update_user, update_date
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, CURRENT_TIMESTAMP
        )`;

        await client.query(insertHistoryQuery, [
            row.code, row.process, row.mc_type_no, row.cleaning_parts_used, row.cleaning_parts_time, row.qty_max,
            row.media_spec, row.media_qty_kg, row.ss_100, row.light_1a, row.water_qty_l, row.revolution, row.time_min,
            row.inspection_sampling, row.water_displacement_used, row.time, row.rust_protection_used,
            row.rust_protection_time, update_user
        ]);

        const updateQuery = `
            UPDATE tumble_condition
            SET code = $2, process = $3, mc_type_no = $4, cleaning_parts_used = $5, cleaning_parts_time = $6,
                qty_max = $7, media_spec = $8, media_qty_kg = $9, ss_100 = $10, light_1a = $11, water_qty_l = $12,
                revolution = $13, time_min = $14, inspection_sampling = $15, water_displacement_used = $16,
                time = $17, rust_protection_used = $18, rust_protection_time = $19,
                update_user = $20, update_date = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *`;

        const results = await client.query(updateQuery, [
            id, code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time,
            qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l,
            revolution, time_min, inspection_sampling, water_displacement_used, time,
            rust_protection_used, rust_protection_time, update_user
        ]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Updated successfully", data: results.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(":: error updateTumbleCondition ::", error);
        res.status(500).json({ success: false, message: "Failed to update data" });
    } finally {
        client.release();
    }
};

const deleteTumbleCondition = async (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM tumble_condition WHERE id = $1 RETURNING *";

    try {
        const results = await pool.query(query, [id]);
        if (results.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Data not found" });
        }
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        console.error(":: error deleteTumbleCondition ::", error);
        res.status(500).json({ success: false, message: "Failed to delete data" });
    }
};

// ==========================================
// Tumble Condition Part (tumble_condition_part)
// ==========================================

const getAllTumbleConditionPart = async (req, res) => {
    try {
        const query = `SELECT * FROM tumble_condition_part ORDER BY code, part_name;`;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(":: error getAllTumbleConditionPart ::", err);
        res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
};

const createTumbleConditionPart = async (req, res) => {
    const update_user = req.user?.empno || req.user?.u_code || req.body.update_user || 'System';
    const { code, part_name, detail, material_part, part_size, process_code } = req.body;

    const query = `
      INSERT INTO tumble_condition_part (code, part_name, detail, material_part, part_size, process_code, update_user, create_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING *`;

    try {
        const results = await pool.query(query, [code, part_name, detail, material_part, part_size, process_code, update_user]);
        res.json({ success: true, message: "Added successfully", data: results.rows[0] });
    } catch (error) {
        console.error(":: error createTumbleConditionPart ::", error);
        res.status(500).json({ success: false, message: "Failed to add data" });
    }
};

const updateTumbleConditionPart = async (req, res) => {
    const { id } = req.params;
    const update_user = req.user?.empno || req.user?.u_code || req.body.update_user || 'System';
    const { code, part_name, detail, material_part, part_size, process_code } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updateQuery = `
            UPDATE tumble_condition_part
            SET 
              code = $2,
              part_name = $3,
              detail = $4,
              material_part = $5,
              part_size = $6,
              process_code = $7,
              update_user = $8,
              update_date = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
          `;
        const results = await client.query(updateQuery, [
            id, code, part_name, detail, material_part, part_size, process_code, update_user
        ]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Updated successfully", data: results.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(":: error updateTumbleConditionPart ::", error);
        res.status(500).json({ success: false, message: "Failed to update data" });
    } finally {
        client.release();
    }
};

const deleteTumbleConditionPart = async (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM tumble_condition_part WHERE id = $1 RETURNING *";

    try {
        const results = await pool.query(query, [id]);
        if (results.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Data not found" });
        }
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        console.error(":: error deleteTumbleConditionPart ::", error);
        res.status(500).json({ success: false, message: "Failed to delete data" });
    }
};

// ==========================================
// MRP Data
// ==========================================
const getMrpDataByLotNo = async (req, res) => {
    const { lotNo } = req.params;
    console.log(":: getMrpDataByLotNo ::", lotNo);
    try {
        const query = `SELECT *, mrp_kzwcode as lot_no FROM pc_mrp WHERE mrp_kzwcode = $1 OR mrp_itemno = $1 OR mrp_mono = $1 ORDER BY mrp_seq ASC`;
        const result = await pool.query(query, [lotNo]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(":: error getMrpDataByLotNo ::", err);
        res.status(500).json({ success: false, message: 'Failed to fetch MRP data' });
    }
};

module.exports = {
    // Tumble Model
    getTumbleModelByOldCn,
    getAllTumbleModel,
    createTumbleModel,
    updateTumbleModel,
    deleteTumbleModel,

    // Tumble Condition
    getTumbleConditionByCode,
    getAllTumbleCondition,
    createTumbleCondition,
    updateTumbleCondition,
    deleteTumbleCondition,

    // Tumble Condition Part
    getAllTumbleConditionPart,
    createTumbleConditionPart,
    updateTumbleConditionPart,
    deleteTumbleConditionPart,

    // MRP Data
    getMrpDataByLotNo,
};
