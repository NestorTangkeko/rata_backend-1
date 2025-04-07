const router = require('express').Router();
const controller = require('../controllers/authController')
const {authorize, revokeAccess, lockAccount} = require('../middleware/auth');

router.get('/',authorize,controller.authAccess);
router.put('/', authorize, controller.updateUser);

router.post('/login', controller.login);
router.post('/logout',controller.logout, lockAccount);
router.post('/forgot-password', controller.forgotPassword, revokeAccess)

router.get('/session', authorize, controller.session);

module.exports = router