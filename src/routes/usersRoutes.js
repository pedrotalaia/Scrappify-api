const express = require('express');
const { registerUser, deleteUser, updateUser, changePassword, updateUserPlan, registerToken } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerUser);
router.put('/changepassword', auth, changePassword); 
router.put('/plan', auth, updateUserPlan);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

router.post('/register-token', auth, registerToken)

module.exports = router;