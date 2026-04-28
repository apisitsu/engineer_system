/**
 * CardDetailDrawer.jsx — Lightweight Shell (F3-05 Refactored)
 * 
 * Orchestrates all sub-components via CardDetailProvider context:
 *   - CardHeader (title, badges, time tracking)
 *   - CardBody (description, issues, memo, attachments, custom fields, parent/child)
 *   - CardTaskLists (checklists with tasks)
 *   - CardComments (comments, actions, time tracking tabs)
 *   - CardSidebar (membership, add-to-card, actions, suspend)
 *
 * This file was reduced from ~2469 lines to ~80 lines.
 */

import React from 'react';
import { Drawer, Typography, Row, Col, Divider, Button } from 'antd';

import { CardDetailProvider, useCardDetailState } from './useCardDetailState';
import CardHeader from './CardHeader';
import CardBody from './CardBody';
import CardTaskLists from './CardTaskLists';
import CardComments from './CardComments';
import CardSidebar from './CardSidebar';
import { AttachmentPreviewModal } from './AttachmentViewManager';
import { IoCloseOutline } from 'react-icons/io5';

const { Text } = Typography;

/** Inner content — must be inside CardDetailProvider to use context */
const CardDetailContent = () => {
    const {
        card, theme, isCardDetailOpen, closeCardDetail,
        previewAttachment, isPreviewVisible, setIsPreviewVisible,
    } = useCardDetailState();

    return (
        <>
            <Drawer
                title={null}
                placement="right"
                width={760}
                onClose={closeCardDetail}
                open={isCardDetailOpen}
                closable={false}
                styles={{ body: { padding: 0, background: theme.colors.background } }}
            >
                {!card ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <Text type="secondary">Loading card details...</Text>
                    </div>
                ) : (
                    <>
                        {/* Gradient Header Cover — full width */}
                        <div style={{
                            height: 56,
                            background: `linear-gradient(135deg, ${theme.colors.primaryLight}, ${theme.colors.secondaryLight || theme.colors.primaryLight})`,
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            padding: `0 ${theme.spacing.md}`
                        }}>
                            <Button
                                type="text"
                                icon={<IoCloseOutline size={22} />}
                                onClick={closeCardDetail}
                                style={{
                                    background: 'rgba(255,255,255,0.7)',
                                    backdropFilter: 'blur(4px)',
                                    borderRadius: '50%',
                                    width: 36, height: 36,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            />
                        </div>

                        <div style={{ padding: `${theme.spacing.md} ${theme.spacing.xl} ${theme.spacing.xl}` }}>
                            <Row gutter={24}>
                                {/* Left Column — Main Content */}
                                <Col xs={24} md={16}>
                                    <CardHeader />

                                    <CardBody />

                                    <Divider style={{ margin: `${theme.spacing.md} 0` }} />

                                    <CardTaskLists />

                                    <Divider style={{ margin: `${theme.spacing.md} 0` }} />

                                    <CardComments />
                                </Col>

                                {/* Right Column — Sidebar */}
                                <Col xs={24} md={8}>
                                    <CardSidebar />
                                </Col>
                            </Row>
                        </div>
                    </>
                )}
            </Drawer>

            <AttachmentPreviewModal
                visible={isPreviewVisible}
                onClose={() => setIsPreviewVisible(false)}
                attachment={previewAttachment}
                theme={theme}
            />
        </>
    );
};

/** 
 * Root export — wraps everything in CardDetailProvider so all 
 * sub-components can consume shared state via useCardDetailState().
 */
const CardDetailDrawer = () => (
    <CardDetailProvider>
        <CardDetailContent />
    </CardDetailProvider>
);

export default CardDetailDrawer;
