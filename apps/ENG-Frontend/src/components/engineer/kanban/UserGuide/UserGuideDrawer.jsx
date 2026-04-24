import React from 'react';
import { Drawer, Typography, Divider, Alert, Space, Tag, Collapse, List } from 'antd';
import { 
    BsKanban, 
    BsGrid3X3Gap, 
    BsList 
} from 'react-icons/bs';
import { 
    MdOutlineDashboard, 
    MdOutlineAssessment, 
    MdOutlinePeople 
} from 'react-icons/md';
import { 
    IoTimeOutline, 
    IoCheckmarkDoneCircleOutline,
    IoSettingsOutline,
    IoSpeedometerOutline,
    IoAlbumsOutline
} from 'react-icons/io5';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const UserGuideDrawer = ({ open, onClose, theme }) => {
    return (
        <Drawer
            title={
                <Space>
                    <BsKanban size={22} color={theme.colors.primary} />
                    <span style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: 700 }}>Kanban System Manual</span>
                </Space>
            }
            placement="right"
            onClose={onClose}
            open={open}
            width={700}
            styles={{
                header: { background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` },
                body: { background: theme.colors.background, padding: theme.spacing['2xl'] },
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
                <Alert 
                    message="Welcome to the Engineering Kanban Project Management System!" 
                    description="This comprehensive guide will help you understand every aspect of the Kanban module, from managing complex projects down to individual task estimations and reporting." 
                    type="info" 
                    showIcon 
                    style={{ marginBottom: theme.spacing.md }}
                />

                <Collapse defaultActiveKey={['1']} ghost>
                    <Panel 
                        header={<Text strong style={{ fontSize: 16 }}><MdOutlineDashboard style={{ marginRight: 8 }}/>1. Projects & Dashboards</Text>} 
                        key="1"
                    >
                        <Paragraph>
                            The workspace is divided into specific tabs to keep your work organized:
                        </Paragraph>
                        <ul>
                            <li><strong>Dashboard:</strong> A high-level overview of the entire system. It shows the total count of projects and boards, highlights recent activity, and provides quick links.</li>
                            <li><strong>Projects:</strong> The central hub for creating and finding workspaces. 
                                <ul>
                                    <li><strong>Creating Projects:</strong> Click the "New Project" button. You can customize the look by selecting an icon and a gradient color.</li>
                                    <li><strong>Privacy Settings:</strong> You can set a project to <strong>Private</strong> (lock icon will appear). Private projects are completely hidden from non-members. Only Managers/Coordinators (MGR/COORD) and assigned members can access them.</li>
                                    <li><strong>Favorites:</strong> Click the Star icon on any project grid/list to pin it for easy access.</li>
                                    <li><strong>Views:</strong> Toggle between Grid View and List View based on your preference.</li>
                                </ul>
                            </li>
                            <li><strong>Reports:</strong> A strategic overview used by management to track project health and completion metrics.</li>
                            <li><strong>Workload:</strong> Real-time capacity monitoring and human resource planning based on task estimations.</li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 16 }}><IoAlbumsOutline style={{ marginRight: 8 }}/>2. Core Entities: Boards, Lists, and Cards</Text>} 
                        key="2"
                    >
                        <Paragraph>
                            Understanding the hierarchy is key to managing work effectively.
                        </Paragraph>
                        <ul>
                            <li><strong>Boards:</strong> A project contains multiple boards. A board is a specific canvas with visual customizable backgrounds representing a product area or workflow. Use the Board Settings (gear icon) to change backgrounds.</li>
                            <li><strong>Lists:</strong> The columns inside a board. Typical lists include "To Do", "In Progress", "Review", and "Done". You can add new lists and drag to reorder them horizontally.</li>
                            <li><strong>Cards (Tasks):</strong> The atomic unit of work inside a list. Creating a card allows you to:
                                <ul>
                                    <li>Add a detailed description using markdown.</li>
                                    <li>Assign multiple team members using the "Members" button.</li>
                                    <li>Apply Labels (colored tags) to categorize tasks.</li>
                                    <li>Set Due Dates and track potential overruns.</li>
                                </ul>
                            </li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 16 }}><IoTimeOutline style={{ marginRight: 8 }}/>3. Task Estimation & Advanced Card Features</Text>} 
                        key="3"
                    >
                        <Paragraph>
                            Properly estimating your tasks is critical for accurate workload analysis and progress tracking.
                        </Paragraph>
                        <ul>
                            <li><strong>Estimated Hours:</strong> Every card has an "Est. Hours" input field in its Detail Drawer. Fill this out realistically. This number feeds directly into the Workload Dashboard to calculate team capacity.</li>
                            <li><strong>Checklists:</strong> For complex tasks, add a Checklist. 
                                <ul>
                                    <li><strong>Inline Editing:</strong> Click directly on the title of a checklist to rename it without opening a separate menu.</li>
                                    <li>Track progress as you tick off nested tasks.</li>
                                </ul>
                            </li>
                            <li><strong>Attachments:</strong> Effortlessly drop files onto the card. The system automatically categorizes attachments and displays icons for Images, PDFs, and Office (Word, Excel) files. Links to mapped network drives (`H:\`) are also supported.</li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 16 }}><IoSpeedometerOutline style={{ marginRight: 8 }}/>4. Workload Management & Capacity</Text>} 
                        key="4"
                    >
                        <Paragraph>
                            The Workload tab provides visibility into team utilization to prevent burnout, identify bottlenecks, and allow for proactive reassignment.
                        </Paragraph>
                        <ul>
                            <li><strong>Capacity Baseline:</strong> The system calculates utilization based on a standard <Tag color="blue">30 productive hours</Tag> per week per member.</li>
                            <li><strong>Health Indicators:</strong> The dashboard summarizes workload using colors:
                                <ul>
                                    <li><Tag color="success">Green (Healthy)</Tag>: 20–25 hours allocated. Sustainable.</li>
                                    <li><Tag color="warning">Yellow (Tensed)</Tag>: 26–30 hours. Nearing full capacity.</li>
                                    <li><Tag color="error">Red (Overloaded)</Tag>: &gt; 30 hours allocated. The team member is bottlenecked.</li>
                                </ul>
                            </li>
                            <li><strong>Manager View vs. Individual View:</strong>
                                <ul>
                                    <li><strong>My Workload:</strong> Focuses on your personalized distribution and helps you prioritize.</li>
                                    <li><strong>Team View (Manager):</strong> Displays a horizontal Bar Chart comparing all members across the project. Managers can drill down into a specific member to reassign cards directly if someone is overloaded (e.g., due to PTO).</li>
                                </ul>
                            </li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 16 }}><MdOutlineAssessment style={{ marginRight: 8 }}/>5. Reports & High-Fidelity Exports</Text>} 
                        key="5"
                    >
                        <Paragraph>
                            The Reports tab is designed to generate executive oversight metrics and professional snapshots for meetings.
                        </Paragraph>
                        <ul>
                            <li><strong>Metrics Tracked:</strong> 
                                <ul>
                                    <li><strong>Task Progress (%):</strong> Calculated as total completed cards vs. total cards in the project.</li>
                                    <li><strong>Team Distribution:</strong> Identifies primary contributors (bars turn <Tag color="error">Red</Tag> if someone handles &gt;40% of the project).</li>
                                </ul>
                            </li>
                            <li><strong>Action Plan (3W1H):</strong> An automated table summarizing active tasks. It automatically sorts tasks by strict priority: <strong>Check</strong> tasks first, then <strong>In Progress</strong>, and finally <strong>To Do</strong>. Items are then sub-sorted by deadline urgency.</li>
                            <li><strong>Export Functionality:</strong> 
                                <ul>
                                    <li>Use the Export button to download the report as a PNG image perfectly formatted for a 1900x900 landscape view (ideal for PowerPoint/Presentations).</li>
                                    <li>The system smartly removes UI elements (like buttons and toggles) during export to ensure the static image is clean and professional.</li>
                                    <li>You can either capture the entire viewport or select specialized sections from the Dropdown export menu.</li>
                                </ul>
                            </li>
                        </ul>
                    </Panel>

                    <Panel 
                        header={<Text strong style={{ fontSize: 16 }}><IoCheckmarkDoneCircleOutline style={{ marginRight: 8 }}/>6. Automated Behaviors & Permissions</Text>} 
                        key="6"
                    >
                        <Paragraph>
                            The system includes built-in safeguards to ensure data security and ease of use.
                        </Paragraph>
                        <ul>
                            <li><strong>Auto-Membership:</strong> Whenever you edit, move, or comment on a card, the system smartly auto-assigns you as a participant to ensure you receive future notifications.</li>
                            <li><strong>Centralized Access Control:</strong> Top-level permissions strictly gate what you can modify based on your role (Owner, Editor, Viewer). System Administrators (AD) and Managers (MGR) retain administrative overrides to clean up abandoned projects.</li>
                            <li><strong>Notifications:</strong> The bell icon tracks mentions, assignments, and relevant card activities. You can view, mark as read, or expand older notifications right from the Board Toolbar.</li>
                        </ul>
                    </Panel>
                </Collapse>
                
                <Divider style={{ margin: '12px 0' }} />
                
                <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Engineering Projects Management System &copy; {new Date().getFullYear()}
                    </Text>
                </div>
            </div>
        </Drawer>
    );
};

export default UserGuideDrawer;
