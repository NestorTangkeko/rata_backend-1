const router = require('express').Router();

router.use('/authentication',   require('./authentication'))
router.use('/draft-bill',       require('./draftbill'))
router.use('/invoice',          require('./invoices'))
router.use('/tariff',           require('./tariff'))
router.use('/contract',         require('./contract'))
router.use('/scheduler',        require('./scheduler'))
router.use('/revenue-leak',     require('./revenue-leak'))
router.use('/data-management',  require('./data-management'))
router.use('/data-upload',      require('./data-upload'))
router.use('/data-export',      require('./data-export'))
router.use('/ascii',            require('./ascii'))
router.use('/administration',   require('./administration'))
router.use('/select',           require('./select'))
router.use('/reports',          require('./reports'))
router.use('/cr-upload',        require('./cr-upload'))
router.use('/so-upload',        require('./so-upload'))
router.use('/jv-creation',      require('./jv-creation'))
router.use('/jv-reversal',      require('./jv-reversal'))

module.exports = router;