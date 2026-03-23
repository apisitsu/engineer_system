import React from 'react';

// Icons from different sets based on suitability
import { GoDiscussionClosed } from 'react-icons/go';
import { FiPaperclip, FiAlignLeft, FiClock, FiCheckSquare, FiMoreHorizontal } from 'react-icons/fi';
import {
    MdOutlineDashboard,
    MdOutlineLabel,
    MdOutlinePeople,
    MdDeleteOutline,
    MdContentCopy,
    MdFormatListBulleted
} from 'react-icons/md';
import { IoSettingsOutline, IoCloseOutline } from 'react-icons/io5';
import { BsKanban } from 'react-icons/bs';

/**
 * Maps Planka action/entity names to React Icons
 * @param {string} name - The name of the icon to map
 * @param {object} props - Additional props (size, color, etc.) to pass to the icon
 * @returns {React.Component} - The React Icon component
 */
export const getIcon = (name, props = {}) => {
    switch (name) {
        // --- Board & Navigation ---
        case 'board':
        case 'dashboard':
            return <MdOutlineDashboard {...props} />;
        case 'kanban':
            return <BsKanban {...props} />;
        case 'settings':
            return <IoSettingsOutline {...props} />;

        // --- Card Badges & Details ---
        case 'description':
        case 'align-left':
            return <FiAlignLeft {...props} />;
        case 'comment':
        case 'discussion':
            return <GoDiscussionClosed {...props} />;
        case 'attachment':
        case 'paperclip':
            return <FiPaperclip {...props} />;
        case 'task':
        case 'check-square':
        case 'checklist':
            return <FiCheckSquare {...props} />;
        case 'clock':
        case 'due-date':
        case 'timer':
            return <FiClock {...props} />;

        // --- Card Actions & Sidebar ---
        case 'label':
        case 'tag':
            return <MdOutlineLabel {...props} />;
        case 'members':
        case 'people':
            return <MdOutlinePeople {...props} />;
        case 'list':
            return <MdFormatListBulleted {...props} />;

        // --- Common UI ---
        case 'more':
        case 'dots':
            return <FiMoreHorizontal {...props} />;
        case 'close':
            return <IoCloseOutline {...props} />;
        case 'delete':
        case 'trash':
            return <MdDeleteOutline {...props} />;
        case 'copy':
        case 'clone':
            return <MdContentCopy {...props} />;

        // Default fallback icon
        default:
            console.warn(`Icon "${name}" not found in iconMapper.`);
            return <FiMoreHorizontal {...props} />;
    }
};
