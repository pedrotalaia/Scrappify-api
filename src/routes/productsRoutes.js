const express = require('express');
const { saveOrUpdateProduct, deleteProduct, countTotalProducts, searchProduct, ProductInfo, getProductsWithoutCategory, getProductsByCategory, assignCategoryToProducts } = require('../controllers/productController');
const { getPriceAnalysis } = require('../controllers/AnalysisController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/save', saveOrUpdateProduct);
router.delete(':id', deleteProduct);
router.get('/count', countTotalProducts);
router.post('/search', auth, searchProduct );
router.get('/:id', ProductInfo);

router.get('/no-category', getProductsWithoutCategory);
router.get('/category/:category', getProductsByCategory);
router.post('/assign-category', assignCategoryToProducts);

router.get('/:id/analysis', getPriceAnalysis);

module.exports = router;