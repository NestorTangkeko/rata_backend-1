const models = require('../models/rata');
const useGlobalFilter = require('../helpers/filters');
const shipPointService = require('../services/shipPoint.service');

exports.getVendor = async (req,res,next) => {
    try{

        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.vendor_tbl.rawAttributes,
            filters:{
                search
            }
        })
        
        const {count,rows} = await models.vendor_tbl.paginated({
            filters:{
                ...globalFilter
            },
            order:[['createdAt','DESC']],
            page,
            totalPage,
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

exports.updateVendor = async(req,res,next) => {
    try{
        const {vendor_id} = req.query;
        const data = req.body;

        await models.vendor_tbl.updateData({
            data: {
                ...data,
                updated_by: req.processor.id
            },
            where:{
                vendor_id
            }
        })


        res.status(200).json({
            message:'Success'
        })
    }
    catch(e){
        next(e)
    }
}

exports.getVendorGroup = async (req,res,next) => {
    try{

        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.vendor_group_tbl.rawAttributes,
            filters:{
                search
            }
        })
        
        const {count,rows} = await models.vendor_group_tbl.paginated({
            filters:{
                ...globalFilter
            },
            order:[['createdAt','DESC']],
            page,
            totalPage,
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

exports.getVendorGroupDetails = async(req,res,next) => {
    try{
        const {id} = req.params;

        const data = await models.vendor_group_tbl.findOne({
            where:{
                vg_code: id
            },
        })
    
        if(!data) {
            return res.status(404).json({
                message: 'Vendor Group not found'
            })
        }


        res.status(200).json(data)
    }
    catch(e){
        next(e)
    }
}

exports.getVendorGroupMapping = async(req,res,next) => {
    try{
        const {id} = req.params;
        const {
            page,
            totalPage,
            search,
        } = req.query;
        
        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.vendor_group_dtl_tbl.rawAttributes,
            filters:{
                search
            }
        })
        const {count,rows} = await models.vendor_group_dtl_tbl.paginated({
            filters:{
                vg_code: id,
                ...globalFilter,
            },
            order:[['createdAt','DESC']],
            page,
            totalPage,
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

exports.updateVendorGroupMapping = async(req,res,next) => {
    try{
        const {id} = req.params;
        const {action, ...data} = req.body;

        if (action && action ==='remove') {
            await models.vendor_group_dtl_tbl.destroy({
                where: {
                    vg_code: id,
                    ...data
                }
            })
        } else {
            await models.vendor_group_dtl_tbl.updateData({
                data: {
                    ...data,
                    updated_by: req.processor.id
                },
                where:{
                    vendor_id
                }
            })
        }
        
        res.status(200).json({
            message:'Success'
        })
    }
    catch(e){
        next(e)
    }
}

exports.getGeo = async(req,res,next) => {
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.geo_barangay_tbl.rawAttributes,
            filters:{
                search
            }
        })  

        const {count,rows} = await models.geo_barangay_tbl.paginated({
            filters:{
                ...globalFilter
            },
            order:[['region_code','DESC']],
            page,
            totalPage,
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

exports.getShipPoint = async(req,res,next) => {
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.ship_point_tbl.rawAttributes,
            filters:{
                search
            }
        })
       
        const {count,rows} = await models.ship_point_tbl.paginated({
            filters:{
                ...globalFilter
            },
            order:[['createdAt','DESC']],
            page,
            totalPage,
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

exports.getShipPointDetails = async(req,res,next) => {
    try{
        const {id} = req.params;

        if(!id) throw 'Stc code is required!'

        const shipPoint = await models.ship_point_tbl.findOne({
            where:{
                stc_code:id
            }
        })

        res.json(shipPoint)
    }
    catch(e){
        next(e)
    }
}

exports.getLocation = async(req,res,next) => {
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.location_tbl.rawAttributes,
            filters:{
                search
            }
        })
       
        const {count,rows} = await models.location_tbl.paginated({
            filters:{
                ...globalFilter
            },
            order:[['createdAt','DESC']],
            page,
            totalPage,
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

exports.getQuickCode = async(req,res,next) => {
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.quick_code_tbl.rawAttributes,
            filters:{
                search
            }
        })
       
        const {count,rows} = await models.quick_code_tbl.paginated({
            filters:{
                ...globalFilter
            },
            order:[['qc_type','ASC'],['sequence_no','ASC']],
            page,
            totalPage,
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

exports.getPrincipal = async(req,res,next) => {
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.principal_tbl.rawAttributes,
            filters:{
                search
            }
        })
       
        const {count,rows} = await models.principal_tbl.paginated({
            filters:{
                ...globalFilter
            },
            order:[['principal_code','DESC']],
            page,
            totalPage,
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

exports.updateShipPoint = async(req,res,next) => {
    try{
        const data = req.body;
        const {id} = req.params;
        
        const shipPoint = await shipPointService.getShipPoint({
            stc_code: id
        })

        if(!shipPoint){
         return res.status(400).json({message: 'Ship point does not exists!'}) 
        }

        // if(!shipPoint.is_active) {
        //     return res.status(400).json({message: 'Ship point is already deactivated!'})  
        // }
        
        await shipPointService.updateShipPoint({
            ...data,
            stc_code: id,
            modified_by: req.processor.id
        })

        res.end()
    }
    catch(e){
        next(e)
    }
   
}

exports.getAlgorithm = async(req,res,next) => {
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.agg_tbl.rawAttributes,
            filters:{
                search
            }
        })
       
        const {count,rows} = await models.agg_tbl.paginated({
            options:{
                include:[
                    {
                        model: models.agg_conditions_tbl,
                        required: false
                    }
                ]
            },
            filters:{
                ...globalFilter
            },
            order:[['createdAt','DESC']],
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

exports.getAlgorithmDetails = async(req,res,next) => {
    try{
        const {id} = req.params;

        const data = await models.agg_tbl.getOneData({
            where:{
                id: id
            },
            options: {
                include: [
                    {
                        model: models.agg_conditions_tbl,
                        required: false
                    }
                ]
            }
        })
    
        if(!data) {
            return res.status(404).json({
                message: 'Algorithm not found'
            })
        }

        const {agg_conditions_tbls,...algo} = data

        res.status(200).json({
            ...algo,
            details:agg_conditions_tbls
        })
    }
    catch(e){
        next(e)
    }
 
}

exports.createAlgorithm = async(req,res,next) => {
    try{
        const {
            data
        } =req.body;

        const getAgg = await models.agg_tbl.getOneData({
            where:{
                id: data.agg_name
            }
        })

        if(getAgg){
            return res.status(400).json({
                message: 'Algorithm already exists!'
            })
        }
        
        await models.agg_tbl.createData({
            data:{
                ...data,
                id: data.agg_name,
                created_by: req.processor.id
            }
        })

        res.status(200).end()
    }
    catch(e){
        next(e)
    }
}

exports.updateAlgorithm = async(req,res,next) => {
    try{
        const {data} =req.body;
        const {id} = req.params;

        const algo = models.agg_tbl.getOneData({
            where: {
                id
            }
        })

        if(!algo) {
            return res.status(400).json({
                message:'Algorithm does not exists!'
            })
        }

        if(algo.status === 'ACTIVE')
        return res.status(400).json({
            message:'Algorithm is already active!'
        })

        await models.agg_tbl.updateData({
            where:{
                id
            },
            data:{
                ...data,
                modified_by: req.processor.id
            }
        })

        res.status(200).end()

   }
    catch(e){
        next(e)
    }
}

exports.createAlgorithmDetails = async(req,res,next) => {
    try{

        const {data} = req.body
        
        await models.agg_conditions_tbl.bulkCreateData({
            data:data.map((item,index)=> {
                const {is_editable,...algo} = item;
                return {
                    ...algo,
                    line_no: index + 1
                }
            }),
            options:{
                ignoreDuplicates:true
            }
        })

        res.status(200).end()
    }
    catch(e){
        next(e)
    }
}