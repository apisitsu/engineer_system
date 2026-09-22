/**
 * DMS Controller
 * HTTP request handlers for Document Management System.
 */
const documentService = require('./documentService');

/**
 * List documents
 */
async function getDocuments(req, res) {
    try {
        const {
            type_id,
            prefix,
            category,
            part,
            link_filter,
            search,
            page,
            pageSize,
            sortBy,
            sortOrder
        } = req.query;

        const result = await documentService.listDocuments({
            type_id,
            prefix,
            category,
            part,
            link_filter,
            search,
            page: page ? parseInt(page, 10) : 1,
            pageSize: pageSize ? parseInt(pageSize, 10) : 20,
            sortBy,
            sortOrder
        });

        res.json({ result: 'true', data: result });
    } catch (err) {
        console.error('getDocuments error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * Get document by ID
 */
async function getDocument(req, res) {
    try {
        const { id } = req.params;
        const doc = await documentService.getDocumentById(id);
        if (!doc) {
            return res.status(404).json({ result: 'false', message: 'Document not found' });
        }
        res.json({ result: 'true', data: doc });
    } catch (err) {
        console.error('getDocument error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * Preview next number for a document type
 */
async function previewNextDocNumber(req, res) {
    try {
        const { typeId } = req.params;
        const preview = await documentService.previewNextNumber(typeId);
        res.json({ result: 'true', data: preview });
    } catch (err) {
        console.error('previewNextDocNumber error:', err.message);
        res.status(400).json({ result: 'false', message: err.message });
    }
}

/**
 * Issue new document number (with transaction lock)
 */
async function issueNewDocument(req, res) {
    try {
        const {
            type_id,
            title,
            part,
            document_link,
            link_innovator,
            seq_no,
            note
        } = req.body;

        const created_by = req.user?.empno 
            ? `${req.user.empno}${req.user.name ? ` (${req.user.name})` : ''}` 
            : (req.body.created_by || 'admin');

        const doc = await documentService.issueDocument({
            type_id,
            title,
            part,
            document_link,
            link_innovator,
            seq_no,
            note,
            created_by
        });

        res.status(201).json({
            result: 'true',
            message: `Issued document ${doc.document_no} successfully`,
            data: doc
        });
    } catch (err) {
        console.error('issueNewDocument error:', err.message);
        res.status(400).json({ result: 'false', message: err.message });
    }
}

/**
 * Update document
 */
async function updateDocument(req, res) {
    try {
        const { id } = req.params;
        const {
            title,
            part,
            document_link,
            link_innovator,
            seq_no,
            note
        } = req.body;

        const updated_by = req.user?.empno 
            ? `${req.user.empno}${req.user.name ? ` (${req.user.name})` : ''}` 
            : (req.body.updated_by || 'admin');

        const doc = await documentService.updateDocument(id, {
            title,
            part,
            document_link,
            link_innovator,
            seq_no,
            note,
            updated_by
        });

        res.json({
            result: 'true',
            message: `Updated document ${doc.document_no} successfully`,
            data: doc
        });
    } catch (err) {
        console.error('updateDocument error:', err.message);
        res.status(400).json({ result: 'false', message: err.message });
    }
}

/**
 * Delete document (soft delete)
 */
async function deleteDocument(req, res) {
    try {
        const { id } = req.params;
        const deleted_by = req.user?.empno 
            ? `${req.user.empno}${req.user.name ? ` (${req.user.name})` : ''}` 
            : (req.body.deleted_by || 'admin');

        const result = await documentService.deleteDocument(id, deleted_by);
        res.json({
            result: 'true',
            message: `Document ${result.document_no} deleted successfully`,
            data: result
        });
    } catch (err) {
        console.error('deleteDocument error:', err.message);
        res.status(400).json({ result: 'false', message: err.message });
    }
}

/**
 * List document types
 */
async function getDocumentTypes(req, res) {
    try {
        const types = await documentService.listDocumentTypes();
        res.json({ result: 'true', data: types });
    } catch (err) {
        console.error('getDocumentTypes error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * Create new document type
 */
async function createDocumentType(req, res) {
    try {
        const { prefix, name, category, current_number, description } = req.body;
        const newType = await documentService.createDocumentType({
            prefix,
            name,
            category,
            current_number,
            description
        });
        res.status(201).json({
            result: 'true',
            message: `Created document type ${newType.prefix} successfully`,
            data: newType
        });
    } catch (err) {
        console.error('createDocumentType error:', err.message);
        res.status(400).json({ result: 'false', message: err.message });
    }
}

/**
 * Update document type
 */
async function updateDocumentType(req, res) {
    try {
        const { id } = req.params;
        const { name, category, current_number, is_active, description } = req.body;
        const updated = await documentService.updateDocumentType(id, {
            name,
            category,
            current_number,
            is_active,
            description
        });
        res.json({
            result: 'true',
            message: `Updated document type ${updated.prefix} successfully`,
            data: updated
        });
    } catch (err) {
        console.error('updateDocumentType error:', err.message);
        res.status(400).json({ result: 'false', message: err.message });
    }
}

/**
 * Dashboard statistics
 */
async function getStats(req, res) {
    try {
        const stats = await documentService.getDashboardStats();
        res.json({ result: 'true', data: stats });
    } catch (err) {
        console.error('getStats error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

module.exports = {
    getDocuments,
    getDocument,
    previewNextDocNumber,
    issueNewDocument,
    updateDocument,
    deleteDocument,
    getDocumentTypes,
    createDocumentType,
    updateDocumentType,
    getStats
};
