import { 
    IoRocketOutline, IoFlashOutline, IoHeartOutline, IoDiamondOutline,
    IoLeafOutline, IoBookOutline, IoCodeSlashOutline, IoColorPaletteOutline,
    IoGameControllerOutline, IoMusicalNotesOutline, IoPlanetOutline, IoShieldCheckmarkOutline,
    IoTrophyOutline, IoBulbOutline, IoConstructOutline, IoCubeOutline,
    IoFlagOutline, IoGlobeOutline, IoHammerOutline, IoPizzaOutline,
    IoPulseOutline, IoSchoolOutline, IoTerminalOutline, IoThunderstormOutline,
    IoWaterOutline, IoAirplaneOutline, IoBicycleOutline, IoCafeOutline,
    IoFitnessOutline, IoHomeOutline, IoLockClosedOutline, IoSettingsOutline,
    IoStarOutline, IoTimeOutline, IoCalendarOutline, IoLayersOutline
} from 'react-icons/io5';
import { BsKanban } from 'react-icons/bs';

export const GRADIENTS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#0ea5e9,#3b82f6)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#ec4899,#f43f5e)',
    'linear-gradient(135deg,#14b8a6,#06b6d4)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#f97316,#fb923c)',
];

export const PROJECT_ICONS = [
    { key: 'rocket', icon: IoRocketOutline, label: 'Rocket' },
    { key: 'flash', icon: IoFlashOutline, label: 'Flash' },
    { key: 'heart', icon: IoHeartOutline, label: 'Heart' },
    { key: 'diamond', icon: IoDiamondOutline, label: 'Diamond' },
    { key: 'leaf', icon: IoLeafOutline, label: 'Leaf' },
    { key: 'book', icon: IoBookOutline, label: 'Book' },
    { key: 'code', icon: IoCodeSlashOutline, label: 'Code' },
    { key: 'palette', icon: IoColorPaletteOutline, label: 'Palette' },
    { key: 'game', icon: IoGameControllerOutline, label: 'Game' },
    { key: 'music', icon: IoMusicalNotesOutline, label: 'Music' },
    { key: 'planet', icon: IoPlanetOutline, label: 'Planet' },
    { key: 'shield', icon: IoShieldCheckmarkOutline, label: 'Shield' },
    { key: 'trophy', icon: IoTrophyOutline, label: 'Trophy' },
    { key: 'bulb', icon: IoBulbOutline, label: 'Bulb' },
    { key: 'construct', icon: IoConstructOutline, label: 'Tools' },
    { key: 'cube', icon: IoCubeOutline, label: 'Cube' },
    { key: 'flag', icon: IoFlagOutline, label: 'Flag' },
    { key: 'globe', icon: IoGlobeOutline, label: 'Globe' },
    { key: 'hammer', icon: IoHammerOutline, label: 'Hammer' },
    { key: 'pizza', icon: IoPizzaOutline, label: 'Pizza' },
    { key: 'pulse', icon: IoPulseOutline, label: 'Pulse' },
    { key: 'school', icon: IoSchoolOutline, label: 'School' },
    { key: 'terminal', icon: IoTerminalOutline, label: 'Terminal' },
    { key: 'storm', icon: IoThunderstormOutline, label: 'Storm' },
    { key: 'water', icon: IoWaterOutline, label: 'Water' },
    { key: 'airplane', icon: IoAirplaneOutline, label: 'Airplane' },
    { key: 'bicycle', icon: IoBicycleOutline, label: 'Bicycle' },
    { key: 'cafe', icon: IoCafeOutline, label: 'Cafe' },
    { key: 'fitness', icon: IoFitnessOutline, label: 'Fitness' },
    { key: 'home', icon: IoHomeOutline, label: 'Home' },
    { key: 'kanban', icon: BsKanban, label: 'Kanban' },
    { key: 'layers', icon: IoLayersOutline, label: 'Layers' },
    { key: 'settings', icon: IoSettingsOutline, label: 'Settings' },
    { key: 'star', icon: IoStarOutline, label: 'Star' },
    { key: 'time', icon: IoTimeOutline, label: 'Time' },
    { key: 'calendar', icon: IoCalendarOutline, label: 'Calendar' },
];

export const getProjectIcon = (iconKey) => {
    const found = PROJECT_ICONS.find(i => i.key === iconKey);
    return found ? found.icon : null;
};

export const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
        case 'low': return 'blue';
        case 'high': return 'volcano';
        case 'urgent': return 'red';
        case 'medium':
        default: return 'green';
    }
};

export const DEFAULT_TAB_ORDER = ['dashboard', 'projects', 'reports', 'workload'];
