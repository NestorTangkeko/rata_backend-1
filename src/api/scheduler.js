const router = require('express').Router();
const schedulerController = require('../controllers/schedulerController');
const {authorize} = require('../middleware/auth')

router.route('/')
.get(authorize,schedulerController.getScheduler)
.post(authorize,schedulerController.postManualTrigger)
.put(authorize,schedulerController.updateScheduler)

router.route('/details')
.get(authorize,schedulerController.getSchedulerDetails)

module.exports = router;