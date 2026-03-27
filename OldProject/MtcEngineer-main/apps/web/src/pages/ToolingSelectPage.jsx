import { useState } from 'react';
import {
  Input, Button, Typography, Card, Space, Spin, Alert,
  Collapse, Table, Tag, Row, Col, Descriptions,
} from 'antd';
import { SearchOutlined, ToolOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { toolingAPI } from '../api/client';
import { color } from '../constance/constance';

const { Title, Text } = Typography;
const { Panel } = Collapse;

// Simple result table
function ResultTable({ dataSource, columns, title, empty }) {
  if (!dataSource || dataSource.length === 0) return empty ? null : (
    <Text type="secondary" style={{ fontSize: 12 }}>{empty || 'ไม่พบ'}</Text>
  );
  return (
    <Table
      size="small"
      dataSource={dataSource.map((r, i) => ({ ...r, _key: i }))}
      columns={columns}
      rowKey="_key"
      pagination={false}
      style={{ marginBottom: 8 }}
      title={() => <Text strong style={{ fontSize: 12 }}>{title}</Text>}
    />
  );
}

// Column helper
const col = (title, key, width) => ({ title, dataIndex: key, key, width: width || 80 });

// Jaw columns (KSB22G / KSB80)
const jawCols = [
  col('No', 'no', 110), col('Machine', 'machine', 90),
  col('A', 'val1', 70), col('B', 'val2', 70),
  col('C', 'val3', 70), col('D', 'valD', 70), col('E', 'valE', 70),
];
const bpCols = [
  col('No', 'no', 110), col('Machine', 'machine', 90),
  col('A', 'val1', 70), col('B', 'val2', 70),
];
const chuteCols = [
  col('No', 'no', 110), col('Machine', 'machine', 90),
  col('A', 'valA', 70), col('B', 'valB', 70), col('C', 'valC', 70), col('D', 'valD', 70),
];
const carrierCols = [
  col('No', 'no', 110), col('Machine', 'machine', 90),
  col('A', 'valA', 70), col('B', 'valB', 70), col('C', 'valC', 70), col('D', 'valD', 70),
];
const genericCols = (keys) => [
  col('No', 'no', 110), col('Machine', 'machine', 90),
  ...keys.map((k, i) => col(k, `val${i + 1}`, 72)),
];

export default function ToolingSelectPage() {
  const [cnInput, setCnInput]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');

  const handleSearch = async () => {
    const cn = cnInput.trim();
    if (!cn) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await toolingAPI.search(cn);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่พบ C/N หรือเกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const d = result;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16, color: color.primary }}>
        Tooling Select
      </Title>

      {/* Search */}
      <Card size="small" style={{ marginBottom: 16 }}>
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
            style={{ background: color.primary, borderColor: color.primary }}
            disabled={!cnInput.trim()}
          >
            Search
          </Button>
        </Space.Compact>
      </Card>

      {/* Error */}
      {error && (
        <Alert
          type="error"
          icon={<ExclamationCircleOutlined />}
          message={error}
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="กำลังค้นหา..." />
        </div>
      )}

      {/* Results */}
      {d && !loading && (
        <>
          {/* Part Info */}
          <Card size="small" style={{ marginBottom: 12, borderLeft: `4px solid ${color.primary}` }}>
            <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
              <ToolOutlined style={{ marginRight: 8 }} />
              C/N: <Tag color="blue">{d.cn}</Tag>
              <Tag color={d.part.process === 'ID→OD' ? 'orange' : 'green'}>{d.part.process || '-'}</Tag>
              <Tag>{d.part.type || '-'}</Tag>
              {d.part.yBall === 'Y' && <Tag color="gold">Yball</Tag>}
            </Title>
            <Row gutter={16}>
              {[
                { label: 'OD_bf', value: d.part.odBf },
                { label: 'OD_aft', value: d.part.odAft },
                { label: 'ID_aft', value: d.part.idAft },
                { label: 'W_aft', value: d.part.wAft },
                { label: 'SD', value: d.part.sd },
                { label: 'SD_aft', value: d.part.sdAft },
              ].map(({ label, value }) => (
                <Col key={label} style={{ marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{label}: </Text>
                  <Text strong style={{ fontSize: 12 }}>{value ?? '-'}</Text>
                </Col>
              ))}
            </Row>
          </Card>

          {/* Calc summary */}
          <Card size="small" style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12 }}>Calculation (KSB): </Text>
            <Text style={{ fontSize: 11 }}>
              A={d.calc.A}  B={d.calc.B}  C={d.calc.C}  D_lim={d.calc.D_Limit}  AA={d.calc.AA}  BB={d.calc.BB}
              &nbsp;|&nbsp;Chute: A={d.calc.chuteA} B={d.calc.chuteB}
              &nbsp;|&nbsp;Carrier: A={d.calc.carrierA}
            </Text>
          </Card>

          <Collapse defaultActiveKey={['ksb', 'tsg']} size="small">
            {/* KSB Jaws / Back Plates */}
            <Panel
              key="ksb"
              header={<><Tag color="purple">KS-B22G / KS-B80</Tag> Jaw &amp; Back Plate</>}
            >
              <ResultTable title="Jaws" dataSource={d.jaws} columns={jawCols} />
              <ResultTable title="Back Plates" dataSource={d.bps} columns={bpCols} />
            </Panel>

            {/* TSG-300 */}
            <Panel
              key="tsg"
              header={<><Tag color="cyan">TSG-300</Tag> Chute &amp; Carrier</>}
            >
              <ResultTable title="Chutes" dataSource={d.chutes} columns={chuteCols} />
              <ResultTable title="Carriers (ZNC)" dataSource={d.carriersZNC} columns={carrierCols} />
              <ResultTable title="Carriers (TSG300W)" dataSource={d.carriersW} columns={carrierCols} />
            </Panel>

            {/* KS400B */}
            {d.ks400b && !d.ks400b.calc?.error && (
              <Panel
                key="ks400b"
                header={<><Tag color="red">KS400B</Tag> Work Driver / Support Block / Chute / Plugs</>}
              >
                <ResultTable title="Work Drivers"   dataSource={d.ks400b.workDrivers}   columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Support Blocks"  dataSource={d.ks400b.supportBlocks}  columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Loading Chutes"  dataSource={d.ks400b.loadingChutes}  columns={genericCols(['A','B','C','D','E','F'])} />
                <ResultTable title="Plug A (F=48)"   dataSource={d.ks400b.plugsA}         columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Plug B (F=70)"   dataSource={d.ks400b.plugsB}         columns={genericCols(['A','B','C','D','E'])} />
              </Panel>
            )}
            {d.ks400b?.calc?.error && (
              <Panel key="ks400b" header={<><Tag color="red">KS400B</Tag> (ไม่ผ่าน Limit)</>}>
                <Text type="secondary">{d.ks400b.calc.error}</Text>
              </Panel>
            )}

            {/* KS-03A */}
            {d.ks03a && !d.ks03a.calc?.error && (
              <Panel
                key="ks03a"
                header={<><Tag color="orange">KS-03A</Tag> Shoes / Gauges / Loader</>}
              >
                <ResultTable title="Roller Shoes"    dataSource={d.ks03a.rollerShoes}    columns={genericCols(['A','C','D','B','Type'])} />
                <ResultTable title="CPX Shoes"       dataSource={d.ks03a.cpxShoes}       columns={genericCols(['A','D','C','V','Type'])} />
                <ResultTable title="Chute Covers"    dataSource={d.ks03a.chuteCovers}    columns={genericCols(['A','B','C','','Type'])} />
                <ResultTable title="Front Plates"    dataSource={d.ks03a.frontPlates}    columns={genericCols(['A','B','C','','Type'])} />
                <ResultTable title="Setting Gauges"  dataSource={d.ks03a.settingGauges}  columns={genericCols(['A','B','C','M','Type'])} />
                <ResultTable title="Master Rings"    dataSource={d.ks03a.masterRings}    columns={genericCols(['A','B','C','','Type'])} />
                <ResultTable title="Plug Gauges"     dataSource={d.ks03a.plugGauges}     columns={genericCols(['A','B','C','','Type'])} />
                <ResultTable title="Loader"          dataSource={d.ks03a.loader}         columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Pressure Rotors" dataSource={d.ks03a.pressureRotors} columns={genericCols(['A','B','C','','Type'])} />
              </Panel>
            )}

            {/* KS500RD */}
            {d.ks500rd && !d.ks500rd.calc?.error && (
              <Panel
                key="ks500rd"
                header={<><Tag color="green">KS500RD</Tag> Loading Pintle / Work Driver</>}
              >
                <ResultTable title="Loading Pintles" dataSource={d.ks500rd.loadingPintles} columns={genericCols(['A','B','C','D','E','F','G','H'])} />
                <ResultTable title="Work Drivers"    dataSource={d.ks500rd.workDrivers}    columns={genericCols(['A','B'])} />
                {d.ks500rd.frontShoes?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 12 }}>Front Shoe: </Text>
                    <Tag color="blue">{d.ks500rd.frontShoes[0]?.no}</Tag>
                  </div>
                )}
              </Panel>
            )}

            {/* KS400B5 */}
            {d.ks400b5 && !d.ks400b5.calc?.error && (
              <Panel
                key="ks400b5"
                header={<><Tag color="magenta">KS400B5</Tag> Work Clamp / Shaft / Chute / etc.</>}
              >
                <ResultTable title="Work Clamps"     dataSource={d.ks400b5.workClamps}      columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Shafts"          dataSource={d.ks400b5.shafts}          columns={genericCols(['A','B','C'])} />
                <ResultTable title="Work Chutes"     dataSource={d.ks400b5.workChutes}      columns={genericCols(['A','B','C','D'])} />
                <ResultTable title="Work Loaders"    dataSource={d.ks400b5.workLoaders}     columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Work Chucks"     dataSource={d.ks400b5.workChucks}      columns={genericCols(['A'])} />
                <ResultTable title="Work Holders"    dataSource={d.ks400b5.workHolders}     columns={genericCols(['A','B'])} />
                <ResultTable title="Chuck Jaws"      dataSource={d.ks400b5.chuckJaws}       columns={genericCols(['A','B','C','D'])} />
                <ResultTable title="Chute Guides"    dataSource={d.ks400b5.workChuteGuides} columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Stoppers"        dataSource={d.ks400b5.stoppers}        columns={genericCols(['A','B'])} />
                <ResultTable title="Master Rings"    dataSource={d.ks400b5.masterRings}     columns={genericCols(['A','B','C'])} />
              </Panel>
            )}

            {/* KS400B6 */}
            {d.ks400b6 && !d.ks400b6.calc?.error && (
              <Panel
                key="ks400b6"
                header={<><Tag color="volcano">KS400B6</Tag> Work Driver / Chute / Plug / etc.</>}
              >
                <ResultTable title="Work Drivers"   dataSource={d.ks400b6.workDrivers}   columns={genericCols(['A','B','C','D','E'])} />
                <ResultTable title="Loading Chutes" dataSource={d.ks400b6.loadingChutes} columns={genericCols(['A','B','C','D','F'])} />
                <ResultTable title="Plugs"          dataSource={d.ks400b6.plugs}         columns={genericCols(['A','B','C','D'])} />
                <ResultTable title="Work Guides"    dataSource={d.ks400b6.workGuides}    columns={genericCols(['A','B','C','E'])} />
                <ResultTable title="Work Pushers"   dataSource={d.ks400b6.workPushers}   columns={genericCols(['A','B','C'])} />
                <ResultTable title="Stocker Chutes" dataSource={d.ks400b6.stockerChutes} columns={genericCols(['A','B','C'])} />
                <ResultTable title="Front Shoes"    dataSource={d.ks400b6.frontShoes}    columns={genericCols(['A','B','C','D'])} />
                <ResultTable title="Rear Shoes"     dataSource={d.ks400b6.rearShoes}     columns={genericCols(['A','B','C'])} />
                <ResultTable title="Pilot Pins"     dataSource={d.ks400b6.pilotPins}     columns={genericCols(['A','B','C'])} />
              </Panel>
            )}
          </Collapse>
        </>
      )}
    </div>
  );
}
