const router = require('express').Router();
const {authorize} = require('../middleware/auth');
const multer = require('../middleware/multer');
const controller = require('../controllers/soUploadController');

router.route('/template')
.post(authorize,controller.template);

router.route('/')
.post(authorize, multer.upload.single('file'), controller.uploadSO)
.get(authorize, controller.getPaginated)

router.get('/header/:id',   authorize, controller.getSo);
router.get('/details/:id',  authorize, controller.getPaginatedDetails);
router.get('/errors/:id',   authorize, controller.getPaginatedErrors);

router.post('/export', authorize, controller.exportSO)

module.exports = router;