const models = require('../models/rata');
const _ = require('lodash');
const axios = require('axios').default;
const asciiService = require('../services/asciiService');
const fs = require('fs');

const api = axios.create({
    baseURL:process.env.ASCII_API,
    headers:{
        [`Accept`]:'application/json'
    }
})

const login = async() => {
    try{
        const username = process.env.ASCII_USER_NAME
        const password = process.env.ASCII_PASSWORD
        const apiKey = process.env.ASCII_API_KEY

        const token = await api.post('/login',{
            username,
            password,
            api_key:apiKey
        })
        .then(result => {
            return result.data.access_token
        })

        return token
    } 
    catch(e){
       throw e
    }
}

exports.warehouseController = async (req,res,next) => {
    try{
        const {date} = req.query;
        let result;
        const token = await login();
        const data = await models.wms_draft_bill_hdr_tbl.getData({
            options:{
                include:[
                    {
                        model:models.wms_draft_bill_dtl_tbl,
                        as:'details'
                    },
                    {
                        model: models.principal_tbl
                    },
                    {
                        model: models.service_type_tbl
                    },
                    {
                        model: models.location_tbl
                    }
                ]
            },
            where:{
                draft_bill_date: date,
                status:'DRAFT_BILL'
            }
        })

        const asciiData = await data.map(item => {
            const {principal_tbl,service_type_tbl,location_tbl} = item
            let SALES_ORDER_DETAIL;
            const SO_AMT = item.total_charges

            SALES_ORDER_DETAIL = [
                {
                    COMPANY_CODE:'00001',
                    SO_CODE: item.draft_bill_no,
                    ITEM_CODE: item.service_type_tbl.ascii_item_code,
                    LINE_NO: 1,
                    LOCATION_CODE: location_tbl?.ascii_loc_code || 'N/A',
                    UM_CODE: item.details[0].min_billable_unit,
                    QUANTITY: 1,
                    UNIT_PRICE:     SO_AMT,
                    EXTENDED_AMT:   SO_AMT
                }
            ]
            
            return {
                COMPANY_CODE:   '00001',
                SO_CODE:        item.draft_bill_no,
                ITEM_TYPE:      'S',
                SO_DATE:        item.draft_bill_date,
                CUSTOMER_CODE:  principal_tbl?.ascii_customer_code || 'N/A',
                PARTICULAR:     item.draft_bill_no,  
                REF_EUPO:       item.draft_bill_no,
                REF_CROSS:      item.contract_id,
                SO_AMT:         SO_AMT,
                SALES_ORDER_DETAIL
            }
        })

        await api.post('/get/sales-order',JSON.parse(JSON.stringify(asciiData)),{
            headers:{
                ['Content-Type']: 'application/json',
                ['Authorization']: `Bearer ${token}`
            }
        })
        .then(res => {    

            result = {
                errors:res.data.ERROR,
                success:res.data.SUMMARY
            }

            return {
                errors:res.data.ERROR,
                success:res.data.SUMMARY
            }
        })

        await models.wms_draft_bill_hdr_tbl.updateData({
            data:{
                status:'DRAFT_BILL_POSTED'
            },
            filters:{
                draft_bill_no: result.success.map(item => item.SO_CODE)
            }
        })

        const xlsx = await asciiService.generateResult({
            success:result.success,
            errors:result.errors,
            data: asciiData
        })

        res.set('Content-disposition',`ascii_warehouse_result.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    
        res.send(xlsx)
    }   
    catch(e){
        next(e)
    }
}   

exports.transportController = async(req,res,next) => {
    const stx = await models.sequelize.transaction();
    try{
      
        const {from,to,type,isRetransmit,...filters} = req.query;
        console.log(req.query)

        let data;
        let result;
        
        const draftBill = await models.draft_bill_hdr_tbl.getData({
            options:{
                include:[
                    {
                        model: models.location_tbl,
                        attributes:['ascii_loc_code'],
                        required:false
                        
                    },
                    {
                        model:models.vendor_tbl,
                        attributes:['ascii_vendor_code'],
                        required:false
                    },
                    {
                        model: models.principal_tbl,
                        attributes:['ascii_principal_code','ascii_customer_code'],
                        required: false
                    },
                    {
                        model: models.service_type_tbl,
                        attributes:['ascii_service_type','ascii_item_code']
                    },
                    {
                        model: models.draft_bill_details_tbl,
                        as:'details'
                    },
                    {
                        model: models.draft_bill_cost_alloc_tbl,
                        as:'cost_allocation_details',
                        required: false,
                        include:[
                            {
                                model:models.principal_tbl,
                                required: false
                            }
                        ]
                    }
                ]
            },
            where:{
                trip_date: {
                    [models.Sequelize.Op.between] : [from,to]
                },
                contract_type: type,
                status: 'DRAFT_BILL',
                is_transmitted: isRetransmit === 'true' ? true : false,
                ...filters
            }
        })
        .then(result => {
            return result.map(item => {
                const {location_tbl,vendor_tbl,principal_tbl,service_type_tbl,...newItem} = item

                return {
                    ...newItem,
                    ascii_service_type: service_type_tbl?.ascii_service_type || null,
                    ascii_item_code:    service_type_tbl?.ascii_item_code || null,
                    ascii_vendor_code:      typeof  vendor_tbl?.ascii_vendor_code === 'undefined' ? null: vendor_tbl?.ascii_vendor_code,
                    ascii_loc_code:         typeof location_tbl?.ascii_loc_code === 'undefined' ? null :location_tbl?.ascii_loc_code, 
                    ascii_principal_code:   typeof principal_tbl?.ascii_principal_code === 'undefined' ? null : principal_tbl?.ascii_principal_code,
                    ascii_customer_code:    typeof principal_tbl?.ascii_customer_code === 'undefined' ? null : principal_tbl?.ascii_customer_code
                }
            })
        })
        
        // res.status(200).json(draftBill);
        const token = await login();
      
        if(type === 'SELL'){
            data = await asciiService.asciiSalesOrder(draftBill)
            await api.post('/get/sales-order',JSON.parse(JSON.stringify(data)),{
                headers:{
                    ['Content-Type']: 'application/json',
                    ['Authorization']: `Bearer ${token}`
                }
            })
            .then(res => {    

                result = {
                    errors:res.data?.ERROR || [],
                    success:res.data?.SUMMARY || []
                }

                return {
                    errors:res.data.ERROR,
                    success:res.data.SUMMARY
                }
            })

            await asciiService.updateDraftBill(
                {
                    status:'DRAFT_BILL_POSTED',
                    updated_by: req.processor.id
                },
                {
                    draft_bill_no:result.success.map(item => item.SO_CODE)
                },
                stx
            )
        }
        else {
            data = await asciiService.asciiConfirmationReceipt(draftBill)

            await api.post('/get/confirm-receipt',JSON.parse(JSON.stringify(data)),{
                headers:{
                    ['Content-Type']: 'application/json',
                    ['Authorization']: `Bearer ${token}`
                }
            })
            .then(res => {    
        
                result = {
                    errors:res.data?.ERROR || [],
                    success:res.data?.SUMMARY || []
                }

                return {
                    errors:res.data.ERROR,
                    success:res.data.SUMMARY
                }
            })

            await asciiService.updateDraftBill(
                {status:'DRAFT_BILL_POSTED'},
                {draft_bill_no:result.success.map(item => item.CR_CODE),},
                stx
            )
        }

        if(isRetransmit === 'false'){
            await asciiService.updateDraftBill(
                {
                    is_transmitted: true
                },
                {
                    draft_bill_no: draftBill.map(item => item.draft_bill_no)
                },
                stx
            )
        }   

        const errors = await asciiService.generateErrors(result.errors)
        //draftBill.filter(item => !result.success.map(suc => suc[type === 'SELL' ? 'SO_CODE' : 'CR_CODE']).includes(item.draft_bill_no))
        const logHeader = await asciiService.createTransmittalLogHeader(draftBill.map(item => ({
            draft_bill_no: item.draft_bill_no,
            created_by: req.processor.id
        })),
        stx)
       
        await asciiService.createTransmittalLogDtl(errors.map(item => {
            const header = logHeader.find(db => db.draft_bill_no === item.ref_code);
            // console.log(item)
            return ({
                // ...item,
                draft_bill_code: item.ref_code,
                fk_id: header.id,
                result_type: item.result_type,
                field_name: item.field_name,
                field_value:item.field_value,
                message: item.message,
                response_code: item.response_code
            })
        }),stx)

        await stx.commit();
        
        const xlsx = await asciiService.generateResult({
            success:result.success,
            errors:result.errors,
            data
        })

        res.set('Content-disposition',`ascii_transport_${type}_result.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    
        res.send(xlsx)
    }   
    catch(e){
        await stx.rollback();
        console.log(e)
        next(e)
    }
}

exports.getSo = async (req,res,next) => {
    try{
        const {date,location,type} = req.query;

        const draftBill = await models.draft_bill_hdr_tbl.getData({
            options:{
                include:[
                    {
                        model: models.location_tbl,
                        attributes:['ascii_loc_code'],
                        required:false
                        
                    },
                    {
                        model:models.vendor_tbl,
                        attributes:['ascii_vendor_code'],
                        required:false
                    },
                    {
                        model: models.principal_tbl,
                        attributes:['ascii_principal_code','ascii_customer_code'],
                        required: false
                    },
                    {
                        model: models.service_type_tbl,
                        attributes:['ascii_service_type','ascii_item_code']
                    },
                    {
                        model: models.draft_bill_details_tbl,
                        as:'details'
                    },
                    {
                        model: models.draft_bill_cost_alloc_tbl,
                        required: false,
                        as: 'cost_allocation_details',
                        include:[
                            {
                                model:models.principal_tbl,
                                required: false
                            }
                        ]
                    }
                ]
            },
            where:{
                trip_date: date,
                location: location,
                contract_type: type,
                status:'DRAFT_BILL'
            }
        })
        .then(result => {
            return result.map(item => {
                const {location_tbl,vendor_tbl,principal_tbl,service_type_tbl,...newItem} = item
    
                return {
                    ...newItem,
                    ascii_service_type: service_type_tbl?.ascii_service_type || null,
                    ascii_item_code:    service_type_tbl?.ascii_item_code || null,
                    ascii_vendor_code:      typeof  vendor_tbl?.ascii_vendor_code === 'undefined' ? null: vendor_tbl?.ascii_vendor_code,
                    ascii_loc_code:         typeof location_tbl?.ascii_loc_code === 'undefined' ? null :location_tbl?.ascii_loc_code, 
                    ascii_principal_code:   typeof principal_tbl?.ascii_principal_code === 'undefined' ? null : principal_tbl?.ascii_principal_code,
                    ascii_customer_code:    typeof principal_tbl?.ascii_customer_code === 'undefined' ? null : principal_tbl?.ascii_customer_code
                }
            })
    
        })

        let data;
        if (type === 'sell') {
            data = await asciiService.asciiSalesOrder(draftBill);
        }
        else {
            data = await asciiService.asciiConfirmationReceipt(draftBill);
        }

        res.json(data)
    }
    catch(e){
        next(e)
    }  
}

exports.getPaginatedTransportDraftBill = async (req,res,next) => {
    try{
        const data = await asciiService.getDraftBills({
            ...req.query
        })
        
        res.status(200).json({
            data:       data.rows,
            rows:       data.count,
            pageCount: data.pageCount
        })
    }
    catch(e){
        next(e)
    }
}

exports.getDraftBill = async(req,res,next) => {
    try{
        const {draft_bill_no} = req.params;

        if(!draft_bill_no) return res.status(400).json({message:'draft bill no is required'});

        const data = await asciiService.getDraftBill({
            draft_bill_no: draft_bill_no
        })

        res.status(200).json(data)
    }
    catch (e) {
        next(e)
    }
}

exports.getTransmittalLogHeader = async(req,res,next) => {
    try{
        const {draft_bill_no} = req.params;
        
        const data = await asciiService.getLogHeader({
            ...req.query,
            draft_bill_no
        })

        res.status(200).json({
            data:      data.rows,
            rows:      data.count,
            pageCount: data.pageCount
        })

    }
    catch(e){
        next(e)
    }
}

exports.getTransmittalLogDetail = async(req,res,next) => {
    try{
        const {header_id} = req.params;
        
        const data = await asciiService.getLogDetail({
            ...req.query,
            fk_id: header_id
        })

        res.status(200).json({
            data:      data.rows,
            rows:      data.count,
            pageCount: data.pageCount
        })
    }
    catch(e){
        next(e)
    }
}

 
