
const THEMES = {
    shire: {
        primary: '#5d4037', secondary: '#fdf5e6', accent: '#6b8e23', followUp: '#d4e09b', followUpBorder: '#c5d0a0',
        noteBg: '#ffffff', noteBorder: '#d7ccc8', textTitle: '#3e2723', textBody: '#4e342e', border: '#d7ccc8', uiBg: '#fafafa',
    },
    cata: {
        primary: '#0077be', secondary: '#fff9c4', accent: '#4fc3f7', followUp: '#e0f7fa', followUpBorder: '#b3e5fc',
        noteBg: '#ffffff', noteBorder: '#b3e5fc', textTitle: '#01579b', textBody: '#0277bd', border: '#b3e5fc', uiBg: '#fdfbf7',
    },
    sabas: {
        primary: '#1b5e20', secondary: '#e3f2fd', accent: '#fbc02d', followUp: '#f0f4f0', followUpBorder: '#c8e6c9',
        noteBg: '#ffffff', noteBorder: '#c8e6c9', textTitle: '#1b5e20', textBody: '#33691e', border: '#c8e6c9', uiBg: '#f1f8e9',
    }
};

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

Object.entries(THEMES).forEach(([tName, colors]) => {
    console.log(`--- ${tName} ---`);
    Object.entries(colors).forEach(([key, hex]) => {
        const hsl = rgbToHsl(...Object.values(hexToRgb(hex)));
        console.log(`${key}: { h: ${hsl.h}, s: ${hsl.s}, l: ${hsl.l} }, // ${hex}`);
    });
});
