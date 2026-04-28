import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BsKanban } from 'react-icons/bs';

const SortableBoardTab = memo(({ board, isActive, setActiveBoard, theme }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: board.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
        cursor: 'grab',
        borderBottom: isActive ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
        color: isActive ? theme.colors.primary : theme.colors.textSecondary,
        fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
        fontSize: theme.typography.fontSize.sm,
        whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: 6,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => setActiveBoard(board)}
            onMouseOver={(e) => { if (!isActive) e.currentTarget.style.color = theme.colors.primary; }}
            onMouseOut={(e) => { if (!isActive) e.currentTarget.style.color = theme.colors.textSecondary; }}
        >
            <BsKanban size={14} />
            {board.name}
        </div>
    );
});

SortableBoardTab.displayName = 'SortableBoardTab';

export default SortableBoardTab;
