const { getBrowser, getRandomUserAgent, acceptCookies, parsePrice, safeEval, delay, dedupeVariations } = require('./utils');
const { normalizeColor, normalizeMemory, normalizeTitle } = require('./normalize');

const scrapeAmazonQuery = async (query) => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setUserAgent(getRandomUserAgent());
        await page.setDefaultNavigationTimeout(60000);

        const searchUrl = `https://www.amazon.es/s?k=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        await acceptCookies(page, '#sp-cc-accept');

        await page.waitForSelector('#search .s-result-item', { timeout: 10000 });

        const refurbishedKeywords = ['reacondicionado', 'renovado', 'usado', 'segunda mano', 'refurbished'];

        const productFromSearch = await page.evaluate((query, refurbishedKeywords) => {
            const items = Array.from(document.querySelectorAll('#search .s-result-item'));
            const queryLower = query.toLowerCase();
            let bestMatch = null;
            let bestScore = -1;

            for (const item of items.slice(0, 10)) {
                const titleElement = item.querySelector('.a-link-normal .a-text-normal');
                const priceElement = item.querySelector('.a-price .a-offscreen');
                const linkElement = item.querySelector('.a-link-normal');
                const isAd = item.querySelector('.puis-label-popover-default') !== null;
                const isRenewed = item.querySelector('[aria-label*="Renovado"]') !== null;

                if (!titleElement || !priceElement || !linkElement || isAd || isRenewed) continue;

                const title = titleElement.innerText.toLowerCase();
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

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        title: titleElement.innerText,
                        price: priceElement.innerText,
                        link: linkElement.href
                    };
                }
            }

            return bestMatch;
        }, query, refurbishedKeywords);

        if (!productFromSearch) return [];

        await page.goto(productFromSearch.link, { waitUntil: 'networkidle2' });

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
                    const color = await normalizeColor(rawColor);

                    const memoryOptions = await page.$$('[id^="size_name_"].text-swatch-button-with-slots');
                    for (let memoryIndex = 0; memoryIndex < memoryOptions.length; memoryIndex++) {
                        const memoryElement = memoryOptions[memoryIndex];
                        if (await memoryElement.isVisible()) {
                            await memoryElement.click();
                            await delay(3000);

                            const memory = normalizeMemory(await safeEval(page, `#size_name_${memoryIndex} .swatch-title-text`, el => el.innerText.trim(), ''));
                            let priceText = await safeEval(page, '.a-price .a-offscreen', el => el.innerText, '');
                            if (!priceText) {
                                priceText = await safeEval(page, '#apex_price .a-price', el => el.innerText, '');
                            }
                            let image = await safeEval(page, '#landingImage', el => el.src, '');
                            if (!image) {
                                image = await safeEval(page, '.a-dynamic-image', el => el.src, '');
                            }
                            const currentUrl = page.url();

                            const price = parsePrice(priceText, ',', '.');
                            if (isNaN(price)) continue;

                            const brand = productFromSearch.title.split(' ')[0];
                            const title = normalizeTitle(brand, query, memory, color);
                            variations.push({ title, price, image, memory, color, url: currentUrl });
                        }
                    }
                }
            }
        }

        if (variations.length === 0) {
            let priceText = await safeEval(page, '.a-price .a-offscreen', el => el.innerText, '');
            if (!priceText) {
                priceText = await safeEval(page, '#apex_price .a-price', el => el.innerText, '');
            }
            let image = await safeEval(page, '#landingImage', el => el.src, '');
            if (!image) {
                image = await safeEval(page, '.a-dynamic-image', el => el.src, '');
            }
            const currentUrl = page.url();

            const price = parsePrice(priceText, ',', '.');
            const titleLower = productFromSearch.title.toLowerCase();
            const memoryMatch = titleLower.match(/\b(\d{2,4}\s?gb|\d\s?tb)\b/i);
            const memory = memoryMatch ? normalizeMemory(memoryMatch[0]) : null;

            let color = null;
            if (colorOptions.length === 0) {
                const rawColor = await safeEval(page, 'tr.po-color td.a-span9 span', el => el.innerText.trim(), '');
                if (rawColor) {
                    color = await normalizeColor(rawColor);
                } else {
                    const colorMatch = titleLower.match(/(white|black|blue|pink|green|yellow|starlight|midnight|multicolor)/i);
                    color = colorMatch ? await normalizeColor(colorMatch[0]) : null;
                }
            }

            const brand = productFromSearch.title.split(' ')[0];
            const title = normalizeTitle(brand, query, memory || '', color || '');

            if (!isNaN(price)) {
                variations.push({ title, price, image, memory, color, url: currentUrl });
            }
        }

        const uniqueVariations = dedupeVariations(variations, v => `${v.title}-${v.memory}-${v.color}`);

        const results = [];

        for (const variation of uniqueVariations) {
            const brand = variation.title.split(' ')[0];
           

 const model = query;
            const priceValue = variation.price;

            if (!brand || !model || !priceValue || priceValue <= 0) continue;

            const productData = {
                brand,
                model,
                memory: variation.memory,
                color: variation.color,
                name: variation.title,
                category: null,
                currency: 'EUR',
                imageUrl: variation.image,
                offers: [{
                    source: 'Amazon',
                    url: variation.url,
                    prices: [{
                        value: priceValue,
                        date: new Date()
                    }],
                    lastUpdated: new Date()
                }],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            results.push(productData);
        }

        return results;

    } catch (error) {
        return [];
    } finally {
        await page.close();
    }
};

module.exports = { scrapeAmazonQuery };