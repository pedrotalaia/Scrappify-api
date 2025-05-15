const { colorMap } = require('./colorMap');

const normalizeMemory = (memory) => {
    if (!memory) return null;
    const cleaned = memory.trim().replace(/\s+/g, ' ').toUpperCase();
    return cleaned.match(/\b(\d{1,4}\s?(GB|TB|MB))\b/i) ? cleaned : null;
};

const normalizeColor = (color) => {
    if (!color) return null;
    const cleaned = color.toLowerCase().trim().replace(/\(product\)/i, '').replace(/^\ben\b\s+/i, '').trim();
    for (const [term, canonicalColor] of Object.entries(colorMap)) {
        if (cleaned.includes(term)) {
            return canonicalColor;
        }
    }
    return cleaned in colorMap ? colorMap[cleaned] : null;
};

const extractColorFromQuery = (query) => {
    const lowerQuery = query.toLowerCase().trim();
    for (const [term, canonicalColor] of Object.entries(colorMap)) {
        if (lowerQuery.includes(term)) {
            return canonicalColor;
        }
    }
    return null;
};

const normalizeModelFromTitle = (title, brand = '') => {
    if (!title) return null;
    const lowerTitle = title.toLowerCase().trim();
    const memoryKeywords = ['gb', 'tb', 'mb', '128', '256', '512', '1tb', '2tb'];
    const sizeKeywords = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'small', 'medium', 'large'];
    const genericKeywords = ['new', 'for men', 'for women', 'unisex', 'renewed', 'refurbished', 'used', 'original', 'apple', 'iphone'];
    
    let cleaned = lowerTitle;
    
    Object.keys(colorMap).forEach(color => {
        cleaned = cleaned.replace(new RegExp(`\\b${color}\\b`, 'gi'), '');
    });
    
    memoryKeywords.forEach(memory => {
        cleaned = cleaned.replace(new RegExp(`\\b${memory}\\b`, 'gi'), '');
    });
    
    sizeKeywords.forEach(size => {
        cleaned = cleaned.replace(new RegExp(`\\b${size}\\b`, 'gi'), '');
    });
    
    genericKeywords.forEach(generic => {
        cleaned = cleaned.replace(new RegExp(`\\b${generic}\\b`, 'gi'), '');
    });
    
    cleaned = cleaned.replace(/\([^)]*\)/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (brand) {
        const brandLower = brand.toLowerCase();
        cleaned = cleaned.replace(new RegExp(`\\b${brandLower}\\b`, 'gi'), '').trim();
    }
    
    return cleaned || null;
};

const normalizeTitle = (brand, title, memory, color) => {
    const normalizedBrand = brand.toLowerCase().includes('apple') ? 'iPhone' : brand;
    const model = normalizeModelFromTitle(title, normalizedBrand);
    if (!model) {
        return `${normalizedBrand}${memory ? ` (${memory})` : ''}${color ? ` - ${color}` : ''}`.trim();
    }
    
    const capitalizedModel = model
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    const memoryPart = memory ? ` (${memory})` : '';
    const colorPart = color ? ` - ${color}` : '';
    return `${normalizedBrand} ${capitalizedModel}${memoryPart}${colorPart}`.replace(/\s+/g, ' ').trim();
};

const normalizeUrl = (url) => {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
};

module.exports = { normalizeMemory, normalizeColor, extractColorFromQuery, normalizeModelFromTitle, normalizeTitle, normalizeUrl };