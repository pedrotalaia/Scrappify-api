const express = require('express');
const { saveOrUpdateProduct, deleteProduct, countTotalProducts } = require('../controllers/productController');

const router = express.Router();

router.post('/save', saveOrUpdateProduct);
router.delete(':id', deleteProduct);
router.get('/count', countTotalProducts);

module.exports = router;