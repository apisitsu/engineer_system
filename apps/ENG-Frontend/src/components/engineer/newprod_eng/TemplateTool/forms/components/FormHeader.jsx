import React from 'react';

/**
 * FormHeader — Standard form header used by PFD, PFMEA, Control Plan, PDR.
 *
 * Contains:
 *   - 3-column details grid (PID Number, Customer P/N, Form Number, etc.)
 *   - Approval stamp block (Prepare / Check by / Approve)
 *
 * Props:
 *   header         — header state object
 *   onUpdateHeader — (field: string, value: string) => void
 *   isApproved     — boolean (disables inputs when true)
 *   cssPrefix      — CSS class prefix (e.g., 'pfd', 'cp', 'pfmea', 'pdr')
 *   formNoLabel    — label for form number field (e.g., 'PFD No.:', 'CP No.:')
 */
export default function FormHeader({
    header,
    onUpdateHeader,
    isApproved,
    cssPrefix = 'pfd',
    formNoLabel = 'Form No.:',
}) {
    const prefix = cssPrefix;

    return (
        <div className={`${prefix}-std-header`}>
            <div className={`${prefix}-header-details`}>
                {/* Column 1: PID, Customer P/N, NMB P/N */}
                <div className={`${prefix}-header-col`}>
                    <div className={`${prefix}-header-row`}>
                        <label>PID Number:</label>
                        <input
                            value={header.pid_number}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('pid_number', e.target.value)}
                        />
                    </div>
                    <div className={`${prefix}-header-row`}>
                        <label>Customer P/N:</label>
                        <input
                            value={header.customer_pn}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('customer_pn', e.target.value)}
                        />
                    </div>
                    <div className={`${prefix}-header-row`}>
                        <label>NMB P/N:</label>
                        <input
                            value={header.nmb_pn}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('nmb_pn', e.target.value)}
                        />
                    </div>
                </div>

                {/* Column 2: Form No., Prepare by, Check by */}
                <div className={`${prefix}-header-col`}>
                    <div className={`${prefix}-header-row`}>
                        <label>{formNoLabel}</label>
                        <input
                            value={header.form_number}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('form_number', e.target.value)}
                        />
                    </div>
                    <div className={`${prefix}-header-row`}>
                        <label>Prepare by:</label>
                        <input
                            value={header.prepare_by}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('prepare_by', e.target.value)}
                        />
                    </div>
                    <div className={`${prefix}-header-row`}>
                        <label>Check by:</label>
                        <input
                            value={header.check_by}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('check_by', e.target.value)}
                        />
                    </div>
                </div>

                {/* Column 3: REV, Date Initiated, Target Date */}
                <div className={`${prefix}-header-col`}>
                    <div className={`${prefix}-header-row`}>
                        <label>REV.:</label>
                        <input
                            value={header.revision}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('revision', e.target.value)}
                        />
                    </div>
                    <div className={`${prefix}-header-row`}>
                        <label>Date Initiated:</label>
                        <input
                            type="date"
                            value={header.date_initiated}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('date_initiated', e.target.value)}
                        />
                    </div>
                    <div className={`${prefix}-header-row`}>
                        <label>Target Date:</label>
                        <input
                            type="date"
                            value={header.target_date}
                            disabled={isApproved}
                            onChange={(e) => onUpdateHeader('target_date', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Approval stamp block */}
            <div className={`${prefix}-approval-block`}>
                {['Prepare', 'Check by', 'Approve'].map((label) => (
                    <div className={`${prefix}-stamp-box`} key={label}>
                        <div className={`${prefix}-stamp-title`}>{label}</div>
                        <div
                            className={`${prefix}-stamp-area`}
                            contentEditable={!isApproved}
                            suppressContentEditableWarning
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
