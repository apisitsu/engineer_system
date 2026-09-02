import React from "react";
import { Link } from "react-router-dom";
import LooksOneIcon from '@mui/icons-material/LooksOne';
import LooksTwoIcon from '@mui/icons-material/LooksTwo';
import Looks3Icon from '@mui/icons-material/Looks3';
import Looks4Icon from '@mui/icons-material/Looks4';
import Looks5Icon from '@mui/icons-material/Looks5';
import Looks6Icon from '@mui/icons-material/Looks6';
import Filter7Icon from '@mui/icons-material/Filter7';
import Filter8Icon from '@mui/icons-material/Filter8';
import Filter9Icon from '@mui/icons-material/Filter9';

import { MTC_PATHS } from "../../constance/mtc_constance";

const iconStyle = { fontSize: '24px' };

const numberIcons = [
    <LooksOneIcon style={iconStyle} />,
    <LooksTwoIcon style={iconStyle} />,
    <Looks3Icon style={iconStyle} />,
    <Looks4Icon style={iconStyle} />,
    <Looks5Icon style={iconStyle} />,
    <Looks6Icon style={iconStyle} />,
    <Filter7Icon style={iconStyle} />,
    <Filter8Icon style={iconStyle} />,
    <Filter9Icon style={iconStyle} />,
];
// The list must stay at least as long as the longest menu, or the `|| [0]`
// fallback below silently numbers a late item "1" again — which is what adding
// the MTC CAD/CAM entry did to "Report" (an 8th item against 7 icons).

const createMenu = (items) => {
    return items.map((item, index) => {
        if (item.children) {
            return {
                key: item.key || `sub-${index}`,
                icon: numberIcons[index] || numberIcons[0],
                label: item.label,
                children: item.children.map((child, childIndex) => ({
                    key: child.key || `child-${index}-${childIndex}`,
                    label: <Link to={child.path}>{child.label}</Link>
                }))
            };
        }
        return {
            key: item.key || `${index + 1}`,
            icon: numberIcons[index] || numberIcons[0],
            label: <Link to={item.path}>{item.label}</Link>
        };
    });
};

export const master = createMenu([
    { label: "Sale Plan", path: "/master/sale_plan" },
    { label: "Machine", path: "/master/machine" },
    { label: "Work Center Code", path: "/master/wc" },
    { label: "Purpose of PO", path: "/master/purpose" },
    { label: "Storage Code", path: "/master/storage" },
]);

export const system = createMenu([
    { label: "Home", path: "/eng/system_eng", key: "1" },
    { label: "User Management", path: "/eng/system_eng/user_management", key: "2" },
    { label: "Tools", path: "/eng/system_eng/tool/gallery", key: "3" },
    { label: "Update Logs", path: "/eng/system_eng/tool/update-logs", key: "4" },
    { label: "Activity Dashboard", path: "/eng/system_eng/activity-dashboard", key: "5" },
]);

export const process = createMenu([
    { label: "Home", path: "/eng/process_eng" },
    {
        label: "ECNT",
        key: "ecnt",
        children: [
            { label: "Dashboard", path: "/eng/process_eng/ecnt/dashboard" },
            { label: "My Tasks", path: "/eng/process_eng/ecnt/tasks" },
            // { label: "Create ECR", path: "/eng/process_eng/ecnt/create" },
            { label: "History", path: "/eng/process_eng/ecnt/history" },
        ]
    },
    { label: "Tumble System", path: "/eng/process_eng/tumble", key: "tumble" },
]);

export const newprod = createMenu([
    { label: "Home", path: "/eng/newprod_eng" },
    { label: "HTML to PDF", path: "/eng/html-to-pdf" },
]);

export const mtc = createMenu([
    { label: "Home", path: MTC_PATHS.HOME, key: "home" },
    { label: "General DWG Request", path: MTC_PATHS.TOOL_REQUEST, key: "tool-request" },
    { label: "Tooling Inspection", path: MTC_PATHS.TOOLING_INSPECT, key: "tooling-inspect" },
    { label: "Tooling Select", path: MTC_PATHS.TOOLING_SELECT, key: "tooling-select" },
    { label: "Setup Data Sheet", path: MTC_PATHS.SDS_V2, key: "sds-v2" },
    { label: "CAD/CAM", path: MTC_PATHS.CAM, key: "cam" },
    {
        label: "Master Data", key: "master-data",
        children: [
            { label: "Part Management", path: MTC_PATHS.PART_MANAGEMENT, key: "part-management" },
            { label: "CN Enable", path: MTC_PATHS.CN_ENABLE, key: "cn-enable" },
        ]
    },
    {
        label: "Report", key: "report",
        children: [
            { label: "Inspection Dashboard", path: MTC_PATHS.TOOLING_RESULT_DASHBOARD, key: "tooling-result-dashboard" },
            { label: "SDS Coverage Report", path: MTC_PATHS.SDS_COVERAGE_REPORT, key: "sds-coverage-report" },
            { label: "SDS History", path: MTC_PATHS.SDS_HISTORY, key: "sds-history" },
            { label: "Lot Status Tracker", path: MTC_PATHS.LOT_TRACK, key: "lot-track" },
        ]
    },
]);

export const all = createMenu([
    { label: "Organization", path: "/eng/overall_eng", key: "1" },
    { label: "Engineer Record", path: "/eng/overall_eng/eng-record", key: "2" },
]);