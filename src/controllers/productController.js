const Product = require('../models/Product');
const { checkAndTriggerAlerts } = require('./alertController');
const { normalizeUrl } = require('../scrapper/normalize');
const { scrapeProductPriceByQuery } = require('../scrapper/index');

const saveProduct = async (productData) => {
    const { name, source, url, price, brand, model, memory, color, category, currency, imageUrl } = productData;
    const normalizedUrl = normalizeUrl(url);
    let product = await Product.findOne({ brand, model, memory, color });
    const newOffer = { source, url: normalizedUrl, prices: [{ value: price, date: Date.now() }], lastUpdated: Date.now() };

    if (product) {
        const offerIndex = product.offers.findIndex(o => o.url === normalizedUrl);
        if (offerIndex >= 0) {
            product.offers[offerIndex].prices.push({ value: price, date: Date.now() });
            product.offers[offerIndex].lastUpdated = Date.now();
        } else {
            product.offers.push(newOffer);
        }
        product.updatedAt = Date.now();
    } else {
        product = new Product({
            brand,
            model,
            memory,
            color,
            name,
            offers: [newOffer],
            category,
            currency: currency || 'EUR',
            imageUrl
        });
    }
    await product.save();
    await checkAndTriggerAlerts(product._id, price);
    return product;
};

const saveOrUpdateProduct = async (req, res) => {
    try {
        const { price } = req.body;
        if (!price || isNaN(price) || price <= 0) throw new Error('Preço inválido');
        const product = await saveProduct(req.body);
        res.status(product.updatedAt ? 200 : 201).json({
            msg: product.updatedAt ? 'Produto atualizado' : 'Produto criado',
            product
        });
    } catch (err) {
        res.status(500).json({ msg: 'Erro no servidor', error: err.message });
    }
};

const deleteProduct = async (req, res) => {
    const productId = req.params.id;

    try {
        const product = await Product.findByIdAndDelete(productId);
        if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });
        res.json({ msg: 'Produto eliminado' });
    } catch (err) {
        res.status(500).json({ msg: 'Erro no servidor', error: err.message });
    }
};

const countTotalProducts = async (req, res) => {
    try {
        const countTotal = await Product.countDocuments();
        res.json({ count: countTotal });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

const searchProduct = async (req, res) => {
    const userPlan = req.user.plan;
    const { query, stores } = req.body;

    if (!query || !stores || !Array.isArray(stores)) {
        return res.status(400).json({ msg: 'Query e stores são obrigatórios' });
    }

    if (userPlan === 'freemium' && stores.length > 1) {
        return res.status(400).json({ msg: 'Só podes escolher 1 loja devido ao teu plano Free' });
    }

    try {
        const normalizedQuery = query.trim().toLowerCase();

        const existingProducts = await Product.find({
            model: { $regex: normalizedQuery, $options: 'i' }
        });

        const storesToScrape = new Set(stores);
        if (existingProducts.length > 0) {
            for (const product of existingProducts) {
                for (const offer of product.offers) {
                    storesToScrape.delete(offer.source);
                }
            }
            if (storesToScrape.size === 0) {
                return res.json({
                    msg: 'Produtos encontrados na base de dados',
                    products: existingProducts
                });
            }
        }

        const scrapedResults = await scrapeProductPriceByQuery(query, Array.from(storesToScrape.size > 0 ? storesToScrape : stores));

        const savedResults = [];
        for (const result of scrapedResults) {
            const savedProduct = await saveProduct(result);
            savedResults.push(savedProduct);
        }

        if (savedResults.length === 0 && existingProducts.length === 0) {
            return res.status(404).json({ msg: 'Nenhum produto encontrado' });
        }

        const finalProducts = [
            ...existingProducts,
            ...savedResults.filter(r => !existingProducts.some(p => p._id.equals(r._id)))
        ];

        return res.json({
            msg: 'Produtos encontrados',
            products: finalProducts
        });

    } catch (error) {
        console.error('Erro ao pesquisar produto:', error);
        return res.status(500).json({ msg: 'Erro ao pesquisar produto', error: error.message });
    }
};

const ProductInfo = async (req, res) => {
    const productId = req.params.id;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ msg: 'Produto não encontrado' });
        }

        return res.json({ product });
    } catch (err) {
        return res.status(500).json({ msg: 'Erro ao obter informação do produto', error: err.message });
    }
};

module.exports = { 
    saveOrUpdateProduct, 
    deleteProduct,
    countTotalProducts,
    searchProduct,
    saveProduct,
    ProductInfo
};