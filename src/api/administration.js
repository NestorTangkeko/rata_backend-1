const router = require('express').Router();
const controller = require('../controllers/administrationController');
const {authorize,revokeAccess} = require('../middleware/auth');

router.route('/role')
.get(authorize,controller.getRoles)
.post(authorize,controller.postRole)

router.route('/role/:id')
.get(authorize,controller.getRoleDetails)
.post(authorize,controller.postRoleAccess, revokeAccess)
.put(authorize, controller.activateRole)

router.route('/user')
.get(authorize,controller.getUsers)
.post(authorize, controller.createUser)

router.route('/user/password')
.put(authorize, controller.updatePassword, revokeAccess);

router.route('/user/:id/:type')
.put(authorize, controller.updateUser, revokeAccess)



module.exports = router;