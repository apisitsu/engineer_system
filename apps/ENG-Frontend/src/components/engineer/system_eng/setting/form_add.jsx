import { Form, Input, Modal, Select, Space, Button, InputNumber, DatePicker } from "antd";
import { MinusCircleOutlined } from "@ant-design/icons";
import Swal from "sweetalert2";
import React, { useState, useEffect } from "react";
import { server, key_constance } from "../../../../constance/constance";
import axios from "axios";
import moment from "moment";

export const CollectionAddForm = ({ visibleAddItem, onCancel, addByDocNo }) => {
  const [masterItem, setMasterItem] = useState([]);
  const [spec, setSpec] = useState([]);
  const [form] = Form.useForm();
  const reload = () => window.location.reload();
  const format = "YYYY-MM-DD (HH:mm)";

  useEffect(() => {
    const getData = async () => {
      if (visibleAddItem) {
        form.setFieldsValue({
          eng_docno: addByDocNo,
        });
      }
    };
    getData();
  }, [addByDocNo, form, visibleAddItem]);

  const onCreate = async (values) => {
    // console.log(values);
    try {
      const tooling = [...values.tooling];
      const newData = [];
      for (let i = 0; i < values.tooling.length; i++) {
        newData.push({
          eng_wc: values.eng_docno.substring(2, 4),
          eng_docno: values.eng_docno,
          eng_itemname: tooling[i].eng_itemname,
          eng_itemno: tooling[i].eng_itemno,
          eng_spec: tooling[i].eng_spec,
          eng_return_qty: Number(tooling[i].eng_acc_qty) + Number(tooling[i].eng_rej_qty),
          eng_return_emp: localStorage.getItem(key_constance.USER_EMPNO),
          eng_return_confirmby: localStorage.getItem(key_constance.USER_EMPNO),
          eng_acc_qty: tooling[i].eng_acc_qty,
          eng_rej_qty: tooling[i].eng_rej_qty,
          eng_insp_emp: localStorage.getItem(key_constance.USER_EMPNO),
          eng_insp_start: moment(tooling[i].eng_insp_start).format(),
          eng_insp_finish: moment(tooling[i].eng_insp_finish).format(),
          eng_remark: tooling[i].eng_remark,
          eng_status: "2",
        });
        console.log("newData[i]", newData[i]);
        await axios.post(server.ENG_TOOLING_INSP_RETURN, newData[i]);
        Swal.fire({
          icon: "success",
          title: `${values.eng_docno} record complete`,
          timer: 15000,
        });
      }
    } catch (error) {
      console.log("Validate Failed:", error);
    }
    onCancel();
    reload();
  };

  const SearchSpec = async (values) => {
    const ipbass = await axios.get(server.IPBASS_SPEC + `/${values}`);
    setMasterItem(ipbass.data);
    setSpec(
      ipbass.data.map(({ SPECIFICATION }) => ({
        label: SPECIFICATION,
        value: SPECIFICATION,
      }))
    );
  };

  const handleSpecChange = async (values) => {
    const item = masterItem.find((x) => x.SPECIFICATION === values);
    const { tooling } = form.getFieldValue();
    // console.log({ tooling });

    if (values !== undefined) {
      for (let i = 0; i < tooling.length; i++) {
        if (tooling[i].eng_spec === values) {
          tooling[i].eng_itemno = item.ITEM_NO
          tooling[i].eng_itemname = item.ITEM_NAME
          form.setFieldsValue({ names: tooling });
        }
      }
    } else {
      for (let i = 0; i < tooling.length; i++) {
        if (tooling[i].eng_spec === values) {
          tooling[i].eng_itemno = ""
          tooling[i].eng_itemname = ""
          tooling[i].eng_return_qty = ""
          form.setFieldsValue({ names: tooling });
        }
      }
    }
  };

  const onOK = () => {
    form.validateFields().then((values) => {
      form.resetFields();
      onCreate(values);
    }).catch((info) => {
      console.log("Validate Failed:", info);
    });
  }

  return (
    <Modal forceRender width={1000} open={visibleAddItem} title="Engineer return tooling list" okText="Create" cancelText="Close" onCancel={onCancel} onOk={() => {onOK()}}>
      <Form form={form} layout="vertical" name="form_in_modal" initialValues={{ modifier: "public" }}>
        <Space>
          <Form.Item name="eng_docno" label="Document No.">
            <Input />
          </Form.Item>
        </Space>
        <br />
        <Space>
          <Form.Item name="eng_start_date" label="Start : Date (Time)" rules={[{ required: true, message: "Please input" }]}>
            <DatePicker showTime format={format} />
          </Form.Item>
          <Form.Item name="eng_finish_date" label="Finish : Date (Time)" rules={[{ required: true, message: "Please input"}]}>
            <DatePicker showTime format={format} />
          </Form.Item>
        </Space>
        {/* ---Add field--- */}
        <Form.List name="tooling">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Space key={Math.random()} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                  <Form.Item {...field} key={Math.random()} name={[field.name, "eng_itemno"]} label="Item No.">
                    <Input placeholder="Item No." />
                  </Form.Item>
                  <Form.Item {...field} key={Math.random()} name={[field.name, "eng_itemname"]} label="Item Name">
                    <Input placeholder="Item Name" />
                  </Form.Item>
                  <Form.Item {...field} key={Math.random()} name={[field.name, "eng_spec"]} label="Spec" rules={[{ required: true, message: "Missing Spec" }]}>
                    <Select key={Math.random()} style={{ width: 250 }} allowClear showSearch placeholder="Spec" options={spec} onSearch={SearchSpec} onChange={handleSpecChange}/>
                  </Form.Item>
                  <Form.Item {...field} key={Math.random()} name={[field.name, "eng_acc_qty"]} label="Acc(pcs)">
                    <InputNumber placeholder="Accept Qty" />
                  </Form.Item>
                  <Form.Item {...field} key={Math.random()} name={[field.name, "eng_rej_qty"]} label="Rej(pcs)">
                    <InputNumber placeholder="Reject Qty" />
                  </Form.Item>
                  <Form.Item {...field} key={Math.random()} name={[field.name, "eng_remark"]} label="Remark">
                    <Input placeholder="Remark" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Form.Item>
                <Button type="dashed" onClick={() => add()} block>
                  +Add field
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};
