import React, { useState, useEffect, useRef } from "react";
import { Layout, Table, Space, Button, Input, DatePicker, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import moment from "moment";
import { server, key_constance } from "../../../../constance/constance";
import { getUniqueListBy } from "../../../../constance/function";
import { CollectionInspForm } from "./form_insp";
import { CollectionAddForm } from "./form_add";
import { CollectionReturnForm } from "./form_print_return";
import { CollectionRejForm } from "./form_print_rej";
import { CollectionEditForm } from "./form_edit";
import Swal from "sweetalert2";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";

const { Content } = Layout;

function Tooling_Report() {
  const [masterDocNo, setMasterDocNo] = useState([]);
  const [visibleInsp, setVisibleInsp] = useState(false);
  const [visibleAddItem, setVisibleAddItem] = useState(false);
  const [visiblePrint, setVisiblePrint] = useState(false);
  const [visibleRej, setVisibleRej] = useState(false);
  const [visibleEdit, setVisibleEdit] = useState(false);
  const [inspByDocNo, setInspByDocNo] = useState([]);
  const [addByDocNo, setAddByDocNo] = useState([]);
  const [printByDocNo, setPrintByDocNo] = useState([]);
  const [masterAdd, setMasterAdd] = useState([]);
  const [editById, setEditById] = useState([]);
  const [dateSelect, setDateSelect] = useState(null);
  const [loading, setLoading] = useState(false);
  const searchInput = useRef(null);
  const { RangePicker } = DatePicker;
  const reload = () => window.location.reload();

  useEffect(() => {
    const getData = async () => {
      const resultDocNo = await axios.get(server.ENG_TOOLING_RETURN);
      setMasterDocNo(resultDocNo.data);
      const resultInsp = await axios.get(server.ENG_TOOLING_INSP);
      setMasterAdd(resultInsp.data);
    };
    getData();
  }, []);

  const sumRejQty = (xs) =>
    Object.values(
      xs.reduce((acc, { eng_rej_qty, eng_docno, eng_insp_confirmby }) => {
        const key = eng_docno;
        acc[key] ??= {
          eng_docno,
          eng_rej_qty: 0,
          eng_insp_confirmby,
        };
        acc[key].eng_rej_qty += Number(eng_rej_qty);
        return acc;
      }, {})
    );
  const listDocNo = getUniqueListBy(masterDocNo, "eng_docno").filter(
    (x) => x.eng_return_confirmby !== null
  );
  // console.log("listDocNo", listDocNo);
  const tableDocNo = [];
  for (let i = 0; i < listDocNo.length; i++) {
    tableDocNo.push({
      key: i.toString(),
      eng_return_confirmby: listDocNo[i].eng_return_confirmby,
      eng_docno: listDocNo[i].eng_docno,
      eng_wc: listDocNo[i].eng_wc,
      eng_insp_emp: listDocNo[i].eng_insp_emp,
      eng_insp_confirmby: listDocNo[i].eng_insp_confirmby,
      eng_return_date: listDocNo[i].eng_return_date,
      eng_rej_qty: "",
    });
  }

  const onInsp = (e) => {
    setInspByDocNo(e.eng_docno);
    setVisibleInsp(true);
  };

  const onConfirm = async (values) => {
    const filter = masterAdd.filter((x) => x.eng_docno === values.eng_docno);
    if (filter.length === 0) {
      Swal.fire({
        icon: "error",
        title: `Please input inspection result Doc no. : ${values.eng_docno}`,
      });
    } else {
      Object.assign(values, {
        eng_insp_confirmby: localStorage.getItem(key_constance.USER_EMPNO),
      });
      await axios.put(
        server.ENG_TOOLING_INSP_CONFIRM + `/${values.eng_docno}`,
        values
      );
      reload();
    }
  };

  const onAdd = (e) => {
    setAddByDocNo(e.eng_docno);
    setVisibleAddItem(true);
  };

  const onPrint = (e) => {
    setPrintByDocNo(e.eng_docno);
    setVisiblePrint(true);
  };

  const onPrintRej = (e) => {
    setPrintByDocNo(e.eng_docno);
    setVisibleRej(true);
  };

  const onEdit = (e) => {
    setEditById(e.id);
    setVisibleEdit(true);
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

  const columns = [
    {
      title: "W/C code",
      dataIndex: "eng_wc",
      key: "eng_wc",
      ...getColumnSearchProps("eng_wc"),
    },
    {
      title: "Doc.No.",
      dataIndex: "eng_docno",
      key: "eng_docno",
      ...getColumnSearchProps("eng_docno"),
    },
    {
      title: "Prd Return Date",
      dataIndex: "eng_return_date",
      key: "eng_return_date",
      ...getColumnSearchProps("eng_return_date"),
      defaultSortOrder: "descend",
      sorter: { compare: (a, b) => a.eng_return_date.localeCompare(b.eng_return_date) },
      render: (text) => moment(text).format("YYYY-MM-DD(HH:mm)"),
    },
    {
      title: "",
      dataIndex: "operation",
      key: "operation",
      render: (_, row) => {
        const showInput = (
          <Space key={Math.random()}>
            <Button type="primary" size="small" onClick={() => onInsp(row)}>
              Input Result
            </Button>
            <CollectionInspForm visibleInsp={visibleInsp} onCancel={() => { setVisibleInsp(false); }} inspByDocNo={inspByDocNo} />
          </Space>
        );
        const showAdd = (
          <Space key={Math.random()}>
            <Button size="small" onClick={() => onAdd(row)}>
              Add Item
            </Button>
            <CollectionAddForm visibleAddItem={visibleAddItem} onCancel={() => { setVisibleAddItem(false); }} addByDocNo={addByDocNo} />
          </Space>
        );

        const showPrintReturn = (
          <Space key={Math.random()}>
            <Button type="primary" ghost size="small" onClick={() => onPrint(row)}>
              Print Return
            </Button>
            <CollectionReturnForm visiblePrint={visiblePrint} onCancel={() => { setVisiblePrint(false); }} printByDocNo={printByDocNo} />
          </Space>
        );
        const showPrintScrap = (
          <Space key={Math.random()}>
            <Button type="primary" danger ghost size="small" onClick={() => onPrintRej(row)}>
              Print Scrap
            </Button>
            <CollectionRejForm visibleRej={visibleRej} onCancel={() => { setVisibleRej(false); }} printByDocNo={printByDocNo} />
          </Space>
        );

        const rejQty = sumRejQty(masterAdd);

        const filter1 = rejQty.filter(
          (x) =>
            x.eng_docno === row.eng_docno &&
            x.eng_insp_confirmby !== null &&
            x.eng_rej_qty === 0
        );
        const filter2 = rejQty.filter(
          (x) => x.eng_docno === row.eng_docno && x.eng_insp_confirmby === null
        );
        const filter3 = rejQty.filter(
          (x) =>
            x.eng_docno === row.eng_docno &&
            x.eng_insp_confirmby !== null &&
            x.eng_rej_qty > 0
        );

        if (filter1.length !== 0) {
          return showPrintReturn;
        } else if (filter2.length !== 0) {
          return showAdd;
        } else if (filter3.length !== 0) {
          return [showPrintReturn, " ", showPrintScrap];
        } else {
          return showInput;
        }
      },
    },
    {
      title: "Status",
      dataIndex: "eng_insp_confirmby",
      key: "eng_insp_confirmby",
      render: (_, row) => {
        const filter = masterAdd.filter((x) => x.eng_docno === row.eng_docno && x.eng_insp_confirmby !== null);
        const showconfirm = (
          <Button size="small" type="primary" shape="round" onClick={() => onConfirm(row)}>
            Waiting Insp.
          </Button>
        );

        if (filter.length !== 0) {
          return <>Confirm By : {filter[0].eng_insp_confirmby.toUpperCase()}</>;
        } else {
          return showconfirm;
        }
      },
    },
  ];

  const expandedRowRender = (e) => {
    const filterInsp = masterAdd.filter((x) => x.eng_docno === e.eng_docno);
    const columnsInsp = [
      {
        title: "No.",
        dataIndex: "eng_no",
        render: (index, text, record) => record + 1,
      },
      {
        title: "Item No.",
        dataIndex: "eng_itemno",
        ...getColumnSearchProps("eng_itemno"),
      },
      {
        title: "Item Name",
        dataIndex: "eng_itemname",
        ...getColumnSearchProps("eng_itemname"),
      },
      {
        title: "Spec",
        dataIndex: "eng_spec",
        ...getColumnSearchProps("eng_spec"),
      },
      {
        title: "Accept Qty",
        dataIndex: "eng_acc_qty",
        editable: true,
        render: (text) => Number(text).toFixed(2),
      },
      {
        title: "Reject Qty",
        dataIndex: "eng_rej_qty",
        editable: true,
        render: (text) => Number(text).toFixed(2),
      },
      {
        title: "Remark",
        dataIndex: "eng_remark",
        editable: true,
      },
      {
        title: "Insp.By",
        dataIndex: "eng_insp_emp",
      },
      {
        title: "",
        render: (_, row) => {
          const showEdit = (
            <Space key={Math.random()}>
              <Button type="primary" danger ghost size="small" onClick={() => onEdit(row)}>Edit</Button>
              <CollectionEditForm visibleEdit={visibleEdit} onCancel={() => { setVisibleEdit(false); }} editById={editById} />
            </Space>
          );

          if (row.eng_insp_confirmby) {
          } else {
            return showEdit;
          }
        },
      },
    ];
    return (
      <Table size="small" columns={columnsInsp} dataSource={filterInsp} pagination={false} rowKey={"eng_itemno"} />
    );
  };

  const onDateRangeChange = (date) => {
    if (date) {
      const startDate = moment(date[0].$d).format("YYYY-MM-DD");
      const endDate = moment(date[1].$d).format("YYYY-MM-DD");
      const filterTable = masterAdd.filter(
        (x) =>
          moment(x.eng_insp_start).format("YYYY-MM-DD") >= startDate &&
          moment(x.eng_insp_start).format("YYYY-MM-DD") <= endDate
      );
      setDateSelect(filterTable);
    } else {
      setDateSelect(tableDocNo);
    }
  };

  let dataList = []
  const onClick_Excel = async () => {
    setLoading(true)
    let dataExcel = (dateSelect ? dateSelect : masterAdd)
    for (let data of dataExcel) {
      let year_eng_insp_start
      let month_eng_insp_start
      let day_eng_insp_start
      let hour_eng_insp_start
      let min_eng_insp_start
      let year_eng_insp_finish
      let month_eng_insp_finish
      let day_eng_insp_finish
      let hour_eng_insp_finish
      let min_eng_insp_finish

      if (data.eng_insp_start) {
        year_eng_insp_start = new Date(data.eng_insp_start).getFullYear()
        month_eng_insp_start = new Date(data.eng_insp_start).getMonth()
        day_eng_insp_start = new Date(data.eng_insp_start).getDate()
        hour_eng_insp_start = new Date(data.eng_insp_start).getHours()
        min_eng_insp_start = new Date(data.eng_insp_start).getMinutes()
      }
      if (data.eng_insp_finish) {
        year_eng_insp_finish = new Date(data.eng_insp_finish).getFullYear()
        month_eng_insp_finish = new Date(data.eng_insp_finish).getMonth()
        day_eng_insp_finish = new Date(data.eng_insp_finish).getDate()
        hour_eng_insp_finish = new Date(data.eng_insp_finish).getHours()
        min_eng_insp_finish = new Date(data.eng_insp_finish).getMinutes()
      }

      data.year_eng_insp_start = year_eng_insp_start
      data.month_eng_insp_start = month_eng_insp_start
      data.day_eng_insp_start = day_eng_insp_start
      data.hour_eng_insp_start = hour_eng_insp_start
      data.min_eng_insp_start = min_eng_insp_start
      data.year_eng_insp_finish = year_eng_insp_finish
      data.month_eng_insp_finish = month_eng_insp_finish
      data.day_eng_insp_finish = day_eng_insp_finish
      data.hour_eng_insp_finish = hour_eng_insp_finish
      data.min_eng_insp_finish = min_eng_insp_finish
      data.eng_acc_qty = Number(data.eng_acc_qty)
      data.eng_rej_qty = Number(data.eng_rej_qty)
      data.eng_insp_emp = (data.eng_insp_emp && data.eng_insp_emp.toUpperCase())
      data.eng_insp_confirmby = (data.eng_insp_confirmby && data.eng_insp_confirmby.toUpperCase())

      dataList.push(data)
    }

    if (dataList.length !== 0) {
      const currentDate = moment().format("YYYYMMDD");
      const fileName = "eng_insp_result_" + currentDate + ".xlsx";
      await axios.post(server.ENG_TOOLING_RETURN + "/downloadExcelEngInspResult", dataList, {
        method: "GET",
        responseType: "blob", // important
      }).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${fileName}`);
        document.body.appendChild(link);
        link.click();
      }).catch(async function (error) {
        Swal.fire({
          icon: "error",
          title: `Please try again`,
          customClass: "swal-style",
        })
      })
    } else {
      Swal.fire({
        icon: "error",
        title: `Data not found`,
        customClass: "swal-style",
      });
    }
    setLoading(false)
  };

  return (
    <Layout>
      <MenuTemplate type={"Eng"} defaultSelectedKeys={"2"} defaultOpenKeys={"sub1"} />
      <Layout>
        <Spin tip="Loading" size="large" spinning={loading}>
          <Content style={{ padding: 15, margin: 0 }}>
            <h2>Tooling Report</h2>
            <Space style={{ marginBottom: 16 }}>
              <strong>Inspection Date :</strong>
              <RangePicker allowClear={true} onChange={onDateRangeChange} />
              <Button onClick={onClick_Excel}>EXCEL</Button>
            </Space>
            <Table
              rowKey={"key"}
              dataSource={tableDocNo}
              columns={columns}
              size="small"
              expandable={{ expandedRowRender }}
              pagination={{
                showSizeChanger: true,
              }}
            />
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default Tooling_Report;
