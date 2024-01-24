const router = require('express').Router();
const controllers = require('../controllers/dataManagementController');
const costAllocControllers = require('../controllers/costAllocController');
const {authorize} = require('../middleware/auth');
const bodyValidator = require('../middleware/body-validator.middleware')

router.route('/vendors')
.get(authorize,controllers.getVendor)
.put(authorize,controllers.updateVendor)

router.route('/algorithm')
.get(authorize,controllers.getAlgorithm)
.post(authorize, controllers.createAlgorithm)

router.route('/algorithm/details/:id')
.get(authorize, controllers.getAlgorithmDetails)
.post(authorize,controllers.createAlgorithmDetails)
.put(authorize, controllers.updateAlgorithm)

router.get('/geography',authorize,controllers.getGeo)

router.route('/ship-point').get(authorize,controllers.getShipPoint)
router.route('/ship-point/:id')
    .get(authorize,controllers.getShipPointDetails)
    .put(authorize,controllers.updateShipPoint)

router.get('/location', authorize,controllers.getLocation)
router.get('/quick-code', authorize,controllers.getQuickCode)
router.get('/principal', authorize,controllers.getPrincipal)


router.route('/cost-allocation')
.post(authorize, bodyValidator('cost-alloc-create'),costAllocControllers.createCostAlloc)
.get(authorize, costAllocControllers.getPaginated)
.put(authorize, costAllocControllers.updateCostAlloc)

module.exports = router;