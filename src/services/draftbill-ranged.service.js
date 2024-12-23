const {
    getContract, 
    groupByTripDate,
    getBillableInvoices, 
    assignContract, 
    assignTariff,
    draftBillCostAlloc
    // draftBillWithAgg,
    // draftBillWithoutAgg,
    //sellValidation
} = require('./podReport.service');
const {
    formatByClassOfStore,
    draftBillIC,
    draftBillWithAgg, 
    draftBillWithoutAgg, 
    sellValidation, 
    tripValidation} = require('./draftbillService');
const models = require('../models/rata');
const _ = require('lodash');
const moment = require('moment');

const getMaxDraftBillCount = async() => {
    return await models.draft_bill_hdr_tbl.max('draft_bill_no', {
            where:{
                draft_bill_date: moment().format('YYYY-MM-DD')
            }
        }).then(result => {
            return Number(String(result).substring(7))
        })
}

const assignDraftBillNo = async(draft_bill,current) => {
    try{
        
        let count = current;
        
        const generateDraftBillNo = ({count}) => {
            try {
                const date = moment().format('MMDD')
                const year = moment().format('YY')

                return `R${date}${String(year).split('')[1]}${String(count).padStart(5,"00000")}`    
            } 
            catch (error) {
                throw error
            }
        }  

        return draft_bill.map(item => {
            
            const {draft_bill_details,ship_from,ship_point,...header} = item
            
            count = count+=1
            
            const draft_bill_no =  generateDraftBillNo({count: count})
            const draft_bill_invoice_tbl = draft_bill_details.map(detail => {
                return {
                    ...detail,
                    draft_bill_no
                }
            })

            return {
                ...header,
                draft_bill_no,
                draft_bill_date:moment().format('YYYY-MM-DD'),
                status:'DRAFT_BILL',
                stc_from: ship_from,
                stc_to: ship_point,
                details: draft_bill_invoice_tbl
            }
        })      
    }
    catch(e){
        throw e
    }
}

const createDraftBill = async({contract_type, draft_bill_header, draft_bill_details, leak_header, leak_details,cost_allocation_details=[], invoices}) => {
    const transaction = await models.sequelize.transaction();
    try{

        await models.helios_invoices_hdr_tbl.update(
            contract_type==='SELL' ? {is_processed_sell: 1} : {is_processed_buy: 1},
            {
                where:{
                    tms_reference_no:  invoices.map(item => item.tms_reference_no)
                },
                transaction
            }

        )

        await models.draft_bill_hdr_tbl.bulkCreate(draft_bill_header, {
            transaction
        })
        await models.draft_bill_details_tbl.bulkCreate(draft_bill_details, {
            transaction
        })

        await models.transport_rev_leak_hdr_tbl.bulkCreate(leak_header,{
            transaction,
            ignoreDuplicates:true
        })

        await models.tranport_rev_leak_dtl_tbl.bulkCreate(leak_details, {
            transaction,
            ignoreDuplicates:true
        })

        await models.draft_bill_cost_alloc_tbl.bulkCreate(cost_allocation_details, {
            transaction,
            ignoreDuplicates: true
        })

        await transaction.commit();
    }
    catch(e){
        await transaction.rollback()
        throw e
    }
}

