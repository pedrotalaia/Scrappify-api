const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { normalizeColor, normalizeMemory, normalizeTitle } = require('./normalize');

let browserInstance;
const getBrowser = async () => {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browserInstance;
};

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
];

const scrapeAmazonQuery = async (query) => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        await page.setDefaultNavigationTimeout(60000);

        const searchUrl = `https://www.amazon.es/s?k=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        const acceptCookiesSelector = '#sp-cc-accept';
        try {
            await page.waitForSelector(acceptCookiesSelector, { visible: true, timeout: 5000 });
            const cookiesButton = await page.$(acceptCookiesSelector);
            if (cookiesButton) {
                await cookiesButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (e) {}

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
        const seenVariations = new Set();

        const colorOptions = await page.$$('[id^="color_name_"].image-swatch-button');
        if (colorOptions.length > 0) {
            for (let colorIndex = 0; colorIndex < colorOptions.length; colorIndex++) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const colorElement = colorOptions[colorIndex];
                    if (await colorElement.isVisible()) {
                        await colorElement.click();
                        await new Promise(resolve => setTimeout(resolve, 3000));

                        const color = normalizeColor(await page.$eval(`#color_name_${colorIndex} img.swatch-image`, el => el.alt.trim()));

                        const memoryOptions = await page.$$('[id^="size_name_"].text-swatch-button-with-slots');
                        for (let memoryIndex = 0; memoryIndex < memoryOptions.length; memoryIndex++) {
                            try {
                                const memoryElement = memoryOptions[memoryIndex];
                                if (await memoryElement.isVisible()) {
                                    await memoryElement.click();
                                    await new Promise(resolve => setTimeout(resolve, 3000));

                                    const memory = normalizeMemory(await page.$eval(`#size_name_${memoryIndex} .swatch-title-text`, el => el.innerText.trim()));
                                    let priceText;
                                    try {
                                        priceText = await page.$eval('.a-price .a-offscreen', el => el.innerText);
                                    } catch (e) {
                                        priceText = await page.$eval('#apex_price .a-price', el => el.innerText);
                                    }
                                    let image;
                                    try {
                                        image = await page.$eval('#landingImage', el => el.src);
                                    } catch (e) {
                                        image = await page.$eval('.a-dynamic-image', el => el.src);
                                    }
                                    const currentUrl = page.url();

                                    const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'));
                                    if (isNaN(price)) continue;

                                    const brand = productFromSearch.title.split(' ')[0];
                                    const title = normalizeTitle(brand, query, memory, color);
                                    const variationKey = `${title}-${memory}-${color}`;
                                    if (!seenVariations.has(variationKey)) {
                                        seenVariations.add(variationKey);
                                        variations.push({ title, price, image, memory, color, url: currentUrl });
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                } catch (e) {}
            }
        }

        if (variations.length === 0) {
            let priceText;
            try {
                priceText = await page.$eval('.a-price .a-offscreen', el => el.innerText);
            } catch (e) {
                priceText = await page.$eval('#apex_price .a-price', el => el.innerText);
            }
            let image;
            try {
                image = await page.$eval('#landingImage', el => el.src);
            } catch (e) {
                image = await page.$eval('.a-dynamic-image', el => el.src);
            }
            const currentUrl = page.url();

            const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'));
            const titleLower = productFromSearch.title.toLowerCase();
            const memoryMatch = titleLower.match(/\b(\d{2,4}\s?gb|\d\s?tb)\b/i);
            const memory = memoryMatch ? normalizeMemory(memoryMatch[0]) : null;

            let color = null;
            if (colorOptions.length === 0) {
                try {
                    color = normalizeColor(await page.$eval('tr.po-color td.a-span9 span', el => el.innerText.trim()));
                } catch (e) {
                    const colorMatch = titleLower.match(/(white|black|blue|pink|green|yellow|starlight|midnight|multicolor)/i);
                    color = colorMatch ? normalizeColor(colorMatch[0]) : null;
                }
            }

            const brand = productFromSearch.title.split(' ')[0];
            const title = normalizeTitle(brand, query, memory || '', color || '');

            if (!isNaN(price)) {
                const variationKey = `${title}-${memory || ''}-${color || ''}`;
                if (!seenVariations.has(variationKey)) {
                    seenVariations.add(variationKey);
                    variations.push({ title, price, image, memory, color, url: currentUrl });
                }
            }
        }

        const results = [];

        for (const variation of variations) {
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