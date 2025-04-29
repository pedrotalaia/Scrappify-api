const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { scrapeAmazonQuery } = require('./amazon');
const { normalizeUrl } = require('./normalize');
const translate = require('google-translate-api-x');


const scrapeProductPriceByQuery = async (query, stores) => {

    let translatedQuery;
    try {
        const translation = await translate(query, { from: 'pt', to: 'es' });
        translatedQuery = translation.text;
    } catch (error) {
        console.error('Erro ao traduzir query:', error);
        translatedQuery = query;
    }

    const results = [];
    if (stores.includes('Amazon')) {
        const amazonResults = await scrapeAmazonQuery(translatedQuery) || []; 
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
        const wortenResults = await scrapeWortenQuery(translatedQuery) || [];
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
    return results;
};

const scrapeFnacQuery = async (query) => { return null; };
const scrapeWortenQuery = async (query) => { return null; };

module.exports = { scrapeProductPriceByQuery };