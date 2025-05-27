const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { scrapeAmazonQuery } = require('./amazon');
const { scrapeWortenQuery } = require('./worten');
const { scrapeFnacQuery } = require('./fnac');
const { scrapeAliExpressQuery } = require('./aliexpress');
const { scrapeMediaMarktQuery } = require('./mediamarket');
const { normalizeUrl } = require('./normalize');

const scrapeProductPriceByQuery = async (query, stores) => {
    const results = [];
    if (stores.includes('Amazon')) {
        const amazonResults = await scrapeAmazonQuery(query) || [];
        for (const result of amazonResults) {
            const normalizedUrl = normalizeUrl(result.offers[0].url);
            const productData = {
                name: result.name,
                source: result.offers[0].source,
                url: normalizedUrl,
                price: result.offers[0].prices[0].value,
                brand: result.brand,
                model: result.model,
                memory: result.memory,
                color: result.color,
                category: result.category,
                currency: result.currency,
                imageUrl: result.imageUrl
            };
            results.push(productData);
        }
    }
    if (stores.includes('Fnac')) {
        const fnacResults = await scrapeFnacQuery(query) || [];
        for (const result of fnacResults) {
            const normalizedUrl = normalizeUrl(result.offers[0].url);
            const productData = {
                name: result.name,
                source: result.offers[0].source,
                url: normalizedUrl,
                price: result.offers[0].prices[0].value,
                brand: result.brand,
                model: result.model,
                memory: result.memory,
                color: result.color,
                category: result.category,
                currency: result.currency,
                imageUrl: result.imageUrl
            };
            results.push(productData);
        }
    }
    if (stores.includes('Worten')) {
        const wortenResults = await scrapeWortenQuery(query) || [];
        for (const result of wortenResults) {
            const normalizedUrl = normalizeUrl(result.offers[0].url);
            const productData = {
                name: result.name,
                source: result.offers[0].source,
                url: normalizedUrl,
                price: result.offers[0].prices[0].value,
                brand: result.brand,
                model: result.model,
                memory: result.memory,
                color: result.color,
                category: result.category,
                currency: result.currency,
                imageUrl: result.imageUrl
            };
            results.push(productData);
        }
    }
    if (stores.includes('MediaMarket')) {
        const MediaResults = await scrapeMediaMarktQuery(query) || [];
        for (const result of MediaResults) {
            const normalizedUrl = normalizeUrl(result.offers[0].url);
            const productData = {
                name: result.name,
                source: result.offers[0].source,
                url: normalizedUrl,
                price: result.offers[0].prices[0].value,
                brand: result.brand,
                model: result.model,
                memory: result.memory,
                color: result.color,
                category: result.category,
                currency: result.currency,
                imageUrl: result.imageUrl
            };
            results.push(productData);
        }
    }
    return results;
};

module.exports = { scrapeProductPriceByQuery };