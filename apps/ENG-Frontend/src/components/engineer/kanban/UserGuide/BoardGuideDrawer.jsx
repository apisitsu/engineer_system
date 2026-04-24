import React from 'react';
import { Drawer, Typography, Divider, Space, Collapse } from 'antd';
import { BsKanban, BsTextParagraph, BsClockHistory } from 'react-icons/bs';
import { IoAddOutline, IoDuplicateOutline, IoMoveOutline, IoArchiveOutline, IoSearchOutline, IoHelpCircleOutline, IoOptionsOutline } from 'react-icons/io5';
import { MdOutlinePeople, MdOutlineLabel, MdOutlineTimer, MdOutlineTextsms } from 'react-icons/md';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

const BoardGuideDrawer = ({ open, onClose, theme }) => {
    return (
        <Drawer
            title={
                <Space>
                    <IoHelpCircleOutline size={22} color={theme.colors.primary} />
                    <span style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: 700 }}>How to Use This Board</span>
                </Space>
            }
            placement="right"
            onClose={onClose}
            open={open}
            width={500}
            styles={{
                header: { background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` },
                body: { background: theme.colors.background, padding: theme.spacing['2xl'] },
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
                <Paragraph style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                    The Board is your interactive canvas. It consists of vertical Lists (columns) and Cards (tasks). This quick guide covers the basics of navigating and managing your workflow.
                </Paragraph>

                <Collapse defaultActiveKey={['1', '2', '3']} ghost>
                    <Panel 
                        header={<Text strong style={{ fontSize: 15 }}><IoMoveOutline style={{ marginRight: 8 }}/>Managing Cards & Lists</Text>} 
                        key="1"
                    >
                        <ul>
                            <li><strong>Drag and Drop:</strong> Click and hold any card to move it between lists. You can also drag lists horizontally to reorder your entire workflow.</li>
                            <li><strong>Adding Cards:</strong> Click the "+ Add a card" button at the bottom of any list, type your task title, and press Enter.</li>
                            <li><strong>Quick Edit:</strong> Hover over a card and click the small pencil icon to quickly change labels, members, or due dates without opening the full drawer.</li>
                            <li><strong>Delete List:</strong> Deleting a list will also permanently delete all cards inside it.</li>
                        </ul>
                        <Collapse 
                            ghost 
                            bordered={false} 
                            defaultActiveKey={['1']}
                            expandIconPosition="end"
                            style={{ background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md }}
                        >
                            <Panel 
                                header={<Text strong style={{ fontSize: 15 }}><IoArchiveOutline style={{ marginRight: 8 }}/>Archiving vs. Deleting</Text>} 
                                key="2"
                            >
                                <ul>
                                    <li><strong>Archive:</strong> When a task is done, you should archive the card instead of deleting it. Archived cards are hidden from the board but remain in the database for statistical reporting.</li>
                                    <li><strong>Unarchive:</strong> You can restore archived items from the Board Settings &gt; Archived Items menu.</li>
                                    <li><strong>Delete:</strong> Deletion is permanent. Only administrators or project managers can fully delete a card.</li>
                                </ul>
                            </Panel>
                        </Collapse>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 15 }}><MdOutlinePeople style={{ marginRight: 8 }}/>Filtering & Searching</Text>} 
                        key="2"
                    >
                        <Paragraph>
                            Use the tools in the upper right Board Toolbar to hone in on specific tasks:
                        </Paragraph>
                        <ul>
                            <li><MdOutlinePeople style={{ display: 'inline', marginRight: 4 }}/><strong>Members Filter:</strong> Select one or more team members to instantly highlight only the cards assigned to them.</li>
                            <li><MdOutlineLabel style={{ display: 'inline', marginRight: 4 }}/><strong>Label Filter:</strong> Click to toggle specific colored labels (e.g., "High Priority", "Bug") on or off.</li>
                            <li><IoSearchOutline style={{ display: 'inline', marginRight: 4 }}/><strong>Search:</strong> Type keywords to instantly filter cards by their title or description.</li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 15 }}><BsTextParagraph style={{ marginRight: 8 }}/>Card Details & Actions</Text>} 
                        key="4"
                    >
                        <Paragraph>
                            Clicking on any card opens the <strong>Card Detail Drawer</strong>. This is the command center for individual tasks.
                        </Paragraph>
                        <ul>
                            <li><strong>Description & Memo:</strong> Write detailed markdown descriptions. Use the "Memo" section for internal context or private notes.</li>
                            <li><strong>Checklists (Task Lists):</strong> Add actionable sub-tasks. You can toggle them when completed.</li>
                            <li><strong>Problem \u0026 Solution:</strong> Log any roadblocks encountered during this task for future reference.</li>
                            <li><strong>Attachments:</strong> Drag and drop files directly or add external mapped links (`H:\\...`).</li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 15 }}><IoOptionsOutline style={{ marginRight: 8 }}/>Right Sidebar Actions</Text>} 
                        key="5"
                    >
                        <Paragraph>
                            The right sidebar inside the card drawer provides powerful task commands:
                        </Paragraph>
                        <ul>
                            <li><strong>Join:</strong> Instantly add yourself as a member to track notifications.</li>
                            <li><strong>Members & Labels:</strong> Assign teammates to the card and apply color-coded tags.</li>
                            <li><strong>Due Date:</strong> Set a strict deadline. The badge acts as a warning when overdue.</li>
                            <li><MdOutlineTimer style={{ display: 'inline', marginRight: 4 }}/><strong>Est. Hours:</strong> Declare how many hours this task will take. This drives the Workload tracker.</li>
                            <li><strong>Move / Delete:</strong> Quickly transfer the card to another list, or permanently discard it (Admin/Manager only).</li>
                            <li><strong>Activity Log:</strong> View a full audit trail of everything that has changed on this card.</li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 15 }}><MdOutlineTextsms style={{ marginRight: 8 }}/>Comments & Mentions</Text>} 
                        key="6"
                    >
                        <ul>
                            <li><strong>Collaboration:</strong> Scroll to the bottom of the card to find the Activity \u0026 Collaboration field. Post status updates here.</li>
                            <li><strong>Mentions:</strong> Type `@` followed by a user's name or ID (e.g., `@LE131`) to tag them. The system will automatically notify them and add them to the card members if they are part of the project.</li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 15 }}><BsClockHistory style={{ marginRight: 8 }}/>Time Tracking (Lead Time)</Text>} 
                        key="7"
                    >
                        <ul>
                            <li><strong>Time in Current State:</strong> The card dynamically calculates how long it has been sitting in the current list since it was moved. Use this to spot lingering or stuck tasks.</li>
                            <li><strong>Total Lead Time:</strong> Once a task reaches the "Done" list, the system measures the total time elapsed from the moment it entered an "In Progress" list to completion. This acts as a vital performance metric.</li>
                        </ul>
                    </Panel>
                </Collapse>

            </div>
        </Drawer>
    );
};

export default BoardGuideDrawer;
