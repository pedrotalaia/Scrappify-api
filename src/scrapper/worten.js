const { getBrowser, getRandomUserAgent, acceptCookies, parsePrice, delay, dedupeVariations } = require('./utils');
const { normalizeColor, normalizeMemory, normalizeTitle } = require('./normalize');

const computeRelevanceScore = (title, query) => {
    const clean = str => str.toLowerCase().replace(/[^\w\s]/g, '').split(' ').filter(w => w.length > 2);
    const titleWords = clean(title);
    const queryWords = clean(query);

    const total = queryWords.length;
    let matches = 0;

    for (const word of queryWords) {
        if (titleWords.includes(word)) matches++;
    }

    const ratio = matches / total;
    let score = Math.round(ratio * 100);

    if (title.toLowerCase().startsWith(query.toLowerCase().split(' ')[0])) score += 10;
    if (matches === 0) score -= 30;
    else if (ratio < 0.5) score -= 10;

    return score;
};

const scrapeWortenQuery = async (query) => {
    if (!query) return [];

    let page;
    const visitedLinks = new Set();

    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        await page.setUserAgent(getRandomUserAgent());
        await page.setDefaultNavigationTimeout(60000);
        await acceptCookies(page, 'button.button--primary');

        const baseFilters = [
            'seller_id:worten-1',
            't_tags:is_in_stock'
        ];

        const encodedQuery = encodeURIComponent(query);
        const filtersWithEstado = [...baseFilters, 'm_estado-del-producto:Nuevo'];
        const filterStringWithEstado = filtersWithEstado.map(f => `facetFilters=${f}`).join('&');
        const filterStringWithoutEstado = baseFilters.map(f => `facetFilters=${f}`).join('&');

        const urlWithFilters = `https://www.worten.es/search?query=${encodedQuery}&${filterStringWithEstado}`;
        const urlWithoutFilters = `https://www.worten.es/search?query=${encodedQuery}&${filterStringWithoutEstado}`;

        await page.goto(urlWithFilters, { waitUntil: 'networkidle2' });
        await delay(2000);
        const resultsWithFilters = await collectProducts(page, query, 10, 0, visitedLinks);

        await page.goto(urlWithoutFilters, { waitUntil: 'networkidle2' });
        await delay(2000);
        const resultsWithoutFilters = await collectProducts(page, query, 10, resultsWithFilters.length, visitedLinks);

        const combinedResults = [...resultsWithFilters, ...resultsWithoutFilters];

        const scoredCombined = combinedResults.map(product => {
            const score = computeRelevanceScore(product.name || '', query);
            return { ...product, _score: score };
        });

        const uniqueResults = dedupeVariations(scoredCombined, product => `${product.name}-${product.memory}-${product.url}`);
        const filteredResults = uniqueResults.filter(p => (p._score || 0) >= 30);
        const top10 = filteredResults.sort((a, b) => (b._score || 0) - (a._score || 0)).slice(0, 10);

        return top10;
    } catch (error) {
        console.error('[WORTEN] Erro durante scraping:', error.message);
        return [];
    } finally {
        if (page) await page.close();
    }
};

