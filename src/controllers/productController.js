const Product = require('../models/Product');

const saveOrUpdateProduct = async (req, res) => {
  const { name, source, url, price, category, currency, imageUrl } = req.body;

  try {
    let product = await Product.findOne({ url });

    if (product) {
      product.prices.push({ value: price });
      product.updatedAt = Date.now();
      await product.save();
      return res.json({ msg: 'Preço atualizado', product });
    }

    product = new Product({
      name,
      source,
      url,
      prices: [{ value: price }],
      category,
      currency,
      imageUrl
    });

    await product.save();
    res.status(201).json({ msg: 'Produto criado', product });
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

module.exports = { saveOrUpdateProduct, deleteProduct};