exports.sell = async(from, to , job_id = null) => {
    let draft_bill_header  = [];
    let draft_bill_details = [];
    let leak_header = [];
    let leak_details = [];

    let draft_bill = [];
    let revenue_leak = [];
    let invoice = [];

    let current = await getMaxDraftBillCount();

    const invoices = await models.helios_invoices_hdr_tbl.getData({
        where:{
            trip_date:{
                [models.Sequelize.Op.between]:[from,to]
            },
            is_processed_sell: 0
        },
        options:{
            include:[
               {model: models.helios_invoices_dtl_tbl, required:false},
               {
                    model: models.vendor_tbl,
                    required:false,
                    where:{
                        vendor_status: 'ACTIVE'
                    }
                },
                {
                    model: models.ship_point_tbl, 
                    as:'ship_point_from',
                    required:false,
                    where:{
                        is_active: 1
                    }
                },
                {
                    model: models.ship_point_tbl, 
                    as:'ship_point_to',
                    required:false,
                    where:{
                        is_active: 1
                    }
                }
            ]
        }
    }) 

    const contracts = await getContract({
        from,
        to,
        contract_type:'SELL',
        principal_code: _.uniq(invoices.map(item => item.principal_code))
    })

    const data = await groupByTripDate(invoices);
    
    for(let trip_date of Object.keys(data)) {
        let raw = await formatByClassOfStore({
            invoices: data[trip_date]
        })
        raw = await getBillableInvoices(raw);
        revenue_leak = revenue_leak.concat(raw.revenue_leak)

        raw = await assignContract({ invoices: raw.data, contracts})
        revenue_leak = revenue_leak.concat(raw.revenue_leak)
        
        raw = await assignTariff({invoices: raw.data, contracts, contract_type: 'SELL'})
        revenue_leak = revenue_leak.concat(raw.revenue_leak);

        const withAgg = await draftBillWithAgg({
            invoices: raw.data,
            contract_type:'SELL'
        })

        const withoutAgg = await draftBillWithoutAgg({
            invoices: raw.data,
            contract_type:'SELL'
        })

        raw = await sellValidation([].concat(withAgg.data,withoutAgg.data), revenue_leak,invoices,false)
        draft_bill = draft_bill.concat(await assignDraftBillNo(raw.draft_bill, current + draft_bill.length));
        revenue_leak = revenue_leak.concat(withAgg.revenue_leak, withoutAgg.revenue_leak)
        
    }
    
    for(let {details,...db} of  draft_bill){
        draft_bill_header.push({
            ...db
        })

        draft_bill_details = draft_bill_details.concat(details.map(item => ({
            ...item,
        })))
    }
    
    for(let {details,...leak} of  revenue_leak){
        leak_header.push({
            tms_reference_no: leak.tms_reference_no,
            fk_tms_reference_no: leak.fk_tms_reference_no,
            draft_bill_type:'SELL',
            rdd:  leak.rdd,
            class_of_store: leak.class_of_store,
            job_id,
            revenue_leak_reason: leak.revenue_leak_reason,
            is_draft_bill: 0,
            trip_date: leak.trip_date
        })
        
        leak_details = leak_details.concat(details.map(({id,createdAt, updatedAt,...items}) => ({
            ...items,
            class_of_store: leak.class_of_store,
            draft_bill_type:'SELL'
        })))
    }

    await createDraftBill({
        contract_type: 'SELL',
        invoices,
        draft_bill_header,
        draft_bill_details,
        leak_header,
        leak_details
    })

    return {
        draft_bill_header,
        draft_bill_details,
        leak_header,
        leak_details
    }; 
}

