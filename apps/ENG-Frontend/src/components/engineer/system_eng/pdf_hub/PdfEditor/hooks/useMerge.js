import { useState } from 'react';

/**
 * useMerge — Manages the state for PDF merging feature.
 * The actual merging logic uses mergeEngine.js (called from the UI).
 */
export default function useMerge() {
    const [mergeFiles, setMergeFiles] = useState([]);
    return { mergeFiles, setMergeFiles };
}
