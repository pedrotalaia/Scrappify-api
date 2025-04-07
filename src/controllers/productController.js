const Product = require('../models/Product');
const { checkAndTriggerAlerts } = require('./alertController');

const saveOrUpdateProduct = async (req, res) => {
    try {
        const product = await saveProduct(req.body);
        res.status(product.updatedAt ? 200 : 201).json({
            msg: product.updatedAt ? 'Produto atualizado' : 'Produto criado',
            product
        });
    } catch (err) {
        res.status(500).json({ msg: 'Erro no servidor', error: err.message });
    }
};

const saveProduct = async (productData) => {
    const { name, source, url, price, brand, model, memory, color, category, currency, imageUrl } = productData;
    let product = await Product.findOne({ name: { $regex: name, $options: 'i' } });
    const newOffer = { source, url, prices: [{ value: price, date: Date.now() }], lastUpdated: Date.now() };

    if (product) {
        const offerIndex = product.offers.findIndex(o => o.url === url);
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
    const { query, stores } = req.body;
    if (!query || !stores || !Array.isArray(stores)) {
        return res.status(400).json({ msg: 'query e stores são obrigatórios' });
    }

    try {
        const existingProduct = await Product.findOne({ name: { $regex: query, $options: 'i' } });
        const savedProducts = [];

        if (existingProduct) {
            const existingStores = existingProduct.offers.map(offer => offer.source);
            const storesToScrape = stores.filter(store => !existingStores.includes(store));
            savedProducts.push(existingProduct);

            if (storesToScrape.length === 0) {
                return res.json({ msg: 'Produto já existe na base de dados', products: savedProducts });
            }

            const results = await scrapeProductPriceByQuery(query, storesToScrape);
            for (const result of results) {
                const product = await saveProduct({
                    name: query,
                    source: result.source,
                    url: result.url,
                    price: result.price,
                    brand: result.brand || 'Desconhecido',
                    model: result.model || query,
                    memory: result.memory || '',
                    color: result.color || '',
                    category: result.category || '',
                    imageUrl: result.imageUrl || ''
                });
                if (!savedProducts.some(p => p._id.equals(product._id))) {
                    savedProducts.push(product);
                }
            }
        } else {
            const results = await scrapeProductPriceByQuery(query, stores);
            if (results.length === 0) return res.status(404).json({ msg: 'Nenhum preço encontrado' });

            for (const result of results) {
                const product = await saveProduct({
                    name: query,
                    source: result.source,
                    url: result.url,
                    price: result.price,
                    brand: result.brand || 'Desconhecido',
                    model: result.model || query,
                    memory: result.memory || '',
                    color: result.color || '',
                    category: result.category || '',
                    imageUrl: result.imageUrl || ''
                });
                savedProducts.push(product);
            }
        }

        res.json({ msg: 'Produtos encontrados e salvos', products: savedProducts });
    } catch (error) {
        res.status(500).json({ msg: 'Erro ao pesquisar produto', error: error.message });
    }
};

module.exports = { 
    saveOrUpdateProduct, 
    deleteProduct,
    countTotalProducts,
    searchProduct
 };