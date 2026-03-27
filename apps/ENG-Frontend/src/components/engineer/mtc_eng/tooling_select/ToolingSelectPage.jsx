import React, { useState } from 'react';
import {
  Input, Button, Typography, Card, Space, Spin, Alert,
  Collapse, Table, Tag, Row, Col, Layout, Badge
} from 'antd';
import {
  SearchOutlined,
  ToolOutlined,
  SettingOutlined,
  BlockOutlined,
  SwapOutlined,
  NodeIndexOutlined,
  BgColorsOutlined,
  RocketOutlined,
  AuditOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import ScrollbarStyle from '../../../common/scrollbar';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Panel } = Collapse;

// Generic Table Component
const ToolingTable = ({ title, dataSource, columns, headers, targets, icon }) => {
  if (!dataSource || dataSource.length === 0) return null;

  const tableColumns = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
      align: 'center',
      render: (_, __, index) => {
        const rank = index + 1;
        let color = 'default';
        if (rank === 1) color = '#ffc107';
        else if (rank === 2) color = '#adb5bd';
        else if (rank === 3) color = '#cd7f32';
        return rank <= 3 ? <Badge count={rank} style={{ backgroundColor: color }} /> : rank;
      }
    },
    {
      title: 'No',
      dataIndex: 'no',
      key: 'no',
      width: 120,
      render: (text) => <Text strong>{text}</Text>
    },
    ...columns.map((colKey, i) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: '600' }}>{headers[i]}</div>
          {targets[i] !== undefined && targets[i] !== null && targets[i] !== '' && targets[i] !== '-' && (
            <div style={{
              fontSize: '10px',
              marginTop: '4px',
              padding: '2px 4px',
              backgroundColor: '#e6f7ff',
              color: '#1890ff',
              borderRadius: '4px',
              border: '1px solid #91d5ff'
            }}>
              Req: {targets[i]}
            </div>
          )}
        </div>
      ),
      dataIndex: colKey,
      key: colKey,
      align: 'center',
      render: (text) => text || '-'
    }))
  ];

  return (
    <Card
      size="small"
      title={<Space>{icon} <Text strong>{title}</Text></Space>}
      extra={<Badge count={dataSource.length} showZero color="#8c8c8c" />}
      style={{ marginBottom: 16, borderRadius: '8px', overflow: 'hidden' }}
      bodyStyle={{ padding: 0 }}
    >
      <Table
        dataSource={dataSource.map((item, idx) => ({ ...item, key: idx }))}
        columns={tableColumns}
        pagination={false}
        size="small"
        bordered
      />
    </Card>
  );
};

