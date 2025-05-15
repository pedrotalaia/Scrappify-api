// FUSÃO COMPLETA: variações + po-* + fallback inteligente
const { getBrowser, getRandomUserAgent, acceptCookies, parsePrice, safeEval, delay, dedupeVariations } = require('./utils');
const { normalizeMemory, normalizeColor, extractColorFromQuery, normalizeTitle, normalizeUrl } = require('./normalize');

const removeTitleRepetitions = (title) => {
    const words = title.split(' ');
    const result = [];
    const seen = new Set();
    for (const word of words) {
        const key = word.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(word);
    }
    return result.join(' ');
};

const cleanModel = (rawModel) => {
    return rawModel
        .replace(/\s+/g, ' ')
        .replace(/[\-–,]/g, ' ')
        .replace(/\([^)]*\)/g, '')
        .trim()
        .split(' ')
        .slice(0, 6)
        .join(' ')
        .trim();
};

const matchesModelInQuery = (model, query) => {
    const match = query.match(/\b(\d{2})\b/);
    if (!match) return true;
    const number = match[1];
    if (!model) return false;
    return model.includes(number);
};

const extractPoData = async (page) => {
    return await page.evaluate(() => {
        const data = {};
        const map = {
            model_name: '.po-model_name .po-break-word',
            color: '.po-color .po-break-word',
            memory: '.po-memory_storage_capacity .po-break-word',
            brand: '.po-brand .po-break-word'
        };
        for (const [key, selector] of Object.entries(map)) {
            const el = document.querySelector(selector);
            if (el) data[key] = el.innerText.trim();
        }
        return data;
    });
};

