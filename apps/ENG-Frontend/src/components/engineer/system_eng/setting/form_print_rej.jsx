import { Button, Form, Modal, Space, Input } from "antd";
import React, { useState, useEffect, useRef } from "react";
import { server, key_constance } from "../../../../constance/constance.js";
import axios from "axios";
import moment from "moment";
import { useReactToPrint } from "react-to-print";

export const CollectionRejForm = ({ onCancel, visibleRej, printByDocNo }) => {
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [wc, setWc] = useState([]);

  const currentDate = moment(new Date()).format("DD / MM / YYYY");
  const componentRef = useRef();
  const onPrint = useReactToPrint({
    content: () => componentRef.current,
  });

  useEffect(() => {
    const getData = async () => {
      if (visibleRej) {
        const resultDocNo = await axios.get(server.ENG_TOOLING_INSP + "/" + printByDocNo);
        form.setFieldsValue({
          eng_docno: printByDocNo,
        });

        const y = sumQty(resultDocNo.data.filter((x) => x.eng_rej_qty > 0));
        const addData = [];
        for (let i = 0; i < y.length; i++) {
          addData.push({
            key: y[i].key,
            item: i + 1,
            eng_docno: y[i].eng_docno,
            eng_itemno: y[i].eng_itemno,
            eng_spec: y[i].eng_spec,
            eng_return_qty: Number(y[i].eng_rej_qty),
          });
        }

        setData(addData);
        setWc(printByDocNo.substring(2, 4));
      }
    };
    getData();
  }, [form, printByDocNo, visibleRej]);

  const sumQty = (xs) =>
    Object.values(
      xs.reduce(
        (
          acc,
          {
            eng_itemno,
            eng_spec,
            eng_acc_qty,
            eng_rej_qty,
            eng_docno,
            eng_itemname,
          }
        ) => {
          const key = eng_docno + eng_itemno;
          acc[key] ??= {
            eng_itemno,
            eng_spec,
            eng_acc_qty: 0,
            eng_rej_qty: 0,
            eng_docno,
            eng_itemname,
          };
          acc[key].eng_acc_qty += Number(eng_acc_qty);
          acc[key].eng_rej_qty += Number(eng_rej_qty);
          return acc;
        },
        {}
      )
    );

  const marginTop = "10mm";
  const marginRight = "10mm";
  const marginBottom = "10mm";
  const marginLeft = "10mm";
  const getPageStyle = () => {
    return `
    @media print
    { 
      @page
        {
          size: A4;             
          margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft} !important;
          page-break-after: always; 
        }      
 
      .footer 
        {
          position: fixed;
          bottom: 5mm;     
        }
    }
    `;
  };

  const footerModal = [
    <Button key="back" onClick={onCancel}>
      Close
    </Button>,
    <Button key="submit" type="primary"
      onClick={() => {
        form.validateFields().then((values) => {
          form.resetFields();
          onPrint(values);
        }).catch((info) => {
          console.log("Validate Failed:", info);
        });
      }}
    >
      Print
    </Button>,
  ]

  return (
    <Modal forceRender width={1000} open={visibleRej} title="Tooling Return List" onCancel={onCancel} footer={footerModal}>
      <Form form={form} layout="vertical" name="form_in_modal" initialValues={{ modifier: "public" }}>
        <Space align="baseline">
          <Form.Item name="eng_docno" label="Document No.">
            <Input />
          </Form.Item>
        </Space>
        <br />
        <div id="tag_print" ref={componentRef}>
          <style>{getPageStyle()}</style>
          <h4 className="text-center font-weight-bold">REQUISITION SHEET</h4>
          <h5 className="text-center font-weight-bold">
            Rodend Bearing Division
          </h5>
          <font size="3">
            <table width="100%">
              <tbody>
                <tr>
                  <td width="33%">NMB-MINEBEA THAI LTD</td>
                  <td width="33%"></td>
                  <td align="right" width="33%">
                    NO.__________________
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td align="center">
                    <strong>TIME REQUISITION</strong>
                  </td>
                  <td align="right">DATE : {currentDate}</td>
                </tr>
                <tr>
                  <td>&#9744; WITHDRAWN FROM STOCK</td>
                  <td>&#9744; 8.00-10.00 AM</td>
                  <td></td>
                </tr>
                <tr>
                  <td>&#9744; RETURN TO STOCK</td>
                  <td>&#9744; 14.00-16.00 PM</td>
                  <td align="right">Dept Code :__________________</td>
                </tr>
                <tr>
                  <td>&#9745; SCRAP FROM STOCK</td>
                  <td></td>
                  <td align="right"> W/C Code : {wc}</td>
                </tr>
              </tbody>
            </table>
            <br />
            <table border="1px solid black" width="100%">
              <thead>
                <tr align="center">
                  <th>Item</th>
                  <th>DESCRIPTION</th>
                  <th>REQUESTED QTY</th>
                  <th>STOCK BALANCE</th>
                  <th>UNIT PRICE</th>
                  <th>ITEM NO.</th>
                </tr>
              </thead>
              <tbody>
                {data.map((x, index) => {
                  return (
                    <React.Fragment key={index}>
                      <tr align="center">
                        <td>{x.item}</td>
                        <td>{x.eng_spec}</td>
                        <td>{x.eng_return_qty}</td>
                        <td></td>
                        <td></td>
                        <td>{x.eng_itemno}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            <br />
            <p>
              REQUESTED BY :{" "}
              {localStorage.getItem(key_constance.USER_EMPNO).toUpperCase()}{" "}
              {localStorage.getItem(key_constance.USER_NAME)}
              <span className="float-right">ISSUED BY : __________________</span>
            </p>
            <p>
              PROCESS : ENGINEER
              <span className="float-right">
                APPROVED BY : __________________
              </span>
            </p>
          </font>
          <div className="footer">Document No. : {printByDocNo}</div>
        </div>
      </Form>
    </Modal>
  );
};