const ToolingSelectPage = () => {
  const { theme } = useTheme();
  const [cnInput, setCnInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const colors = theme?.colors || {};
  const shadows = theme?.shadows || {};

  const handleSearch = async () => {
    const cn = cnInput.trim();
    if (!cn) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.post(server.MTC_TOOLING_SELECT_SEARCH, { cnNumber: cn });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่พบ C/N หรือเกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const renderMachineGroup = (groupTitle, machines, icon) => {
    const machineList = machines.filter(m => m.hasData);
    if (machineList.length === 0) return null;

    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 16,
          borderBottom: `2px solid ${colors.primary || '#1890ff'}`,
          paddingBottom: 8
        }}>
          {icon}
          <Title level={4} style={{ margin: 0, marginLeft: 8, color: colors.primary || '#1890ff' }}>
            {groupTitle}
          </Title>
        </div>
        <Collapse ghost expandIconPosition="right">
          {machineList.map(m => (
            <Panel
              header={
                <Space>
                  <BlockOutlined style={{ color: colors.primary }} />
                  <Text strong style={{ fontSize: '16px', color: m.isIncomplete ? '#d9480f' : 'inherit' }}>{m.name}</Text>
                  {m.isIncomplete && (
                    <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                      Incomplete ({m.foundCount}/{m.requiredCount})
                    </Tag>
                  )}
                </Space>
              }
              key={m.name}
              style={{
                marginBottom: 12,
                backgroundColor: '#fff',
                borderRadius: '8px',
                boxShadow: shadows.sm
              }}
            >
              <div style={{ padding: '8px' }}>
                {m.content}
              </div>
            </Panel>
          ))}
        </Collapse>
      </div>
    );
  };

  const buildResults = (res) => {
    if (!res) return null;
    const c = res.calc;
    const mData = [];

    // TSG-300ZNC
    const zncChutes = res.chutes?.filter(item => !String(item.machine).toUpperCase().includes('W')) || [];
    if (zncChutes.length || res.carriersZNC?.length) {
      const zncTools = (
        <>
          <ToolingTable title="CHUTE" dataSource={zncChutes} columns={['valA', 'valB', 'valC', 'valD']} headers={['Slot Length (A)', 'Slot Height (B)', 'Min Width (C)', 'Center Slot (D)']} targets={[c?.chuteA, c?.chuteB, c?.chuteC, c?.chuteD]} icon={<SwapOutlined />} />
          <ToolingTable title="CARRIER (ZNC)" dataSource={res.carriersZNC} columns={['valA', 'valB', 'valC', 'valD']} headers={['Slot Width (A)', 'ØPCD (B)', 'Slot Length (C)', 'Carrier Thin (D)']} targets={[c?.carrierA, c?.carrierB, c?.carrierC, '']} icon={<SettingOutlined />} />
        </>
      );
      const found = (zncChutes.length ? 1 : 0) + (res.carriersZNC?.length ? 1 : 0);
      mData.push({ name: 'TSG-300ZNC', group: 'FACE', hasData: true, content: zncTools, requiredCount: 2, foundCount: found, isIncomplete: found < 2 });
    }

    // TSG300W
    const wChutes = res.chutes?.filter(item => String(item.machine).toUpperCase().includes('W')) || [];
    if (wChutes.length || res.carriersW?.length) {
      const wTools = (
        <>
          <ToolingTable title="CHUTE" dataSource={wChutes} columns={['valA', 'valB', 'valC', 'valD']} headers={['Slot Length (A)', 'Slot Height (B)', 'Min Width (C)', 'Center Slot (D)']} targets={[c?.chuteA, c?.chuteB, c?.chuteC, c?.chuteD]} icon={<SwapOutlined />} />
          <ToolingTable title="CARRIER (W)" dataSource={res.carriersW} columns={['valA', 'valB']} headers={['Slot Width (A)', 'Carrier Thin (E)']} targets={[c?.carrierA, '']} icon={<SettingOutlined />} />
        </>
      );
      const found = (res.carriersW?.length ? 1 : 0);
      mData.push({ name: 'TSG300W', group: 'FACE', hasData: true, content: wTools, requiredCount: 1, foundCount: found, isIncomplete: found < 1 });
    }

    // KS400B
    const ks = res.ks400b?.calc;
    if (ks && !ks.error) {
      const ksTools = (
        <>
          <ToolingTable title="WORK DRIVER" dataSource={res.ks400b.workDrivers} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6']} headers={['A (OD)', 'B (ID)', 'C (OD)', 'D (OD)', 'E (Width)', 'F (Step)']} targets={[ks.wd_A, ks.wd_B, ks.wd_C, ks.wd_D, ks.wd_E, ks.wd_F]} icon={<ToolOutlined />} />
          <ToolingTable title="LOADING CHUTE" dataSource={res.ks400b.loadingChutes} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6']} headers={['A', 'B', 'C', 'D', 'E', 'F']} targets={[ks.lc_A, ks.lc_B, ks.lc_C, ks.lc_D, ks.lc_E, ks.lc_F]} icon={<SwapOutlined />} />
          <ToolingTable title="SUPPORT BLOCK" dataSource={res.ks400b.supportBlocks} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[ks.sb_A, ks.sb_B, ks.sb_C, ks.sb_D, ks.sb_E]} icon={<BlockOutlined />} />
          <ToolingTable title="PLUG A" dataSource={res.ks400b.plugsA} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A (OD)', 'B (OD)', 'C (Depth)', 'D (Cham)', 'E (Dist)']} targets={[ks.pa_A, ks.pa_B, ks.pa_C, ks.pa_D, ks.pa_E]} icon={<NodeIndexOutlined />} />
          <ToolingTable title="PLUG B" dataSource={res.ks400b.plugsB} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A (OD)', 'B (OD)', 'C (Depth)', 'D (Cham)', 'E (Dist)']} targets={[ks.pb_A, ks.pb_B, ks.pb_C, ks.pb_D, ks.pb_E]} icon={<NodeIndexOutlined />} />
        </>
      );
      const found = (res.ks400b.workDrivers?.length ? 1 : 0) + (res.ks400b.loadingChutes?.length ? 1 : 0) + (res.ks400b.supportBlocks?.length ? 1 : 0) + (res.ks400b.plugsA?.length ? 1 : 0) + (res.ks400b.plugsB?.length ? 1 : 0);
      mData.push({ name: 'KS400B', group: 'OD', hasData: true, content: ksTools, requiredCount: 5, foundCount: found, isIncomplete: found < 5 });
    }

    // KS400B5
    const b5 = res.ks400b5?.calc;
    if (b5 && !b5.error) {
      const b5Tools = (
        <>
          <ToolingTable title="1. WORK CLAMP" dataSource={res.ks400b5.workClamps} columns={['type', 'val1', 'val2', 'val3', 'val4', 'val5']} headers={['Type', 'A', 'B', 'C', 'D', 'E']} targets={[b5.workClamp?.Type, b5.workClamp?.A, b5.workClamp?.B, b5.workClamp?.C, b5.workClamp?.D, b5.workClamp?.E]} icon={<ToolOutlined />} />
          <ToolingTable title="2. SHAFT" dataSource={res.ks400b5.shafts} columns={['type', 'val1', 'val2', 'val3']} headers={['Type', 'A', 'B', 'C']} targets={[b5.shaft?.Type, b5.shaft?.A, b5.shaft?.B, b5.shaft?.C]} icon={<SettingOutlined />} />
          <ToolingTable title="3. WORK CHUTE" dataSource={res.ks400b5.workChutes} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b5.workChute?.A, b5.workChute?.B, b5.workChute?.C, b5.workChute?.D]} icon={<SwapOutlined />} />
          <ToolingTable title="4. WORK LOADER" dataSource={res.ks400b5.workLoaders} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6', 'val7']} headers={['A', 'B', 'C', 'D', 'E', 'F', 'G']} targets={[b5.workLoader?.A, b5.workLoader?.B, b5.workLoader?.C, b5.workLoader?.D, b5.workLoader?.E, b5.workLoader?.F, b5.workLoader?.G]} icon={<BgColorsOutlined />} />
          <ToolingTable title="5. WORK CHUCK" dataSource={res.ks400b5.workChucks} columns={['val1']} headers={['A']} targets={[b5.workChuck?.A]} icon={<BlockOutlined />} />
          <ToolingTable title="6. WORK HOLDER" dataSource={res.ks400b5.workHolders} columns={['val1', 'val2']} headers={['A', 'B']} targets={[b5.workHolder?.A, b5.workHolder?.B]} icon={<ToolOutlined />} />
          <ToolingTable title="7. CHUCK JAW" dataSource={res.ks400b5.chuckJaws} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b5.chuckJaw?.A, b5.chuckJaw?.B, b5.chuckJaw?.C, b5.chuckJaw?.D]} icon={<ToolOutlined />} />
          <ToolingTable title="8. WORK CHUTE GUIDE" dataSource={res.ks400b5.workChuteGuides} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b5.workChuteGuide?.A, b5.workChuteGuide?.B, b5.workChuteGuide?.C, b5.workChuteGuide?.D, b5.workChuteGuide?.E]} icon={<NodeIndexOutlined />} />
          <ToolingTable title="9. STOPPER" dataSource={res.ks400b5.stoppers} columns={['val1', 'val2']} headers={['A', 'B']} targets={[b5.stopper?.A, b5.stopper?.B]} icon={<BlockOutlined />} />
          <ToolingTable title="10. MASTER RING" dataSource={res.ks400b5.masterRings} columns={['val1', 'val2', 'val3']} headers={['A', 'B', 'C']} targets={[b5.masterRingForJaw?.A, b5.masterRingForJaw?.B, b5.masterRingForJaw?.C]} icon={<AuditOutlined />} />
        </>
      );
      const found = Object.keys(res.ks400b5).filter(k => k !== 'calc' && res.ks400b5[k]?.length).length;
      mData.push({ name: 'KS400B5', group: 'OD', hasData: true, content: b5Tools, requiredCount: 10, foundCount: found, isIncomplete: found < 10 });
    }

    // KS400B6
    const b6 = res.ks400b6?.calc;
    if (b6 && !b6.error) {
      const b6Tools = (
        <>
          <ToolingTable title="1. WORK DRIVER" dataSource={res.ks400b6.workDrivers} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b6.workDriver?.A, b6.workDriver?.B, b6.workDriver?.C, b6.workDriver?.D, b6.workDriver?.E]} icon={<ToolOutlined />} />
          <ToolingTable title="2. LOADING CHUTE" dataSource={res.ks400b6.loadingChutes} columns={['val1', 'val2', 'val3', 'val4', 'val6']} headers={['A', 'B', 'C', 'D', 'F']} targets={[b6.loadingChute?.A, b6.loadingChute?.B, b6.loadingChute?.C, b6.loadingChute?.D, b6.loadingChute?.F]} icon={<SwapOutlined />} />
          <ToolingTable title="3. PLUG" dataSource={res.ks400b6.plugs} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b6.plug?.A, b6.plug?.B, b6.plug?.C, b6.plug?.D]} icon={<NodeIndexOutlined />} />
          <ToolingTable title="4. WORK GUIDE" dataSource={res.ks400b6.workGuides} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b6.workGuide?.A, b6.workGuide?.B, b6.workGuide?.C, b6.workGuide?.D, b6.workGuide?.E]} icon={<SettingOutlined />} />
          <ToolingTable title="5. WORK PUSHER" dataSource={res.ks400b6.workPushers} columns={['val1', 'val2', 'val3']} headers={['A', 'B', 'C']} targets={[b6.workPusher?.A, b6.workPusher?.B, b6.workPusher?.C]} icon={<RocketOutlined />} />
          <ToolingTable title="6. STOCKER CHUTE" dataSource={res.ks400b6.stockerChutes} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b6.stockerChute?.A, b6.stockerChute?.B, b6.stockerChute?.C, b6.stockerChute?.D, b6.stockerChute?.E]} icon={<BlockOutlined />} />
          <ToolingTable title="7. FRONT SHOE" dataSource={res.ks400b6.frontShoes} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b6.frontShoe?.A, b6.frontShoe?.B, b6.frontShoe?.C, b6.frontShoe?.D]} icon={<ToolOutlined />} />
          <ToolingTable title="8. REAR SHOE" dataSource={res.ks400b6.rearShoes} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b6.rearShoe?.A, b6.rearShoe?.B, b6.rearShoe?.C, b6.rearShoe?.D]} icon={<ToolOutlined />} />
          <ToolingTable title="9. PILOT PIN" dataSource={res.ks400b6.pilotPins} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6']} headers={['A', 'B', 'C', 'D', 'E', 'F']} targets={[b6.pilotPin?.A, b6.pilotPin?.B, b6.pilotPin?.C, b6.pilotPin?.D, b6.pilotPin?.E, b6.pilotPin?.F]} icon={<NodeIndexOutlined />} />
        </>
      );
      const found = Object.keys(res.ks400b6).filter(k => k !== 'calc' && res.ks400b6[k]?.length).length;
      mData.push({ name: 'KS400B6', group: 'OD', hasData: true, content: b6Tools, requiredCount: 9, foundCount: found, isIncomplete: found < 9 });
    }

    // KS500RD
    const ks5 = res.ks500rd?.calc;
    if (ks5 && !ks5.error) {
      const ks5Tools = (
        <>
          <ToolingTable title="WORK DRIVER" dataSource={res.ks500rd.workDrivers} columns={['val1', 'val2']} headers={['A', 'B']} targets={[ks5.wd?.A, ks5.wd?.B]} icon={<ToolOutlined />} />
          <ToolingTable title="LOADING PINTLE" dataSource={res.ks500rd.loadingPintles} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6', 'val7', 'val8']} headers={['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']} targets={[ks5.lp?.A, ks5.lp?.B, ks5.lp?.C, ks5.lp?.D, ks5.lp?.E, ks5.lp?.F, ks5.lp?.G, ks5.lp?.H]} icon={<SettingOutlined />} />
          <ToolingTable title="FRONT SHOE" dataSource={res.ks500rd.frontShoes} columns={['val1', 'val2', 'val3']} headers={['-', '-', '-']} targets={['', '', '']} icon={<ToolOutlined />} />
        </>
      );
      const found = (res.ks500rd.workDrivers?.length ? 1 : 0) + (res.ks500rd.loadingPintles?.length ? 1 : 0) + (res.ks500rd.frontShoes?.length ? 1 : 0);
      mData.push({ name: 'KS500RD', group: 'OD', hasData: true, content: ks5Tools, requiredCount: 3, foundCount: found, isIncomplete: found < 3 });
    }

    // KS-03A / KS-B22RD
    const ks3 = res.ks03a?.calc;
    if (ks3 && !ks3.error) {
      const ks3Name = res.part.idAft >= 12.0 ? 'KS-B22RD' : 'KS-03A';
      const ks3Tools = (
        <>
          <ToolingTable title="FRONT PLATE" dataSource={res.ks03a.frontPlates} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.fp?.A, ks3.fp?.B, ks3.fp?.C, ks3.fp?.Type]} icon={<ToolOutlined />} />
          <ToolingTable title="CHUTE COVER" dataSource={res.ks03a.chuteCovers} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.chute?.A, ks3.chute?.B, ks3.chute?.C, ks3.chute?.Type]} icon={<SwapOutlined />} />
          <ToolingTable title="PRESSURE ROTOR" dataSource={res.ks03a.pressureRotors} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.pr?.A, '', '', ks3.pr?.Type]} icon={<SettingOutlined />} />
          <ToolingTable title="PLUG GAUGE" dataSource={res.ks03a.plugGauges} columns={['val1', 'val2', 'val3', 'val5']} headers={['A (ID)', 'B', 'C', 'Type']} targets={[ks3.pg?.A, ks3.pg?.B, ks3.pg?.C, ks3.pg?.Type]} icon={<NodeIndexOutlined />} />
          <ToolingTable title="SETTING GAUGE" dataSource={res.ks03a.settingGauges} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'M', 'Type']} targets={[ks3.sg?.A, ks3.sg?.B, ks3.sg?.C, ks3.sg?.M, ks3.sg?.Type]} icon={<AuditOutlined />} />
          <ToolingTable title="MASTER RING GAUGE" dataSource={res.ks03a.masterRings} columns={['val1', 'val2', 'val3', 'val5']} headers={['A (OD)', 'B (F"A")', 'C (W)', 'Type']} targets={[ks3.mr?.A, ks3.mr?.B, ks3.mr?.C, '']} icon={<AuditOutlined />} />
          <ToolingTable title="CPX SHOE" dataSource={res.ks03a.cpxShoes} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A (Width)', 'D (Height)', 'C', 'V / M', 'Type']} targets={[ks3.cpxShoe?.A, ks3.cpxShoe?.D, ks3.cpxShoe?.C, ks3.cpxShoe?.V, ks3.cpxShoe?.Type]} icon={<ToolOutlined />} />
          <ToolingTable title="LOADER" dataSource={res.ks03a.loader} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A (Width)', 'B (OD)', 'C', 'D', 'E']} targets={[`${ks3.ld?.A_min}-${ks3.ld?.A_max}`, ks3.ld?.B, ks3.ld?.C, ks3.ld?.D, ks3.ld?.E]} icon={<SwapOutlined />} />
          <ToolingTable title="ROLLER SHOE" dataSource={res.ks03a.rollerShoes} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A (Height)', 'C (Width)', 'D', 'B', 'Type']} targets={[ks3.rollerShoe?.A, ks3.rollerShoe?.C, ks3.rollerShoe?.D, ks3.rollerShoe?.B, ks3.rollerShoe?.Type]} icon={<ToolOutlined />} />
        </>
      );
      const found = Object.keys(res.ks03a).filter(k => k !== 'calc' && res.ks03a[k]?.length).length;
      mData.push({ name: ks3Name, group: 'ID', hasData: true, content: ks3Tools, requiredCount: 9, foundCount: found, isIncomplete: found < 9 });
    }

    // KS-B22G / KS-B80
    if (res.jaws?.length || res.bps?.length) {
      const ksbTools = (
        <>
          <ToolingTable title="JAW" dataSource={res.jaws} columns={['val1', 'val2', 'val3', 'valD', 'valE']} headers={['ØID (A)', 'ØID (B)', 'Min Width (C)', 'Max Depth (D)', 'E']} targets={[c.A, c.B, c.C, c.D_Limit, '']} icon={<ToolOutlined />} />
          <ToolingTable title="BACK PLATE" dataSource={res.bps} columns={['val1', 'val2']} headers={['ØID (A)', 'Min ØPCD (B)']} targets={[c.AA, c.BB]} icon={<BlockOutlined />} />
        </>
      );
      const found = (res.jaws?.length ? 1 : 0) + (res.bps?.length ? 1 : 0);
      mData.push({ name: 'KS-B22G / KS-B80', group: 'ID', hasData: true, content: ksbTools, requiredCount: 2, foundCount: found, isIncomplete: found < 2 });
    }

    return mData;
  };

  const mData = buildResults(result);

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"4"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={colors.primary} />
        <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto' }}>
          
          <Title level={4} style={{ marginBottom: 16, color: colors.primary }}>
            Tooling Selection System
          </Title>

          {/* Search Section */}
          <Card size="small" style={{ marginBottom: 16, borderRadius: '8px', boxShadow: shadows.sm }}>
            <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
              <Input
                placeholder="กรอก C/N Number เช่น 1234-56-7890"
                value={cnInput}
                onChange={e => setCnInput(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                allowClear
              />
              <Button
                type="primary"
                onClick={handleSearch}
                loading={loading}
                style={{ background: colors.primary, borderColor: colors.primary }}
                disabled={!cnInput.trim()}
              >
                Search
              </Button>
            </Space.Compact>
          </Card>

          {error && (
            <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
          )}

          <Spin spinning={loading} tip="Searching...">
            {result ? (
              <>
                <Card size="small" style={{ marginBottom: 16, borderLeft: `4px solid ${colors.primary}`, borderRadius: '8px', boxShadow: shadows.sm }}>
                  <Row gutter={[24, 16]}>
                    <Col span={24}>
                      <Title level={5} style={{ margin: 0 }}>
                        C/N: <Tag color="blue" style={{ fontSize: '16px', padding: '4px 12px' }}>{result.cn}</Tag>
                        <Tag color="green">{result.part.process}</Tag>
                        <Tag color="purple">{result.part.type}</Tag>
                      </Title>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}><Text type="secondary">OD (Outside Diameter)</Text></div>
                      <Space>
                        <Badge count="Bf" style={{ backgroundColor: '#8c8c8c' }} /><Text strong>{result.part.odBf}</Text>
                        <SwapOutlined style={{ color: colors.primary }} />
                        <Badge count="Aft" style={{ backgroundColor: colors.primary }} /><Text strong style={{ color: colors.primary, fontSize: '16px' }}>{result.part.odAft}</Text>
                      </Space>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}><Text type="secondary">ID (Inside Diameter)</Text></div>
                      <Space>
                        <Badge count="Bf" style={{ backgroundColor: '#8c8c8c' }} /><Text strong>{result.part.idBf}</Text>
                        <SwapOutlined style={{ color: colors.primary }} />
                        <Badge count="Aft" style={{ backgroundColor: colors.primary }} /><Text strong style={{ color: colors.primary, fontSize: '16px' }}>{result.part.idAft}</Text>
                      </Space>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}><Text type="secondary">W (Thickness)</Text></div>
                      <Space>
                        <Badge count="Bf" style={{ backgroundColor: '#8c8c8c' }} /><Text strong>{result.part.wBf}</Text>
                        <SwapOutlined style={{ color: colors.primary }} />
                        <Badge count="Aft" style={{ backgroundColor: colors.primary }} /><Text strong style={{ color: colors.primary, fontSize: '16px' }}>{result.part.wAft}</Text>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {renderMachineGroup('FACE GRIND', mData.filter(m => m.group === 'FACE'), <BgColorsOutlined style={{ fontSize: '20px', color: colors.primary }} />)}
                {renderMachineGroup('OD SPH GRIND', mData.filter(m => m.group === 'OD'), <SettingOutlined style={{ fontSize: '20px', color: colors.primary }} />)}
                {renderMachineGroup('ID GRIND', mData.filter(m => m.group === 'ID'), <ToolOutlined style={{ fontSize: '20px', color: colors.primary }} />)}
              </>
            ) : (
              !loading && (
                <div style={{ textAlign: 'center', marginTop: 80, opacity: 0.5 }}>
                  <ToolOutlined style={{ fontSize: 64, marginBottom: 16, display: 'block', margin: '0 auto', color: colors.primary }} />
                  <Title level={5} type="secondary">Tooling Selection System</Title>
                  <Text type="secondary">กรุณากรอก C/N Number เพื่อเริ่มต้นการค้นหาเครื่องมือที่เหมาะสม</Text>
                </div>
              )
            )}
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ToolingSelectPage;
