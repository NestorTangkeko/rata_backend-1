const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '../../.env'),
});

module.exports = {
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    jwtSecret: process.env.TOKEN_SECRET,
    nodeMailer: {
        email:process.env.NODEMAILER_EMAIL,
        password:process.env.NODEMAILER_PASSWORD,
        service:process.env.NODEMAILER_SERVICE,
    },
    redisKey: 'rata'
}
  