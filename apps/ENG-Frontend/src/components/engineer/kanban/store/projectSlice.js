/**
 * projectSlice.js
 * Zustand slice for Kanban Project-level state and actions.
 * 
 * Manages: projects, activeProject, projectManagers, 
 *          backgroundImages, baseCustomFieldGroups, projectSettings UI
 */
import axios from 'axios';
import { server } from '../../../../constance/constance';
import Swal from 'sweetalert2';
import { useAuthStore } from '../../../../stores/authStore';

export const createProjectSlice = (set, get) => ({
    // --- Project Data State ---
    projects: [],
    activeProject: null,
    projectManagers: [],

    // --- Project Settings UI ---
    isProjectSettingsOpen: false,
    projectSettingsTargetId: null,

    // --- Background Images (Feature 10) ---
    backgroundImages: [],

    // --- Base Custom Field Groups ---
    baseCustomFieldGroups: [],

    // ====================================================================
    //  PROJECT ACTIONS
    // ====================================================================

    fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await axios.get(server.KANBAN_PROJECTS);
            const prjs = res.data?.data || [];
            set({ projects: prjs });
            const currentActive = get().activeProject;
            if (prjs.length > 0) {
                if (currentActive && !prjs.find(p => p.id === currentActive.id)) {
                    get().setActiveProject(prjs[0]);
                }
            } else {
                set({ activeProject: null, boards: [], activeBoard: null, lists: [], cards: {} });
            }
        } catch (err) {
            set({ error: err.message });
            console.error("Failed to fetch projects", err);
            Swal.fire('Error', 'ไม่สามารถโหลดรายการโปรเจคได้', 'error');
        } finally {
            set({ isLoading: false });
        }
    },

    setActiveProject: (project) => {
        const current = get().activeProject;
        if (current && project && current.id === project.id) {
            if (get().boards.length === 0) {
                get().fetchBoards(project.id);
            }
            return;
        }

        // Disconnect WebSocket before clearing state to prevent stale event injection
        get().disconnectWebSocket();

        set({
            activeProject: project,
            activeBoard: null,
            boards: [],
            lists: [],
            cards: {},
            searchQuery: '',
            filterMembers: [],
            filterLabels: []
        });

        if (project) {
            get().fetchBoards(project.id);
        }
    },

    createProject: async (data) => {
        try {
            const res = await axios.post(server.KANBAN_PROJECTS, data);
            if (res.data?.data) {
                set(state => ({ projects: [...state.projects, res.data.data] }));
                get().checkAndAutoJoin('project', res.data.data.id);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create project', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to create project', 'error');
        }
        return null;
    },

    updateProject: async (projectId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_PROJECTS}/${projectId}`, data);
            if (res.data?.data) {
                set(state => ({
                    projects: state.projects.map(p => p.id === projectId ? { ...p, ...res.data.data } : p),
                    activeProject: state.activeProject?.id === projectId
                        ? { ...state.activeProject, ...res.data.data }
                        : state.activeProject
                }));
                get().checkAndAutoJoin('project', projectId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update project', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to update project', 'error');
        }
        return null;
    },

    deleteProject: async (projectId) => {
        try {
            await axios.delete(`${server.KANBAN_PROJECTS}/${projectId}`);
            const projects = get().projects.filter(p => p.id !== projectId);
            set({ projects });
            if (get().activeProject?.id === projectId) {
                if (projects.length > 0) {
                    get().setActiveProject(projects[0]);
                } else {
                    set({ activeProject: null, boards: [], activeBoard: null, lists: [], cards: {} });
                }
            }
            return true;
        } catch (err) {
            console.error('Failed to delete project', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete project', 'error');
            return false;
        }
    },

    toggleFavorite: async (projectId) => {
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/favorite`);
            const isFav = res.data?.is_favorite;
            set(state => ({
                projects: state.projects.map(p =>
                    p.id === projectId ? { ...p, is_favorite: isFav } : p
                ),
                activeProject: state.activeProject?.id === projectId
                    ? { ...state.activeProject, is_favorite: isFav }
                    : state.activeProject
            }));
            return isFav;
        } catch (err) {
            console.error('Failed to toggle favorite', err);
            Swal.fire('Error', 'ไม่สามารถเปลี่ยนสถานะรายการโปรดได้', 'error');
            return null;
        }
    },

    // ====================================================================
    //  PROJECT MANAGERS
    // ====================================================================

    fetchProjectManagers: async (projectId) => {
        try {
            const res = await axios.get(`${server.KANBAN_PROJECTS}/${projectId}/managers`);
            const managers = res.data?.data || [];
            set({ projectManagers: managers });
        } catch (err) {
            console.error('Failed to fetch project managers', err);
        }
    },

    addProjectManager: async (projectId, uCode, role) => {
        try {
            const payload = { target_u_code: uCode };
            if (role) payload.role = role;
            await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/managers`, payload);
            await get().fetchProjectManagers(projectId);

            if (!get().users.find(u => u.u_code === uCode)) {
                await get().fetchUsers();
            }
        } catch (err) {
            console.error('Failed to add manager', err);
            Swal.fire('Error', err.response?.data?.error || 'Cannot add manager', 'error');
        }
    },

    removeProjectManager: async (projectId, uCode, force = false) => {
        try {
            const res = await axios.delete(`${server.KANBAN_PROJECTS}/${projectId}/managers`, { data: { target_u_code: uCode, force } });

            if (res.data?.requires_confirmation) {
                const boardNames = res.data.boards.map(b => b.name).join(', ');
                const cardNames = res.data.cards.map(c => c.name).join(', ');

                let htmlMsg = `<div style="text-align: left; font-size: 14px;">สมาชิกคนนี้รับผิดชอบงานอยู่ ดังนี้:<br/>`;
                if (res.data.boards.length > 0) {
                    htmlMsg += `<br/><b>บอร์ด (${res.data.boards.length}):</b> ${boardNames}`;
                }
                if (res.data.cards.length > 0) {
                    htmlMsg += `<br/><b>การ์ด (${res.data.cards.length}):</b> ${cardNames}`;
                }
                htmlMsg += `<br/><br/>หากยืนยัน สมาชิกจะถูกลบออกจากบอร์ดและการ์ดทั้งหมดที่เกี่ยวข้องด้วย</div>`;

                const result = await Swal.fire({
                    title: 'ยืนยันการลบสมาชิกออกจากโปรเจค?',
                    html: htmlMsg,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#aaa',
                    confirmButtonText: 'ยืนยัน ลบทั้งหมด',
                    cancelButtonText: 'ยกเลิก'
                });

                if (result.isConfirmed) {
                    return get().removeProjectManager(projectId, uCode, true);
                }
                return;
            }

            get().fetchProjectManagers(projectId);

            const activeBoard = get().activeBoard;
            if (activeBoard && activeBoard.project_id === projectId) {
                get().fetchBoardMembers(activeBoard.id);
                get().fetchBoardDetails(activeBoard.id);
            }
        } catch (err) {
            console.error('Failed to remove manager', err);
            Swal.fire('Error', err.response?.data?.error || 'Cannot remove manager', 'error');
        }
    },

    // ====================================================================
    //  REPORT DATA
    // ====================================================================

    fetchProjectReportData: async (projectId, forTemplate = false) => {
        try {
            const url = `${server.KANBAN_PROJECTS}/${projectId}/report-data${forTemplate ? '?for_template=1' : ''}`;
            const res = await axios.get(url);
            return res.data?.data || null;
        } catch (err) {
            console.error('Failed to fetch report data', err);
            return null;
        }
    },

    // ====================================================================
    //  WORKLOAD DATA
    // ====================================================================

    teamWorkload: [],

    fetchTeamWorkload: async (params = {}) => {
        set({ isLoading: true });
        try {
            const res = await axios.get(server.KANBAN_WORKLOAD, { params });
            set({ teamWorkload: res.data?.data || [] });
        } catch (err) {
            console.error('Failed to fetch team workload', err);
        } finally {
            set({ isLoading: false });
        }
    },

    // ====================================================================
    //  BACKGROUND IMAGES (Feature 10)
    // ====================================================================

    fetchBackgroundImages: async (projectId) => {
        try {
            const res = await axios.get(`${server.KANBAN_PROJECTS}/${projectId}/background-images`);
            set({ backgroundImages: res.data?.data || [] });
        } catch (err) { console.error('Failed to fetch background images', err); }
    },

    uploadBackgroundImage: async (projectId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/background-images`, data);
            if (res.data?.data) {
                set(state => ({ backgroundImages: [...state.backgroundImages, res.data.data] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to upload background image', err);
            Swal.fire('Error', 'ไม่สามารถอัปโหลดรูปพื้นหลังได้', 'error');
        }
        return null;
    },

    deleteBackgroundImage: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_BACKGROUND_IMAGES}/${id}`);
            set(state => ({ backgroundImages: state.backgroundImages.filter(b => b.id !== id) }));
            return true;
        } catch (err) {
            console.error('Failed to delete background image', err);
            Swal.fire('Error', 'ไม่สามารถลบรูปพื้นหลังได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  BASE CUSTOM FIELD GROUPS (Project-level templates)
    // ====================================================================

    fetchBaseCustomFieldGroups: async (projectId) => {
        try {
            const res = await axios.get(`${server.KANBAN_PROJECTS}/${projectId}/custom-field-groups`);
            set({ baseCustomFieldGroups: res.data?.data || [] });
        } catch (err) { console.error('Failed to fetch base custom field groups', err); }
    },

    createBaseCustomFieldGroup: async (projectId, name) => {
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/custom-field-groups`, { name });
            if (res.data?.data) {
                set(state => ({ baseCustomFieldGroups: [...state.baseCustomFieldGroups, res.data.data] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create base custom field group', err);
            Swal.fire('Error', 'ไม่สามารถสร้างกลุ่ม custom field ได้', 'error');
        }
        return null;
    },

    deleteBaseCustomFieldGroup: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_BASE_CUSTOM_FIELD_GROUPS}/${id}`);
            set(state => ({ baseCustomFieldGroups: state.baseCustomFieldGroups.filter(g => g.id !== id) }));
            return true;
        } catch (err) {
            console.error('Failed to delete group', err);
            Swal.fire('Error', 'ไม่สามารถลบกลุ่ม custom field ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  TEMPLATE CONFIGURATIONS (Blueprint & Selective Cloning)
    // ====================================================================

    templateConfigs: [],

    fetchTemplateConfigs: async (type = null) => {
        try {
            const url = type ? `${server.KANBAN_TEMPLATES}?type=${type}` : server.KANBAN_TEMPLATES;
            const res = await axios.get(url);
            set({ templateConfigs: res.data?.data || [] });
        } catch (err) {
            console.error('Failed to fetch template configs', err);
        }
    },

    createTemplateConfig: async (payload) => {
        try {
            const res = await axios.post(server.KANBAN_TEMPLATES, payload);
            if (res.data?.data) {
                set(state => ({ templateConfigs: [res.data.data, ...state.templateConfigs] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create template config', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to create template', 'error');
        }
        return null;
    },

    updateTemplateConfig: async (id, payload) => {
        try {
            const res = await axios.patch(`${server.KANBAN_TEMPLATES}/${id}`, payload);
            if (res.data?.data) {
                set(state => ({
                    templateConfigs: state.templateConfigs.map(t => t.id === id ? { ...t, ...res.data.data } : t)
                }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update template config', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to update template', 'error');
        }
        return null;
    },

    deleteTemplateConfig: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_TEMPLATES}/${id}`);
            set(state => ({ templateConfigs: state.templateConfigs.filter(t => t.id !== id) }));
            return true;
        } catch (err) {
            console.error('Failed to delete template config', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete template', 'error');
            return false;
        }
    },

    instantiateTemplate: async (templateId, payload) => {
        try {
            const res = await axios.post(`${server.KANBAN_TEMPLATES}/${templateId}/instantiate`, payload);
            if (res.data?.data) {
                // Add the new project to the store or update if existing project
                set(state => {
                    const existingIdx = state.projects.findIndex(p => p.id === res.data.data.id);
                    if (existingIdx !== -1) {
                        const newProjects = [...state.projects];
                        newProjects[existingIdx] = res.data.data;
                        return { projects: newProjects };
                    }
                    return { projects: [res.data.data, ...state.projects] };
                });
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to instantiate template', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to instantiate template', 'error');
        }
        return null;
    },

    stampCard: async (templateId, listId) => {
        try {
            const res = await axios.post(`${server.KANBAN_TEMPLATES}/${templateId}/stamp-card`, { list_id: listId });
            return res.data?.data;
        } catch (err) {
            console.error('Failed to stamp card template', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to use card template', 'error');
        }
        return null;
    },

    stampList: async (templateId, boardId) => {
        try {
            const res = await axios.post(`${server.KANBAN_TEMPLATES}/${templateId}/stamp-list`, { board_id: boardId });
            return res.data?.data;
        } catch (err) {
            console.error('Failed to stamp list template', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to use list template', 'error');
        }
        return null;
    },

    stampChecklist: async (templateId, cardId) => {
        try {
            const res = await axios.post(`${server.KANBAN_TEMPLATES}/${templateId}/stamp-checklist`, { card_id: cardId });
            return res.data?.data;
        } catch (err) {
            console.error('Failed to stamp checklist template', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to use checklist template', 'error');
        }
        return null;
    },

    stampLabels: async (templateId, boardId) => {
        try {
            const res = await axios.post(`${server.KANBAN_TEMPLATES}/${templateId}/stamp-labels`, { board_id: boardId });
            return res.data?.data;
        } catch (err) {
            console.error('Failed to stamp label template', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to use label template', 'error');
        }
        return null;
    },

    // ====================================================================
    //  PROJECT UI ACTIONS
    // ====================================================================

    openProjectSettings: (projectId = null) => set({ isProjectSettingsOpen: true, projectSettingsTargetId: projectId }),
    closeProjectSettings: () => set({ isProjectSettingsOpen: false, projectSettingsTargetId: null }),
});
