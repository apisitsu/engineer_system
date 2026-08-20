/**
 * sdsApprovalSlice.js
 * Zustand slice for signing Setup Data Sheets from the board itself.
 *
 * A board card seeded by the SDS pipeline stands for one sheet, and until now the
 * only way to sign it was to follow the card's link to the SDS page, wait for the
 * search, and find the sheet again — for an act that is one button. The signer is
 * already looking at the card that says which sheet it is.
 *
 * Manages: sdsApprovals (card_id → sheet + per-role state), keyed by board.
 *
 * **Fetched per board, not per card.** `GET /approval/board?board_id=` answers the
 * whole board in four queries; asking per card would be 40+ round trips on load,
 * and the backlog feed seeds up to 150 cards a run.
 *
 * Nothing here decides who may sign. `canSign` comes from the server, computed next
 * to the rules the POST enforces (`sds_approval_role_config` + the sequential
 * prepared→checked→approved gate). Re-deriving it here would drift, and the
 * direction it drifts is a button that looks available and then fails.
 */
import axios from 'axios';
import { server } from '../../../../constance/constance';

export const createSdsApprovalSlice = (set, get) => ({
    // card_id → { cn, machine_type_name, process_code, sds_rev, ambiguous,
    //             candidates[], signUrl, state: [{ role, signed, canSign, … }] }
    sdsApprovals: {},
    sdsApprovalsBoardId: null,
    sdsApprovalsLoading: false,
    // card_id||role currently being signed — the button shows a spinner and a
    // second press cannot double-post while the first is in flight.
    sdsSigning: null,

    /**
     * Load the sign state for every SDS card on a board.
     *
     * Silent on failure: this is an extra affordance on cards that are perfectly
     * usable without it, so a board that loads with the panel missing is far better
     * than a board that shows an error over an unrelated feature. The link on the
     * card still works either way.
     */
    fetchSdsApprovals: async (boardId) => {
        if (!boardId) return;
        set({ sdsApprovalsLoading: true });
        try {
            const res = await axios.get(`${server.MTC_SDS_V2_APPROVAL}/board`, {
                params: { board_id: boardId },
            });
            const cards = res.data?.cards || {};
            // Boards without a single SDS card are the common case; keep the empty
            // object rather than null so consumers need no null check.
            set({ sdsApprovals: cards, sdsApprovalsBoardId: boardId });
        } catch (err) {
            console.warn('SDS approvals unavailable for this board', err?.message);
            set({ sdsApprovals: {}, sdsApprovalsBoardId: boardId });
        } finally {
            set({ sdsApprovalsLoading: false });
        }
    },

    /**
     * Sign one role on the sheet behind a card.
     *
     * Returns `{ ok }` (plus `error` when refused) rather than throwing or popping
     * its own dialog — the caller is a button on a card and knows where to put the
     * message. A refusal here is usually a real answer, not a fault: the server
     * re-checks permission and the prepared→checked→approved order, and a 403/409
     * means the signature was not the signer's to give yet.
     *
     * The card MOVES as a result — the backend's kanban intake advances it to the
     * stage's list and pushes that over the websocket — so this only refreshes the
     * signatures and lets the socket do the rest.
     */
    signSdsApproval: async (cardId, role) => {
        const info = get().sdsApprovals?.[cardId];
        if (!info || info.ambiguous || !info.machine_type_name) {
            return { ok: false, error: 'This card does not name a single sheet to sign' };
        }
        set({ sdsSigning: `${cardId}||${role}` });
        try {
            await axios.post(server.MTC_SDS_V2_APPROVAL, {
                cn: info.cn,
                machine_type_name: info.machine_type_name,
                process_code: info.process_code,
                role,
            });
            // Re-read the board rather than patching the row locally: signing
            // `prepared` unlocks `checked` for whoever may sign it, and that gate
            // lives on the server.
            await get().fetchSdsApprovals(get().sdsApprovalsBoardId);
            return { ok: true };
        } catch (err) {
            const error = err?.response?.data?.error || 'Sign failed';
            return { ok: false, error };
        } finally {
            set({ sdsSigning: null });
        }
    },
});
