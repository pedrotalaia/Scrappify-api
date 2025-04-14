const express = require('express');
const { saveOrUpdateProduct, deleteProduct, countTotalProducts, searchProduct } = require('../controllers/productController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/save', saveOrUpdateProduct);
router.delete(':id', deleteProduct);
router.get('/count', countTotalProducts);
router.post('/search', auth, searchProduct );

module.exports = router;