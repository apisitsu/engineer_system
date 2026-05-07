import React, { useState } from 'react';
import { Card, List, Progress, Button, Space, Typography, Badge, Empty, Row, Col, Divider, Tooltip, Input, Select, DatePicker, Popover } from 'antd';
import { IoGridOutline, IoListOutline, IoTimeOutline, IoPauseCircleOutline, IoCheckmarkCircleOutline, IoSettingsOutline, IoSearchOutline, IoCalendarOutline } from 'react-icons/io5';
import dayjs from 'dayjs';
import { useKanbanStore } from './store/kanbanStore';

const { Title, Text } = Typography;

const PRIORITY_CONFIG = {
    LOW: { label: 'Low', emoji: '🟢', color: '#52c41a', bgColor: '#f6ffed' },
    MEDIUM: { label: 'Medium', emoji: '🔵', color: '#1677ff', bgColor: '#e6f4ff' },
    HIGH: { label: 'High', emoji: '🟠', color: '#fa8c16', bgColor: '#fff7e6' },
    URGENT: { label: 'Urgent', emoji: '🔴', color: '#f5222d', bgColor: '#fff2f0' },
};

const BoardDashboard = ({ boards, onSelectBoard, onOpenBoardSettings }) => {
    const [viewMode, setViewMode] = useState('card');
    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [dueDateFilter, setDueDateFilter] = useState('ALL');

    const updateBoard = useKanbanStore(state => state.updateBoard);

    const handleUpdatePriority = (e, boardId, priority) => {
        e.stopPropagation();
        updateBoard(boardId, { priority });
    };

    const handleUpdateDueDate = (date, boardId) => {
        updateBoard(boardId, { due_date: date ? date.format('YYYY-MM-DD') : null });
    };

    const getBoardProgress = (board) => {
        const total = parseInt(board.total_cards) || 0;
        const done = parseInt(board.done_cards) || 0;
        const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, percentage };
    };

    // Filter Boards
    const filteredBoards = boards.filter(b => {
        // Search
        if (searchTerm && !b.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        // Priority
        if (priorityFilter !== 'ALL' && (b.priority || 'MEDIUM') !== priorityFilter) return false;
        
        // Due Date
        if (dueDateFilter !== 'ALL') {
            if (!b.due_date) return false;
            const due = dayjs(b.due_date);
            const today = dayjs().startOf('day');
            
            if (dueDateFilter === 'OVERDUE') {
                if (!due.isBefore(today)) return false;
            } else if (dueDateFilter === 'TODAY') {
                if (!due.isSame(today, 'day')) return false;
            } else if (dueDateFilter === 'UPCOMING') {
                if (due.isBefore(today) || due.isSame(today, 'day')) return false;
            }
        }
        
        return true;
    });

    const poolBoards = filteredBoards.filter(b => b.status === 'pool' || !b.status);
    const activeBoards = filteredBoards.filter(b => b.status === 'active');
    const suspendedBoards = filteredBoards.filter(b => b.status === 'suspended');
    const finishedBoards = filteredBoards.filter(b => b.status === 'finished');

    const renderPrioritySelector = (board) => {
        const currentPriority = board.priority || 'MEDIUM';
        const config = PRIORITY_CONFIG[currentPriority];
        
        const menu = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <div 
                        key={key}
                        onClick={(e) => handleUpdatePriority(e, board.id, key)}
                        style={{ 
                            padding: '4px 8px', cursor: 'pointer', borderRadius: 4,
                            background: currentPriority === key ? cfg.bgColor : 'transparent',
                            display: 'flex', alignItems: 'center', gap: 8
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = cfg.bgColor}
                        onMouseLeave={(e) => e.currentTarget.style.background = currentPriority === key ? cfg.bgColor : 'transparent'}
                    >
                        <span>{cfg.emoji}</span>
                        <Text style={{ color: cfg.color, fontWeight: 500 }}>{cfg.label}</Text>
                    </div>
                ))}
            </div>
        );

        return (
            <Popover content={menu} trigger="click" placement="bottomLeft">
                <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 4, 
                        padding: '2px 8px', borderRadius: 12, 
                        background: config.bgColor, border: `1px solid ${config.color}30`,
                        cursor: 'pointer', fontSize: 12
                    }}
                >
                    <span>{config.emoji}</span>
                    <span style={{ color: config.color, fontWeight: 500 }}>{config.label}</span>
                </div>
            </Popover>
        );
    };

    const renderDueDateSelector = (board) => {
        const isOverdue = board.due_date && dayjs(board.due_date).isBefore(dayjs(), 'day');
        return (
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <DatePicker
                    size="small"
                    value={board.due_date ? dayjs(board.due_date) : null}
                    onChange={(date) => handleUpdateDueDate(date, board.id)}
                    format="DD MMM YYYY"
                    placeholder="Set Due Date"
                    bordered={false}
                    suffixIcon={<IoCalendarOutline style={{ color: isOverdue ? '#f5222d' : 'inherit' }} />}
                    style={{ 
                        padding: '0 4px', 
                        color: isOverdue ? '#f5222d' : 'inherit',
                        fontWeight: isOverdue ? 600 : 'normal'
                    }}
                />
            </div>
        );
    };

    const renderCard = (board, icon, color) => {
        const { total, done, percentage } = getBoardProgress(board);
        return (
            <Card
                hoverable
                onClick={() => onSelectBoard(board)}
                style={{ height: '100%', borderColor: color }}
                bodyStyle={{ padding: 16 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Space>
                        <span style={{ color, fontSize: 20, display: 'flex' }}>{icon}</span>
                        <Text strong ellipsis style={{ maxWidth: 120 }}>{board.name}</Text>
                    </Space>
                    <Space size={4}>
                        <Badge color={color} text={board.status || 'pool'} style={{ textTransform: 'capitalize' }} />
                        {onOpenBoardSettings && (
                            <Tooltip title="Board Settings">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<IoSettingsOutline size={13} />}
                                    onClick={(e) => { e.stopPropagation(); onOpenBoardSettings(board); }}
                                    style={{
                                        color: '#bfbfbf',
                                        width: 22, height: 22, minWidth: 22,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: 4, padding: 0,
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#595959'; e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = '#bfbfbf'; e.currentTarget.style.background = 'transparent'; }}
                                />
                            </Tooltip>
                        )}
                    </Space>
                </div>
                
                {/* Priority & Due Date Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, background: '#fafafa', padding: '6px 8px', borderRadius: 6 }}>
                    {renderPrioritySelector(board)}
                    {renderDueDateSelector(board)}
                </div>

                <Text type="secondary" style={{ fontSize: 12 }}>View: {board.default_view}</Text>
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Progress</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{done} / {total}</Text>
                    </div>
                    <Progress percent={percentage} size="small" strokeColor={color} status={percentage === 100 ? 'success' : 'active'} />
                </div>
            </Card>
        );
    };

    const renderListItem = (board, icon, color) => {
        const { total, done, percentage } = getBoardProgress(board);
        return (
            <List.Item
                onClick={() => onSelectBoard(board)}
                style={{ cursor: 'pointer', padding: '16px 24px', background: '#fff', transition: 'background 0.3s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
                <List.Item.Meta
                    avatar={<span style={{ color, fontSize: 24, display: 'flex' }}>{icon}</span>}
                    title={
                        <Space style={{ marginBottom: 4 }}>
                            <Text strong>{board.name}</Text>
                            {renderPrioritySelector(board)}
                            {renderDueDateSelector(board)}
                        </Space>
                    }
                    description={<Badge color={color} text={board.status || 'pool'} style={{ textTransform: 'capitalize' }} />}
                />
                <div style={{ width: '30%', marginRight: 24 }}>
                    <Progress percent={percentage} size="small" strokeColor={color} status={percentage === 100 ? 'success' : 'active'} />
                </div>
                <Text type="secondary" style={{ width: '100px', textAlign: 'right' }}>{done} / {total} Cards</Text>
            </List.Item>
        );
    };

    const renderSection = (title, items, icon, color) => {
        if (!items || items.length === 0) return null;
        
        return (
            <div style={{ marginBottom: 32 }}>
                <Title level={5} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                    {title} <Badge count={items.length} style={{ backgroundColor: '#f0f0f0', color: '#595959', marginLeft: 12 }} />
                </Title>
                
                {viewMode === 'card' ? (
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        {items.map(b => (
                            <Col xs={24} sm={12} md={8} lg={6} key={b.id}>
                                {renderCard(b, icon, color)}
                            </Col>
                        ))}
                    </Row>
                ) : (
                    <List
                        bordered
                        dataSource={items}
                        renderItem={b => renderListItem(b, icon, color)}
                        style={{ marginTop: 16, background: '#fff' }}
                    />
                )}
            </div>
        );
    };

    return (
        <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: '#fff', padding: '16px 24px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Operations Dashboard</Title>
                    <Text type="secondary">Overview of all boards within this permanent project</Text>
                </div>
                <Space>
                    <Tooltip title="Card View">
                        <Button 
                            type={viewMode === 'card' ? 'primary' : 'default'} 
                            icon={<IoGridOutline />} 
                            onClick={() => setViewMode('card')} 
                        />
                    </Tooltip>
                    <Tooltip title="List View">
                        <Button 
                            type={viewMode === 'list' ? 'primary' : 'default'} 
                            icon={<IoListOutline />} 
                            onClick={() => setViewMode('list')} 
                        />
                    </Tooltip>
                </Space>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24, background: '#fff', padding: '12px 24px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <Input 
                    placeholder="Search boards..." 
                    prefix={<IoSearchOutline color="#bfbfbf" />} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                />
                <Select
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    style={{ width: 150 }}
                    options={[
                        { value: 'ALL', label: 'All Priorities' },
                        ...Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => ({
                            value: key,
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{cfg.emoji} {cfg.label}</span>
                        }))
                    ]}
                />
                <Select
                    value={dueDateFilter}
                    onChange={setDueDateFilter}
                    style={{ width: 150 }}
                    options={[
                        { value: 'ALL', label: 'Any Due Date' },
                        { value: 'OVERDUE', label: 'Overdue' },
                        { value: 'TODAY', label: 'Due Today' },
                        { value: 'UPCOMING', label: 'Upcoming' },
                    ]}
                />
            </div>

            {/* Sections */}
            {renderSection('Active Operations', activeBoards, <IoTimeOutline />, '#1890ff')}
            {renderSection('Waiting Pool', poolBoards, <IoTimeOutline />, '#faad14')}
            {renderSection('Suspended', suspendedBoards, <IoPauseCircleOutline />, '#fa8c16')}

            {finishedBoards.length > 0 && (
                <>
                    <Divider dashed style={{ margin: '32px 0' }} />
                    {renderSection('Finished / Archived', finishedBoards, <IoCheckmarkCircleOutline />, '#52c41a')}
                </>
            )}

            {filteredBoards.length === 0 && (
                <Empty description={boards.length === 0 ? "No boards found" : "No boards match your filters"} style={{ marginTop: 64, background: '#fff', padding: 48, borderRadius: 8, border: '1px solid #f0f0f0' }} />
            )}
        </div>
    );
};

export default BoardDashboard;
