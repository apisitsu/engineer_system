import React, { useState } from 'react';
import { Card, List, Progress, Button, Space, Typography, Badge, Empty, Row, Col, Divider, Tooltip } from 'antd';
import { IoGridOutline, IoListOutline, IoTimeOutline, IoPauseCircleOutline, IoCheckmarkCircleOutline, IoSettingsOutline } from 'react-icons/io5';

const { Title, Text } = Typography;

const BoardDashboard = ({ boards, onSelectBoard, onOpenBoardSettings }) => {
    const [viewMode, setViewMode] = useState('card');

    const poolBoards = boards.filter(b => b.status === 'pool' || !b.status);
    const activeBoards = boards.filter(b => b.status === 'active');
    const suspendedBoards = boards.filter(b => b.status === 'suspended');
    const finishedBoards = boards.filter(b => b.status === 'finished');

    const getBoardProgress = (board) => {
        const total = parseInt(board.total_cards) || 0;
        const done = parseInt(board.done_cards) || 0;
        const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, percentage };
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
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
                <Text type="secondary" style={{ fontSize: 12 }}>View: {board.default_view}</Text>
                <div style={{ marginTop: 16 }}>
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
                    title={<Text strong>{board.name}</Text>}
                    description={<Badge color={color} text={board.status || 'pool'} style={{ textTransform: 'capitalize' }} />}
                />
                <div style={{ width: '40%', marginRight: 24 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, background: '#fff', padding: '16px 24px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
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

            {boards.length === 0 && (
                <Empty description="No boards found" style={{ marginTop: 64, background: '#fff', padding: 48, borderRadius: 8, border: '1px solid #f0f0f0' }} />
            )}
        </div>
    );
};

export default BoardDashboard;
