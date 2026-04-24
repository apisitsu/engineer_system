import { useMemo } from 'react';
import { useAuthStore } from '../../../../stores/authStore';

export const useKanbanPermissions = ({
    isPrivateProject = false,
    projectRole = null,
    boardRole = null,
    cardRole = null,
    projectStatus = 'active',
} = {}) => {
    const globalRole = useAuthStore(state => state.userRole);
    const globalDepartment = useAuthStore(state => state.userDepartment);

    // console.log(`User :`, globalRole, globalDepartment);

    return useMemo(() => {
        // ── 1. Global & Project Member Flags ──
        const isSuperAdmin = globalRole === 'AD' || globalDepartment === 'AD';
        // console.log(`isSuperAdmin :`, isSuperAdmin);
        const isManagerOrCoord = ['MGR', 'COORD'].includes(globalRole);

        const isProjectOwner = projectRole === 'owner';
        const isProjectEditor = projectRole === 'editor';
        const isProjectViewer = projectRole === 'viewer';
        const isProjectMember = !!projectRole;

        const isProjectInactive = ['suspended', 'completed'].includes((projectStatus || '').toLowerCase());

        // ── 2. Project-Level ──
        // Only AD, Owner, and MGR/COORD (in public) can manage the ROOT project settings
        const canManageProject = isSuperAdmin || isProjectOwner || (isManagerOrCoord && !isPrivateProject);
        let canEditProject = canManageProject || isProjectEditor;
        const canViewProject = canEditProject || isProjectViewer || isSuperAdmin || (isManagerOrCoord && !isPrivateProject);

        // ── 3. Board-Level (CRITICAL FIXES HERE) ──
        const isBoardOwner = boardRole === 'owner';
        const isBoardEditor = boardRole === 'editor';
        const isBoardViewer = boardRole === 'viewer';

        // 3.1 Manage Members: AD, Proj Owner, Board Owner, MGR/COORD (Public). MGR/COORD in Private only if Owner
        const canManageBoardMembers = canManageProject || isBoardOwner;

        // 3.2 Manage Structure (Create/Move/Delete Boards): All the above + Public Project Editors
        let canManageBoardStructure = canManageBoardMembers || (!isPrivateProject && isProjectEditor);

        // 3.3 Edit Board Content: All the above + Explicit Board Editors + Private Project Editors
        let canEditBoard = canManageBoardStructure || isBoardEditor || (isPrivateProject && isProjectEditor);

        const canViewBoard = canEditBoard || isBoardViewer || canViewProject;

        // ── 4. Card-Level ──
        const isCardOwner = cardRole === 'owner';
        const isCardEditor = cardRole === 'editor';
        const isCardViewer = cardRole === 'viewer';
        const isCardMember = !!cardRole;

        const canManageCard = canManageBoardStructure || isCardOwner;
        let canEditCard = canManageCard || isCardMember || canEditBoard || isSuperAdmin || (isManagerOrCoord && !isPrivateProject);
        const canViewCard = canEditCard || isCardViewer || canViewBoard;

        // ── Inactive Project Locks ──
        if (isProjectInactive && !isSuperAdmin) {
            canEditProject = false;
            canManageBoardStructure = false;
            canEditBoard = false;
            canEditCard = false;
        }

        // ── 5. Convenience ──
        const isReadOnly = !canEditCard;
        const canCreateProject = isSuperAdmin || isManagerOrCoord;

        return {
            isSuperAdmin, isManagerOrCoord, globalRole,
            isProjectOwner, isProjectEditor, isProjectViewer, isProjectMember,
            canManageProject, canEditProject, canViewProject,
            isBoardOwner, isBoardEditor, isBoardViewer,
            canManageBoardMembers, canManageBoardStructure, canEditBoard, canViewBoard,
            isCardOwner, isCardEditor, isCardViewer, isCardMember,
            canManageCard, canEditCard, canViewCard,
            isReadOnly, canCreateProject,
        };
    }, [globalRole, isPrivateProject, projectRole, boardRole, cardRole, projectStatus]);
};
