const nodemailer = require('nodemailer');
const {email,password,service} =require('../../../config').nodeMailer;
const models = require('../../models/rata');

const transporter = nodemailer.createTransport({
    service:service,
    auth:{
        user:email,
        pass:password
    }
})

//Sends email on completed and failed jobs
exports.sendEmail = async({
    subject,
    scheduler_id,
    data
}) => {
    try{

        

        const emails = await models.scheduler_email_tbl.getData({
            where:{
                scheduler_id,
                status: 'ACTIVE'
            }
        })

        if(emails.length > 0) {
            await transporter.sendMail({
                to: emails.map(item => item.email),
                subject,
                html: data
            })
        }
    }
    catch(e){
        throw e
    }
}

//send email to user
exports.sendEmailToUser = async ({
    subject,
    to,
    data
}) => {
    await transporter.sendMail({
        to, 
        subject,
        html: data
    })

}