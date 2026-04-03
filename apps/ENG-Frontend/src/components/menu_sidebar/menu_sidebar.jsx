import React from "react";
import { Link } from "react-router-dom";
import LooksOneIcon from '@mui/icons-material/LooksOne';
import LooksTwoIcon from '@mui/icons-material/LooksTwo';
import Looks3Icon from '@mui/icons-material/Looks3';
import Looks4Icon from '@mui/icons-material/Looks4';
import Looks5Icon from '@mui/icons-material/Looks5';
import Looks6Icon from '@mui/icons-material/Looks6';

const iconStyle = { fontSize: '24px' };

const numberIcons = [
    <LooksOneIcon style={iconStyle} />,
    <LooksTwoIcon style={iconStyle} />,
    <Looks3Icon style={iconStyle} />,
    <Looks4Icon style={iconStyle} />,
    <Looks5Icon style={iconStyle} />,
    <Looks6Icon style={iconStyle} />,
];

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
    {
        label: "Project",
        key: "sub1",
        children: [
            { label: "Dashboard", path: "/eng/system_eng/project_dashboard", key: "2" },
            { label: "Task", path: "/eng/system_eng/todo_project", key: "3" }
        ]
    },
<<<<<<< HEAD
    { label: "User Management", path: "/eng/system_eng/user_management", key: "4" },
    { label: "Setting", path: "/eng/system_eng/setting", key: "5" }
=======
    { label: "User Management", path: "/eng/system_eng/user_management", key: "4" }
>>>>>>> old-work-backup
]);

export const process = createMenu([
    { label: "Home", path: "/eng/process_eng" },
<<<<<<< HEAD
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
=======
    { label: "ECNT", path: "/eng/process_eng/ecnt" },
>>>>>>> old-work-backup
    { label: "Tumble", path: "/eng/process_eng/tumble" },
]);

export const newprod = createMenu([
    { label: "Home", path: "/eng/newprod_eng" },
]);

export const mtc = createMenu([
    { label: "Home", path: "/eng/mtc_eng" },
    { label: "Tooling Inspect", path: "/eng/mtc_eng/tooling" },
<<<<<<< HEAD
    { label: "Tool Request", path: "/eng/mtc_eng/tool-request" },
=======
    { label: "General DWG Request", path: "/eng/mtc_eng/tool-request" },
    { label: "Tooling Select", path: "/eng/mtc_eng/tooling-select" },
    { label: "Setup Data Sheet", path: "/eng/mtc_eng/sds" },

>>>>>>> old-work-backup
]);

export const all = createMenu([
    { label: "Organization", path: "/eng/all_eng" },
]);