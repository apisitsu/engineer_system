/**
 * DMS Service
 * Business logic and PostgreSQL transaction locking for Document Management.
 */
const { engPool } = require('../../../../instance/eng_db');
const { TABLES, NUMBERING } = require('./documentConstants');

/**
 * Format document running number:
 * 0 - 999999 -> 000000 - 999999 (e.g. CP-000025)
 * >= 1000000 -> A00000 - ZZZZZZ (e.g. CP-A00000)
 */
function formatDocumentNumber(prefix, num) {
    if (num <= NUMBERING.MAX_DECIMAL) {
        return `${prefix}-${String(num).padStart(6, '0')}`;
    }
    const offset = num - NUMBERING.ALPHANUMERIC_START_NUM;
    const BASE_5 = Math.pow(36, 5); // 60,466,176
    const char1Index = Math.floor(offset / BASE_5);
    if (char1Index > 25) {
        throw new Error('Document number range exceeded (maximum reached: ZZZZZZ)');
    }
    const char1 = String.fromCharCode(65 + char1Index);
    const restVal = offset % BASE_5;
    const rest = restVal.toString(36).toUpperCase().padStart(5, '0');
    return `${prefix}-${char1}${rest}`;
}

/**
 * Preview next number for a document type without incrementing
 */
async function previewNextNumber(typeId) {
    const res = await engPool.query(
        `SELECT id, prefix, current_number FROM ${TABLES.DOCUMENT_TYPES} WHERE id = $1`,
        [typeId]
    );
    if (res.rows.length === 0) throw new Error('Document type not found');
    const type = res.rows[0];
    const nextNum = type.current_number + 1;
    return {
        type_id: type.id,
        prefix: type.prefix,
        next_number: nextNum,
        formatted_preview: formatDocumentNumber(type.prefix, nextNum)
    };
}

/**
 * Issue new document with strict Database Transaction Row-Lock (FOR UPDATE)
 */
