const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');
const { parsePrice, dedupeVariations } = require('./utils');
const { normalizeMemory, normalizeColor, normalizeTitle, normalizeUrl } = require('./normalize');

const scrapeFnacQuery = async (query) => {
    if (!query) return [];

    const url = `https://www.fnac.pt/SearchResult/ResultList.aspx?SCat=0!1&Search=${encodeURIComponent(query)}`;
    const browser = await puppeteer.launch({
        headless: false,
        args: []
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'accept-language': 'pt-PT,pt;q=0.9',
        'upgrade-insecure-requests': '1'
    });
    await page.setViewport({ width: 1280, height: 800 });
    await page.setDefaultNavigationTimeout(60000);

    const delay = ms => new Promise(res => setTimeout(res, ms));

    try {
        console.log('pesquisa:', url);
        await page.goto(url, { waitUntil: 'networkidle2' });
        await delay(3000);

        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 150);
            });
        });

        await delay(2000);

        const screenshotPath = path.join(__dirname, 'fnac_search_debug.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(` Screenshot tirado: ${screenshotPath}`);

        const htmlPreview = await page.evaluate(() => document.body.innerHTML.slice(0, 1500));
        console.log(' HTML da página (início):', htmlPreview);

        const debugLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.innerText.trim(),
                href: a.href,
                class: a.className
            })).slice(0, 30);
        });
        console.log('Primeiros <a> encontrados:', debugLinks);

        const firstLink = await page.evaluate(() => {
            const a = document.querySelector('a.Article-title.js-Search-hashLink');
            return a ? a.href : null;
        });

        if (!firstLink) {
            console.log('Nenhum link encontrado.');
            return [];
        }

        console.log('A visitar produto principal:', firstLink);
        await page.goto(firstLink, { waitUntil: 'domcontentloaded' });
        await delay(3000);

        const title = await page.$eval('h1[itemprop="name"]', el => el.innerText).catch(() => '');
        const baseImage = await page.$eval('img[itemprop="image"]', img => img.src).catch(() => '');

        const specs = await page.evaluate(() => {
            const entries = {};
            document.querySelectorAll('.f-productProperties__item').forEach(el => {
                const key = el.querySelector('.f-productProperties__term')?.innerText?.trim().toLowerCase();
                const val = el.querySelector('.f-productProperties__definition')?.innerText?.trim();
                if (key && val) entries[key] = val;
            });
            return entries;
        });

        const brand = specs['marca'] || title.split(' ')[0];
        const model = specs['modelo telemóvel'] || title.replace(brand, '').trim();

        const colorButtons = await page.$$('[data-qa="Cor"] button');
        const memoryButtons = await page.$$('[data-qa="Memoria Interna"] button');

        const results = [];

        for (let i = 0; i < colorButtons.length || i === 0; i++) {
            if (colorButtons.length) {
                await colorButtons[i].click();
                await delay(1000);
            }

            const currentColor = await page.evaluate(() => {
                const active = document.querySelector('[data-qa="Cor"] button[aria-pressed="true"]');
                return active ? active.innerText.trim() : '';
            });

            for (let j = 0; j < memoryButtons.length || j === 0; j++) {
                if (memoryButtons.length) {
                    await memoryButtons[j].click();
                    await delay(1000);
                }

                const currentMemory = await page.evaluate(() => {
                    const active = document.querySelector('[data-qa="Memoria Interna"] button[aria-pressed="true"]');
                    return active ? active.innerText.trim() : '';
                });

                const priceText = await page.$eval('.f-priceBox-price', el => el.innerText).catch(() => '');
                const price = parsePrice(priceText);

                const memory = normalizeMemory(currentMemory);
                const color = normalizeColor(currentColor);
                const name = normalizeTitle(brand, model, memory, color);

                if (!isNaN(price) && name) {
                    results.push({
                        brand,
                        model,
                        memory,
                        color,
                        name,
                        category: null,
                        currency: 'EUR',
                        imageUrl: baseImage,
                        offers: [
                            {
                                source: 'FNAC',
                                url: normalizeUrl(firstLink),
                                prices: [
                                    {
                                        value: price,
                                        date: new Date()
                                    }
                                ],
                                lastUpdated: new Date()
                            }
                        ],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
            }
        }

        console.log(`Produtos finais extraídos: ${results.length}`);
        return dedupeVariations(results, p => `${p.name}-${p.memory}-${p.color}`);
    } catch (err) {
        console.error('Erro:', err.message);
        return [];
    } finally {
        await page.close();
    }
};

module.exports = { scrapeFnacQuery };
