const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { normalizeString, getBrowser, getRandomUserAgent, acceptCookies, delay } = require('./utils');
const { normalizeColor } = require('./normalize');

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
    if (matches === 0) score = 1;
    else if (ratio < 0.5) score -= 10;

    return score;
};
const scrapeMediaMarktQuery = async (query, debug = false) => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setUserAgent(getRandomUserAgent());
        await page.setDefaultNavigationTimeout(60000);
        const searchUrl = `https://www.mediamarkt.es/es/search.html?query=${encodeURIComponent(query)}`;
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        await acceptCookies(page, 'button#onetrust-accept-btn-handler');
        await delay(3000);
        
        const productOptions = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('article[data-test="mms-product-card"]')).slice(0, 10).map(el => {
                const titleEl = el.querySelector('[data-test="product-title"]');
                const linkEl = el.querySelector('a[data-test="mms-router-link-product-list-item-link"]');
                return titleEl && linkEl ? { title: titleEl.innerText.trim(), url: linkEl.href } : null;
            }).filter(Boolean);
        });
        if (!productOptions.length) throw new Error('Nenhum produto encontrado');
        
        productOptions.forEach(p => {
            p._score = computeRelevanceScore(p.title, query);
        });

        productOptions.sort((a, b) => b._score - a._score);
        const bestProduct = productOptions[0];
        const productUrl = bestProduct.url;

        await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
        await delay(2000);
        
        const bestProductUrl = page.url();
        await page.waitForSelector('[data-test="product-title"]', { timeout: 10000 });
        
        await delay(3000);
        const marca = await page.$eval('[data-test="mms-router-link"] span', el => el.innerText.trim());
        
        const variacoes = await page.evaluate(() => {
            const corLinks = Array.from(document.querySelectorAll('[data-test="mms-pdp-variants-color"] a')).map(a => ({
                cor: a.getAttribute('aria-label')?.trim(),
                url: a.href
            }));
            const memoriaLinks = Array.from(document.querySelectorAll('[data-test="mms-pdp-variants"] [title$="GB"]')).map(span => ({
                memoria: span.title.trim(),
                url: span.closest('a')?.href
            }));
            const modeloLinks = Array.from(document.querySelectorAll('[data-test="mms-pdp-variants"] [title^="iPhone"]')).map(span => ({
                modelo: span.title.trim(),
                url: span.closest('a')?.href
            }));
            const todas = new Set([
                ...corLinks.map(v => v.url),
                ...memoriaLinks.map(v => v.url),
                ...modeloLinks.map(v => v.url)
            ]);
            return Array.from(todas);
        });
        if (variacoes.length === 0) {
    
        const isRecondicionado = await page.evaluate(() => {
            return !!document.querySelector('p.sc-d571b66f-0.dsHgIL');
        });
        if (isRecondicionado) {
            
            return [];
        }
        
        const nome = bestProduct.title;
        const imageUrl = await page.$eval('picture[data-test="product-image"] img', el => el.src);
        const precoRaw = await page.evaluate(() => {
            const precoEl = document.querySelector('[data-test="branded-price-whole-value"]');
            const decimalEl = document.querySelector('[data-test="branded-price-decimal-value"]');
            if (!precoEl || !decimalEl) return null;
            const inteiro = precoEl.innerText.replace(/[^0-9]/g, '');
            const decimal = decimalEl.innerText.replace(/[^0-9]/g, '');
            return parseFloat(`${inteiro}.${decimal || '00'}`);
        });
        if (!precoRaw) {
            
            return [];
        }
        const preco = precoRaw;
        const caracteristicas = await page.evaluate(() => {
            const dados = {};
            const tabelas = document.querySelectorAll('#features-content table');
            tabelas.forEach(tabela => {
                tabela.querySelectorAll('tr').forEach(tr => {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length === 2) {
                        const chave = tds[0].innerText.trim();
                        const valor = tds[1].innerText.trim();
                        dados[chave] = valor;
                    }
                });
            });
            return dados;
        });
        const memoria = caracteristicas['Capacidad memoria'] || null;
        const corOriginal = caracteristicas['Color (por fabricante)'] || null;
        const cor = normalizeColor(corOriginal);
        const modelo = nome.toLowerCase().startsWith(marca.toLowerCase())
            ? nome.slice(marca.length).split(',')[0].trim()
            : nome.split(',')[0].trim();
        const result = {
            brand: marca,
            model: modelo,
            memory: memoria,
            color: cor,
            name: nome,
            category: null,
            currency: 'EUR',
            imageUrl,
            offers: [{
                source: 'MediaMarkt',
                url: bestProductUrl,
                prices: [{ value: preco }],
                lastUpdated: new Date()
            }]
        };
        
        return [result];
    }
        const results = [];
        for (const url of variacoes) {
            try {
                
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await delay(2000);
                const isRecondicionado = await page.evaluate(() => {
                    return !!document.querySelector('p.sc-d571b66f-0.dsHgIL');
                });
                if (isRecondicionado) {
                    
                    continue;
                }
                const nome = await page.$eval('[data-test="product-title"]', el => el.innerText.trim());
                const imageUrl = await page.$eval('picture[data-test="product-image"] img', el => el.src);
                const precoRaw = await page.evaluate(() => {
                    const precoEl = document.querySelector('[data-test="branded-price-whole-value"]');
                    const decimalEl = document.querySelector('[data-test="branded-price-decimal-value"]');
                    if (!precoEl || !decimalEl) return null;
                    const inteiro = precoEl.innerText.replace(/[^0-9]/g, '');
                    const decimal = decimalEl.innerText.replace(/[^0-9]/g, '');
                    return parseFloat(`${inteiro}.${decimal || '00'}`);
                });
                if (!precoRaw) {
                    
                    continue;
                }
                const preco = precoRaw;
                const caracteristicas = await page.evaluate(() => {
                    const dados = {};
                    const tabelas = document.querySelectorAll('#features-content table');
                    tabelas.forEach(tabela => {
                        tabela.querySelectorAll('tr').forEach(tr => {
                            const tds = tr.querySelectorAll('td');
                            if (tds.length === 2) {
                                const chave = tds[0].innerText.trim();
                                const valor = tds[1].innerText.trim();
                                dados[chave] = valor;
                            }
                        });
                    });
                    return dados;
                });
                const memoria = caracteristicas['Capacidad memoria'] || null;
                const corOriginal = caracteristicas['Color (por fabricante)'] || null;
                const cor = normalizeColor(corOriginal);
                const modelo = nome.toLowerCase().startsWith(marca.toLowerCase())
                    ? nome.slice(marca.length).split(',')[0].trim()
                    : nome.split(',')[0].trim();
                results.push({
                    brand: marca,
                    model: modelo,
                    memory: memoria,
                    color: cor,
                    name: nome,
                    category: null,
                    currency: 'EUR',
                    imageUrl,
                    offers: [{
                        source: 'MediaMarkt',
                        url,
                        prices: [{ value: preco }],
                        lastUpdated: new Date()
                    }]
                });
            } catch (err) {
                console.warn(`Erro ao processar variação: ${url} => ${err.message}`);
            }
        }
        
        
        return results;
    } catch (error) {
        console.error('Erro geral:', error.message);
        return [];
    } finally {
        await page.close();
    }
};
module.exports = { scrapeMediaMarktQuery };
