const bcrypt = require('bcryptjs');
const models = require('../models/rata');
const _ = require('lodash');
const redis = require('../../config').redis;
const jwtSecret = require('../../config').jwtSecret;
const jwt = require('jsonwebtoken');
const userService = require('../services/user.service');
const emailService = require('../services/emailService');
const moment = require('moment');
const createHttpError = require('http-errors');

exports.login = async (req,res,next) => {
    try{
        const {
            email,
            password
        } = req.body;

        const errorMessage = {
            message: 'Invalid Username or password'
        };

        const getUser = await models.user_tbl.getOneData({
            where:{
                email: email,
                status: 'ACTIVE'
            },
            options:{
                include: [
                    {
                        model: models.role_tbl,
                        as:'role'
                    },
                    {
                        model: models.role_access_tbl,
                        as:'access'
                    }
                ]
            }
        })
        .then(result => {
            if(!result) return null;

            let {access,role,...user} = result;

            const accessHeaders = access.filter(item => item.is_header)
            access = accessHeaders.map(header => {
                const details = access.filter(item => !item.is_header && header.header_id === item.header_id)

                return {
                    ...header,
                    children: details
                }
            })

            return {
                email: user.email,
                id: user.id,
                password: user.password,
                first_name: user.first_name,
                last_name: user.last_name,
                role_name: role?.role_name,
                role_id: role?.role_id,
                is_reset: user.is_reset,
                is_lock: user.is_lock,
                password_expiry: user.password_expiry,
                access
            }
        })
    
        if(!getUser) {
            throw createHttpError(400, errorMessage)
        }
             
        //get user redis session
        if(getUser.is_lock === 1) {
            throw createHttpError(400, 'You reached the maximum number of login retries.')
        }

        if(!bcrypt.compareSync(password,getUser.password)) {
            //count login attempt
            await userService.lockUserAccount({
                user_id: getUser.id,
                role_id:getUser.role_id,
                role_name: getUser.role_name,
                is_reset: getUser.is_reset,
                password_expiry: getUser.password_expiry
            })

            throw createHttpError(400, errorMessage)
        }
        
        //generate Token
        const token = jwt.sign({id: getUser.id,email,role:getUser.role_name}, jwtSecret,{
            expiresIn:'24h'
        })
        
        //insert into redis
        await redis.json.set(`rata:session:${getUser.id}`, '$', {
            id: getUser.id,
            email:getUser.email,
            role_id:getUser.role_id,
            role_name: getUser.role_name,
            is_reset: getUser.is_reset,
            login_attempt: 0,
            password_expiry: getUser.password_expiry,
            access: getUser.access
        })

        //add logs to login
        await userService.createLoginLogs(getUser.id);

        res.status(200).json({
            token
        })

    }
    catch(e){
        next(e)
    }
}

exports.logout = async(req,res,next) => {
    try{
        // const id = req.processor.id;
        
        // if(token) {
        //     await redis.del(`rata:session:${id}`)
        // }
        
        res.status(200).end()

    }
    catch(e){
        next(e)
    }
}

exports.authAccess=async(req,res,next) => {
    try{    
        const id = req.processor.id

        //get the modules
        const data = await redis.json.get(`rata:session:${id}`)
        if(!data) {
           return res.status(401).json({message:'Invalid Access!'})
        }

        res.status(200).json(data.access)
    }
    catch(e){
        next(e)
    }
}

exports.updateUser = async(req,res,next)=>{
    try{
        const token = req.headers['x-access-token']
        const {data} = req.body;
        const session = jwt.decode(token)
        
        const getUser = await models.user_tbl.getOneData({
            where:{
                email: session.email
            }
        })
        
        if(!bcrypt.compareSync(data.oldPassword,getUser.password)) return res.status(400).json({
            message:'Old Password not match'
        })
        
        await models.user_tbl.updateData({
            where:{
                email: session.email
            },
            data:{
                password: bcrypt.hashSync(data.password,10),
                password_expiry: moment().add(90, 'days').format('YYYY-MM-DD HH:mm:ss'),
                updated_by: req.processor.id    
            }
        })

        res.status(200).end()
    }
    catch(e){
        next(e)
    }
}

exports.session = async(req,res,next) => {
    try{
        const id = req.processor.id;

        const data = await redis.json.get(`rata:session:${id}`);

        if(!data) return res.status(401).json({message: 'No Active Session Found!'})
        const {access,...user} = data;

        res.status(200).json(user)
    }
    catch(e){
        next(e)
    }
}

exports.forgotPassword = async(req,res,next) => {
    try{
        const {email} = req.body;
        const getUser = await userService.getUser({
            email
        }) 

        if(!getUser) return res.status(400).json({message: 'Invalid Email'});

        const password = await userService.randomCharGenerator(36);

        await userService.updateUser({
            data:{
                password: bcrypt.hashSync(password, 10),
                is_reset: 1, 
            },
            filters:{
                id: getUser.id
            }
        });

        await emailService.sendEmailToUser({
            to: getUser.email,
            subject: '[RATA: Reset Account]',
            data:`<p>Dear ${getUser.first_name},</p>
            <p>Below are your credentials to access RATA and reset your account:</p>
            <p>RATA Link: ${process.env.RATA_URL}</p>
            <p>User ID: ${getUser.email}</p>
            <p>Temporary Password: ${password}</p>
            <br/>
            <p>Please log in and follow the instructions to
            secure your account by changing your
            password.</p>
            <br/>
            <p>Regards, 
            RATA IT Team</p>`
        })

        req.sessions = {
            id: getUser.id
        };

        next();
    }
    catch(e){
        next(e)
    }
}

