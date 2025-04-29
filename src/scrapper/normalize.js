const translate = require('google-translate-api-x');

const normalizeColor = async (color) => {
    if (!color) return null;
    const lowerColor = color.toLowerCase().trim().replace(/^en\s+/i, '');
    try {
        const translation = await translate(lowerColor, { from: 'auto', to: 'en' });
        return translation.text.toLowerCase().trim();
    } catch (error) {
        console.error('Error translating color:', error);
        return lowerColor;
    }
};

const normalizeMemory = (memory) => {
    return memory ? memory.trim().replace(/\s+/g, ' ').toUpperCase() : null;
};

const normalizeTitle = (brand, model, memory, color) => {
    const memoryPart = memory ? ` (${memory})` : '';
    const colorPart = color ? ` - ${color}` : '';
    return `${brand} ${model}${memoryPart}${colorPart}`;
};

const normalizeUrl = (url) => {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
};

module.exports = { normalizeColor, normalizeMemory, normalizeTitle, normalizeUrl };