const collectProducts = async (page, query, maxProducts, currentCount, visitedLinks) => {
    const refurbishedKeywords = ['reacondicionado', 'renovado', 'usado', 'segunda mano', 'refurbished'];
    const products = [];

    try {
        await page.waitForFunction(
            () => document.querySelectorAll('[class*="listing-content"] [class*="card"]').length > 0,
            { timeout: 20000 }
        );

        const productItems = await page.evaluate((query, refurbishedKeywords) => {
            const items = Array.from(document.querySelectorAll('[class*="listing-content"] [class*="card"]'))
                .filter(item => !item.hasAttribute('hidden'))
                .map(item => {
                    const titleElement = item.querySelector('.product-card__name') || item.querySelector('.product-card__title') || item.querySelector('[class*="product-card"]');
                    const priceElement = item.querySelector('.product-card__price meta[itemprop="price"]') || item.querySelector('.product-card__price');
                    const linkElement = item.querySelector('a.product-card') || item.querySelector('a[href*="/productos/"]') || item.querySelector('a[href]');

                    const title = titleElement ? titleElement.innerText : null;
                    const price = priceElement ? (priceElement.content || priceElement.innerText) : null;
                    const link = linkElement ? linkElement.href : null;

                    return { title, price, link };
                });

            const validItems = items.filter(item => item.title && item.link);

            const seenLinks = new Set();
            const dedupedItems = validItems.filter(item => {
                if (seenLinks.has(item.link)) return false;
                seenLinks.add(item.link);
                return true;
            });

            const queryLower = query.toLowerCase();
            const scoredItems = dedupedItems.map(item => {
                const title = item.title ? item.title.toLowerCase() : '';
                let score = 0;

                if (title.includes(queryLower)) {
                    score += 10;
                    if (title.startsWith(queryLower)) score += 5;
                }

                if (title.includes('consola') || title.includes('console')) score += 10;
                if (title.includes('juego') || title.includes('game') || title.includes('accesorio')) score -= 15;

                const isRefurbishedInTitle = refurbishedKeywords.some(keyword => title.includes(keyword));
                if (isRefurbishedInTitle) score -= 20;

                return { ...item, score };
            });

            return scoredItems.sort((a, b) => b.score - a.score);
        }, query, refurbishedKeywords);

        const itemsToProcess = productItems.slice(0, maxProducts - currentCount);

        for (const item of itemsToProcess) {
            const absoluteLink = item.link.startsWith('http') ? item.link : `https://www.worten.es${item.link}`;
            if (visitedLinks.has(absoluteLink)) continue;
            visitedLinks.add(absoluteLink);

            await page.goto(absoluteLink, { waitUntil: 'networkidle2' });

            const productDetails = await page.evaluate(() => {
                const specs = {};
                const specRows = document.querySelectorAll('.table-specifications__row');
                specRows.forEach(row => {
                    const key = row.querySelector('.table__subtitle')?.innerText.trim();
                    const value = row.querySelector('.table-specifications__right-container span')?.innerText.trim();
                    if (key && value) specs[key] = value;
                });

                const imageElement = document.querySelector('.product-gallery__slider-image');
                const imageUrl = imageElement ? imageElement.src : null;

                const priceElement = document.querySelector('meta[itemprop="price"]') || document.querySelector('.product-card__price');
                const rawPrice = priceElement ? (priceElement.content || priceElement.innerText) : null;

                return { specs, imageUrl, rawPrice };
            });

            const brand = productDetails.specs['Marca'] || 'Unknown';
            const modelRaw = productDetails.specs['Modelo'] || item.title || 'Unknown';
            const model = modelRaw.trim();
            const memory = normalizeMemory(productDetails.specs['Memoria interna'] || 'Unknown');
            const rawColor = productDetails.specs['Color'] || 'Unknown';
            const color = await normalizeColor(rawColor);
            const name = normalizeTitle(brand, model, memory, color);

            const priceValue = parsePrice(item.price) || parsePrice(productDetails.rawPrice);

            if (isNaN(priceValue) || priceValue <= 0) continue;

            const productData = {
                brand,
                model,
                memory,
                color,
                name,
                category: null,
                currency: 'EUR',
                imageUrl: productDetails.imageUrl,
                offers: [
                    {
                        source: 'Worten',
                        url: absoluteLink,
                        prices: [
                            {
                                value: priceValue,
                                date: new Date()
                            }
                        ],
                        lastUpdated: new Date()
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            products.push(productData);
        }

        return products;
    } catch (error) {
        console.error('[WORTEN] Erro em collectProducts:', error.message);
        return [];
    }
};

module.exports = { scrapeWortenQuery };