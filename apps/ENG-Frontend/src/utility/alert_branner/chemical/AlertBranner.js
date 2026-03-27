import React, { useEffect, useState } from 'react'
import axios from "axios";
import { server } from "../../../constance/constance";
import { Alert } from "antd";
import moment from "moment";

export const AlertBranner = ({visible}) => {

    const [data, setData] = useState([])

    useEffect( () => {
        const getAlertData = async () => {
            const searchAlert = {
                // periodFrom: moment('2023-08-24').format("YYYY-MM-DD 00:00:00"),
                // periodTo: moment('2023-08-24').format("YYYY-MM-DD 23:59:59")
                periodFrom: moment().format("YYYY-MM-DD 00:00:00"),
                periodTo: moment().format("YYYY-MM-DD 23:59:59")
            };
        
            await axios.post(server.CHEM_TAG + '/getDataByCheckDate', searchAlert).then(async function (res) {
                setData(res.data)
            })
        };
        getAlertData();
    }, []);

    return (
        <>
            {visible && data.length === 0 ? <Alert message="Please check chemical expired date before use it" type="warning" showIcon closable style={{marginBottom: "5px"}} /> : <div></div>}
        </>
    )
}