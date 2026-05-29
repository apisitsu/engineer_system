import React, { useState, useEffect } from 'react';
import { Modal, Select, Typography, Button } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const LoadBoardTemplateModal = ({ open, onClose, boardId, theme }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stamping, setStamping] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [targetListId, setTargetListId] = useState(null); // null = Create new lists

    const stampBoardData = useKanbanStore(state => state.stampBoardData);
    const lists = useKanbanStore(state => state.lists) || [];

    useEffect(() => {
        if (open) {
            setLoading(true);
            axios.get(`${server.KANBAN_TEMPLATES}?type=project`)
                .then(res => setTemplates(res.data?.data || []))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        } else {
            setSelectedTemplate(null);
            setTargetListId(null);
        }
    }, [open]);

    const handleLoad = async () => {
        if (!selectedTemplate) return;
        setStamping(true);
        const success = await stampBoardData(boardId, selectedTemplate, targetListId);
        setStamping(false);
        if (success) {
            onClose();
        }
    };

    return (
        <Modal
            title="Load Data from Template"
            open={open}
            onCancel={onClose}
            onOk={handleLoad}
            okText="Load Template"
            confirmLoading={stamping}
            okButtonProps={{ disabled: !selectedTemplate }}
        >
            <div style={{ padding: '10px 0' }}>
                <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
                    Loading a template will copy lists, cards, and labels from the template into this board.
                </Typography.Text>
                <Select
                    style={{ width: '100%' }}
                    placeholder="Select a Blueprint Template..."
                    loading={loading}
                    options={templates.map(t => ({ value: t.id, label: t.name }))}
                    onChange={setSelectedTemplate}
                    value={selectedTemplate}
                />
                
                <Typography.Text style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>
                    Destination List (Optional)
                </Typography.Text>
                <Select
                    style={{ width: '100%' }}
                    placeholder="Create new lists exactly as Blueprint"
                    options={[
                        { value: null, label: 'Create new lists exactly as Blueprint' },
                        ...lists.map(l => ({ value: l.id, label: `Put all cards into: ${l.name}` }))
                    ]}
                    onChange={setTargetListId}
                    value={targetListId}
                />
            </div>
        </Modal>
    );
};

export default LoadBoardTemplateModal;
