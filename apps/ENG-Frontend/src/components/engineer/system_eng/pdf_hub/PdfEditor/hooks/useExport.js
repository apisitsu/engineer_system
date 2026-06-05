import { useState } from 'react';

/**
 * useExport — Manages the state for PDF exporting feature.
 */
export default function useExport() {
    const [exportedImages, setExportedImages] = useState([]);
    return { exportedImages, setExportedImages };
}
