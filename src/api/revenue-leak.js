const router = require('express').Router();
const controller = require('../controllers/revenueLeakController');
const {authorize} = require('../middleware/auth');

router.route('/')
.get(authorize,controller.getRevenueLeaks)

router.route('/:br_no')
.get(authorize, controller.getRevenueLeaksDetails)

router.route('/transport/sell')
.post(controller.transportReplanSell)

router.route('/transport/buy')
.post(controller.transportReplanBuy)


module.exports = router;