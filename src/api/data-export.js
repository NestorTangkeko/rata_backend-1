const router = require('express').Router();
const transportRouter = require('express').Router();
const dataRouter = require('express').Router();
const controller =require('../controllers/dataExportController');
const {authorize} = require('../middleware/auth');

//transport export route
transportRouter.route('/invoice')
.post(authorize,controller.exportInvoice)

transportRouter.route('/draft-bill')
.post(authorize,controller.exportDraftBill)

transportRouter.route('/revenue-leak')
.post(authorize,controller.exportRevenueLeak)

transportRouter.route('/contract')
.post(authorize,controller.exportContract)

transportRouter.route('/tariff')
.post(authorize,controller.exportTariff)

//data-management export routes
dataRouter.post('/geography',   authorize,controller.exportGeography)
dataRouter.post('/vendor',      authorize,controller.exportVendor)
dataRouter.post('/principal',   authorize,controller.exportPrincipal)
dataRouter.post('/ship-point',  authorize,controller.exportShipPoint)
dataRouter.post('/location',    authorize,controller.exportLocation)
dataRouter.post('/quick-code',  authorize,controller.exportQuickCode)
dataRouter.post('/algorithm',   authorize,controller.exportAlgorithm)


router.use('/transport',transportRouter)
router.use('/data-management', dataRouter)

module.exports = router;