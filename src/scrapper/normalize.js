const colorMap = {
    'negro': 'black',
    'preto': 'black',
    'azul': 'blue',
    'rosa': 'pink',
    'verde': 'green',
    'amarelo': 'yellow',
    'amarillo': 'yellow',
    'blanco': 'white',
    'branco': 'white',
    'blanco estrella': 'starlight',
    'medianoche': 'midnight',
    'multicolor': 'white'
};

const normalizeColor = (color) => {
    if (!color) return null;
    const lowerColor = color.toLowerCase().trim().replace(/^en\s+/i, '');
    return colorMap[lowerColor] || lowerColor;
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