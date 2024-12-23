const router = require('express').Router();
const schedulerController = require('../controllers/schedulerController');
const {authorize} = require('../middleware/auth')

router.route('/')
.get(authorize,schedulerController.getScheduler)
.post(authorize,schedulerController.postManualTrigger)
.put(authorize,schedulerController.updateScheduler)

router.route('/details')
.get(authorize,schedulerController.getSchedulerDetails)

router.route('/email')
.get(authorize,     schedulerController.getEmails)
.post(authorize,    schedulerController.postEmail)
.put(authorize,     schedulerController.putEmail)

router.route('/cron')
.post(schedulerController.cronTest)

router.post('/daily_accrual_expense',schedulerController.manualDailyAccrualTriggerExpense)
router.post('/daily_accrual_revenue',schedulerController.manualDailyAccrualTriggerRevenue)

router.post('/draft_bill_sell_range', schedulerController.draftBillSellRange)
router.post('/draft_bill_buy_range', schedulerController.draftBillBuyRange)


module.exports = router;