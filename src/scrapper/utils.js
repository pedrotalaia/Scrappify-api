const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let browserInstance;

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
];

const getBrowser = async () => {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browserInstance;
};

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

const acceptCookies = async (page, selector, timeout = 5000) => {
    try {
        await page.waitForSelector(selector, { visible: true, timeout });
        const cookiesButton = await page.$(selector);
        if (cookiesButton) {
            await cookiesButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (e) {}
};

const parsePrice = (priceText) => {
    if (!priceText) return NaN;
    const cleaned = priceText.replace(/[^\d,.]/g, '');
    const parts = cleaned.split(/[,.]/);
    let normalized;
    if (parts.length >= 2) {
        const last = parts.pop();
        const secondLast = parts.pop();
        normalized = `${parts.join('') || '0'}${secondLast}.${last}`;
    } else {
        normalized = cleaned.replace(',', '.');
    }
    const result = parseFloat(normalized);
    return isNaN(result) ? NaN : Math.round(result * 100) / 100;
};

const safeEval = async (page, selector, callback, defaultValue = null) => {
    try {
        return await page.$eval(selector, callback);
    } catch (e) {
        return defaultValue;
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const dedupeVariations = (variations, keyGenerator) => {
    const seen = new Set();
    return variations.filter(variation => {
        const key = keyGenerator(variation);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

module.exports = {
    getBrowser,
    getRandomUserAgent,
    acceptCookies,
    parsePrice,
    safeEval,
    delay,
    dedupeVariations
};