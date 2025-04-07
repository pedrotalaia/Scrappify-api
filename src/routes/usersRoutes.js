const express = require('express');
const { registerUser, deleteUser, updateUser, changePassword, updateUserPlan } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerUser);
router.put('/changepassword', auth, changePassword); 
router.put('/plan', auth, updateUserPlan);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;