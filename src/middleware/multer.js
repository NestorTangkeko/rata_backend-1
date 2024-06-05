const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req,file,cb) => {
        cb(null, './assets/uploads')
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
})

exports.upload = multer({
    storage
})