import { Button, Form, Modal, Space, Input } from "antd";
import React, { useEffect } from "react";
import { server, key_constance } from "../../../../constance/constance.js";
import axios from "axios";

export const CollectionEditForm = ({ onCancel, visibleEdit, editById }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    const getData = async () => {
      if (visibleEdit) {
        const resultDocNo = await axios.get(
          server.ENG_TOOLING_INSP_RETURN + "/" + editById
        );
        const x = resultDocNo.data[0];
        form.setFieldsValue({
          eng_docno: x.eng_docno,
          eng_itemno: x.eng_itemno,
          eng_itemname: x.eng_itemname,
          eng_spec: x.eng_spec,
          eng_acc_qty: x.eng_acc_qty,
          eng_rej_qty: x.eng_rej_qty,
          eng_remark: x.eng_remark,
        });
        console.log(resultDocNo.data);
      }
    };
    getData();
  }, [editById, form, visibleEdit]);

  const onEdit = async (values) => {
    // console.log(values);
    Object.assign(values, {
      eng_insp_emp: localStorage.getItem(key_constance.USER_EMPNO),
    });
    await axios.put(server.ENG_TOOLING_INSP_RETURN + "/" + editById, values);
  };

  const footerModal = [
    <Button key="back" onClick={onCancel}>
      Close
    </Button>,
    <Button key="submit" type="primary"
      onClick={() => {
        form.validateFields().then((values) => {
          form.resetFields();
          onEdit(values);
        }).catch((info) => {
          console.log("Validate Failed:", info);
        });
      }}
    >
      Edit
    </Button>,
  ]

  return (
    <>
      <Modal forceRender width={1000} open={visibleEdit} title="Tooling Inspection Edit Inspection Data" onCancel={onCancel} footer={footerModal} >
        <Form form={form} layout="vertical" name="form_in_modal" initialValues={{ modifier: "public" }}>
          <Space align="baseline">
            <Form.Item name="eng_docno" label="Document No.">
              <Input readOnly />
            </Form.Item>
            <Form.Item name="eng_itemno" label="Item No.">
              <Input readOnly />
            </Form.Item>
            <Form.Item name="eng_itemname" label="Item Name">
              <Input readOnly />
            </Form.Item>
            <Form.Item name="eng_spec" label="Spec">
              <Input readOnly style={{ width: 400 }}/>
            </Form.Item>
          </Space>
          <Form.Item name="eng_acc_qty" label="Acc.Qty">
            <Input status="error" />
          </Form.Item>
          <Form.Item name="eng_rej_qty" label="Rej.Qty">
            <Input status="error" />
          </Form.Item>
          <Form.Item name="eng_remark" label="Remark">
            <Input status="error" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