async function issueDocument({ type_id, title, part, document_link, link_innovator, seq_no, note, created_by }) {
    if (!type_id) throw new Error('type_id is required');
    if (!title || !title.trim()) throw new Error('Title is required');

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // 1. Lock document type row
        const typeRes = await client.query(
            `SELECT id, prefix, name, category, current_number, is_active 
             FROM ${TABLES.DOCUMENT_TYPES} 
             WHERE id = $1 FOR UPDATE`,
            [type_id]
        );

        if (typeRes.rows.length === 0) {
            throw new Error(`Document type with ID ${type_id} not found`);
        }

        const type = typeRes.rows[0];
        if (!type.is_active) {
            throw new Error(`Document type ${type.prefix} (${type.name}) is currently inactive`);
        }

        // 2. Calculate next number and format
        const nextNum = type.current_number + 1;
        const documentNo = formatDocumentNumber(type.prefix, nextNum);

        // 3. Prevent duplicate check
        const existCheck = await client.query(
            `SELECT id FROM ${TABLES.DOCUMENTS} WHERE document_no = $1 AND deleted_at IS NULL`,
            [documentNo]
        );
        if (existCheck.rows.length > 0) {
            throw new Error(`Concurrency check failed: Document number ${documentNo} is already registered`);
        }

        // 4. Insert document record
        const insertRes = await client.query(
            `INSERT INTO ${TABLES.DOCUMENTS}
             (document_no, type_id, prefix, title, category, part, document_link, link_innovator, seq_no, note, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                documentNo,
                type.id,
                type.prefix,
                title.trim(),
                type.category || type.prefix,
                part ? part.trim() : null,
                document_link ? document_link.trim() : null,
                link_innovator ? link_innovator.trim() : null,
                seq_no ? seq_no.trim() : null,
                note ? note.trim() : null,
                created_by || 'System'
            ]
        );

        // 5. Increment current_number in document types table
        await client.query(
            `UPDATE ${TABLES.DOCUMENT_TYPES} 
             SET current_number = $1, updated_at = NOW() 
             WHERE id = $2`,
            [nextNum, type.id]
        );

        await client.query('COMMIT');
        return insertRes.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * List documents with pagination and rich filtering
 */
async function listDocuments({
    type_id,
    prefix,
    category,
    part,
    link_filter,
    search,
    page = 1,
    pageSize = 20,
    sortBy = 'id',
    sortOrder = 'DESC'
}) {
    const where = ['d.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (type_id) {
        where.push(`d.type_id = $${idx++}`);
        params.push(Number(type_id));
    }
    if (prefix) {
        where.push(`d.prefix = $${idx++}`);
        params.push(prefix);
    }
    if (category) {
        where.push(`d.category = $${idx++}`);
        params.push(category);
    }
    if (part) {
        where.push(`d.part = $${idx++}`);
        params.push(part);
    }
    if (link_filter === 'has_link') {
        where.push(`(d.document_link IS NOT NULL AND d.document_link != '')`);
    } else if (link_filter === 'no_link') {
        where.push(`(d.document_link IS NULL OR d.document_link = '')`);
    }

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        where.push(`(
            d.document_no ILIKE $${idx} OR 
            d.title ILIKE $${idx} OR 
            d.note ILIKE $${idx} OR 
            d.seq_no ILIKE $${idx} OR
            d.created_by ILIKE $${idx}
        )`);
        params.push(term);
        idx++;
    }

    const whereClause = where.join(' AND ');

    // Count query
    const countSql = `SELECT COUNT(*) AS total FROM ${TABLES.DOCUMENTS} d WHERE ${whereClause}`;
    const countRes = await engPool.query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Whitelist sort fields
    const safeSortFields = ['id', 'document_no', 'title', 'category', 'part', 'created_at', 'updated_at'];
    const safeSort = safeSortFields.includes(sortBy) ? `d.${sortBy}` : 'd.id';
    const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (Math.max(1, page) - 1) * pageSize;
    params.push(pageSize);
    params.push(offset);

    const querySql = `
        SELECT 
            d.*,
            t.name AS type_name,
            t.digit_length
        FROM ${TABLES.DOCUMENTS} d
        LEFT JOIN ${TABLES.DOCUMENT_TYPES} t ON d.type_id = t.id
        WHERE ${whereClause}
        ORDER BY ${safeSort} ${safeOrder}
        LIMIT $${idx++} OFFSET $${idx++}
    `;

    const dataRes = await engPool.query(querySql, params);

    return {
        items: dataRes.rows,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / pageSize)
    };
}

/**
 * Get single document by ID
 */
async function getDocumentById(id) {
    const res = await engPool.query(
        `SELECT d.*, t.name AS type_name, t.digit_length
         FROM ${TABLES.DOCUMENTS} d
         LEFT JOIN ${TABLES.DOCUMENT_TYPES} t ON d.type_id = t.id
         WHERE d.id = $1 AND d.deleted_at IS NULL`,
        [id]
    );
    return res.rows[0] || null;
}

/**
 * Update document details
 */
async function updateDocument(id, { title, part, document_link, link_innovator, seq_no, note, updated_by }) {
    const res = await engPool.query(
        `UPDATE ${TABLES.DOCUMENTS}
         SET title = COALESCE($1, title),
             part = $2,
             document_link = $3,
             link_innovator = $4,
             seq_no = $5,
             note = $6,
             updated_by = $7,
             updated_at = NOW()
         WHERE id = $8 AND deleted_at IS NULL
         RETURNING *`,
        [
            title ? title.trim() : null,
            part !== undefined ? (part ? part.trim() : null) : null,
            document_link !== undefined ? (document_link ? document_link.trim() : null) : null,
            link_innovator !== undefined ? (link_innovator ? link_innovator.trim() : null) : null,
            seq_no !== undefined ? (seq_no ? seq_no.trim() : null) : null,
            note !== undefined ? (note ? note.trim() : null) : null,
            updated_by || 'admin',
            id
        ]
    );
    if (res.rows.length === 0) throw new Error('Document not found or already deleted');
    return res.rows[0];
}

/**
 * Soft delete document
 */
async function deleteDocument(id, deleted_by) {
    const res = await engPool.query(
        `UPDATE ${TABLES.DOCUMENTS}
         SET deleted_at = NOW(),
             deleted_by = $1
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id, document_no`,
        [deleted_by || 'admin', id]
    );
    if (res.rows.length === 0) throw new Error('Document not found or already deleted');
    return res.rows[0];
}

/**
 * List all document types with current statistics
 */
async function listDocumentTypes() {
    const res = await engPool.query(`
        SELECT 
            t.*,
            COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL) AS total_documents,
            COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL AND (d.document_link IS NOT NULL AND d.document_link != '')) AS documents_with_links
        FROM ${TABLES.DOCUMENT_TYPES} t
        LEFT JOIN ${TABLES.DOCUMENTS} d ON t.id = d.type_id
        GROUP BY t.id
        ORDER BY t.id ASC
    `);
    return res.rows;
}

/**
 * Create new document type
 */
async function createDocumentType({ prefix, name, category, current_number = 0, description }) {
    if (!prefix || !prefix.trim()) throw new Error('Prefix is required');
    if (!name || !name.trim()) throw new Error('Name is required');

    const cleanPrefix = prefix.trim().toUpperCase();
    const cleanName = name.trim();

    const res = await engPool.query(
        `INSERT INTO ${TABLES.DOCUMENT_TYPES}
         (prefix, name, category, current_number, digit_length, description, is_active)
         VALUES ($1, $2, $3, $4, 6, $5, true)
         RETURNING *`,
        [cleanPrefix, cleanName, category ? category.trim() : cleanPrefix, Number(current_number) || 0, description || null]
    );
    return res.rows[0];
}

/**
 * Update document type
 */
async function updateDocumentType(id, { name, category, current_number, is_active, description }) {
    const fields = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); params.push(name.trim()); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); params.push(category ? category.trim() : null); }
    if (current_number !== undefined) { fields.push(`current_number = $${idx++}`); params.push(Number(current_number)); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(Boolean(is_active)); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const res = await engPool.query(
        `UPDATE ${TABLES.DOCUMENT_TYPES}
         SET ${fields.join(', ')}
         WHERE id = $${idx}
         RETURNING *`,
        params
    );
    if (res.rows.length === 0) throw new Error('Document type not found');
    return res.rows[0];
}

/**
 * Dashboard stats
 */
async function getDashboardStats() {
    const totalDocsRes = await engPool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE document_link IS NOT NULL AND document_link != '') AS with_links,
                COUNT(*) FILTER (WHERE document_link IS NULL OR document_link = '') AS missing_links
         FROM ${TABLES.DOCUMENTS}
         WHERE deleted_at IS NULL`
    );

    const byPrefixRes = await engPool.query(
        `SELECT prefix, category, COUNT(*) AS count
         FROM ${TABLES.DOCUMENTS}
         WHERE deleted_at IS NULL
         GROUP BY prefix, category
         ORDER BY count DESC`
    );

    const byPartRes = await engPool.query(
        `SELECT COALESCE(part, 'Unspecified') AS part, COUNT(*) AS count
         FROM ${TABLES.DOCUMENTS}
         WHERE deleted_at IS NULL
         GROUP BY part
         ORDER BY count DESC`
    );

    return {
        summary: totalDocsRes.rows[0],
        byPrefix: byPrefixRes.rows,
        byPart: byPartRes.rows
    };
}

module.exports = {
    formatDocumentNumber,
    previewNextNumber,
    issueDocument,
    listDocuments,
    getDocumentById,
    updateDocument,
    deleteDocument,
    listDocumentTypes,
    createDocumentType,
    updateDocumentType,
    getDashboardStats
};
