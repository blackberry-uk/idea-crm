import { ThemePalette } from '../types';

export interface ColorScheme {
    id: ThemePalette;
    name: string;
    primary: string;      // Icons, Primary Buttons, Active States (e.g. indigo-600)
    secondary: string;    // Working Area Background (e.g. amber-50)
    accent: string;       // Secondary accents
    followUp: string;     // Follow-up Note Background
    textTitle: string;    // Titles
    textBody: string;     // Body text
    textMain: string;     // Primary Black/Neutral Text (e.g. #1a1a1a)
    border: string;       // Borders
    noteBg: string;       // Normal Note Background
    noteBorder: string;   // Normal Note Border
    followUpBorder: string; // Follow-up Note Border
    uiBg: string;         // General UI background (canvas)
    adjustments?: Record<string, { base?: string, h: number, l: number, s: number }>;
}

export const THEMES: Record<ThemePalette, ColorScheme> = {
    default: {
        id: 'default',
        name: 'Nazareno de San Pablo (Default)',
        primary: '#4f46e5', // Indigo-600
        secondary: '#FDF1C8', // Unified CRM Amber
        accent: '#10b981', // Emerald-500
        followUp: '#fffaf0', // FloralWhite (User selection)
        followUpBorder: '#d2b48c', // Tan (User selection)
        noteBg: '#ffffff',
        noteBorder: '#e5e7eb',
        textTitle: '#111827',
        textBody: '#374151',
        textMain: '#1a1a1a',
        border: '#e5e7eb',
        uiBg: '#F2F3F4',
        adjustments: {
            primary: { base: 'Indigo', h: 243, s: 75, l: 59 },
            secondary: { base: 'Beige', h: 46, s: 93, l: 89 },
            accent: { base: 'MediumSeaGreen', h: 160, s: 84, l: 39 },
            followUp: { base: 'FloralWhite', h: 40, s: 100, l: 97 },
            followUpBorder: { base: 'Tan', h: 34, s: 44, l: 69 },
            noteBg: { base: 'White', h: 0, s: 0, l: 100 },
            noteBorder: { base: 'Gainsboro', h: 220, s: 13, l: 91 },
            textTitle: { base: 'MidnightBlue', h: 221, s: 39, l: 11 },
            textBody: { base: 'SlateGray', h: 217, s: 19, l: 27 },
            textMain: { base: 'DarkSlateGray', h: 0, s: 0, l: 10 },
            border: { base: 'LightGray', h: 220, s: 13, l: 91 },
            uiBg: { base: 'WhiteSmoke', h: 210, s: 8, l: 95 }
        }
    },
    shire: {
        id: 'shire',
        name: 'The Shire',
        primary: '#795548', // Brown-600
        secondary: '#fdf5e6', // Old Lace
        accent: '#6b8e23', // Olive Drab
        followUp: '#d4e09b', // Sage Green
        followUpBorder: '#c5d0a0',
        noteBg: '#ffffff',
        noteBorder: '#d7ccc8',
        textTitle: '#3e2723',
        textBody: '#4e342e',
        textMain: '#2d1b11',
        border: '#d7ccc8',
        uiBg: '#fafafa',
        adjustments: {
            primary: { base: 'Sienna', h: 16, s: 22, l: 38 },
            secondary: { base: 'OldLace', h: 39, s: 85, l: 95 },
            accent: { base: 'OliveDrab', h: 80, s: 60, l: 35 },
            followUp: { base: 'DarkSeaGreen', h: 70, s: 53, l: 74 },
            followUpBorder: { base: 'DarkSeaGreen', h: 74, s: 34, l: 72 },
            noteBg: { base: 'White', h: 0, s: 0, l: 100 },
            noteBorder: { base: 'Silver', h: 16, s: 16, l: 81 },
            textTitle: { base: 'SaddleBrown', h: 9, s: 28, l: 19 },
            textBody: { base: 'SaddleBrown', h: 11, s: 26, l: 24 },
            textMain: { base: 'DarkSienna', h: 21, s: 45, l: 12 },
            border: { base: 'Silver', h: 16, s: 16, l: 81 },
            uiBg: { base: 'WhiteSmoke', h: 0, s: 0, l: 98 }
        }
    },
    cata: {
        id: 'cata',
        name: 'Bahía de Cata',
        primary: '#0288d1', // Vibrant Caribbean Blue
        secondary: '#fff9c4', // Warm Yellow
        accent: '#4fc3f7', // Light Blue
        followUp: '#e0f7fa', // Light Caribbean Blue
        followUpBorder: '#b3e5fc',
        noteBg: '#ffffff',
        noteBorder: '#b3e5fc',
        textTitle: '#01579b',
        textBody: '#0277bd',
        textMain: '#002b4d',
        border: '#b3e5fc',
        uiBg: '#fdfbf7', // Sand White
        adjustments: {
            primary: { base: 'VibrantBlue', h: 201, s: 98, l: 41 },
            secondary: { base: 'LemonChiffon', h: 54, s: 100, l: 88 },
            accent: { base: 'LightSkyBlue', h: 199, s: 91, l: 64 },
            followUp: { base: 'LightCyan', h: 187, s: 72, l: 93 },
            followUpBorder: { base: 'PowderBlue', h: 199, s: 92, l: 85 },
            noteBg: { base: 'White', h: 0, s: 0, l: 100 },
            noteBorder: { base: 'PowderBlue', h: 199, s: 92, l: 85 },
            textTitle: { base: 'DarkCyan', h: 206, s: 99, l: 31 },
            textBody: { base: 'SteelBlue', h: 202, s: 98, l: 37 },
            textMain: { base: 'MidnightBlue', h: 206, s: 100, l: 15 },
            border: { base: 'PowderBlue', h: 199, s: 92, l: 85 },
            uiBg: { base: 'FloralWhite', h: 40, s: 60, l: 98 }
        }
    },
    sabas: {
        id: 'sabas',
        name: 'Sabas Nieves',
        primary: '#2e7d32', // Green-700
        secondary: '#e3f2fd', // Sky Blue
        accent: '#fbc02d', // Yellow Dirt
        followUp: '#f0f4f0', // Light green shift
        followUpBorder: '#c8e6c9',
        noteBg: '#ffffff',
        noteBorder: '#c8e6c9',
        textTitle: '#1b5e20',
        textBody: '#33691e',
        textMain: '#0a230d',
        border: '#c8e6c9',
        uiBg: '#f1f8e9',
        adjustments: {
            primary: { base: 'ForestGreen', h: 123, s: 46, l: 34 },
            secondary: { base: 'LightBlue', h: 205, s: 87, l: 94 },
            accent: { base: 'Gold', h: 43, s: 96, l: 58 },
            followUp: { base: 'Honeydew', h: 120, s: 15, l: 95 },
            followUpBorder: { base: 'LightGreen', h: 122, s: 37, l: 84 },
            noteBg: { base: 'White', h: 0, s: 0, l: 100 },
            noteBorder: { base: 'LightGreen', h: 122, s: 37, l: 84 },
            textTitle: { base: 'DarkGreen', h: 124, s: 55, l: 24 },
            textBody: { base: 'ForestGreen', h: 103, s: 56, l: 26 },
            textMain: { base: 'DarkGreen', h: 128, s: 55, l: 9 },
            border: { base: 'LightGreen', h: 122, s: 37, l: 84 },
            uiBg: { base: 'Honeydew', h: 88, s: 52, l: 94 }
        }
    }
};

export const getTheme = (id: ThemePalette = 'default', customTheme?: Partial<ColorScheme>): ColorScheme => {
    const base = THEMES[id] || THEMES.default;
    if (customTheme) {
        return { ...base, ...customTheme };
    }
    return base;
};
