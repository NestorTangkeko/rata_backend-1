const models = require('../models/rata')
const useGlobalFilter = require('../helpers/filters');
const bcrypt = require('bcryptjs');
const userService = require('../services/user.service');
const emailService= require('../services/emailService/emailService');
const moment = require('moment');

exports.getRoles = async(req,res,next) => {
    try{ 
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.role_tbl.getAttributes(),
            filters:{
                search
            }
        })

        const {count,rows} = await models.role_tbl.paginated({
            filters:{
                ...globalFilter,
                ...filters
            },
            order: [['createdAt','DESC']],
            page,
            totalPage
        })

        res.status(200).json({
            data:rows,
            rows:count,
            pageCount: Math.ceil(count/totalPage)
        })

    }
    catch(e){
        next(e)
    }
}

exports.getRoleDetails = async(req,res,next) => {
    try{
        const {id} = req.params;

        const getRoles = await models.role_tbl.getOneData({
            where:{
                role_id: id
            },
            options:{
                include: [
                    {
                        model: models.role_access_tbl,
                        required: false,
                        as:'access'
                    }
                ]  
            }
        })
        .then(result => {
            return {
                ...result,
                isHeader: result.is_header
            }
        })

        res.status(200).send(getRoles)
    }
    catch(e){
        next(e)
    }
}

exports.postRoleAccess = async(req,res,next) => {
    try{
        const {id} = req.params;
        const {data}  = req.body;

        await models.role_access_tbl.bulkCreateData({
            data:data.map(item => {
                const {isHeader,...header} = item
                return {
                    ...header,
                    role_id: id,
                    is_header: isHeader,
                    created_by: req.processor.id,
                    //updatedBy: req.processor.id
                }
            }),
            options: {
                updateOnDuplicate: ['view','create','edit','export','updatedBy']
            }
        })
        
        req.sessions = {
            role_id: id
        }

        next();
    }
    catch(e){
        next(e)
    }
}

exports.postRole = async(req,res,next) => {
    try{
        const {data} = req.body;

        const getRole = await models.role_tbl.getOneData({
            where: {
                role_name: data.role_name
            }
        })

        if(getRole) return res.status(400).json({
            message:'Role already exists!'
        })

        await models.role_tbl.createData({
            data:{
                ...data,
                role_status: 'INACTIVE',
                created_by: req.processor.id, 
                //updatedBy: req.processor.id
            }
        })

        res.status(200).end()
    }
    catch(e){
        next(e)
    }
}

exports.activateRole = async(req,res,next) => {
    try{
        const {id} = req.params;
        const {status} = req.query;

        const getRole = await models.role_tbl.getOneData({
            where: {
                role_id: id
            },
            options: {
                include: [
                    {
                        model: models.role_access_tbl,
                        required: false,
                        as:'access'
                    }
                ]
            }
        })

        if(status === 'ACTIVE'){
            if(getRole.access.length === 0){
                return res.status(400).json({
                    message:'Assign Access first!'
                })
            }
        }
        else{    
            const getUsers = await models.user_tbl.getAllData({
                where: {
                    user_role_id: id,
                    status:'ACTIVE'
                }
            })

            if(getRole.role_name==='Administrator'){
                return res.status(400).json({
                    message:'Administrator account cannot be de-activated!'
                }) 
            }

            if(getUsers.length > 0){
                return res.status(400).json({
                    message:'Role is in used by active users!'
                }) 
            }
        }

        await models.role_tbl.updateData({
            where:{
                role_id: id
            },
            data:{
                role_status: status,
                modified_by: req.processor.id
            }
        })

        res.status(200).end()
    }
    catch(e){
        next(e)
    }
}

exports.getUsers = async(req,res,next)=>{
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.user_tbl.rawAttributes,
            filters:{
                search
            }
        })

        const {count,rows} = await models.user_tbl.paginated({
            filters:{
                ...globalFilter,
                ...filters
            },
            order: [['createdAt','DESC']],
            page,
            totalPage,
            options:{
                include:[
                    {
                        model: models.role_tbl,
                        required: false,
                        as:'role'
                    }
                ]
            }
        })
        .then(({rows,count}) => {
            const data = rows.map(item => {
                const {role,...users} = item;
                return {    
                    ...users,
                    role_name: role?.role_name,
                    role_id: role?.role_id
                }
            })
            
            return {
                count,
                rows: data
            }
        })
        
        res.status(200).json({
            data:rows,
            rows:count,
            pageCount: Math.ceil(count/totalPage)
        })

    }
    catch(e){
        next(e)
    }
}

