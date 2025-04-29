const express = require('express');
const { saveOrUpdateProduct, deleteProduct, countTotalProducts, searchProduct, ProductInfo } = require('../controllers/productController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/save', saveOrUpdateProduct);
router.delete(':id', deleteProduct);
router.get('/count', countTotalProducts);
router.post('/search', auth, searchProduct );
router.get('/:id', ProductInfo);

module.exports = router;