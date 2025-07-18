const express = require('express');
const {
    deleteProduct,
    countTotalProducts,
    searchProduct,
    ProductInfo,
    getProductsWithoutCategory,
    getProductsByCategory,
    assignCategoryToProducts,
    getTrendingProducts,
    getChildrenProducts,
    updateParentId,
    getCategoryByAgeGroup,
    saveProduct
} = require('../controllers/productController');

const { getPriceAnalysis } = require('../controllers/AnalysisController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/save', saveProduct);
router.patch('/:id/parent', updateParentId);
router.get('/:id/children', getChildrenProducts);
router.delete('/:id', deleteProduct);
router.get('/count', countTotalProducts);
router.post('/search', auth, searchProduct);
router.get('/trending', getTrendingProducts);

router.get('/list-no-category', getProductsWithoutCategory);
router.get('/category/:category', getProductsByCategory);
router.post('/assign-category', assignCategoryToProducts);

router.get('/category-by-age', getCategoryByAgeGroup);

router.get('/:id', auth, ProductInfo);
router.get('/:id/analysis', getPriceAnalysis);

module.exports = router;
