const Product = require('../models/Product');
const { checkAndTriggerAlerts } = require('./alertController');
const { normalizeUrl, extractColorFromQuery } = require('../scrapper/normalize');
const { scrapeProductPriceByQuery } = require('../scrapper/index');

const saveProduct = async (productData) => {
    const { name, source, url, price, brand, model, memory, color, category, currency, imageUrl } = productData;
    const normalizedUrl = normalizeUrl(url);

    let product = await Product.findOne(
        { brand, model, memory, color }
    ).collation({ locale: 'en', strength: 2 });

    const newOffer = {
        source,
        url: normalizedUrl,
        prices: [{ value: price, date: Date.now() }],
        lastUpdated: Date.now()
    };

    if (product) {
        const offerIndex = product.offers.findIndex(o => o.source === source);

        if (offerIndex >= 0) {
            if (product.offers[offerIndex].url !== normalizedUrl) {
                product.offers[offerIndex].url = normalizedUrl;
            }
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
        return res.status(400).json({ msg: 'Query and stores are required' });
    }

    if (userPlan === 'freemium' && stores.length > 1) {
        return res.status(400).json({ msg: 'Freemium plan allows only one store' });
    }

    try {
        let normalizedQuery = query.trim().toLowerCase();

        const searchTerms = normalizedQuery.split(' ').filter(Boolean);
        const regexQueries = searchTerms.map(term => ({
            $or: [
                { model: { $regex: term, $options: 'i' } },
                { name: { $regex: term, $options: 'i' } },
                { color: { $regex: term, $options: 'i' } },
                { brand: { $regex: term, $options: 'i' } }
            ]
        }));

        const allProducts = await Product.find({ $and: regexQueries });

        const existingProducts = [];
        const storesToScrape = new Set(stores);

        for (const product of allProducts) {
            let productHasAnyRequestedStore = false;
            for (const offer of product.offers) {
                if (stores.includes(offer.source)) {
                    storesToScrape.delete(offer.source);
                    productHasAnyRequestedStore = true;
                }
            }
            if (productHasAnyRequestedStore) {
                existingProducts.push(product);
            }
        }

        const scrapedResults = storesToScrape.size > 0
            ? await scrapeProductPriceByQuery(normalizedQuery, Array.from(storesToScrape))
            : [];

        const savedResults = [];
        for (const result of scrapedResults) {
            const savedProduct = await saveProduct(result);
            savedResults.push(savedProduct);
        }

        if (savedResults.length === 0 && existingProducts.length === 0) {
            return res.status(404).json({ msg: 'No products found' });
        }

        const finalProducts = [
            ...existingProducts,
            ...savedResults.filter(r => !existingProducts.some(p => p._id.equals(r._id)))
        ];

        return res.json({
            msg: 'Products found',
            products: finalProducts
        });

    } catch (error) {
        console.error('[ERROR] searchProduct:', error.message);
        return res.status(500).json({ msg: 'Error searching product', error: error.message });
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

const getProductsWithoutCategory = async (req, res) => {
    try {
        const products = await Product.find({ category: { $in: [null, ''] } });
        res.json(products);
    } catch (err) {
        res.status(500).json({ msg: 'Erro ao obter produtos sem categoria', error: err.message });
    }
};

const getProductsByCategory = async (req, res) => {
    const { category } = req.params;
    try {
        const products = await Product.find({ category });
        res.json(products);
    } catch (err) {
        res.status(500).json({ msg: 'Erro ao obter produtos da categoria', error: err.message });
    }
};

const assignCategoryToProducts = async (req, res) => {
    const { productIds, category } = req.body;

    if (!Array.isArray(productIds) || !category) {
        return res.status(400).json({ msg: 'IDs dos produtos e categoria são obrigatórios' });
    }

    try {co
        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            { $set: { category, updatedAt: Date.now() } }
        );
        res.json({ msg: 'Categoria atribuída com sucesso', modifiedCount: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ msg: 'Erro ao atualizar os produtos', error: err.message });
    }
};

module.exports = {
    saveOrUpdateProduct,
    deleteProduct,
    countTotalProducts,
    searchProduct,
    saveProduct,
    ProductInfo,
    getProductsWithoutCategory,
    getProductsByCategory,
    assignCategoryToProducts
};