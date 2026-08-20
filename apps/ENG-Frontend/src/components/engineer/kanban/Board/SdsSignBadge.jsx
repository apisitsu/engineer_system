import React from 'react';
import { Tooltip, Popconfirm, App } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../../../theme';

/**
 * Prepared / Checked / Approved, on the card.
 *
 * A card seeded by the SDS pipeline IS one Setup Data Sheet, and signing it used to
 * mean following the card's link to the SDS page, waiting for the search and finding
 * the sheet again — for an act that is one button. The signer is already looking at
 * the card that names the sheet.
 *
 * Three things this deliberately does not do:
 *
 *  - **It does not decide who may sign.** `canSign` arrives from the server, computed
 *    beside the rules the POST enforces (`sds_approval_role_config` plus the
 *    prepared→checked→approved order). A second copy of that logic here would drift,
 *    and it drifts towards a button that looks available and then fails.
 *  - **It does not sign a sheet it cannot name.** A card whose machine is a *group*
 *    label (TSG-300W/TSG-300ZNC) may stand for either member's sheet; where the
 *    server could not resolve it, this shows the link instead. Guessing would stamp a
 *    signature on a sheet that is not the one printed.
 *  - **It does not fire on a single tap.** A signature is a commitment, and these
 *    cards are read on a shop-floor touch screen where a stray tap is cheap.
 */

const ROLE_LABEL = { prepared: 'Prepared', checked: 'Checked', approved: 'Approved' };
const ROLE_SHORT = { prepared: 'P', checked: 'C', approved: 'A' };

const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString();
};

const SdsSignBadge = ({ cardId }) => {
    const { info, signing, sign } = useKanbanStore(
        useShallow((s) => ({
            info: s.sdsApprovals?.[cardId],
            signing: s.sdsSigning,
            sign: s.signSdsApproval,
        }))
    );
    const { theme } = useTheme();
    const { message } = App.useApp();

    if (!info) return null;

    const stop = {
        onClick: (e) => e.stopPropagation(),
        // The list wraps each card in dnd-kit's drag listeners. The 5 px activation
        // distance already saves a plain click, but a press that drifts a little —
        // a thumb on a touch screen — would otherwise start dragging the card
        // instead of pressing the button under it.
        onPointerDown: (e) => e.stopPropagation(),
    };

    const chip = (bg, color, border, children, key, extra = {}) => (
        <span
            key={key}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, lineHeight: 1.6, padding: '0 6px',
                borderRadius: 3, background: bg, color, border: `1px solid ${border}`,
                whiteSpace: 'nowrap', ...extra,
            }}
        >
            {children}
        </span>
    );

    const header = (
        <span style={{ fontSize: 9, color: theme.colors.textTertiary, letterSpacing: 0.4 }}>SDS</span>
    );

    const wrap = (children) => (
        <div
            style={{
                display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
                marginTop: 6, paddingTop: 6,
                borderTop: `1px solid ${theme.colors.textTertiary}25`,
            }}
            {...stop}
        >
            {header}
            {children}
        </div>
    );

    // Cannot name one sheet — offer the page where the machine can be picked.
    if (info.ambiguous) {
        return wrap(
            <Tooltip
                title={`${info.cn} · ${info.machine_label} · ${info.process_code} — this card covers more than one machine, so the sheet has to be opened to sign it`}
            >
                <a
                    href={info.signUrl}
                    style={{ fontSize: 10, color: theme.colors.primary }}
                    {...stop}
                >
                    Open sheet to sign →
                </a>
            </Tooltip>
        );
    }

    const sheet = `${info.cn} · ${info.machine_type_name} · ${info.process_code}${info.sds_rev ? ` · Rev ${info.sds_rev}` : ''}`;

    const onSign = async (role) => {
        const res = await sign(cardId, role);
        if (res.ok) message.success(`Signed ${ROLE_LABEL[role]} — ${info.cn}`);
        else message.error(res.error);
    };

    return wrap(
        info.state.map((s) => {
            const busy = signing === `${cardId}||${s.role}`;

            if (s.signed) {
                return (
                    <Tooltip
                        key={s.role}
                        title={`${ROLE_LABEL[s.role]} — ${s.signer_name || s.em_id || 'signed'}${s.signed_at ? ` · ${fmt(s.signed_at)}` : ''}${s.source === 'backfill' ? ' (recorded)' : ''}\n${sheet}`}
                    >
                        {chip('#61bd4f22', '#3f8f2f', '#61bd4f55', <>{ROLE_SHORT[s.role]} ✓</>, s.role)}
                    </Tooltip>
                );
            }

            if (s.canSign) {
                return (
                    <Popconfirm
                        key={s.role}
                        title={`Sign as ${ROLE_LABEL[s.role]}?`}
                        description={sheet}
                        okText="Sign"
                        cancelText="Cancel"
                        onConfirm={() => onSign(s.role)}
                        // The card underneath opens its detail on click; without this the
                        // confirm's own buttons would open it as they dismiss.
                        onCancel={(e) => e?.stopPropagation?.()}
                    >
                        <span {...stop} style={{ cursor: busy ? 'wait' : 'pointer' }}>
                            {chip(
                                `${theme.colors.primary}18`, theme.colors.primary, `${theme.colors.primary}66`,
                                <>{ROLE_SHORT[s.role]} {busy ? '…' : 'Sign'}</>,
                                s.role,
                                { fontWeight: 600 }
                            )}
                        </span>
                    </Popconfirm>
                );
            }

            // Unsigned and not this user's to give — say which of the two reasons it is,
            // because "waiting for the previous role" and "not your signature to give"
            // call for completely different actions.
            const why = s.blockedByOrder
                ? `${ROLE_LABEL[s.role]} — waiting for ${ROLE_LABEL[info.state[info.state.findIndex((x) => x.role === s.role) - 1]?.role] || 'the previous role'} to be signed`
                : `${ROLE_LABEL[s.role]} — not signed. You are not permitted to sign this role.`;

            return (
                <Tooltip key={s.role} title={`${why}\n${sheet}`}>
                    {chip(
                        'transparent', theme.colors.textTertiary, `${theme.colors.textTertiary}45`,
                        <>{ROLE_SHORT[s.role]}</>, s.role
                    )}
                </Tooltip>
            );
        })
    );
};

export default SdsSignBadge;
