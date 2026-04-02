/**
 * ReportDashboard.jsx
 * Main Report page — select projects, report type, month, then generate
 * Export as 19:9 landscape image via dedicated ExportRenderer
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Typography, Select, DatePicker, Button, Spin, Empty, Radio, Tag, Tooltip, message } from 'antd';
import { MdOutlineAssessment } from 'react-icons/md';
import { IoDocumentTextOutline, IoCalendarOutline, IoFolderOpenOutline, IoImageOutline, IoDownloadOutline } from 'react-icons/io5';
import { BsFileEarmarkBarGraph, BsKanban } from 'react-icons/bs';
import { useKanbanStore } from '../store/kanbanStore';
import dayjs from 'dayjs';
import MonthlyReport from './MonthlyReport';
import ProjectReport from './ProjectReport';
import ExportRenderer from './ExportRenderer';

const { Text, Title } = Typography;

// 19:9 aspect ratio constants
const EXPORT_WIDTH = 1900;
const EXPORT_HEIGHT = 900;

const ReportDashboard = ({ theme }) => {
    const { projects, users, fetchProjectReportData, fetchUsers } = useKanbanStore();

    useEffect(() => {
        if (!users || users.length === 0) {
            fetchUsers();
        }
    }, [users, fetchUsers]);
    const [selectedProjectIds, setSelectedProjectIds] = useState([]);
    const [reportType, setReportType] = useState('monthly');
    const [selectedMonth, setSelectedMonth] = useState(dayjs().subtract(1, 'month'));
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [hasGenerated, setHasGenerated] = useState(false);
    const exportRef = useRef(null);
    const reportContentRef = useRef(null);
    const [isExportingActive, setIsExportingActive] = useState(false);

    const projectOptions = useMemo(() =>
        (projects || []).map(p => ({ label: p.name, value: p.id })),
        [projects]
    );

    const handleGenerate = useCallback(async () => {
        if (selectedProjectIds.length === 0) {
            message.warning('Please select at least one project');
            return;
        }
        setIsLoading(true);
        setHasGenerated(true);
        try {
            const results = await Promise.all(
                selectedProjectIds.map(id => fetchProjectReportData(id))
            );
            setReportData(results.filter(Boolean));
        } catch (err) {
            message.error('Failed to generate report');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedProjectIds, fetchProjectReportData]);

    // ─── Export: Render ExportRenderer off-screen → capture → download ──
    const handleExportImage = useCallback(async () => {
        const el = exportRef.current;
        if (!el) {
            message.warning('No export content available');
            return;
        }

        setIsExporting(true);
        try {
            const html2canvas = (await import('html2canvas')).default;

            // Wait for ExportRenderer to be fully painted
            await new Promise(r => setTimeout(r, 300));

            // Capture the off-screen ExportRenderer (exactly 1900×900)
            const canvas = await html2canvas(el, {
                backgroundColor: '#ffffff',
                width: EXPORT_WIDTH,
                height: EXPORT_HEIGHT,
                scale: 2,       // 2x for crisp retina output (3800×1800 px)
                useCORS: true,
                logging: false,
            });

            // Download as PNG
            canvas.toBlob((blob) => {
                if (!blob) {
                    message.error('Failed to export image');
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const projectNames = (reportData || []).map(r => r.project?.name || 'report').join('_');
                const dateStr = reportType === 'monthly'
                    ? selectedMonth.format('YYYY-MM')
                    : dayjs().format('YYYY-MM-DD');
                a.href = url;
                a.download = `${reportType}_report_${projectNames}_${dateStr}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                message.success('Report exported as image!');
            }, 'image/png', 1.0);
        } catch (err) {
            console.error('Export failed:', err);
            message.error('Failed to export image. Please try again.');
        } finally {
            setIsExporting(false);
        }
    }, [reportData, reportType, selectedMonth]);

    // ─── Export Active View: Capture what's currently on screen ────────
    const handleExportActiveView = useCallback(async () => {
        const el = reportContentRef.current;
        if (!el) {
            message.warning('No content to export');
            return;
        }

        setIsExportingActive(true);
        try {
            const html2canvas = (await import('html2canvas')).default;

            const canvas = await html2canvas(el, {
                backgroundColor: '#f8fafc',
                useCORS: true,
                scale: 2,
                logging: false,
                scrollX: 0,
                scrollY: -window.scrollY, // ensure we capture from top of element
            });

            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const projectNames = (reportData || []).map(r => r.project?.name || 'report').join('_');
                a.href = url;
                a.download = `active_view_${projectNames}_${dayjs().format('YYYY-MM-DD_HHmm')}.png`;
                a.click();
                URL.revokeObjectURL(url);
                message.success('Active view exported!');
            }, 'image/png');
        } catch (err) {
            console.error('Active view export failed:', err);
            message.error('Failed to export current view');
        } finally {
            setIsExportingActive(false);
        }
    }, [reportData]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ═══ Report Config Bar ═══ */}
            <div className="kanban-report-toolbar" style={{
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
                padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
                marginBottom: theme.spacing.xl,
                display: 'flex', alignItems: 'center', gap: theme.spacing.lg,
                flexWrap: 'wrap',
                boxShadow: theme.shadows.sm,
            }}>
                {/* Project Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <IoFolderOpenOutline size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                        Projects
                    </Text>
                    <Select
                        mode="multiple"
                        placeholder="Select projects..."
                        value={selectedProjectIds}
                        onChange={setSelectedProjectIds}
                        options={projectOptions}
                        style={{ minWidth: 280, maxWidth: 500 }}
                        maxTagCount={3}
                        maxTagTextLength={16}
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label || '').toLowerCase().includes(input.toLowerCase())
                        }
                    />
                </div>

                {/* Report Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <IoDocumentTextOutline size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                        Report Type
                    </Text>
                    <Radio.Group
                        value={reportType}
                        onChange={e => setReportType(e.target.value)}
                        buttonStyle="solid"
                        size="middle"
                    >
                        <Radio.Button value="monthly" style={{ fontWeight: 600 }}>
                            <IoCalendarOutline size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                            Monthly
                        </Radio.Button>
                        <Radio.Button value="project" style={{ fontWeight: 600 }}>
                            <BsFileEarmarkBarGraph size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                            Project
                        </Radio.Button>
                    </Radio.Group>
                </div>

                {/* Month Picker (only for monthly) */}
                {reportType === 'monthly' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            <IoCalendarOutline size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                            Month
                        </Text>
                        <DatePicker
                            picker="month"
                            value={selectedMonth}
                            onChange={setSelectedMonth}
                            format="MMMM YYYY"
                            style={{ width: 180 }}
                            allowClear={false}
                        />
                    </div>
                )}

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
                    {reportData && (
                        <>
                            <Tooltip title="Export Current View (as seen on screen)">
                                <Button
                                    icon={<IoImageOutline size={18} />}
                                    onClick={handleExportActiveView}
                                    loading={isExportingActive}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        borderColor: '#3b82f6', color: '#3b82f6',
                                    }}
                                />
                            </Tooltip>

                            <Tooltip title="HD Export (Professional 19:9 Layout)">
                                <Button
                                    icon={<IoDownloadOutline size={18} />}
                                    onClick={handleExportImage}
                                    loading={isExporting}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        borderColor: '#10b981', color: '#10b981',
                                    }}
                                />
                            </Tooltip>
                        </>
                    )}
                    <Button
                        type="primary"
                        icon={<MdOutlineAssessment size={18} />}
                        onClick={handleGenerate}
                        loading={isLoading}
                        disabled={selectedProjectIds.length === 0}
                        style={{
                            background: theme.colors.primary, borderColor: theme.colors.primary,
                            borderRadius: theme.borderRadius.md, height: 38,
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        {/* Generate Report */}
                    </Button>
                </div>
            </div>

            {/* ═══ Report Content ═══ */}
            <div className="kanban-report-scroll kb-vscroll" style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
            }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <Spin size="large" />
                        <Text style={{ display: 'block', marginTop: 16, color: theme.colors.textSecondary }}>
                            Generating report...
                        </Text>
                    </div>
                ) : !hasGenerated ? (
                    <div style={{
                        textAlign: 'center', padding: '80px 0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                    }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: 20,
                            background: `${theme.colors.primary}10`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <BsFileEarmarkBarGraph size={36} color={theme.colors.primary} />
                        </div>
                        <div>
                            <Text strong style={{ fontSize: 18, color: theme.colors.textPrimary, display: 'block' }}>
                                Kanban Report Generator
                            </Text>
                            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, display: 'block', marginTop: 4 }}>
                                Select projects and report type, then click "Generate Report"
                            </Text>
                        </div>
                        <div style={{
                            display: 'flex', gap: theme.spacing.xl,
                            marginTop: theme.spacing.lg,
                        }}>
                            <div style={{
                                padding: theme.spacing.lg,
                                background: `${theme.colors.primary}06`,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.borderRadius.lg,
                                width: 240, textAlign: 'left',
                            }}>
                                <IoCalendarOutline size={24} color={theme.colors.primary} />
                                <Text strong style={{ display: 'block', fontSize: 14, color: theme.colors.textPrimary, marginTop: 8 }}>
                                    Monthly Report
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block', marginTop: 4 }}>
                                    สรุปผลงานรายเดือน: What I've Done, KPIs, ปัญหา/อุปสรรค, แนวทางแก้ไข, แผน 3W1H
                                </Text>
                            </div>
                            <div style={{
                                padding: theme.spacing.lg,
                                background: '#8b5cf606',
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.borderRadius.lg,
                                width: 240, textAlign: 'left',
                            }}>
                                <BsFileEarmarkBarGraph size={24} color="#8b5cf6" />
                                <Text strong style={{ display: 'block', fontSize: 14, color: theme.colors.textPrimary, marginTop: 8 }}>
                                    Project Report
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block', marginTop: 4 }}>
                                    ภาพรวมโปรเจค: สถานะ Cards, Workload สมาชิก, Labels, Time Metrics, Issues
                                </Text>
                            </div>
                        </div>
                    </div>
                ) : reportData && reportData.length > 0 ? (
                    <div ref={reportContentRef} style={{ paddingBottom: 40 }}>
                        {reportType === 'monthly' ? (
                            <MonthlyReport
                                reportData={reportData}
                                selectedMonth={selectedMonth}
                                theme={theme}
                                users={users}
                            />
                        ) : (
                            <ProjectReport
                                reportData={reportData}
                                theme={theme}
                                users={users}
                            />
                        )}

                        {/* ─── Off-screen Renderer for Export ─── */}
                        <ExportRenderer
                            ref={exportRef}
                            reportType={reportType}
                            reportData={reportData}
                            selectedMonth={selectedMonth}
                            users={users}
                        />
                    </div>
                ) : (
                    <Empty
                        description="No data found for selected projects"
                        style={{ padding: '80px 0' }}
                    />
                )}
            </div>
        </div>
    );
};

export default ReportDashboard;
