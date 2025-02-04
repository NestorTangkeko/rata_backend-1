const models = require('../models/rata')
const useGlobalFilter = require('../helpers/filters');
const bcrypt = require('bcryptjs');
const userService = require('../services/user.service');
const emailService= require('../services/emailService/emailService');

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
            created_by: req.processor.id
        }

        await models.user_tbl.createData({
            data:user_data
        })

        ///send email
        await emailService.sendEmailToUser({
            to: data.email,
            subject: '[RATA - New Account]',
            data:`<p>Email: ${data.email}</p>
            <p>Password; ${password}</p>`
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
                await models.user_tbl.updateData({
                    data:{
                        password:bcrypt.hashSync('secret',10),
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
            default: return res.status(400).json({
                message: 'Invalid Type'
            })     
        }
    }
    catch(e){
        next(e)
    }
}