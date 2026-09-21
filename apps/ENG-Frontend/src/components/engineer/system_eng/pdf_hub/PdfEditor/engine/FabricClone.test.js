import * as fabric from 'fabric';

beforeAll(() => {
    const mockCtx = {
        measureText: () => ({ width: 10 }),
        fillText: () => {},
        strokeText: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        rect: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        clip: () => {},
        transform: () => {},
        setTransform: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        clearRect: () => {}
    };
    HTMLCanvasElement.prototype.getContext = () => mockCtx;
});

describe('Fabric v6 Object Cloning', () => {
    it('should clone stampUserDate group without crashing', async () => {
        const dept = 'ROD ENG';
        const name = 'L.WORAWUT';
        const formattedName = 'W.L';
        const color = '#e74c3c';

        const bgCircle = new fabric.Circle({
            radius: 48, fill: 'transparent', stroke: color, strokeWidth: 3,
            originX: 'center', originY: 'center',
            left: 0, top: 0, objectCaching: false
        });
        const line1 = new fabric.Line([-46, -14, 46, -14], { stroke: color, strokeWidth: 2, objectCaching: false });
        const line2 = new fabric.Line([-46, 14, 46, 14], { stroke: color, strokeWidth: 2, objectCaching: false });

        const fontProps = {
            fontWeight: 'bold', fill: color, fontFamily: 'Arial',
            originX: 'center', originY: 'center',
            objectCaching: false
        };

        const deptText = new fabric.FabricText(dept, {
            ...fontProps,
            fontSize: 16, top: -24, left: 0
        });

        const dateTextObj = new fabric.FabricText('11 SEP 2026', {
            ...fontProps,
            fontSize: 14, top: 5, left: 0
        });

        const nameChars = formattedName.split('');
        const nameObjects = nameChars.map((char, i) => {
            return new fabric.FabricText(char, {
                ...fontProps,
                fontSize: 12,
                left: 38,
                top: 0,
                angle: 0
            });
        });

        const userDateGroup = new fabric.Group([bgCircle, line1, line2, deptText, dateTextObj, ...nameObjects], {
            id: 'test_stamp',
            left: 100,
            top: 100,
            customData: { type: 'stampUserDate' },
        });

        const cloned = await userDateGroup.clone();
        expect(cloned).toBeDefined();
    });

    it('should clone ActiveSelection containing text and other objects', async () => {
        const canvas = new fabric.Canvas();
        const t1 = new fabric.Textbox('Hello world', { left: 10, top: 10 });
        const r1 = new fabric.Rect({ left: 20, top: 20, width: 50, height: 50 });
        canvas.add(t1, r1);

        const sel = new fabric.ActiveSelection([t1, r1], { canvas });
        const cloned = await sel.clone();
        expect(cloned).toBeDefined();
    });

    it('should prevent crash when FabricText prototype is safeguarded', async () => {
        const origSplit = fabric.FabricText.prototype._splitTextIntoLines;
        fabric.FabricText.prototype._splitTextIntoLines = function (text) {
            const safeText = (text !== undefined && text !== null) ? String(text) : (this.text !== undefined && this.text !== null ? String(this.text) : '');
            if (this.text === undefined || this.text === null) {
                this.text = safeText;
            }
            return origSplit.call(this, safeText);
        };


        const badSerialized = {
            type: 'Textbox',
            left: 0,
            top: 0,
            width: 100,
            // text is missing!
        };

        const revived = await fabric.Textbox.fromObject(badSerialized);
        expect(revived).toBeDefined();
        expect(revived.text).toBe('');

        // Restore
        fabric.FabricText.prototype._splitTextIntoLines = origSplit;
    });

    it('should test canvas.loadFromJSON restoration', async () => {
        const canvas = new fabric.Canvas();
        const r1 = new fabric.Rect({ left: 10, top: 10, width: 50, height: 50 });
        const t1 = new fabric.Textbox('Test Text', { left: 100, top: 100 });
        canvas.add(r1, t1);

        const snapshot = canvas.toObject(['customData', 'textLines', 'id']);
        expect(snapshot.objects.length).toBe(2);

        // Clear canvas
        canvas.clear();
        expect(canvas.getObjects().length).toBe(0);

        // Restore via loadFromJSON
        await canvas.loadFromJSON(snapshot);
        expect(canvas.getObjects().length).toBe(2);
    });

    it('should restore stampUserDate via loadFromJSON without crashing', async () => {
        const canvas = new fabric.Canvas();
        const deptText = new fabric.FabricText('ROD ENG', { fontSize: 16 });
        const dateText = new fabric.FabricText('11 SEP 2026', { fontSize: 14 });
        const circle = new fabric.Circle({ radius: 48 });
        const nameObjects = 'L.WORAWUT SOMENAME'.split('').map(c => new fabric.FabricText(c, { fontSize: 12 }));
        const group = new fabric.Group([circle, deptText, dateText, ...nameObjects], {
            customData: { type: 'stampUserDate' },
        });
        canvas.add(group);

        const snapshot = canvas.toObject(['customData', 'textLines', 'id']);
        canvas.clear();
        expect(canvas.getObjects().length).toBe(0);

        await canvas.loadFromJSON(snapshot);
        expect(canvas.getObjects().length).toBe(1);
    });

    it('should test canvas.toObject and loadFromJSON when an ActiveSelection exists', async () => {
        const canvas = new fabric.Canvas();
        const r1 = new fabric.Rect({ left: 10, top: 10, width: 50, height: 50 });
        const r2 = new fabric.Rect({ left: 100, top: 100, width: 50, height: 50 });
        canvas.add(r1, r2);

        // Select both objects
        const sel = new fabric.ActiveSelection([r1, r2], { canvas });
        canvas.setActiveObject(sel);

        const snapshot = canvas.toObject(['customData', 'textLines', 'id']);
        expect(snapshot.objects.length).toBe(2);

        canvas.clear();
        await canvas.loadFromJSON(snapshot);
        expect(canvas.getObjects().length).toBe(2);
    });

    it('should properly update text content and dimensions via updateSelectedTextContent', () => {
        const { usePdfEditorStore } = require('../../../../../../stores/usePdfEditorStore');
        const canvas = new fabric.Canvas();
        canvas.renderAll = jest.fn();

        const textObj = new fabric.FabricText('Hello World', {
            id: 'text-obj-1',
            left: 100,
            top: 100,
            fontSize: 16
        });
        textObj.id = 'text-obj-1';
        canvas.add(textObj);

        const fakeRefs = { current: { 1: canvas } };

        // Select object in store
        usePdfEditorStore.getState().setSelectedObject('text-obj-1', { type: 'FabricText', text: 'Hello World' });

        // Call updateSelectedTextContent
        usePdfEditorStore.getState().updateSelectedTextContent('Antigravity Engineer', fakeRefs, 1);

        expect(textObj.text).toBe('Antigravity Engineer');
        expect(usePdfEditorStore.getState().selectedObjectProps.text).toBe('Antigravity Engineer');
    });

    it('should correctly push and restore snapshots across undo and redo', async () => {
        const canvas = new fabric.Canvas();
        canvas.renderAll = jest.fn();
        const rect = new fabric.Rect({ left: 10, top: 10, width: 50, height: 50 });
        
        // Initial state: empty
        const state0 = { 1: canvas.toObject() };
        
        // Action: add rect
        canvas.add(rect);
        const state1 = { 1: canvas.toObject() };

        expect(canvas.getObjects().length).toBe(1);

        // Simulate undo: restore state0
        canvas.clear();
        canvas.renderAll();
        expect(canvas.getObjects().length).toBe(0);

        // Simulate redo: restore state1
        await canvas.loadFromJSON(state1[1]);
        canvas.renderAll();
        expect(canvas.getObjects().length).toBe(1);
    });

    it('should properly apply Role Preset color to selected text without setting it transparent', () => {
        const { usePdfEditorStore } = require('../../../../../../stores/usePdfEditorStore');
        const canvas = new fabric.Canvas();
        canvas.renderAll = jest.fn();

        const textObj = new fabric.FabricText('DWG Check Note', {
            id: 'dwg-text-1',
            fill: '#000000',
            left: 50,
            top: 50
        });
        textObj.id = 'dwg-text-1';
        canvas.add(textObj);

        const fakeRefs = { current: { 1: canvas } };

        usePdfEditorStore.getState().setSelectedObject('dwg-text-1', {
            type: 'FabricText',
            fill: '#000000',
            strokeColor: '#000000',
            text: 'DWG Check Note'
        });

        // Simulate user clicking "Drawer" (#3498db)
        usePdfEditorStore.getState().setDwgRoleColor('drawer', '#3498db');
        usePdfEditorStore.getState().updateSelectedObjectProperty('strokeColor', '#3498db', fakeRefs, 1);

        // Text in Fabric uses fill for color - it must NOT be transparent!
        expect(textObj.fill).toBe('#3498db');
        expect(textObj.fill).not.toBe('transparent');
        expect(usePdfEditorStore.getState().selectedObjectProps.fill).toBe('#3498db');
    });

    it('should properly apply Role Preset color to selected arrow (both line stroke and arrowhead fill)', () => {
        const { usePdfEditorStore } = require('../../../../../../stores/usePdfEditorStore');
        const canvas = new fabric.Canvas();
        canvas.renderAll = jest.fn();

        const line = new fabric.Line([0, 0, 100, 100], { stroke: '#000000', strokeWidth: 2 });
        const head = new fabric.Triangle({
            left: 100,
            top: 100,
            width: 16,
            height: 16,
            fill: '#000000',
            customData: { type: 'arrowhead' }
        });
        const arrowGroup = new fabric.Group([line, head], {
            id: 'arrow-group-1',
            customData: { type: 'arrow', arrowHeadSize: 16 }
        });
        arrowGroup.id = 'arrow-group-1';
        canvas.add(arrowGroup);

        const fakeRefs = { current: { 1: canvas } };

        usePdfEditorStore.getState().setSelectedObject('arrow-group-1', {
            type: 'group',
            customData: { type: 'arrow', arrowHeadSize: 16 }
        });

        // Simulate user clicking "Checker" (#e74c3c)
        usePdfEditorStore.getState().setDwgRoleColor('checker', '#e74c3c');
        usePdfEditorStore.getState().updateSelectedObjectProperty('strokeColor', '#e74c3c', fakeRefs, 1);

        expect(line.stroke).toBe('#e74c3c');
        expect(head.fill).toBe('#e74c3c');
    });

    it('should properly resize arrowhead on arrow group via arrowHeadSize', () => {
        const { usePdfEditorStore } = require('../../../../../../stores/usePdfEditorStore');
        const canvas = new fabric.Canvas();
        canvas.renderAll = jest.fn();

        const line = new fabric.Line([0, 0, 100, 100], { stroke: '#3498db', strokeWidth: 2 });
        const head = new fabric.Triangle({
            left: 100,
            top: 100,
            width: 16,
            height: 16,
            fill: '#3498db',
            customData: { type: 'arrowhead' }
        });
        const arrowGroup = new fabric.Group([line, head], {
            id: 'arrow-group-2',
            customData: { type: 'arrow', arrowHeadSize: 16 }
        });
        arrowGroup.id = 'arrow-group-2';
        canvas.add(arrowGroup);

        const fakeRefs = { current: { 1: canvas } };

        usePdfEditorStore.getState().setSelectedObject('arrow-group-2', {
            type: 'group',
            customData: { type: 'arrow', arrowHeadSize: 16 }
        });

        // Resize arrowhead to 28px
        usePdfEditorStore.getState().updateSelectedObjectProperty('arrowHeadSize', 28, fakeRefs, 1);

        expect(head.width).toBe(28);
        expect(head.height).toBe(28);
        expect(arrowGroup.customData.arrowHeadSize).toBe(28);
        expect(usePdfEditorStore.getState().selectedObjectProps.arrowHeadSize).toBe(28);
    });
});





