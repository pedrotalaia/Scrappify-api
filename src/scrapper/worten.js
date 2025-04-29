const { getBrowser, getRandomUserAgent, acceptCookies, parsePrice, delay, dedupeVariations } = require('./utils');
const { normalizeColor, normalizeMemory, normalizeTitle } = require('./normalize');

const scrapeWortenQuery = async (query) => {
    if (!query) {
        return [];
    }

    let browser;
    let page;
    const results = [];

    try {
        browser = await getBrowser();
        page = await browser.newPage();

        await page.setUserAgent(getRandomUserAgent());
        await page.setDefaultNavigationTimeout(60000);

        const baseFilters = [
            'seller_id:worten-1',
            't_tags:is_in_stock',
            'm_estado-del-producto:Nuevo'
        ];

        const encodedQuery = encodeURIComponent(query);
        const baseFilterString = baseFilters.map(filter => `facetFilters=${filter}`).join('&');
        const initialSearchUrl = `https://www.worten.es/search?query=${encodedQuery}&${baseFilterString}`;

        await page.goto(initialSearchUrl, { waitUntil: 'networkidle2' });
        await delay(2000);

        await acceptCookies(page, 'button.button--primary');

        const hasResults = await page.$('[class*="listing-content"] [class*="card"]');
        if (!hasResults) {
            return [];
        }

        const memoryOptions = await page.evaluate(() => {
            const memoryLabels = Array.from(document.querySelectorAll('label[for*="m_memoria-interna"]'));
            return memoryLabels.map(label => {
                const memoryText = label.innerText.match(/(\d+\s*(?:GB|TB))/i)?.[0];
                return memoryText ? memoryText.trim() : null;
            }).filter(memory => memory);
        });

        if (!memoryOptions || memoryOptions.length === 0) {
            const products = await collectProducts(page, query, 5, results.length);
            results.push(...products);
        } else {
            for (const memory of memoryOptions) {
                if (results.length >= 5) {
                    break;
                }

                const remainingSlots = 5 - results.length;

                const encodedMemory = encodeURIComponent(memory);
                const memoryFilter = `facetFilters=m_memoria-interna:${encodedMemory}`;
                const memorySearchUrl = `https://www.worten.es/search?query=${encodedQuery}&${baseFilterString}&${memoryFilter}`;

                await page.goto(memorySearchUrl, { waitUntil: 'networkidle2' });
                await delay(2000);

                const products = await collectProducts(page, query, remainingSlots, results.length);
                results.push(...products);
                await delay(1000);
            }
        }

        const uniqueResults = dedupeVariations(results, product => `${product.name}-${product.memory}-${product.url}`);
        return uniqueResults;

    } catch (error) {
        return [];
    } finally {
        if (page) {
            await page.close();
        }
        if (browser) {
            await browser.close();
        }
    }
};

const collectProducts = async (page, query, maxProducts, currentCount) => {
    const refurbishedKeywords = ['reacondicionado', 'renovado', 'usado', 'segunda mano', 'refurbished'];
    const products = [];

    try {
        await page.waitForFunction(
            () => document.querySelectorAll('[class*="listing-content"] [class*="card"]').length > 0,
            { timeout: 20000 }
        );

        const productItems = await page.evaluate((query, refurbishedKeywords, maxProducts, currentCount) => {
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
                if (seenLinks.has(item.link)) {
                    return false;
                }
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

                const isRefurbishedInTitle = refurbishedKeywords.some(keyword => title.includes(keyword));
                if (isRefurbishedInTitle) {
                    score -= 20;
                }

                if (title.includes('nuevo') || title.includes('novo')) {
                    score += 5;
                }

                return { ...item, score };
            });

            return scoredItems.sort((a, b) => b.score - a.score);
        }, query, refurbishedKeywords, maxProducts, currentCount);

        const itemsToProcess = productItems.slice(0, maxProducts - currentCount);

        for (const item of itemsToProcess) {
            const absoluteLink = item.link.startsWith('http') ? item.link : `https://www.worten.es${item.link}`;
            await page.goto(absoluteLink, { waitUntil: 'networkidle2' });

            const productDetails = await page.evaluate(() => {
                const specs = {};
                const specRows = document.querySelectorAll('.table-specifications__row');
                specRows.forEach(row => {
                    const key = row.querySelector('.table__subtitle')?.innerText.trim();
                    const value = row.querySelector('.table-specifications__right-container span')?.innerText.trim();
                    if (key && value) {
                        specs[key] = value;
                    }
                });

                const imageElement = document.querySelector('.product-gallery__slider-image');
                const imageUrl = imageElement ? imageElement.src : null;

                return { specs, imageUrl };
            });

            if (!productDetails.specs['Marca'] || !productDetails.specs['Modelo']) {
                continue;
            }

            const brand = productDetails.specs['Marca'] || 'Unknown';
            const model = productDetails.specs['Modelo'] || 'Unknown';
            const memory = normalizeMemory(productDetails.specs['Memoria interna'] || 'Unknown');
            const color = normalizeColor(productDetails.specs['Color'] || 'Unknown');
            const name = normalizeTitle(brand, model, memory, color);
            const priceValue = parsePrice(item.price);

            if (isNaN(priceValue) || priceValue <= 0) {
                continue;
            }

            const productData = {
                brand,
                model,
                memory,
                color,
                name,
                category: 'Smartphone',
                currency: 'EUR',
                imageUrl: productDetails.imageUrl,
                offers: [{
                    source: 'Worten',
                    url: absoluteLink,
                    prices: [{
                        value: priceValue,
                        date: new Date()
                    }],
                    lastUpdated: new Date()
                }],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            products.push(productData);
        }

        return products;

    } catch (error) {
        return [];
    }
};

module.exports = { scrapeWortenQuery };