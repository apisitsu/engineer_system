import React, { useEffect, useState } from 'react';
import { Row, Col, Input, Button, Card, Descriptions, Spin, Tag, Typography, App, Collapse, Checkbox } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { useTumbleStore } from '../store/useTumbleStore';
import { tumbleApi } from '../api/tumbleApi';
import { pdfBase64 } from './pdfTemplate';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const { Text } = Typography;

const TumbleProductionView = () => {
  const { message, modal } = App.useApp();
  const { searchModelAndCondition, getConditionByCode, isLoading } = useTumbleStore();
  const [mrpData, setMrpData] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [conditionData, setConditionData] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [weightPcs, setWeightPcs] = useState('');
  const [selectedConditions, setSelectedConditions] = useState([]);

  const handleSearch = async (value) => {
    if (!value) return;
    setIsSearching(true);
    setMrpData(null);
    setModelData(null);
    setConditionData([]);
    setWeightPcs('');
    setSelectedConditions([]);
    value = value.toUpperCase();
    // console.log('value', value)

    try {
      const mrpJson = await tumbleApi.getMrpDataByLotNo(value);
      // console.log('mrpJson', mrpJson)
      if (mrpJson && mrpJson.length > 0) {
        const item = mrpJson[0];
        setMrpData(item);

        const cn = item.mrp_itemno ? item.mrp_itemno.substring(0, 6) : '';
        if (cn) {
          const result = await searchModelAndCondition(cn);
          if (result.success && result.models.length > 0) {
            const foundModel = result.models[0];
            setModelData(foundModel);

            if (foundModel.condition_code) {
              const condResult = await getConditionByCode(foundModel.condition_code);
              if (condResult.success && condResult.conditions.length > 0) {
                setConditionData(condResult.conditions);
              } else {
                message.warning(`Condition code '${foundModel.condition_code}' not found.`);
              }
            }
          } else {
            message.warning(`Model not found for CN: ${cn}`);
          }
        } else {
          message.warning('Could not extract CN from MRP Item No.');
        }
      } else {
        message.warning('No MRP data found for this Lot No.');
      }
    } catch (error) {
      console.error(error);
      message.error('Error fetching data. Ensure you are on the company network.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCheckboxChange = (e, condition) => {
    if (e.target.checked) {
      setSelectedConditions(prev => {
        const filtered = prev.filter(c => c.process !== condition.process);
        return [...filtered, condition];
      });
    } else {
      setSelectedConditions(prev => prev.filter(c => c.id !== condition.id));
    }
  };

  const generatePDF = async () => {
    if (!modelData || conditionData.length === 0) {
      message.warning('Please search for a valid Lot/Model first before generating PDF.');
      return;
    }

    const uniqueProcessesInModel = [...new Set(conditionData.map(item => item.process))];
    const selectedProcessTypes = selectedConditions.map(c => c.process);

    let missing = [];
    if (uniqueProcessesInModel.includes("Rough barrel") && !selectedProcessTypes.includes("Rough barrel")) missing.push("Rough barrel");
    if (uniqueProcessesInModel.includes("Finish barrel") && !selectedProcessTypes.includes("Finish barrel")) missing.push("Finish barrel");
    if ((uniqueProcessesInModel.includes("Drain and Refill") || uniqueProcessesInModel.includes("Clean")) &&
      !(selectedProcessTypes.includes("Drain and Refill") || selectedProcessTypes.includes("Clean"))) {
      missing.push("Drain and Refill or Clean");
    }
    if (!weightPcs) missing.push("Weight per Pcs (KG)");

    if (missing.length > 0) {
      modal.warning({
        title: 'Please fill in complete information.',
        content: (
          <ul style={{ color: 'red', marginTop: 10 }}>
            {missing.map(m => <li key={m}>{m}</li>)}
          </ul>
        )
      });
      return;
    }

    try {
      const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const drawCenteredText = (text, xStart, xEnd, yStart, yEnd, fontSize) => {
        if (!text) return;
        const textStr = String(text);
        const textWidth = font.widthOfTextAtSize(textStr, fontSize);
        const textHeight = font.heightAtSize(fontSize);
        const x = xStart + (xEnd - xStart - textWidth) / 2;
        const y = yStart + (yEnd - yStart - textHeight) / 2;
        firstPage.drawText(textStr, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
      };

      const getPositionByProcess = (process) => {
        const positions = {
          "Rough barrel": { xStart: 173, xEnd: 265 },
          "Finish barrel": { xStart: 357, xEnd: 450 },
          "Drain and Refill": { xStart: 450, xEnd: 543 },
          "Clean": { xStart: 450, xEnd: 543 }
        };
        return positions[process] || { xStart: 0, xEnd: 0 };
      };

      // Header Info
      if (modelData) {
        firstPage.drawText(modelData.part || '', { x: 90, y: 730, size: 10, font });
        firstPage.drawText(modelData.class_name || '', { x: 300, y: 730, size: 10, font });
        firstPage.drawText(modelData.material || '', { x: 90, y: 708, size: 10, font });
        firstPage.drawText(modelData.condition_code || '', { x: 130, y: 686, size: 10, font });
      }

      if (mrpData) {
        firstPage.drawText(mrpData.mrp_itemno || '', { x: 300, y: 708, size: 10, font });
        firstPage.drawText(mrpData.lot_no || '', { x: 440, y: 708, size: 10, font });
      }

      drawCenteredText(weightPcs, 311, 403, 720, 730, 12);

      selectedConditions.forEach(cond => {
        const { xStart, xEnd } = getPositionByProcess(cond.process);
        if (xStart === 0) return;

        let checkX = xStart + 5;
        if (cond.process === "Rough barrel") checkX = 176;
        else if (cond.process === "Finish barrel") checkX = 360;
        else if (cond.process === "Clean" || cond.process === "Drain and Refill") checkX = 453;

        drawCenteredText('/', checkX, checkX + 15, 695, 705, 14);

        drawCenteredText(cond.media_spec, xStart, xEnd, 655, 667, 10);
        drawCenteredText(cond.media_qty_kg, xStart, xEnd, 645, 655, 10);
        drawCenteredText(cond.ss_100, xStart, xEnd, 632, 644, 10);
        drawCenteredText(cond.water_qty_l, xStart, xEnd, 620, 632, 10);
        drawCenteredText(cond.light_1a, xStart, xEnd, 608, 620, 10);
        drawCenteredText(cond.time_min, xStart, xEnd, 597, 608, 10);
        drawCenteredText(cond.revolution, xStart, xEnd, 585, 597, 10);

        if (cond.inspection_sampling && cond.inspection_sampling !== '-') {
          drawCenteredText(cond.inspection_sampling, 250, 325, 198, 210, 12);
        }
      });

      const pdfBytesOut = await pdfDoc.save();
      const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error('Failed to generate PDF: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <Row gutter={[16, 16]} style={{ alignItems: 'center', textAlign: 'center' }}>
        <Col span={24}>
          <Card title="Process Scanning (Production View)" variant="borderless" className="shadow-sm">
            <Row justify="center" align="middle">
              <Col xs={24} sm={16} md={12} lg={10}>
                <Input.Search
                  placeholder="Scan or Enter Lot No / MRP Item No"
                  enterButton="Search"
                  size="large"
                  onSearch={handleSearch}
                  loading={isSearching || isLoading}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {(isSearching || isLoading) && (
          <Col span={24} style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" tip="Loading Tumble Data...">
              <div style={{ padding: '40px' }} />
            </Spin>
          </Col>
        )}

        {!isSearching && !isLoading && modelData && (
          <Col span={24}>
            <Card
              title={
                <Row justify="space-between" align="middle">
                  <Text strong>Tumble Model Information</Text>
                </Row>
              }
              variant="borderless"
              className="shadow-sm"
            >
              <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }} size="small">
                <Descriptions.Item label="CN">{modelData.new_cn || '-'}</Descriptions.Item>
                <Descriptions.Item label="Old CN">{modelData.old_cn || '-'}</Descriptions.Item>
                <Descriptions.Item label="Part No">{modelData.part || '-'}</Descriptions.Item>
                <Descriptions.Item label="Class Name">{modelData.class_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Material">{modelData.material || '-'}</Descriptions.Item>
                <Descriptions.Item label="Process">{modelData.process || '-'}</Descriptions.Item>
                <Descriptions.Item label="Condition Code">
                  <Tag color="blue">{modelData.condition_code || '-'}</Tag>
                </Descriptions.Item>
              </Descriptions>

              {mrpData && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>MRP Context: </Text>
                  <Tag color="green">Lot No: {mrpData.lot_no}</Tag>
                  <Tag color="orange">Item No: {mrpData.mrp_itemno}</Tag>
                </div>
              )}
            </Card>
          </Col>
        )}

        {!isSearching && !isLoading && conditionData && conditionData.length > 0 && (
          <Col span={24}>
            <Card title="INPUT FORM" variant="borderless" className="shadow-sm" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text strong><span style={{ color: 'red' }}>*</span> Weight per Pcs (KG) :</Text>
                  <Input
                    placeholder="Weight"
                    value={weightPcs}
                    onChange={e => setWeightPcs(e.target.value)}
                    style={{ width: 150 }}
                  />
                </div>
              </div>

              <Collapse accordion={false} bordered={true} style={{ textAlign: 'left' }}>
                {conditionData.map((item, index) => (
                  <Collapse.Panel
                    key={index}
                    header={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Checkbox
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleCheckboxChange(e, item)}
                          style={{ marginRight: 16 }}
                          checked={selectedConditions.some(c => c.id === item.id)}
                        />
                        <Text strong><span style={{ color: 'red' }}>*</span> {item.process}</Text>
                        <Text style={{ marginLeft: 8 }}>- {item.mc_type_no}</Text>
                      </div>
                    }
                  >
                    <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }} size="small">
                      <Descriptions.Item label="M/C Type & No">{item.mc_type_no || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Process">{item.process || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Qty (Max)">{item.qty_max || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Media SPEC">{item.media_spec || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Media Qty (kg)">{item.media_qty_kg || '-'}</Descriptions.Item>
                      <Descriptions.Item label="SS-100">{item.ss_100 || '-'}</Descriptions.Item>
                      <Descriptions.Item label="LIGHT 1A">{item.light_1a || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Water Qty (l)">{item.water_qty_l || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Revolution">{item.revolution || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Time (min)">{item.time_min || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Inspection Sampling" span={2}>{item.inspection_sampling || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Cleaning Parts Used">{item.cleaning_parts_used || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Cleaning Parts Time">{item.cleaning_parts_time || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Water Displacement Used">{item.water_displacement_used || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Rust Protection Used">{item.rust_protection_used || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Rust Protection Time">{item.rust_protection_time || '-'}</Descriptions.Item>
                    </Descriptions>
                  </Collapse.Panel>
                ))}
              </Collapse>

              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Button type="primary" icon={<FilePdfOutlined />} size="large" onClick={generatePDF}>
                  Generate PDF
                </Button>
              </div>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default TumbleProductionView;