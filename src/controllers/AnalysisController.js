const Product = require('../models/Product');

const getPriceAnalysis = async (req, res) => {
    const productId = req.params.id;

    try {
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });

        const allPrices = product.offers.flatMap(offer =>
            offer.prices.map(p => ({ value: p.value, date: p.date }))
        );

        if (allPrices.length === 0) return res.status(400).json({ msg: 'Produto sem preços registados' });

        const prices = allPrices.map(p => p.value).sort((a, b) => a - b);
        const dates = allPrices.map(p => ({ date: p.date, price: p.value })).sort((a, b) => new Date(a.date) - new Date(b.date));

        const average = prices.reduce((sum, val) => sum + val, 0) / prices.length;
        const stdDev = Math.sqrt(prices.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / prices.length);

        const percentile = (arr, p) => {
            const index = (p / 100) * (arr.length - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            if (lower === upper) return arr[lower];
            return arr[lower] + (arr[upper] - arr[lower]) * (index - lower);
        };

        const analysis = {
            average: Math.round(average * 100) / 100,
            stdDev: Math.round(stdDev * 100) / 100,
            min: prices[0],
            max: prices[prices.length - 1],
            p25: percentile(prices, 25),
            p50: percentile(prices, 50),
            p75: percentile(prices, 75),
            priceHistory: dates
        };

        res.json({ productId, analysis });
    } catch (err) {
        res.status(500).json({ msg: 'Erro ao calcular análise de preços', error: err.message });
    }
};

module.exports = { getPriceAnalysis };
