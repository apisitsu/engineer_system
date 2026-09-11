// ============================================================
// Engineer Record - Case Types & Constants
// ============================================================

export const CASE_TYPES = {
    REQUEST_DRAWING: 'Request Drawing',
    JUDGMENT_SPEC: 'Judgment Spec',
    CHANGE_DWG: 'Request change DWG/Traveler',
    DWG_PROBLEM: 'DWG/Traveler Problem',
    SPECIAL: 'Special',
};

export const CASE_OPTIONS = [
    { value: 'Request Drawing', label: 'Request Drawing' },
    { value: 'Judgment Spec', label: 'Judgment Spec' },
    { value: 'Request change DWG/Traveler', label: 'Request change DWG/Traveler' },
    { value: 'DWG/Traveler Problem', label: 'DWG/Traveler Problem' },
    { value: 'Special', label: 'Special' },
];

export const CASE_COLORS = {
    request_drawing: '#1677ff',
    judgment_spec: '#722ed1',
    change_dwg: '#fa8c16',
    dwg_problem: '#f5222d',
    special: '#13c2c2',
};

export const CASE_LABELS = {
    request_drawing: 'Request Drawing',
    judgment_spec: 'Judgment Spec',
    change_dwg: 'Change DWG/Traveler',
    dwg_problem: 'DWG/Traveler Problem',
    special: 'Special',
};

export const CASE_TAG_MAP = {
    'Request Drawing': { color: 'blue', short: 'Drawing' },
    'Judgment Spec': { color: 'purple', short: 'Judgment' },
    'Request change DWG/Traveler': { color: 'orange', short: 'Change DWG' },
    'DWG/Traveler Problem': { color: 'red', short: 'Problem' },
    'Special': { color: 'cyan', short: 'Special' },
};
