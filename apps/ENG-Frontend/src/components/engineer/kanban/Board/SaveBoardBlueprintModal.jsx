import React, { useState } from 'react';
import { Modal, Input, Typography } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';

const SaveBoardBlueprintModal = ({ open, onClose, boardId, theme }) => {
    const [templateName, setTemplateName] = useState('');
    const [loading, setLoading] = useState(false);
    
    const saveBoardAsBlueprint = useKanbanStore(state => state.saveBoardAsBlueprint);

    const handleSave = async () => {
        if (!templateName.trim()) return;
        setLoading(true);
        const success = await saveBoardAsBlueprint(boardId, templateName);
        setLoading(false);
        if (success) {
            setTemplateName('');
            onClose();
        }
    };

    return (
        <Modal
            title="Save Board as Blueprint"
            open={open}
            onCancel={onClose}
            onOk={handleSave}
            okText="Save as Blueprint"
            confirmLoading={loading}
            okButtonProps={{ disabled: !templateName.trim() }}
        >
            <div style={{ padding: '10px 0' }}>
                <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
                    This will create a new Master Template Blueprint with a deep copy of all lists, cards, subtasks, and labels from this board.
                </Typography.Text>
                <Input
                    placeholder="Enter Blueprint Template Name"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    autoFocus
                />
            </div>
        </Modal>
    );
};

export default SaveBoardBlueprintModal;
