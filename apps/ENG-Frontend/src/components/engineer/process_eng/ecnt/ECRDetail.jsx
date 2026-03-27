import React, { useState, useEffect } from "react";
import { Layout, Spin, Card, Row, Col, Divider, Tag, Button } from 'antd';
import { useParams, useNavigate } from "react-router-dom";
import { FilePdfOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import ActionCard from './components/WorkflowActions/ActionCard';
import StatusBadge from './components/StatusBadge';

const { Content } = Layout;

// Deterministic step progression map
const STEP_ORDER = ['3.1', '3.2', '3.3', '3.4', '3.45', '3.5', '3.6', '4.0'];

function getNextStep(latestStepStr) {
    const idx = STEP_ORDER.indexOf(latestStepStr);
    if (idx === -1) return 3.1;
    if (idx + 1 >= STEP_ORDER.length) return 4.0;
    return parseFloat(STEP_ORDER[idx + 1]);
}

export default function ECRDetail() {
    const { theme } = useTheme();
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    const [ecrData, setEcrData] = useState(null);
    const [actionLogs, setActionLogs] = useState([]);
    const [currentStep, setCurrentStep] = useState(3.1);

    const fetchDetails = async () => {
        try {
            const res = await axios.get(`${server.ECR_REQUIRE_GET_BY_ID}${id}`);
            const data = res.data.data;
            const logs = res.data.logs;

            // Format changelist mapping for UI
            const changes = [];
            if (data.is_drawing) changes.push("Drawing");
            if (data.is_tooling) changes.push("Tooling");
            if (data.is_program) changes.push("Program");
            if (data.is_usage) changes.push("Usage");
            data.changeList = changes;

            setEcrData(data);
            setActionLogs(logs);

            // Determine latest workflow step from logs using deterministic map
            if (data.process_status === 'Closed') {
                setCurrentStep(4.0);
            } else if (logs.length > 0) {
                const latestStepStr = logs[logs.length - 1].step_number;
                setCurrentStep(getNextStep(latestStepStr));
            } else {
                setCurrentStep(3.1);
            }

        } catch (err) {
            console.error("Fetch detail err: ", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const handleNextStep = (nextStep) => {
        setCurrentStep(nextStep);
        if (nextStep === 4.0) {
            navigate(`/eng/process_eng/ecnt/close/${id}`);
        }
        fetchDetails(); // Reload data after save
    };

    if (loading) {
        return <Spin tip="Loading Details..." size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '20vh' }} />;
    }

    if (!ecrData && !loading) return <div style={{ padding: '24px' }}>ECR Not found.</div>;

    return (
        <>
            <ScrollbarStyle primary={theme.colors.primary} />
            <Content className="kb-vscroll" style={{
                height: 'calc(100vh - 64px)',
                overflowY: 'auto',
                padding: '15px'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/eng/process_eng/ecnt/dashboard')} />
                            <h2 style={{ margin: 0, color: theme.colors.primary }}>ECR Details: {ecrData.ecr_no}</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <StatusBadge status={ecrData?.process_status || "Pending Dept Mgr"} />
                            <Button type="default" icon={<FilePdfOutlined />} style={{ color: theme.colors.error, borderColor: theme.colors.error }}>
                                Export PDF
                            </Button>
                        </div>
                    </div>

                    <Card title="ECR Information" style={{ marginBottom: 20 }}>
                        <Row gutter={[16, 16]}>
                            <Col span={24}><Divider orientation="left" style={{ margin: 0 }}>General Information</Divider></Col>
                            <Col xs={12} md={6}><b>Request By:</b> <br /> {ecrData.request_by}</Col>
                            <Col xs={12} md={6}><b>Department:</b> <br /> {ecrData.department}</Col>
                            <Col xs={12} md={6}><b>Require Date:</b> <br /> {ecrData?.require_date ? moment(ecrData.require_date).format('DD-MMM-YYYY') : '-'}</Col>
                            <Col xs={12} md={6}><b>Due Date:</b> <br /> {ecrData?.due_date ? moment(ecrData.due_date).format('DD-MMM-YYYY') : '-'}</Col>

                            <Col span={24}><Divider orientation="left" style={{ margin: 0 }}>Objective & Change Type</Divider></Col>
                            <Col xs={12} md={6}><b>Status Type:</b> <br /> {ecrData.status_type || ecrData.status}</Col>
                            <Col xs={12} md={6}><b>Objective:</b> <br /> {ecrData.objective}</Col>
                            <Col xs={24} md={12}>
                                <b>Change Required:</b> <br />
                                {ecrData.changeList?.map(c => <Tag key={c} color={c === 'Drawing' ? 'blue' : c === 'Tooling' ? 'orange' : c === 'Program' ? 'purple' : 'cyan'}>{c}</Tag>)}
                            </Col>

                            {ecrData?.changeList?.includes("Drawing") && (
                                <>
                                    <Col span={24}><Divider orientation="left" style={{ margin: 0 }}>Drawing Details</Divider></Col>
                                    <Col xs={8} md={8}><b>Part No:</b> <br /> {ecrData.part_no_drawing || '-'}</Col>
                                    <Col xs={8} md={8}><b>C/N:</b> <br /> {ecrData.cn_drawing || '-'}</Col>
                                    <Col xs={8} md={8}><b>Revision:</b> <br /> {ecrData.rev_drawing || '-'}</Col>
                                    <Col xs={12} md={12}><b>Before Change:</b> <br /> {ecrData.drawing_before_change || '-'}</Col>
                                    <Col xs={12} md={12}><b>After Change:</b> <br /> {ecrData.drawing_after_change || '-'}</Col>
                                </>
                            )}
                        </Row>
                    </Card>

                    {/* Render Dynamic Action Card for Current Workflow Step */}
                    <ActionCard currentStep={currentStep} onNextStep={handleNextStep} ecrData={ecrData} actionLogs={actionLogs} />

                </div>
            </Content>
        </>
    );
}
