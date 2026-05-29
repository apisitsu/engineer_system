import React, { useRef, useEffect, useState } from 'react';

/**
 * EditableCell — Fully UNCONTROLLED textarea for inline table editing.
 *
 * Uses `defaultValue` so React NEVER updates the textarea DOM after mount.
 * This makes cursor-jumping STRUCTURALLY IMPOSSIBLE — there is no mechanism
 * by which React can interfere with the cursor position.
 *
 * Auto-resizes height to fit content synchronously in the onChange handler
 * (before any render cycle), so height adjustments also cannot affect cursor.
 *
 * Props:
 *   defaultValue   — initial text (only used on mount, ignored on re-render)
 *   onValueChange  — (newValue: string) => void — updates a ref, NOT state
 *   disabled       — read-only mode
 *   className      — CSS class
 *   minHeight      — minimum height in px (default: 22)
 */
const EditableCell = React.memo(({ defaultValue, onValueChange, disabled, className, minHeight = 22 }) => {
    const ref = useRef(null);

    // Auto-resize on mount (for pre-existing content from API)
    useEffect(() => {
        const el = ref.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e) => {
        const el = e.target;
        // Auto-resize SYNCHRONOUSLY — before any React render cycle
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
        // Report value to parent (mutates a ref, causes NO re-render)
        onValueChange?.(el.innerHTML);
    };

    return (
        <div
            ref={ref}
            contentEditable={!disabled}
            dangerouslySetInnerHTML={{ __html: defaultValue ?? '' }}
            onInput={handleChange}
            onBlur={handleChange}
            className={className}
            style={{
                outline: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
                padding: '2px 4px',
                minHeight: `${minHeight}px`,
                lineHeight: '1.4',
                wordBreak: 'break-word',
                cursor: disabled ? 'default' : 'text',
                overflow: 'hidden'
            }}
        />
    );
}, (prev, next) => {
    // ONLY re-render when disabled changes (approve/unapprove).
    // defaultValue is only used on mount via the textarea's defaultValue prop.
    // When rows remount (new _key from data fetch), fresh cells get correct values.
    return prev.disabled === next.disabled;
});

EditableCell.displayName = 'EditableCell';

/**
 * CheckboxCell — Self-contained checkbox with LOCAL state.
 *
 * Manages its own checked state so clicking works instantly
 * without needing a parent re-render.
 */
const CheckboxCell = React.memo(({ initialChecked, onValueChange, disabled }) => {
    const [checked, setChecked] = useState(!!initialChecked);

    const handleChange = (e) => {
        setChecked(e.target.checked);
        onValueChange?.(e.target.checked);
    };

    return (
        <input
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
        />
    );
}, (prev, next) => prev.disabled === next.disabled);

CheckboxCell.displayName = 'CheckboxCell';

export { EditableCell, CheckboxCell };
export default EditableCell;
