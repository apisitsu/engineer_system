import { Button, Form, Modal, Space, Table, Input, DatePicker, InputNumber } from "antd";
import React, { useState, useEffect, useRef, useContext } from "react";
import { server, key_constance } from "../../../../constance/constance.js";
import axios from "axios";
import { SearchOutlined } from "@ant-design/icons";
import Swal from "sweetalert2";
import moment from "moment";
import dayjs from "dayjs";

export const CollectionInspForm = ({ onCancel, visibleInsp, inspByDocNo }) => {
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const searchInput = useRef(null);
  const reload = () => window.location.reload();
  const EditableContext = React.createContext(null);
  const format = "YYYY-MM-DD (HH:mm)";

  useEffect(() => {
    const getData = async () => {
      if (visibleInsp) {
        const resultDocNo = await axios.get(server.ENG_TOOLING_RETURN + "/" + inspByDocNo);

        form.setFieldsValue({
          eng_docno: inspByDocNo,
        });

        const sumData = sumQty(resultDocNo.data);
        const addData = [];
        for (let i = 0; i < sumData.length; i++) {
          addData.push({
            key: sumData[i].key,
            eng_docno: sumData[i].eng_docno,
            eng_itemname: sumData[i].eng_itemname,
            eng_itemno: sumData[i].eng_itemno,
            eng_return_qty: sumData[i].eng_return_qty,
            eng_spec: sumData[i].eng_spec,
            eng_acc_qty: sumData[i].eng_return_qty,
            eng_rej_qty: 0,
            eng_remark: "",
          });
        }
        setData(addData);
      }
    };
    getData();
  }, [form, inspByDocNo, visibleInsp]);

  const sumQty = (xs) =>
    Object.values(
      xs.reduce(
        (acc, { eng_itemno, eng_spec, eng_return_qty, eng_docno, eng_itemname }) => {
          const key = eng_docno + eng_itemno;
          acc[key] ??= {
            key,
            eng_itemno,
            eng_spec,
            eng_return_qty: 0,
            eng_docno,
            eng_itemname,
          };
          acc[key].eng_return_qty += Number(eng_return_qty);
          return acc;
        }, {}
      )
    );

  const onSave = async (values) => {
    // console.log("e:", e);
    console.log("data", data);
    console.log("values", values);

    const newData = [];
    for (let i = 0; i < data.length; i++) {
      newData.push({
        eng_wc: values.eng_docno.substring(2, 4),
        eng_docno: values.eng_docno,
        eng_itemname: data[i].eng_itemname,
        eng_itemno: data[i].eng_itemno,
        eng_spec: data[i].eng_spec,
        eng_acc_qty: data[i].eng_acc_qty,
        eng_rej_qty: data[i].eng_rej_qty,
        eng_remark: data[i].eng_remark,
        eng_insp_start: dayjs(values.eng_insp_start).format(),
        eng_insp_finish: dayjs(values.eng_insp_finish).format(),
        eng_insp_emp: localStorage.getItem(key_constance.USER_EMPNO),
        eng_return_confirmby: localStorage.getItem(key_constance.USER_EMPNO),
        eng_status: "2",
      });
      // console.log("newData[i]", newData[i]);
      await axios.post(server.ENG_TOOLING_INSP, newData[i]);
      Swal.fire({
        icon: "success",
        title: `${values.eng_docno} record complete`,
      });
    }
    onCancel();
    reload();
  };

  const EditableRow = ({ index, ...props }) => {
    return (
      <Form form={form} component={false}>
        <EditableContext.Provider value={form}>
          <tr {...props} />
        </EditableContext.Provider>
      </Form>
    );
  };

  const EditableCell = ({ title, editable, children, dataIndex, record, handleSave, ...restProps }) => {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef(null);
    const form = useContext(EditableContext);

    useEffect(() => {
      if (editing) {
        inputRef.current.focus();
      }
    }, [editing]);

    const toggleEdit = () => {
      setEditing(!editing);
      form.setFieldsValue({
        [dataIndex]: record[dataIndex],
      });
    };

    const save = async () => {
      try {
        const values = await form.validateFields();
        toggleEdit();
        handleSave({ ...record, ...values });
      } catch (errInfo) {
        console.log("Save failed:", errInfo);
      }
    };

    let childNode = children;
    const inputNode =
      dataIndex === "eng_remark" ? (
        <Input ref={inputRef} onPressEnter={save} />
      ) : (
        <InputNumber ref={inputRef} onChange={save} />
      );

    if (editable) {
      childNode = editing ? (
        <Form form={form}>
          <Form.Item style={{ margin: 0 }} name={dataIndex}>
            {inputNode}
          </Form.Item>
        </Form>
      ) : (
        <div className="editable-cell-value-wrap" style={{ paddingRight: 24 }} onClick={toggleEdit}>
          {children}
        </div>
      );
    }
    return <td {...restProps}>{childNode}</td>;
  };

  const handleSave = (row) => {
    const newData = [...data];
    const index = newData.findIndex((item) => row.key === item.key);
    const item = newData[index];
    newData.splice(index, 1, { ...item, ...row });
    setData(newData);
  };

  ///---Search---///
  const handleSearch = (selectedKeys, confirm) => {
    confirm();
  };
  const handleReset = (clearFilters) => {
    clearFilters();
  };
  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <Input ref={searchInput} placeholder={`Search`} value={selectedKeys[0]} onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])} onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)} style={{ marginBottom: 8, display: "block" }} />
        <Space>
          <Button type="primary" onClick={() => handleSearch(selectedKeys, confirm, dataIndex)} icon={<SearchOutlined />} size="small" style={{ width: 90 }}>
            Search
          </Button>
          <Button onClick={() => { clearFilters && handleReset(clearFilters); confirm({ closeDropdown: false }); }} size="small" style={{ width: 90 }}>
            Clear
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (<SearchOutlined style={{ color: filtered ? "#1890ff" : undefined }} />),
    onFilter: (value, record) => String(record[dataIndex]).toLowerCase().includes(value.toLowerCase()),
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
  });
  ///---End Search---///

  const defaultColumns = [
    {
      title: "Item No.",
      dataIndex: "eng_itemno",
      key: "eng_itemno",
      ...getColumnSearchProps("eng_itemno"),
    },
    {
      title: "Item Name",
      dataIndex: "eng_itemname",
      key: "eng_itemname",
      ...getColumnSearchProps("eng_itemname"),
    },
    {
      title: "Spec",
      dataIndex: "eng_spec",
      key: "eng_spec",
      ...getColumnSearchProps("eng_spec"),
    },
    {
      title: "Return Qty(pcs)",
      dataIndex: "eng_return_qty",
      key: "eng_return_qty",
      editable: true,
      render: (text) => Number(text).toFixed(2),
    },
    {
      title: "Accept Qty(pcs)",
      dataIndex: "eng_acc_qty",
      key: "eng_acc_qty",
      editable: true,
      render: (index, row, record) => {
        return (
          <div>
            <InputNumber value={data[record].eng_acc_qty} />
          </div>
        );
      },
    },
    {
      title: "Reject Qty(pcs)",
      dataIndex: "eng_rej_qty",
      key: "eng_rej_qty",
      editable: true,
      render: (index, row, record) => (
        <InputNumber value={data[record].eng_rej_qty} />
      ),
    },
    {
      title: "Remark",
      dataIndex: "eng_remark",
      key: "eng_remark",
      editable: true,
      render: (index, row, record) => <Input value={data[record].eng_remark} />,
    },
  ];

  const columns = defaultColumns.map((col) => {
    if (!col.editable) {
      return col;
    }

    return {
      ...col,
      onCell: (record) => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave,
      }),
    };
  });

  const footerModal = [
    <Button key="back" onClick={onCancel}>
      Close
    </Button>,
    <Button key="submit" type="primary"
      onClick={() => {
        form.validateFields().then((values) => {
          form.resetFields();
          onSave(values);
        }).catch((info) => {
          console.log("Validate Failed:", info);
        });
      }}
    >
      Save Insp.Result
    </Button>,
  ]

  return (
    <Modal forceRender width={1000} open={visibleInsp} title="Tooling Inspection Return List" onCancel={onCancel} footer={footerModal} >
      <Form form={form} layout="vertical" name="form_in_modal" initialValues={{ modifier: "public" }}>
        <Space align="baseline">
          <Form.Item name="eng_docno" label="Document No.">
            <Input />
          </Form.Item>
        </Space>
        <br />
        <Space>
          <Form.Item name="eng_insp_start" label="Start : Date (Time)" rules={[{ required: true, message: "Please input" }]}>
            <DatePicker showTime format={format} />
          </Form.Item>
          <Form.Item name="eng_insp_finish" label="Finish : Date (Time)" rules={[{ required: true, message: "Please input" }]}>
            <DatePicker showTime format={format} />
          </Form.Item>
        </Space>
        <Table
          bordered
          size="small"
          dataSource={data}
          columns={columns}
          rowClassName={() => "editable-row"}
          components={{
            body: {
              row: EditableRow,
              cell: EditableCell,
            },
          }}
        />
      </Form>
    </Modal>
  );
};
