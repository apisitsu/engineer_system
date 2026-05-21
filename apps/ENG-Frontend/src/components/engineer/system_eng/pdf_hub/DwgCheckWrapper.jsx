import React from 'react';
import { useTheme } from '../../../../theme';
import DwgCheckApp from '../../newprod_eng/dwg_check/DwgCheckApp';

/**
 * DwgCheckWrapper — Renders DwgCheckApp in a constrained container
 * instead of 100vh/100vw, fitting inside the PDF Hub layout.
 */
const DwgCheckWrapper = () => {
    const { theme } = useTheme();

    return (
        <div
            style={{
                height: 'calc(100vh - 64px)',
                width: '100%',
                overflow: 'hidden',
                borderRadius: 12,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
            }}
        >
            {/*
              Override DwgCheckApp's 100vh/100vw with our container.
              The CSS below targets the .pdf-viewer-root class used by DwgCheckApp.
            */}
            <style>{`
                .pdf-hub-dwg-container .pdf-viewer-root {
                    height: 100% !important;
                    width: 100% !important;
                }
            `}</style>
            <div className="pdf-hub-dwg-container" style={{ height: '100%', width: '100%' }}>
                <DwgCheckApp />
            </div>
        </div>
    );
};

export default DwgCheckWrapper;
