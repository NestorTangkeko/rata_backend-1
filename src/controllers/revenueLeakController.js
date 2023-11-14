const models = require('../models/rata');
const useGlobalFilter = require('../helpers/filters');
const { Sequelize } = require('../../models');
const {replanBuy,replanSell} = require('../services/draftbillService')

exports.getRevenueLeaks = async(req,res,next) => {
    try{
        const {
            page,
            totalPage,
            search,
            ...filters
        } = req.query;

        const where = {};

        Object.keys(filters).map(key =>  {
            if(key === 'draft_bill_type'){
                return where[key] = filters[key]
                
            }
            if(key === 'rdd'){
                return where.rdd = {
                    [Sequelize.Op.between]: filters.rdd.split(',')
                }
            }
            else{
                return where[`$helios_invoices_hdr_tbl.${key}$`] = filters[key]
            }
            
        })

        const globalFilter = useGlobalFilter.defaultFilter({
            model:models.transport_rev_leak_hdr_tbl.rawAttributes,
            filters:{
                search
            }
        })
         
        const {count,rows} = await models.transport_rev_leak_hdr_tbl.paginated({
            filters:{
                is_draft_bill: 0,
                ...where,
                ...globalFilter
            },
            order: [],
            page,
            totalPage,
            options: {
                include: [
                    {
                        model:models.helios_invoices_hdr_tbl,
                    }
                ],
                //distinct:true
            }
        })
        .then(result => {
            const rows = result.rows.map(item => {
                const {helios_invoices_hdr_tbl,tranport_rev_leak_dtl_tbls,...header} = item;

                return {
                    ...header,
                    ...helios_invoices_hdr_tbl,
                }
            })

            return {
                count: result.count,
                rows
            }

        })

        res.status(200).json({
            data:rows,
            rows:count,
            pageCount:Math.ceil(count/totalPage)  
        })
        
    }
    catch(e){
        next(e)
    }
}

exports.getRevenueLeaksDetails = async(req,res,next) => {
    try{
        const {br_no} = req.params;

        if(!br_no) throw 'Booking Number is required';

        const data = await models.tranport_rev_leak_dtl_tbl.findAll({
            where:{
                br_no
            }
        })

        res.status(200).json(JSON.parse(JSON.stringify(data)))
    }
    catch(e){
        next(e)
    }
}

exports.transportReplanBuy = async(req,res,next) => {
    try{
        const {rdd} = req.query;

        const invoices = await models.transport_rev_leak_hdr_tbl.getData({
            options:{
                include:[
                    {
                        model:models.helios_invoices_hdr_tbl,
                        include:[
                            {model: models.ship_point_tbl, as:'ship_point_from'},
                            {model: models.ship_point_tbl, as:'ship_point_to'},
                            {model: models.vendor_tbl},
                            {
                                model: models.vendor_group_dtl_tbl,
                                required: false,
                                where:Sequelize.where(Sequelize.col('helios_invoices_hdr_tbl.vendor_group_dtl_tbl.location'),Sequelize.col('helios_invoices_hdr_tbl.location'))
                            },
                        ]
                    },
                    {
                        model: models.tranport_rev_leak_dtl_tbl
                    }
                ]
            },
            where:{
                draft_bill_type:'BUY',
                rdd:rdd,
                is_draft_bill:0
            }
        })
        .then(result => {
            return result.map(res => {
                const {helios_invoices_hdr_tbl,tranport_rev_leak_dtl_tbls,...headers} = res;
                const {vendor_group_dtl_tbl,vendor_tbl,...invoice} = helios_invoices_hdr_tbl; 
                return {
                    ...invoice,
                    vg_code:             vendor_group_dtl_tbl?.vg_code || null,
                    is_ic:               vendor_tbl?.is_ic || 0,
                    tms_reference_no:    headers.tms_reference_no,
                    fk_tms_reference_no: headers.fk_tms_reference_no,
                    class_of_store:      headers.class_of_store,
                    draft_bill_type:     headers.draft_bill_type,
                    revenue_leak_reason: headers.revenue_leak_reason,
                    details: tranport_rev_leak_dtl_tbls
                }

            })
        })

        const draft_bill = await replanBuy({
            invoices,
            rdd
        })

        res.status(200).json({
            draft_bill: draft_bill.draft_bill.length,
            revenue_leak: draft_bill.revenue_leak,
            invoices: draft_bill.data.length
        })        
    }
    catch(e){
        next(e)
    }

}

exports.transportReplanSell = async(req,res,next) => {
    try{
        const {rdd} = req.query;

        const invoices = await models.transport_rev_leak_hdr_tbl.getData({
            options:{
                include:[
                    {
                        model:models.helios_invoices_hdr_tbl,
                        include:[
                            {model: models.vendor_tbl},
                            {model: models.ship_point_tbl, as:'ship_point_from'},
                            {model: models.ship_point_tbl, as:'ship_point_to'}
                        ]
                    },
                    {
                        model: models.tranport_rev_leak_dtl_tbl
                    }
                ]
            },
            where:{
                draft_bill_type:'SELL',
                rdd:rdd,
                is_draft_bill:0
            }
        })
        .then(result => {
            return result.map(item => {
                const {
                    helios_invoices_hdr_tbl,
                    tranport_rev_leak_dtl_tbls,
                    ...headers
                } = item

                return {
                    ...helios_invoices_hdr_tbl,
                    tms_reference_no: headers.tms_reference_no,
                    fk_tms_reference_no: headers.fk_tms_reference_no,
                    class_of_store: headers.class_of_store,
                    draft_bill_type: headers.draft_bill_type,
                    revenue_leak_reason: headers.revenue_leak_reason,
                    details: tranport_rev_leak_dtl_tbls

                }
            })
        })

        const draft_bill = await replanSell({
            invoices,
            rdd
        })

        res.status(200).json({
            draft_bill: draft_bill.draft_bill.length,
            revenue_leak: draft_bill.revenue_leak.length,
            invoices: draft_bill.data.length
        })
    }
    catch(e){
        next (e)
    }
}