const scrapeAmazonQuery = async (query) => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setUserAgent(getRandomUserAgent());
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9' });
        await page.setDefaultNavigationTimeout(60000);

        const queryColor = extractColorFromQuery(query);
        const searchUrl = `https://www.amazon.es/s?k=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });
        await acceptCookies(page, '#sp-cc-accept');
        await page.waitForSelector('#search .s-result-item', { timeout: 10000 });

        const refurbishedKeywords = ['refurbished', 'renewed', 'used', 'second hand', 'reacondicionado', 'renovado', 'usado', 'segunda mano'];

        const productFromSearch = await page.evaluate((query, refurbishedKeywords) => {
            const items = Array.from(document.querySelectorAll('#search .s-result-item'));
            const queryTerms = query.toLowerCase().split(/\s+/);
            let bestMatch = null;
            let bestScore = -1;

            for (const item of items.slice(0, 10)) {
                const titleElement = item.querySelector('.a-link-normal .a-text-normal');
                const priceElement = item.querySelector('.a-price .a-offscreen');
                const linkElement = item.querySelector('.a-link-normal');
                const brandElement = item.querySelector('.a-size-base-plus.a-color-base');
                const isAd = item.querySelector('.puis-label-popover-default') !== null;
                const isRenewed = item.querySelector('[aria-label*="Renewed"]') || item.querySelector('[aria-label*="Reacondicionado"]');

                if (!titleElement || !linkElement || isAd || isRenewed) continue;

                const title = titleElement.innerText.toLowerCase();
                const brand = brandElement?.innerText.trim() || '';
                let score = 0;

                for (const term of queryTerms) {
                    if (title.includes(term)) score += term.length > 3 ? 5 : 2;
                }

                const exactMatch = queryTerms.every(term => title.includes(term));
                if (exactMatch) score += 15;
                if (!priceElement) score -= 3;

                if (refurbishedKeywords.some(keyword => title.includes(keyword))) continue;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        title: titleElement.innerText,
                        price: priceElement?.innerText || null,
                        link: linkElement.href,
                        brand
                    };
                }
            }

            return bestMatch;
        }, query, refurbishedKeywords);

        if (!productFromSearch) return [];
        await page.goto(productFromSearch.link, { waitUntil: 'networkidle2' });

        const poData = await extractPoData(page);
        const brand = (poData.brand || productFromSearch.brand || '').trim() || productFromSearch.title.split(' ')[0];
        const rawModel = poData.model_name || productFromSearch.title;
        const model = cleanModel(rawModel);
        const allowMatch = matchesModelInQuery(model.toLowerCase(), query.toLowerCase());

        const variations = [];
        const colorOptions = await page.$$('[id^="color_name_"].image-swatch-button');

        if (colorOptions.length > 0) {
            for (let colorIndex = 0; colorIndex < colorOptions.length; colorIndex++) {
                await delay(1000);
                const colorElement = colorOptions[colorIndex];
                if (await colorElement.isVisible()) {
                    await colorElement.click();
                    await delay(3000);
                    const rawColor = await safeEval(page, `#color_name_${colorIndex} img.swatch-image`, el => el.alt.trim(), '');
                    const normalizedColor = normalizeColor(rawColor);
                    const color = queryColor || normalizedColor;
                    if (queryColor && color !== queryColor) continue;

                    const memoryOptions = await page.$$('[id^="size_name_"].text-swatch-button-with-slots');
                    for (let memoryIndex = 0; memoryIndex < memoryOptions.length; memoryIndex++) {
                        const memoryElement = memoryOptions[memoryIndex];
                        if (await memoryElement.isVisible()) {
                            await memoryElement.click();
                            await delay(3000);
                            const memory = normalizeMemory(await safeEval(page, `#size_name_${memoryIndex} .swatch-title-text`, el => el.innerText.trim(), '')) || normalizeMemory(poData.memory);
                            const priceText = await safeEval(page, '.a-price .a-offscreen', el => el.innerText, '') || '';
                            const image = await safeEval(page, '#landingImage', el => el.src, '') || await safeEval(page, '.a-dynamic-image', el => el.src, '');
                            const price = parsePrice(priceText);
                            const currentUrl = page.url();

                            if (!isNaN(price)) {
                                const title = removeTitleRepetitions(normalizeTitle(brand, rawModel, memory, color)).trim();
                                variations.push({ title, price, image, memory, color, url: currentUrl, model });
                            }
                        }
                    }
                }
            }
        }

        if (variations.length === 0) {
            const priceText = await safeEval(page, '.a-price .a-offscreen', el => el.innerText, '') || '';
            const image = await safeEval(page, '#landingImage', el => el.src, '') || await safeEval(page, '.a-dynamic-image', el => el.src, '') || '';
            const price = parsePrice(priceText);
            const currentUrl = page.url();
            const memory = normalizeMemory(poData.memory);
            const color = queryColor || normalizeColor(poData.color);
            const title = removeTitleRepetitions(normalizeTitle(brand, rawModel, memory, color)).trim();

            if (!isNaN(price) && !refurbishedKeywords.some(k => title.toLowerCase().includes(k)) && currentUrl !== 'https://www.amazon.es/s' && allowMatch) {
                variations.push({ title, price, image, memory, color, url: currentUrl, model });
            }
        }

        const uniqueVariations = dedupeVariations(variations, v => `${v.title}-${v.memory || ''}-${v.color || ''}`);

        const validVariations = uniqueVariations.filter(v => {
            if (!v.title || typeof v.title !== 'string') {
                console.warn('[SCRAPER] Variação rejeitada por título inválido:', v);
                return false;
            }
            return true;
        });

        const results = validVariations.map(variation => {
            return {
                brand: brand.trim(),
                model: (variation.model || cleanModel(variation.title)).trim(),
                memory: variation.memory,
                color: variation.color,
                name: variation.title.trim(),
                category: null,
                currency: 'EUR',
                imageUrl: variation.image,
                offers: [
                    {
                        source: 'Amazon',
                        url: normalizeUrl(variation.url),
                        prices: [
                            {
                                value: variation.price,
                                date: new Date()
                            }
                        ],
                        lastUpdated: new Date()
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            };
        });

        return results;
    } catch (error) {
        console.error(`[SCRAPER] Erro: ${error.message}`);
        return [];
    } finally {
        await page.close();
    }
};

module.exports = { scrapeAmazonQuery };