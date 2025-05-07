const router        = require('express').Router();
const {authorize}   = require('../middleware/auth');
const controllers = require('../controllers/jvReversalController');
const multer = require('../middleware/multer');

router.route('/')
.get(authorize, controllers.getPaginatedJVReversal);

router.route('/reverse')
.post(authorize, controllers.reverseJV)

router.route('/export/jvc/:jv_ref')
.get(authorize, controllers.exportJVC)

module.exports = router;

