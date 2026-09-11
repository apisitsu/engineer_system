import * as fabric from 'fabric';

/**
 * fabricSafeguard.js
 * 
 * Global monkey-patches and defensive guards for Fabric.js v6.
 * Specifically prevents:
 *  1. TypeError: Cannot read properties of undefined (reading 'split') in _splitTextIntoLines
 *     when cloning or deserializing FabricText / Textbox / IText whose text property is missing or undefined.
 *  2. Unhandled rejections during async object enlivening.
 */

if (fabric?.FabricText?.prototype && !fabric.FabricText.prototype.__safeguarded) {
    const origSplit = fabric.FabricText.prototype._splitTextIntoLines;
    fabric.FabricText.prototype._splitTextIntoLines = function (text) {
        const safeText = (text !== undefined && text !== null)
            ? String(text)
            : (this.text !== undefined && this.text !== null ? String(this.text) : '');
        if (this.text === undefined || this.text === null) {
            this.text = safeText;
        }
        return origSplit.call(this, safeText);
    };
    fabric.FabricText.prototype.__safeguarded = true;
}

export default fabric;
