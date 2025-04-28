const router        = require('express').Router();
const {authorize}   = require('../middleware/auth');
const controllers = require('../controllers/jvCreationController');
const multer = require('../middleware/multer');

router.route('/')
.get(authorize, controllers.getPaginatedJVDraftBill);

router.route('/generate')
.post(authorize, controllers.generateJV)

module.exports = router;