exports.createUser = async(req,res,next) =>{
    try{
        const {
            data
        } = req.body;

        const getUser = await models.user_tbl.getOneData({
            where:{
                email: data.email
            }
        })

        if(getUser) return res.status(400).json({message:'User exists!'})

        const password = await userService.randomCharGenerator(36)
        const hashedPassword = bcrypt.hashSync(password, 10)

        const user_data = {
            ...data,
            is_reset: 1,
            status:'ACTIVE',
            password: hashedPassword,
            is_lock: 0,
            created_by: req.processor.id
        }

        await models.user_tbl.createData({
            data:user_data
        })

        ///send email
        await emailService.sendEmailToUser({
            to: data.email,
            subject: '[RATA: New Account Registration]',
            data:`<p>Dear ${data.first_name},</p>
            <p>Below are your initial login credentials to RATA:</p>
            <p>RATA Link: ${process.env.RATA_URL}</p>
            <p>User ID: ${data.email}</p>
            <p>Temporary Password: ${password}</p>
            <br/>
            <p>Please log in and follow the instructions to
            secure your account by changing your
            password.</p>
            <br/>
            <p>Regards, 
            RATA IT Team</p>`
        })

        res.status(200).end();
    }
    catch(e){
        next(e)
    }
}

exports.updateUser = async(req,res,next) => {
    try{

        const {type,id} = req.params;
        const {data} = req.body;

        switch(type) {
            case 'status' : {
                await models.user_tbl.updateData({
                    data:{
                        status: data.status,
                        updated_by: req.processor.id
                    },
                    where:{
                        id
                    }
                })

                req.sessions = {
                    id: id
                }

                return next()
            }
            case 'role' : {
                await models.user_tbl.updateData({
                    data:{
                        user_role_id: data.role_id,
                        updated_by: req.processor.id
                    },
                    where:{
                        id
                    }
                })

                req.sessions = {
                    id: id
                }

                return next()
            }
            case 'password': {
                const getUser = await userService.getUser({
                    id
                })

                const newPassword = await userService.randomCharGenerator(36)

                await models.user_tbl.updateData({
                    data:{
                        password: bcrypt.hashSync(newPassword,10),
                        is_reset: 1,
                        updated_by: req.processor.id
                    },
                    where:{
                        id
                    }
                });

                await emailService.sendEmailToUser({
                    to: getUser.email,
                    subject: '[RATA: Reset Account]',
                    data:`<p>Dear ${getUser.first_name},</p>
                    <p>Below are your credentials to access RATA and reset your account:</p>
                    <p>RATA Link: ${process.env.RATA_URL}</p>
                    <p>User ID: ${getUser.email}</p>
                    <p>Temporary Password: ${newPassword}</p>
                    <br/>
                    <p>Please log in and follow the instructions to
                    secure your account by changing your
                    password.</p>
                    <br/>
                    <p>Regards, 
                    RATA IT Team</p>`
                })
            
                req.sessions = {
                    id: id
                };
                
                return next()
            }
            case 'unlock' : {
                const getUser = await userService.getUser({
                    id
                })
                const newPassword = await userService.randomCharGenerator(36)
                await userService.updateUser({
                    data:{
                        is_lock: 0,
                        is_reset: 1,
                        updated_by: req.processor.id,
                        password: bcrypt.hashSync(newPassword,10),
                    },
                    where:{
                        id
                    }
                })

                await emailService.sendEmailToUser({
                    to: getUser.email,
                    subject: '[RATA: Unlock Account]',
                    data:`<p>Dear ${getUser.first_name},</p>
                    <p>Below are your credentials to access RATA and reset your account:</p>
                    <p>RATA Link: ${process.env.RATA_URL}</p>
                    <p>User ID: ${getUser.email}</p>
                    <p>Temporary Password: ${newPassword}</p>
                    <br/>
                    <p>Please log in and follow the instructions to
                    secure your account by changing your
                    password.</p>
                    <br/>
                    <p>Regards, 
                    RATA IT Team</p>`
                })

                req.sessions = {
                    id: id
                }

                return next()
            }
            default: return res.status(400).json({
                message: 'Invalid Type'
            })     
        }
    }
    catch(e){
        next(e)
    }
}

exports.updatePassword = async (req,res,next) => {
    try{
        const id = req.processor.id;
        const {
            oldPassword,
            newPassword,
            confirmPassword
        } = req.body;

        const getUser = await userService.getUser({
            id
        })
        //compare old password to current password
        if(!getUser) return res.status(400).json({message: 'User not found!'});

        if(!bcrypt.compareSync(oldPassword, getUser.password)) return res.status(400).json({message: 'Invalid old password'}) 

        //compare old password to new password
        if(oldPassword === newPassword) {
            return res.status(400).json({message: 'New password must not match the password'})
        }
        //update user password and is_reset field

        await userService.updateUser({
            data:{
                password: bcrypt.hashSync(newPassword, 10),
                password_expiry: moment().add(90, 'days').format('YYYY-MM-DD HH:mm:ss'),
                is_reset: 0
            },
            filters:{
                id
            }
        })

        req.sessions = {
            id: id
        };
    
        next();
    }
    catch(e){
        next(e)
    }
}