exports.buy = async(from, to, job_id = null) => {
    let draft_bill_header  = [];
    let draft_bill_details = [];
    let cost_allocation_details = [];

    let leak_header = [];
    let leak_details = [];

    let draft_bill = [];
    let revenue_leak = [];
    let invoice = [];

    let current = await getMaxDraftBillCount();

    const invoices = await (models.helios_invoices_hdr_tbl.getData({
        where:{
            trip_date:{
                [models.Sequelize.Op.between]:[from,to]
            },
            is_processed_buy: 0
        },
        options:{
            include:[
                {
                    model: models.helios_invoices_dtl_tbl
                },
                {
                    model: models.ship_point_tbl, 
                    as:'ship_point_from',
                    required:false,
                    where:{
                        is_active: 1
                    }
                },
                {
                    model: models.ship_point_tbl, 
                    as:'ship_point_to',
                    required:false,
                    where:{
                        is_active: 1
                    }
                },
                {
                    model: models.vendor_tbl,
                    required: false,
                    where:{
                        vendor_status: 'ACTIVE'
                    }
                },
                {
                    model: models.vendor_group_dtl_tbl,
                    required: false,
                    where:models.Sequelize.where(models.Sequelize.col('vendor_group_dtl_tbl.location'),models.Sequelize.col('helios_invoices_hdr_tbl.location'))
                },
            ]
        }
    }))
    .then(result => {
        return result.map(item => {
            const {
                vendor_tbl,
                vendor_group_dtl_tbl,
                ...invoice
            } = item;

            return {
                ...invoice,
                vg_code:vendor_group_dtl_tbl?.vg_code || null,
                is_ic: vendor_tbl?.is_ic || 0
            }
        })
    })

    const vehicleTypes = await models.vehicle_types_tbl.findAll({
        where:{
            status:'ACTIVE'
        }
    }).then(result => JSON.parse(JSON.stringify(result)))

    const hasCostAlloc = await models.cost_alloc_setup_tbl.findAll({
        where:{
            is_active:1
        }
    }).then(result => JSON.parse(JSON.stringify(result)))

    const raw_data = await groupByTripDate(invoices);
    const contracts = await getContract({
        from,
        to,
        contract_type: 'BUY',
        vendor_group:  _.uniq(invoices.map(item => item.vg_code))
    })

    for(let trip_date of Object.keys(raw_data)) {
        let raw = await formatByClassOfStore({invoices:raw_data[trip_date]})
        raw             = await getBillableInvoices(raw)
        revenue_leak    = revenue_leak.concat(raw.revenue_leak)

        raw             = await assignContract({ invoices: raw.data, contracts})
        revenue_leak   = revenue_leak.concat(raw.revenue_leak)

        raw             = await assignTariff({invoices: raw.data, contracts, contract_type: 'BUY'})
        revenue_leak   = revenue_leak.concat(raw.revenue_leak)

        const ic =          await draftBillIC({invoices: raw.data})
        const withAgg   =     await draftBillWithAgg({invoices: raw.data, contract_type:'BUY'})
        const withoutAgg =  await draftBillWithoutAgg({invoices: raw.data, contract_type:'BUY'})

        revenue_leak    = revenue_leak.concat(withAgg.revenue_leak, withoutAgg.revenue_leak, ic.revenue_leak)

        raw             = await tripValidation([].concat(ic.data, withAgg.data, withoutAgg.data), revenue_leak,invoices, false)
        draft_bill      = draft_bill.concat(await assignDraftBillNo(raw.draft_bill, current+draft_bill.length));
        revenue_leak    = revenue_leak.concat(raw.revenue_leak);
    }

    draft_bill = await draftBillCostAlloc(draft_bill, vehicleTypes, hasCostAlloc)


    for(let {details,...db} of  draft_bill){
        draft_bill_header.push({
            ...db
        })

        draft_bill_details = draft_bill_details.concat(details.map(item => ({
            ...item,
        })))

        cost_allocation_details = cost_allocation_details.concat(db.cost_allocation_details)
    }
    

    for(let {details,...leak} of  revenue_leak){
        leak_header.push({
            tms_reference_no: leak.tms_reference_no,
            fk_tms_reference_no: leak.fk_tms_reference_no,
            draft_bill_type:'BUY',
            rdd:  leak.rdd,
            class_of_store: leak.class_of_store,
            job_id,
            revenue_leak_reason: leak.revenue_leak_reason,
            is_draft_bill: 0,
            trip_date: leak.trip_date
        })
        
        leak_details = leak_details.concat(details.map(({id,createdAt, updatedAt,...items}) => ({
            ...items,
            class_of_store: leak.class_of_store,
            draft_bill_type:'BUY'
        })))
    }

    await createDraftBill({
        contract_type: 'BUY',
        invoices,
        draft_bill_header,
        draft_bill_details,
        cost_allocation_details,
        leak_header,
        leak_details
    })
    
    return draft_bill
}
