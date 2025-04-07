const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const Product = require('../models/Product');

const scrapeProductPriceByQuery = async (query, stores) => {
    const results = [];
    if (stores.includes('Amazon')) {
        const result = await scrapeAmazonQuery(query);
        if (result) results.push(result);
    }
    if (stores.includes('Fnac')) {
        const result = await scrapeFnacQuery(query);
        if (result) results.push(result);
    }
    if (stores.includes('Worten')) {
        const result = await scrapeWortenQuery(query);
        if (result) results.push(result);
    }
    return results;
};

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
        const cookiesButton = await page.$(acceptCookiesSelector);
        if (cookiesButton) {
            await cookiesButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

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

            if (bestMatch) {
                const titleLower = bestMatch.title.toLowerCase();
                const isBestMatchRefurbished = refurbishedKeywords.some(keyword => titleLower.includes(keyword));
                if (isBestMatchRefurbished) {
                    return null;
                }
            }

            return bestMatch;
        }, query, refurbishedKeywords);

        if (!productFromSearch) {
            return null;
        }

        await page.goto(productFromSearch.link, { waitUntil: 'networkidle2' });

        let productDetails = {};
        const overviewExists = await page.$('#productOverview_feature_div');
        if (overviewExists) {
            productDetails = await page.evaluate(() => {
                const overview = document.querySelector('#productOverview_feature_div');
                const details = {};
                if (overview) {
                    const rows = overview.querySelectorAll('.a-row');
                    rows.forEach(row => {
                        const key = row.querySelector('.a-text-bold')?.innerText.trim();
                        const value = row.querySelector('.a-span-last')?.innerText.trim();
                        if (key && value) {
                            details[key] = value;
                        }
                    });
                }
                return details;
            });
        } else {
            const detailsExists = await page.$('#productDetails_detailBullets_sections1');
            if (detailsExists) {
                productDetails = await page.evaluate(() => {
                    const detailsTable = document.querySelector('#productDetails_detailBullets_sections1');
                    const details = {};
                    if (detailsTable) {
                        const rows = detailsTable.querySelectorAll('tr');
                        rows.forEach(row => {
                            const key = row.querySelector('th')?.innerText.trim();
                            const value = row.querySelector('td')?.innerText.trim();
                            if (key && value) {
                                details[key] = value;
                            }
                        });
                    }
                    return details;
                });
            }
        }

        const imageUrl = await page.evaluate(() => {
            const imgElement = document.querySelector('#landingImage');
            return imgElement ? imgElement.src : null;
        });

        const titleParts = productFromSearch.title.split(' ');
        const brand = titleParts[0];
        const model = query;
        let memory = null;
        let color = null;

        const titleLower = productFromSearch.title.toLowerCase();
        const memoryMatch = titleLower.match(/\b(\d{1,3}\s?(gb|tb))\b/i);
        if (memoryMatch) memory = memoryMatch[0].toUpperCase();

        const colors = ['negro', 'blanco', 'azul', 'rojo', 'plata', 'oro', 'gris', 'verde'];
        color = colors.find(c => titleLower.includes(c)) || null;

        if (!memory && productDetails['Capacidad de almacenamiento']) {
            memory = productDetails['Capacidad de almacenamiento'];
        } else if (!memory && productDetails['Tamaño']) {
            memory = productDetails['Tamaño'];
        }
        if (!color && productDetails['Color']) {
            color = productDetails['Color'];
        }

        const priceValue = parseFloat(productFromSearch.price.replace(/[^\d,]/g, '').replace(',', '.'));

        if (!brand || !model || !priceValue || priceValue <= 0) {
            return null;
        }

        const productData = {
            brand,
            model,
            memory,
            color,
            name: productFromSearch.title,
            category: null,
            currency: 'EUR',
            imageUrl,
            offers: [{
                source: 'Amazon',
                url: productFromSearch.link,
                prices: [{
                    value: priceValue,
                    date: new Date()
                }],
                lastUpdated: new Date()
            }],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const product = new Product(productData);
        await product.save();

        return productData;

    } catch (error) {
        return null;
    } finally {
        await page.close();
    }
};

const scrapeFnacQuery = async (query) => { return null; };
const scrapeWortenQuery = async (query) => { return null; };

module.exports = {
    scrapeAmazonQuery,
    scrapeProductPriceByQuery
};
