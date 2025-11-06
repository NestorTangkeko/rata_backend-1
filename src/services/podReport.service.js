const Sequelize     = require('sequelize');
const {kronos, pod} = require('../models/datawarehouse');
const models        = require('../models/rata');
const round         = require('../helpers/round');
const moment        = require('moment');
const _             = require('lodash');

const getSum = (details,uom,field) => {
    return _.sumBy(details.filter(item => item.uom === uom), item => isNaN(parseFloat(item[field])) ? 0 : parseFloat(item[field]))
}

const getRevenueLeakNoFormula = ({invoices,draft_bill_details}) => {
    const revenue_leak_reason = 'NO FORMULA OR CONDITION MATCHED'
    
    return invoices.filter(item =>  draft_bill_details.map(dtl => dtl.tms_reference_no).includes(item.tms_reference_no))
    .map(item => {
        const {ship_point_from,ship_point_to,group_id,tariff,...header} = item;
        return {
            ...header,
            tariff_id: tariff.tariff_id,
            revenue_leak_reason
        }
    })
}

const getInvalidTotalCharges = ({invoices,draft_bill_details, total_charges}) => {
    const revenue_leak_reason = 'INVALID TOTAL CHARGES RESULT';

    return invoices.filter(item =>  draft_bill_details.map(dtl => dtl.tms_reference_no).includes(item.tms_reference_no))
    .map(item => {
        const {ship_point_from,ship_point_to,group_id,tariff,...header} = item;
        return {
            ...header,
            tariff_id: tariff.tariff_id,
            revenue_leak_reason
        }
    })
}

const getKronosTrips = async(trips=[]) => {
   return await kronos.query(`    
        Select 
        a.trip_log_id,
        d.type AS 'vehicle_type',
        a.trip_status,
        b.vehicle_id,
        c.trucker_id
        from trip_header a
        left join vehicle b on a.fk_assigned_vehicle_id = b.id
        left join trucker c on b.trucker_id = c.id
        LEFT JOIN vehicle_type d ON b.vehicle_type_id = d.id
        where trip_status in ('EXECUTED','INITIATED')
        and trip_log_id in (:trips)
    `,{
       type: Sequelize.QueryTypes.SELECT,
       replacements:{
            trips:trips.length === 0 ? '' :  _.uniq(trips)
       }
    })
}

const getPodInvoices = async({from,to}) => {
    const header =  await pod.query(`               
        Select     
        c.bookingRequestNo	    'tms_reference_no',    
        b.tripPlanNo			'trip_no',    
        b.trip_date			    'trip_date',    
        b.locationCode		    'location',    
        b.tripStatus			'trip_status',    
        b.actual_vendor		    'trucker_id',    
        b.actual_vehicle_type   'vehicle_type',    
        b.actual_vehicle_id	    'vehicle_id',    
        b.vendorId			    'planned_trucker',    
        b.truckType			    'planned_vehicle_type',    
        b.plateNo				'planned_vehicle_id',    
        c.serviceType			'service_type',    
        c.sub_service_type	    'sub_service_type',  
        c.invoiceNo             'invoice_no',    
        c.deliveryDate		    'rdd',    
        c.drNo				    'dr_no',    
        c.shipmentManifest	    'shipment_manifest',    
        c.customerCode		    'principal_code',    
        c.ship_from			    'stc_from',    
        c.shipToCode			'stc_to',    
        c.brStatus			    'br_status', 
        c.deliveryStatus		'delivery_status',    
        c.rudStatus			    'rud_status',    
        c.reasonCode			'reason_code',    
        d.is_billable			'is_billable',    
        c.date_cleared		    'cleared_date'    
        from trip_br_dtl_tbl a    
        left join trip_plan_hdr_tbl b on a.tripPlan = b.tripPlanNo    
        left join booking_request_hdr_tbl c on a.brNo = c.bookingRequestNo    
        left join reason_codes_tbl d on c.reasonCode = d.code    
        where cast(b.trip_date as date) between :from and :to 
        and c.deliveryStatus in ('DELIVERED_FULL','DELIVERED_PARTIAL')
        and c.rudStatus in (null,'CLEARED','NONE','PARTIAL')
        and c.brStatus in ('VERIFIED_COMPLETE', 'RETURNED_BY_TRUCKER')
        and b.tripStatus <> 'SHORT_CLOSED'
        and a.isDeleted <> 1
    `,{
        type: Sequelize.QueryTypes.SELECT,
        replacements:{
            from,
            to
        }
    })
    .then(result => {
        return result.map(item => ({
            ...item,
            status: item.br_status+'_'+item.rud_status
        }))
        .filter(item => item.status !== 'VERIFIED_COMPLETE_CLEARED')
    })

    const details = await pod.query(`
    Select distinct    
    a.tripPlan	      'trip_no',    
    a.brNo			  'br_no',    
    a.deliveryStatus  'delivery_status',
    b.class_of_stores 'class_of_store',    
    b.uom,    
    b.planned_qty,    
    b.planned_weight,    
    b.planned_cbm,    
    b.actual_qty,    
    CASE WHEN b.actual_qty = b.planned_qty THEN b.planned_weight ELSE b.actual_weight END 'actual_weight',  
    CASE WHEN b.actual_qty = b.planned_qty THEN b.planned_cbm  ELSE b.actual_cbm  END 'actual_cbm',  
    b.return_qty
    from (    
    select     
    ax.tripPlan,    
    ax.brNo,
    cx.deliveryStatus
    from trip_br_dtl_tbl ax    
    inner join trip_plan_hdr_tbl bx on ax.tripPlan = bx.tripPlanNo and ax.isDeleted = 0    
    left join booking_request_hdr_tbl cx on ax.brNo = cx.bookingRequestNo and ax.isDeleted = 0    
    where brNo in (:br)
    ) a    
        
    OUTER APPLY (    
        Select     
        bx.class_of_stores,    
        ax.uom,    
        SUM(ax.planned_qty) 'planned_qty',    
        SUM(ax.weight) 'planned_weight',    
        SUM(ax.cbm) 'planned_cbm',    
        SUM(ax.actual_qty) 'actual_qty',    
        SUM(ax.actual_weight) 'actual_weight',    
        SUM(ax.actual_cbm) 'actual_cbm',    
        SUM(ax.return_qty) 'return_qty',    
        SUM(ax.damaged_qty) 'damaged_qty',    
        SUM(ax.variance_qty) 'variance_qty',    
        SUM(ax.short_landed_qty) 'short_landed_qty',    
        SUM(ax.lost_qty) 'lost_qty'    
        from dispatch_item_dtl ax    
        left join booking_request_dtl_tbl bx on ax.br_no = bx.bookingRequestNo and ax.sku_code = bx.skuCode    
        where ax.trip_plan_id = a.tripPlan and ax.br_no = a.brNo    
        group by ax.uom,bx.class_of_stores    
    ) b`
    ,{
        type: Sequelize.QueryTypes.SELECT,
        replacements:{
            br: header.length === 0 ? '' : header.map(item => item.tms_reference_no)
        }
    })

    const shipPoints = await models.ship_point_tbl.findAll({
        where:{
            is_active: 1,
            stc_code: _.uniq(header.map(item => item.stc_from).concat(header.map(item => item.stc_to)))
        }
    }).then(result => JSON.parse(JSON.stringify(result)))
   
    return header.map(item => {
        const invoiceDetails = details.filter(a => a.br_no === item.tms_reference_no);
        const ship_point_from = shipPoints.find(a => String(a.stc_code).toLowerCase() === String(item.stc_from).toLowerCase())
        const ship_point_to = shipPoints.find(a => String(a.stc_code).toLowerCase() === String(item.stc_to).toLowerCase())
        const redel_remarks = String(item.invoice_no).split('|')
        
        return {
            ...item,
            is_billable: _.isNull(item.is_billable) ? 1 : item.is_billable,
            ship_point_from: ship_point_from ?? null,
            ship_point_to: ship_point_to ?? null,
            invoice_no: redel_remarks[0],
            redel_remarks: typeof redel_remarks[1] === 'undefined' ? null : redel_remarks[1],
            details: invoiceDetails,
        }
    })
}

const getHandedOverInvoices = async(trip_date) => {
    const header =  await pod.query(`               
        Select     
        c.bookingRequestNo	    'tms_reference_no',    
        b.tripPlanNo			'trip_no',    
        b.trip_date			    'trip_date',    
        b.locationCode		    'location',    
        b.tripStatus			'trip_status',    
        b.actual_vendor		    'trucker_id',    
        b.actual_vehicle_type   'vehicle_type',    
        b.actual_vehicle_id	    'vehicle_id',    
        b.vendorId			    'planned_trucker',    
        b.truckType			    'planned_vehicle_type',    
        b.plateNo				'planned_vehicle_id',    
        c.serviceType			'service_type',    
        c.sub_service_type	    'sub_service_type',  
        c.invoiceNo             'invoice_no',    
        c.deliveryDate		    'rdd',    
        c.drNo				    'dr_no',    
        c.shipmentManifest	    'shipment_manifest',    
        c.customerCode		    'principal_code',    
        c.ship_from			    'stc_from',    
        c.shipToCode			'stc_to',    
        c.brStatus			    'br_status', 
        c.deliveryStatus		'delivery_status',    
        c.rudStatus			    'rud_status',    
        c.reasonCode			'reason_code',    
        d.is_billable			'is_billable',    
        c.date_cleared		    'cleared_date'    
        from trip_br_dtl_tbl a    
        left join trip_plan_hdr_tbl b on a.tripPlan = b.tripPlanNo    
        left join booking_request_hdr_tbl c on a.brNo = c.bookingRequestNo    
        left join reason_codes_tbl d on c.reasonCode = d.code    
        where cast(b.trip_date as date) = :trip_date 
        and c.brStatus in ('VERIFIED_COMPLETE','HANDED_OVER_TO_TRUCKER' ,'RETURNED_BY_TRUCKER')
        and b.tripStatus <> 'SHORT_CLOSED'
        and a.isDeleted <> 1
    `,{
        type: Sequelize.QueryTypes.SELECT,
        replacements:{
            trip_date
        }
    })
    .then(result => {
        return result.map(item => ({
            ...item,
            status: item.br_status+'_'+item.rud_status
        }))
        //.filter(item => item.status !== 'VERIFIED_COMPLETE_CLEARED')
    })

    const details = await pod.query(`
        Select distinct    
        a.tripPlan	      'trip_no',    
        a.brNo			  'br_no',    
        a.deliveryStatus  'delivery_status',
        b.class_of_stores 'class_of_store',    
        b.uom,   
        b.planned_qty,    
        b.planned_weight ,
        b.planned_cbm,    
        b.planned_qty       'actual_qty',    
        b.planned_weight    'actual_weight',    
        b.planned_cbm       'actual_cbm',    
        b.return_qty
        from (    
        select     
        ax.tripPlan,    
        ax.brNo,
        cx.deliveryStatus
        from trip_br_dtl_tbl ax    
        inner join trip_plan_hdr_tbl bx on ax.tripPlan = bx.tripPlanNo and ax.isDeleted = 0    
        left join booking_request_hdr_tbl cx on ax.brNo = cx.bookingRequestNo and ax.isDeleted = 0    
        where brNo in (:br)
        ) a    
            
        OUTER APPLY (    
            Select     
            bx.class_of_stores,    
            ax.uom,    
            SUM(ax.planned_qty) 'planned_qty',    
            SUM(ax.weight) 'planned_weight',    
            SUM(ax.cbm) 'planned_cbm',    
            SUM(ax.actual_qty) 'actual_qty',    
            SUM(ax.actual_weight) 'actual_weight',    
            SUM(ax.actual_cbm) 'actual_cbm',    
            SUM(ax.return_qty) 'return_qty',    
            SUM(ax.damaged_qty) 'damaged_qty',    
            SUM(ax.variance_qty) 'variance_qty',    
            SUM(ax.short_landed_qty) 'short_landed_qty',    
            SUM(ax.lost_qty) 'lost_qty'    
            from dispatch_item_dtl ax    
            left join booking_request_dtl_tbl bx on ax.br_no = bx.bookingRequestNo and ax.sku_code = bx.skuCode    
            where ax.trip_plan_id = a.tripPlan and ax.br_no = a.brNo    
            group by ax.uom,bx.class_of_stores    
        ) b`
    ,{
        type: Sequelize.QueryTypes.SELECT,
        replacements:{
            br: header.length === 0 ? '' : header.map(item => item.tms_reference_no)
        }
    })

    const shipPoints = await models.ship_point_tbl.findAll({
        where:{
            is_active: 1,
            stc_code: _.uniq(header.map(item => item.stc_from).concat(header.map(item => item.stc_to)))
        }
    }).then(result => JSON.parse(JSON.stringify(result)))
   
    return header.map(item => {
        const invoiceDetails = details.filter(a => a.br_no === item.tms_reference_no);
        const ship_point_from = shipPoints.find(a => String(a.stc_code).toLowerCase() === String(item.stc_from).toLowerCase())
        const ship_point_to = shipPoints.find(a => String(a.stc_code).toLowerCase() === String(item.stc_to).toLowerCase())
        const redel_remarks = String(item.invoice_no).split('|')
        
        return {
            ...item,
            is_billable: _.isNull(item.is_billable) ? 1 : item.is_billable,
            ship_point_from: ship_point_from ?? null,
            ship_point_to: ship_point_to ?? null,
            invoice_no: redel_remarks[0],
            redel_remarks: typeof redel_remarks[1] === 'undefined' ? null : redel_remarks[1],
            details: invoiceDetails,
        }
    })
}

const getContract = async ({
    from,
    to,
    ...filter
}) => {
    const contractHeader = await models.contract_hdr_tbl.findAll({
        where:{
            contract_status:'APPROVED',
            ...filter
        }
    })
    .then(result=>JSON.parse(JSON.stringify(result)))

    const contractDetails = await models.contract_tariff_dtl.findAll({
        include:[
            {
                model: models.tariff_sell_hdr_tbl,
                required:false
            },
            {
                model:models.agg_tbl,
                required:false,
            },
            {
                model:models.agg_conditions_tbl,
                required:false
            },
            {
                model: models.tariff_ic_algo_tbl,
                where: {
                    algo_status:'ACTIVE'
                },
                required:false,
            }
        ],
        where: {
            [Sequelize.Op.or]:[
                Sequelize.where(Sequelize.cast(from,'text'),{[Sequelize.Op.between]:[Sequelize.col('valid_from'),Sequelize.col('valid_to')]}),
                Sequelize.where(Sequelize.cast(to,'text'),{[Sequelize.Op.between]:[Sequelize.col('valid_from'),Sequelize.col('valid_to')]}),   
            ],
            [Sequelize.Op.and]:[
                {
                    status:'ACTIVE',
                    contract_id: contractHeader.map(item => item.contract_id)
                },
            ]
        }
    })
    .then(result=>JSON.parse(JSON.stringify(result)))

    return contractHeader.map(header => {
        const contract_tariff_dtls = contractDetails.filter(detail => header.contract_id === detail.contract_id)
        return {
            ...header,
            contract_tariff_dtls 
        }
    })
}

const groupByTripDate = async (data = []) => {
    return _.groupBy(data, 'trip_date')
}

const formatByClassOfStore = async (invoices) => {
    try{
        let invoiceData = [];
        invoices.map(invoice => {
            const {details,...header} = invoice;
            const group = _.groupBy(details, item => item.class_of_store)
            
            Object.keys(group).map((class_of_store,i) => {
                const invDetails = group[class_of_store];
                const tms_reference_no = i > 0 ? `${header.tms_reference_no}-${i}` : header.tms_reference_no
                  
                invoiceData.push({
                    ...header,
                    tms_reference_no,
                    fk_tms_reference_no: header.tms_reference_no,
                    class_of_store: class_of_store,
                    details: invDetails.map(item => {
                        return {
                            ...item,
                            br_no: tms_reference_no
                        }
                    })
                })
            })
        })

        return invoiceData

    }
    catch(e){
        throw e
    }
}

const getBillableInvoices = async(invoices) => {
    let revenue_leak = [];
    const data = invoices.filter(item => (item.is_billable === 1 || item.is_billable) && item.ship_point_from && item.ship_point_to)
   
    const notBillable = invoices.filter(item => !item.is_billable)
    .map(item => {
        const {ship_point_from,ship_point_to,...header} = item;
        
        return {
            ...header,
            revenue_leak_reason: 'NOT BILLABLE REVENUE'
        }
    });

    const noShipPoint = invoices.filter(item => !(item.ship_point_to && item.ship_point_from)).map(item => {
        const {ship_point_from,ship_point_to,...header} = item;
        return {
            ...header,
            revenue_leak_reason: 'NO SHIP POINT INFORMATION'
        }
    });

    revenue_leak = revenue_leak.concat(noShipPoint,notBillable);

    return {
        data,
        revenue_leak
    }

}


const getBillableInvoicesBuy = async(invoices) => {
    let revenue_leak = [];
    const data = invoices.filter(item => (item.is_billable_buy === 1 || item.is_billable_buy) && item.ship_point_from && item.ship_point_to)

    const notBillable = invoices.filter(item => !item.is_billable_buy)
    .map(item => {
        const {ship_point_from,ship_point_to,...header} = item;

        return {
            ...header,
            revenue_leak_reason: 'NOT BILLABLE EXPENSE'
        }
    });

    const noShipPoint = invoices.filter(item => !(item.ship_point_to && item.ship_point_from)).map(item => {
        const {ship_point_from,ship_point_to,...header} = item;
        return {
            ...header,
            revenue_leak_reason: 'NO SHIP POINT INFORMATION'
        }
    });

    revenue_leak = revenue_leak.concat(noShipPoint,notBillable);

    return {
        data,
        revenue_leak
    }

}

const assignContract = async({invoices, contracts}) => {
    let data = [];
    let revenue_leak = [];
    const revenue_leak_reason = 'NO CONTRACT'

    contracts.map(contract => {
        const filtered_data = invoices.filter(item => {
            if(contract.contract_type === 'SELL'){
                return item.principal_code === contract.principal_code
            }
            else {
                // for modification later
                return item.vg_code === contract.vendor_group
            }
         })
        .map(item => {
            return {
                ...item,
                contract_id: contract.contract_id
            }
        })

        data = data.concat(filtered_data)
    })

    revenue_leak = invoices.filter(item => {
        return !data.map(item2 => item2.tms_reference_no).includes(item.tms_reference_no)
    })
    .map(item => {
        const {contract,ship_point_from,ship_point_to,...header} = item;
        return {
            ...header,
            contract_id:null,
            revenue_leak_reason: revenue_leak_reason,
        }
    })

    return {
        data,
        revenue_leak
    }
}

const getTariffs = async({contracts}) => {
    let tariffs = [];

    contracts.map(contract => {
        const {contract_id,contract_tariff_dtls} = contract;

        contract_tariff_dtls.map(tariff => {
            const {
                tariff_id,
                tariff_rate,
                min_rate,
                valid_from,
                valid_to,
                tariff_sell_hdr_tbl,
                tariff_ic_algo_tbls,
                agg_tbl,
                agg_conditions_tbls
            } = tariff;

            tariffs.push({
                contract_id,
                tariff_id,
                tariff_rate,
                min_rate,
                valid_from,
                valid_to,
                tariff_ic_algo_tbls,
                agg_conditions_tbls,
                ...tariff_sell_hdr_tbl,
                ...agg_tbl,
                
            })
        })
    })
    

    return tariffs;
}

const assignTariff = async({invoices, contracts, contract_type}) => {
    let data = [];
    let revenue_leak = [];
    const contract_tariffs = await getTariffs({contracts});

    for (let invoice of invoices){
        const {details, ...header} = invoice;
        const tariffs = contract_tariffs
        .filter(item => item.contract_id === header.contract_id && (moment(header.trip_date).diff(item.valid_from,'days') >= 0 && moment(item.valid_to).diff(header.trip_date) >= 0))
        .filter(tariff => {
            let {
                service_type,
                from_geo_type,
                from_geo,
                to_geo_type,
                to_geo,
                location,
                vehicle_type,    
                class_of_store,
                sub_service_type,
            } = tariff;

            const inv_stc_from              = header?.ship_point_from[String(from_geo_type).toLowerCase()] || null
            const inv_stc_to                = header?.ship_point_to[String(to_geo_type).toLowerCase()] || null
            const invoice_sub_service_type  = String(invoice.sub_service_type).toLowerCase();

            if( String(contract_type).toUpperCase() === 'SELL'){
                if(String(location).toLowerCase()           === String(invoice.location).toLowerCase()      &&
                (String(inv_stc_from).toLowerCase()         === String(from_geo).toLowerCase()              &&
                String(inv_stc_to).toLowerCase()            === String(to_geo).toLowerCase())               &&
                service_type                                === invoice.service_type                        &&
                (invoice_sub_service_type===null || invoice_sub_service_type==='null' || invoice_sub_service_type=== '' ?   true : (invoice_sub_service_type === String(sub_service_type).toLowerCase())))
                {
                    //if tariff has vehicle type maintained
                    if(vehicle_type){
                        //if tariff is equal to invoice vehicle type
                        if(vehicle_type === invoice.vehicle_type){
                            
                            //if tariff class off store is null 
                            if(!class_of_store){
                                return true
                            }
                            else{
                                //if class of store is not null
                                //check if the invoice class of store is equal to the tariff
                                if(String(class_of_store).toLowerCase() === String(invoice.class_of_store).toLowerCase()){
                                    return true
                                }

                                return false
                            }
                        } 
                        return false 
                    }
                    else{
                        //check if the invoice class of store is equal to the tariff
                        if(String(class_of_store).toLowerCase() === String(invoice.class_of_store).toLowerCase()){
                        
                            return true
                        }

                        return false
                    }
                }
            }
            else{
                if(String(location).toLowerCase()           === String(invoice.location).toLowerCase()      &&
                (String(inv_stc_from).toLowerCase()         === String(from_geo).toLowerCase()              &&
                String(inv_stc_to).toLowerCase()            === String(to_geo).toLowerCase())               &&
                service_type                                === invoice.service_type)
                {
                    //if tariff has vehicle type maintained
                    if(vehicle_type){
                        //if tariff is equal to invoice vehicle type
                        if(vehicle_type === invoice.vehicle_type){
                            
                            //if tariff class off store is null 
                            if(!class_of_store){
                                return true
                            }
                            else{
                                //if class of store is not null
                                //check if the invoice class of store is equal to the tariff
                                if(String(class_of_store).toLowerCase() === String(invoice.class_of_store).toLowerCase()){
                                    return true
                                }

                                return false
                            }
                        } 
                        return false 
                    }
                    else{
                        //check if the invoice class of store is equal to the tariff
                        if(String(class_of_store).toLowerCase() === String(invoice.class_of_store).toLowerCase()){
                        
                            return true
                        }

                        return false
                    }
                }
            }

            return false
        })

        if(tariffs.length === 1){
            const tariff={
                tariff_id:          tariffs[0].tariff_id,
                tariff_type:        tariffs[0].tariff_type,
                min_billable_unit:  tariffs[0].min_billable_unit,
                min_value:          tariffs[0].min_value,
                max_value:          tariffs[0].max_value,
                tariff_rate:        Number(tariffs[0].tariff_rate),
                min_rate:           Number(tariffs[0].min_rate),
                group_by:           tariffs[0].group_by,
                parameter:          tariffs[0].parameter,
                with_agg:           tariffs[0].with_agg,
                fk_agg_id:          tariffs[0].fk_agg_id,
                from_geo_type:      tariffs[0].from_geo_type,
                to_geo_type:        tariffs[0].from_geo_type,
                contract_type:      tariffs[0].contract_type,
                tariff_ic:          tariffs[0].tariff_ic_algo_tbls,
                conditions:         tariffs[0].agg_conditions_tbls
            }

            data.push({
                ...invoice,
                group_id: typeof tariff.group_by === 'string' ?  tariff.group_by.split(',').map(item =>  invoice[item]).join('|') : null,
                tariff
            })
        }

        if(tariffs.length > 1){
                
            const {ship_point_from,ship_point_to,...header} = invoice
            revenue_leak.push({
                ...header,
                tariff_id: null,
                revenue_leak_reason: 'DUPLICATE TARIFF'
            })
        }

        if(tariffs.length === 0){
            const {ship_point_from,ship_point_to,...header} = invoice
            
            revenue_leak.push({
                ...header,
                tariff_id:null,
                revenue_leak_reason:'NO TARIFF'
            })
        }
    }

    return {
        data,
        revenue_leak
    }
}

const getGroupedInvoices = async({invoices}) => {
    return _.groupBy(invoices,(item) => {
        return item.group_id
    })
}

const draftBillWithAgg = async({contract_type,invoices}) => {
    try{
        let data = [];
        let draft_bills = [];
        let revenue_leak = [];

        const aggData = invoices.filter(item => {
            if(contract_type === 'SELL'){
                return item.tariff.with_agg
            }
            else {
                return item.is_ic===0&&item.tariff.with_agg
            }
        });

        const raw_group = await getGroupedInvoices({invoices:aggData});

        //Group the data per group id
        Object.keys(raw_group).map(group_id => {
            const groupedInvoice = raw_group[group_id];
            const invoice = contract_type === 'SELL' ? groupedInvoice[0] : _.maxBy(groupedInvoice, i => Number(i.tariff.tariff_rate))
            const parameters = invoice.tariff.parameter ? invoice.tariff.parameter.split(',') : null
            
            let draft_bill_details = [];
            
            //compute the sum of items per invoice
            groupedInvoice.map(item => {
                const details = item.details;
                const planned_qty       = _.sum(details.map(d => isNaN(Number(d.planned_qty))            ? 0 : Number(d.planned_qty))) 
                const actual_qty        = _.sum(details.map(d => isNaN(Number(d.actual_qty))             ? 0 : Number(d.actual_qty)))   
                const planned_weight    = _.sumBy(details,item => isNaN(parseFloat(item.planned_weight)) ? 0 : round(item.planned_weight,2))
                const planned_cbm       = _.sumBy(details,item => isNaN(parseFloat(item.planned_cbm))    ? 0 : round(item.planned_cbm,2))
                const actual_weight     = _.sumBy(details,item => isNaN(parseFloat(item.actual_weight))  ? 0 : round(item.actual_weight,2))
                const actual_cbm        = _.sumBy(details,item => isNaN(parseFloat(item.actual_cbm))     ? 0 : round(item.actual_cbm,2))
                const return_qty        = _.sumBy(details,item => isNaN(parseFloat(item.return_qty))     ? 0 : round(item.return_qty,2))

                draft_bill_details.push({
                    draft_bill_no:      '',
                    tms_reference_no:   item.tms_reference_no,
                    fk_tms_reference_no:item.fk_tms_reference_no,
                    principal_code:     item.principal_code,
                    br_no:              item.br_no,
                    delivery_date:      item.rdd,
                    trip_date:          item.trip_date,
                    location:           item.location,
                    trip_plan:          item.trip_no,
                    shipment_manifest:  item.shipment_manifest,
                    dr_no:              item.dr_no,
                    invoice_no:         item.invoice_no,
                    delivery_status:    item.delivery_status,
                    vehicle_type:       item.vehicle_type,
                    tariff_id:          item.tariff.tariff_id,
                    contract_id:        item.contract_id,
                    service_type:       item.service_type,
                    sub_service_type:   item.sub_service_type,
                    min_billable_value: Number(item.tariff.min_value) || item.tariff.min_value,
                    max_billable_value: Number(item.tariff.max_value) || item.tariff.max_value,
                    min_billable_unit:  item.tariff.min_billable_unit,
                    from_geo_type:      invoice.tariff.from_geo_type,
                    ship_from:          item.stc_from,
                    to_geo_type:        invoice.tariff.to_geo_type,
                    ship_to:            item.stc_to,
                    remarks:            item.redel_remarks,
                    class_of_store:     item.class_of_store,
                    planned_trucker:        item.planned_trucker,
                    planned_vehicle_type:   item.planned_vehicle_type,
                    planned_vehicle_id:     item.planned_vehicle_id,
                    kronos_trip_status:     item.kronos_trip_status,
                    br_status:              item.br_status,
                    uom:                    details[0]?.uom ?? null,
                    rud_status:         item.rud_status,
                    planned_qty:        round(planned_qty,2),
                    actual_qty:         round(actual_qty,2),
                    actual_weight:      round(actual_weight,2),  
                    actual_cbm:         round(actual_cbm,2), 
                    planned_weight:     round(planned_weight,2),
                    planned_cbm:        round(planned_cbm,2),
                    return_qty:         round(return_qty,2)     
                })
            })

            data.push({
                draft_bill_no:      null,
                draft_bill_date:    null,
                contract_type:      contract_type,
                service_type:       invoice.service_type,
                trip_no:            invoice.trip_no,
                contract_id:        invoice.contract_id,
                tariff_id:          invoice.tariff.tariff_id,
                customer:           invoice.principal_code,
                vendor:             invoice.trucker_id,
                location:           invoice.location,
                ship_from:          invoice.stc_from,
                ship_point:         invoice.stc_to,
                delivery_date:      invoice.rdd,
                trip_date:          invoice.trip_date,
                rate:               invoice.tariff.tariff_rate,
                min_rate:           invoice.tariff.min_rate,
                vehicle_type:       invoice.vehicle_type,
                min_billable_value: invoice.tariff.min_value,
                max_billable_value: invoice.tariff.max_value,
                min_billable_unit:  invoice.tariff.min_billable_unit,
                conditions:         invoice.tariff.conditions,
                tariff:             invoice.tariff,
                planned_trucker:        invoice.planned_trucker,
                planned_vehicle_type:   invoice.planned_vehicle_type,
                planned_vehicle_id:     invoice.planned_vehicle_id,
                kronos_trip_status:     invoice.kronos_trip_status,
                sub_service_type:       invoice.sub_service_type,
                vehicle_id:             invoice.vehicle_id,
                parameters,
                draft_bill_details
            })

        })

        data.map(draft_bill => {
            //declare variables
            let aggregatedValues = {
                total_cbm:null,
                total_weight:null,
                total_qty:null
            }

            let total_charges = null;

            if(draft_bill.parameters) {
                const total_cbm     = _.sumBy(draft_bill.draft_bill_details,item => isNaN(parseFloat(item.actual_cbm)) ? 0 :    parseFloat(item.actual_cbm))
                const total_weight  = _.sumBy(draft_bill.draft_bill_details,item => isNaN(parseFloat(item.actual_weight))? 0 :  parseFloat(item.actual_weight))
                const total_qty     = _.sumBy(draft_bill.draft_bill_details,item => isNaN(parseFloat(item.actual_qty)) ? 0 :    parseFloat(item.actual_qty))
                    
                aggregatedValues = {
                    ...aggregatedValues,
                    total_cbm:      isNaN(Number(total_cbm))    ? 0 : round(total_cbm,4),
                    total_weight:   isNaN(Number(total_weight)) ? 0 : round(total_weight,4),
                    total_qty:      isNaN(Number(total_qty))    ? 0 : round(total_qty,4)
                }
            }
            else{
                const total_cbm     = _.sumBy(draft_bill.draft_bill_details,item => isNaN(parseFloat(item.actual_cbm)) ? 0 :    parseFloat(item.actual_cbm))
                const total_weight  = _.sumBy(draft_bill.draft_bill_details,item => isNaN(parseFloat(item.actual_weight))? 0 :  parseFloat(item.actual_weight))
                    
                aggregatedValues = {
                    ...aggregatedValues,
                    total_cbm:      isNaN(Number(total_cbm))    ? 0 : round(total_cbm,4),
                    total_weight:   isNaN(Number(total_weight)) ? 0 : round(total_weight,4),
                }

            }

            //compute total charges
            const invoice = aggregatedValues;
            let aggCondition = {
                condition:null,
                formula:null,
            }

            for(const cnd of draft_bill.conditions){
                const {tariff} = draft_bill;
                const condition = cnd.raw_condition.split(',').join('')
                const fn = new Function(['tariff','invoice'],'return ' +condition)

                if(fn(tariff,invoice) || fn(tariff,invoice) === null){
                    const formula = cnd.raw_formula.split(',').join('')
                    const fnFormula = new Function(['tariff','invoice'],'return '+formula)
                    total_charges = round(round(Number(fnFormula(tariff,invoice)) * 100,2) / 100, 2);
                   
                    aggCondition = {
                        ...aggCondition,
                        condition:condition,
                        formula:formula
                    }

                    break; 
                }
            }

           

            const {conditions,tariff,parameters,...header} = draft_bill;
            const df = {
                ...header,
                total_charges: total_charges,
                ...aggCondition,
                ...aggregatedValues,
                draft_bill_details:header.draft_bill_details,
            }
            //revenue_leaks
            if(!aggCondition.formula) {
                revenue_leak = revenue_leak.concat(getRevenueLeakNoFormula({
                    invoices:invoices,
                    draft_bill_details: header.draft_bill_details
                }))

            }
            else if(!total_charges || Number(total_charges) <= 0 || isNaN(parseFloat(total_charges)))  {
                revenue_leak = revenue_leak.concat(getInvalidTotalCharges({
                    invoices:invoices,
                    draft_bill_details: header.draft_bill_details,
                    total_charges
                }))
            }
            else {
                //push clean draft bill
                draft_bills.push(df)
            }
        })

        return {
            data: draft_bills,
            revenue_leak
        }
    }
    catch(e){
        throw e
    }
}

const draftBillWithoutAgg = async({contract_type,invoices}) => {
    try{

        let data = [];
        let revenue_leak = [];
        const withoutAggData = invoices.filter(item => {
            if(contract_type === 'SELL'){
                return !item.tariff.with_agg
            }
            else {
                return item.is_ic === 0&&!item.tariff.with_agg
            }
        });

        withoutAggData.map(invoice => {
            const details = invoice.details;
            const planned_qty       = _.sumBy(details, item => round(item.planned_qty,2)) 
            const actual_qty        = _.sumBy(details,item => round(item.actual_qty,2))     
         
            const planned_weight    = _.sumBy(details, item => isNaN(Number(item.planned_weight)) ? 0 : round(item.planned_weight,2))
            const planned_cbm       = _.sumBy(details, item => isNaN(Number(item.planned_cbm)) ? 0 :    round(item.planned_cbm,2))
            const actual_weight     = _.sumBy(details, item => isNaN(Number(item.actual_weight)) ? 0 :  round(item.actual_weight,2))
            const actual_cbm        = _.sumBy(details, item => isNaN(Number(item.actual_cbm)) ? 0 :     round(item.actual_cbm,2))
            const return_qty        = _.sumBy(details, item => isNaN(Number(item.return_qty)) ? 0 :     round(item.return_qty,2))
            const uom               = details[0]?.uom ?? null; 

            let aggCondition = {
                condition:null,
                formula:null,
            }

            let total_charges = null;
            let total_data = {
                total_cbm:      round(actual_cbm,4),
                total_weight:   round(actual_weight,4),
                total_qty:      round(actual_qty,4)
            }

            for(const cnd of invoice.tariff.conditions){
                const condition = cnd.raw_condition.split(',').join('')
                const fn = new Function(['tariff','invoice'],'return '+condition)
                if(fn(invoice.tariff,total_data) || fn(invoice.tariff,total_data) === null){
                    const formula = cnd.raw_formula.split(',').join('')
                    const fnFormula = new Function(['tariff','invoice'],'return '+formula)
                    total_charges = round(round(Number(fnFormula(invoice.tariff,invoice)) * 100,2) / 100, 2)
                    aggCondition = {
                        ...aggCondition,
                        condition: condition,
                        formula: formula
                    }
                }
            }

            const draft_bill = {
                draft_bill_no:          null,
                draft_bill_date:        null,
                contract_type:          contract_type,
                service_type:           invoice.service_type,
                trip_no:                invoice.trip_no,
                contract_id:            invoice.contract_id,
                tariff_id:              invoice.tariff.tariff_id,
                customer:               invoice.principal_code,
                vendor:                 invoice.trucker_id,
                location:               invoice.location,
                ship_from:              invoice.stc_from,
                ship_point:             invoice.stc_to,
                delivery_date:          invoice.rdd,
                trip_date:              invoice.trip_date,
                rate:                   invoice.tariff.tariff_rate,
                min_rate:               invoice.tariff.min_rate,
                vehicle_type:           invoice.vehicle_type,
                min_billable_value:     Number(invoice.tariff.min_value) || null,
                max_billable_value:     Number(invoice.tariff.max_value) || null,
                min_billable_unit:      invoice.tariff.min_billable_unit,
                planned_trucker:        invoice.planned_trucker,
                planned_vehicle_type:   invoice.planned_vehicle_type,
                planned_vehicle_id:     invoice.planned_vehicle_id,
                kronos_trip_status:     invoice.kronos_trip_status,
                sub_service_type:       invoice.sub_service_type,
                vehicle_id:             invoice.vehicle_id,
                ...aggCondition,
                ...total_data,
                total_charges,
                draft_bill_details: [
                    {
                        draft_bill_no:      null,
                        tms_reference_no:   invoice.tms_reference_no,
                        fk_tms_reference_no:invoice.fk_tms_reference_no,
                        principal_code:     invoice.principal_code,
                        br_no:              invoice.br_no,
                        delivery_date:      invoice.rdd,
                        trip_date:          invoice.trip_date,
                        location:           invoice.location,
                        trip_plan:          invoice.trip_no,
                        shipment_manifest:  invoice.shipment_manifest,
                        dr_no:              invoice.dr_no,
                        invoice_no:         invoice.invoice_no,
                        delivery_status:    invoice.delivery_status,
                        vehicle_type:       invoice.vehicle_type,
                        tariff_id:          invoice.tariff.tariff_id,
                        contract_id:        invoice.contract_id,
                        service_type:       invoice.service_type,
                        sub_service_type:   invoice.sub_service_type,
                        min_billable_value: invoice.tariff.min_value,
                        max_billable_value: invoice.tariff.max_value,
                        min_billable_unit:  invoice.tariff.min_billable_unit,
                        from_geo_type:      invoice.tariff.from_geo_type,
                        ship_from:          invoice.stc_from,
                        to_geo_type:        invoice.tariff.to_geo_type,
                        ship_to:            invoice.stc_to,
                        remarks:            invoice.redel_remarks,
                        class_of_store:     invoice.class_of_store,
                        br_status:          invoice.br_status,
                        rud_status:         invoice.rud_status,
                        uom,
                        planned_qty,
                        actual_qty,
                        actual_weight,  
                        actual_cbm,     
                        planned_weight,
                        planned_cbm,
                        return_qty,
                        billing: null
                        //billing: total_charges     
                    }
                ],
            }
            //revenue_leak
            if(!aggCondition.formula){
                revenue_leak = revenue_leak.concat(getRevenueLeakNoFormula({invoices,draft_bill_details:draft_bill.draft_bill_details}))
            }
            else if(!total_charges || parseFloat(total_charges) <= 0 || isNaN(parseFloat(total_charges))){
                revenue_leak = revenue_leak.concat(getInvalidTotalCharges({invoices,draft_bill_details:draft_bill.draft_bill_details,total_charges}))
            }
            else{
                data.push(draft_bill)
            }  
        })

        return {
            data: data,
            revenue_leak: revenue_leak
        }
    }
    catch(e){
        throw e
    }
}

const sellValidation = async(draft_bill=[], revenue_leak=[], invoices=[], isRevLeak = false) => {
    //group by principal and trip number
    let leak_invoice = [];
    const leak_trip = draft_bill.filter(db => revenue_leak.filter(rl => rl.revenue_leak_reason !== 'NOT BILLABLE').map(rl => rl.trip_no+rl.principal_code).includes(db.trip_no+db.customer))
    
    leak_trip.map(item => {
        leak_invoice = leak_invoice.concat(item.draft_bill_details.map(dtl => {
            const invoice = invoices.find(i => i.tms_reference_no === dtl.fk_tms_reference_no)
            return {
                ...invoice,
                tms_reference_no: dtl.tms_reference_no,
                fk_tms_reference_no: dtl.fk_tms_reference_no,
                class_of_store: dtl.class_of_store,
                draft_bill_type: 'SELL',
                rdd: dtl.delivery_date,
                revenue_leak_reason: 'TRANSACTION ERROR',
                is_draft_bill: 0,
                trip_date: invoice.trip_date,
                details: invoice.details.filter(i => i.class_of_store === dtl.class_of_store)
            }
        }))
    })
    
    return {
        revenue_leak: leak_invoice,
        draft_bill: draft_bill.filter(item => !leak_trip.map(l => l.trip_no+l.customer).includes(item.trip_no+item.customer)),
    }
    
}

const assignDraftBillNo = async(draft_bill = [], current=0) => {
    let count = 1 + current;

    const generateDraftBillNo = ({count}) => {
        return `B${moment().format('MMDDYY')}${String(count).padStart(5,"00000")}`
    }

    return draft_bill.map(item => {
        const {draft_bill_details,ship_from,ship_point,...header} = item
        const draft_bill_no =  generateDraftBillNo({count: count})
        const draft_bill_invoice_tbl = draft_bill_details.map((detail,index) => {
            let billing = 0;

            if(draft_bill_details.length === 1) {
                billing = header.total_charges
            }
            else{   
                if(String(header.min_billable_unit).toUpperCase() === 'CBM'){
                    billing = ( detail.actual_cbm / header.total_cbm ) * header.total_charges
                }
                else if(String(header.min_billable_unit).toUpperCase() === 'WEIGHT'){
                    billing = ( detail.actual_weight / header.total_weight ) * header.total_charges
                }
                else if(['CASE','PIECE'].includes(String(header.min_billable_unit).toUpperCase())){
                    billing = ( detail.actual_qty / header.total_qty ) * header.total_charges
                }
                else {
                    if(index === draft_bill_details.length - 1){
                        billing=Math.floor(header.total_charges/draft_bill_details.length)  + (header.total_charges%draft_bill_details.length)        
                    }
                    else{
                        billing=Math.floor(header.total_charges/draft_bill_details.length)
                    }
                }

            }

            return {
                ...detail,
                draft_bill_no,
                billing: round(billing,4)
            }
        })

        count = count+=1

        return {
            ...header,
            draft_bill_no,
            draft_bill_date:moment().format('YYYY-MM-DD'),
            stc_from: ship_from,
            stc_to: ship_point,
            details: draft_bill_invoice_tbl
        }
    })
}

const assignVendorGroup = async (invoices=[]) => {
    const getVendorGroup = await models.vendor_group_dtl_tbl.findAll({
        include:[
            {
                model: models.vendor_tbl,
                as: 'vendor_hdr'
            }
        ],
        where:{
            vg_vendor_status: 'ACTIVE'
        }
    })

    return invoices.map(item => {
        const vendor = getVendorGroup.find(a => a.vg_vendor_id === item.trucker_id && String(a.location).toLowerCase() === String(item.location).toLowerCase())
        return {
            ...item,
            vg_code: vendor ? vendor?.vg_code : null,
            is_ic: vendor ? vendor.vendor_hdr?.is_ic : null
        }
    })
}

const draftBillIC = async({invoices}) => {
    let data = [];
    let revenue_leak = [];
    const ic = invoices.filter(item => item.is_ic === 1);

    const raw_group = await getGroupedInvoices({invoices:ic});

    Object.keys(raw_group).map(group_id => {
        const groupedInvoice = raw_group[group_id];
        const invoice = groupedInvoice[0];
        let draft_bill_details = [];
        const tariffIC = invoice.tariff.tariff_ic;
        let rates = [];
        let total_charges = null;
        
        //compute the sum of items per invoice
        groupedInvoice.map(item => {
            const details = item.details;
            
            const planned_qty       = _.sumBy(details,i => isNaN(Number(i.planned_qty)) ? 0 : Number(i.planned_qty)) 
            const actual_qty        = getSum(details,item.tariff.min_billable_unit,'actual_qty')         
            const ic_qty            = _.sumBy(details,item => {
                if(item.uom === 'PIECE') {
                    return 1
                } 
                return parseFloat(item.actual_qty)
            })

            const planned_weight    = _.sumBy(details, item => isNaN(parseFloat(item.planned_weight)) ? 0 : parseFloat(item.planned_weight))
            const planned_cbm       = _.sumBy(details, item => isNaN(parseFloat(item.planned_cbm)) ? 0 :    parseFloat(item.planned_cbm))
            const actual_weight     = _.sumBy(details, item => isNaN(parseFloat(item.actual_weight)) ? 0 :  parseFloat(item.actual_weight))
            const actual_cbm        = _.sumBy(details, item => isNaN(parseFloat(item.actual_cbm)) ? 0 :     parseFloat(item.actual_cbm))
            const return_qty        = _.sumBy(details, item => isNaN(parseFloat(item.return_qty)) ? 0 :     parseFloat(item.return_qty))

            draft_bill_details.push({
                draft_bill_no:      '',
                tms_reference_no:   item.tms_reference_no,
                fk_tms_reference_no:item.fk_tms_reference_no,
                principal_code:     item.customer,
                br_no:              item.br_no,
                delivery_date:      item.rdd,
                trip_date:          item.trip_date,
                location:           item.location,
                trip_plan:          item.trip_no,
                shipment_manifest:  item.shipment_manifest,
                dr_no:              item.dr_no,
                invoice_no:         item.invoice_no,
                delivery_status:    item.delivery_status,
                vehicle_type:       item.vehicle_type,
                tariff_id:          item.tariff.tariff_id,
                contract_id:        item.contract_id,
                service_type:       item.service_type,
                sub_service_type:   item.sub_service_type,
                min_billable_value: Number(item.tariff.min_value) || item.tariff.min_value,
                max_billable_value: Number(item.tariff.max_value) || item.tariff.max_value,
                min_billable_unit:  item.tariff.min_billable_unit,
                from_geo_type:      invoice.tariff.from_geo_type,
                ship_from:          item.stc_from,
                to_geo_type:        invoice.tariff.to_geo_type,
                ship_to:            item.stc_to,
                remarks:            item.redel_remarks,
                class_of_store:     item.class_of_store,
                principal_code:     item.principal_code,
                rud_status:         item.rud_status,
                planned_qty:        round(planned_qty,2),
                actual_qty:         round(actual_qty,2),
                ic_qty:             round(ic_qty,2),
                actual_weight:      round(actual_weight,2),  
                actual_cbm:         round(actual_cbm,2), 
                planned_weight:     round(planned_weight,2),
                planned_cbm:        round(planned_cbm,2),
                br_status:              item.br_status,
                planned_trucker:        item.planned_trucker,
                planned_vehicle_type:   item.planned_vehicle_type,
                planned_vehicle_id:     item.planned_vehicle_id,
                kronos_trip_status:     item.kronos_trip_status,
                uom:                    details[0]?.uom ?? null,
                return_qty     
            })
        })

        //group invoices per stc
        //sum ic qty per stc/drop
        const groupByStc = _.groupBy(draft_bill_details,item => item.ship_to)
        Object.keys(groupByStc).map(stc => {
            const details = groupByStc[stc]
            const total_ic_qty = _.sumBy(details,item => item.ic_qty)

            tariffIC.filter(item => item.uom === details[0].min_billable_unit)
            .filter(ic => total_ic_qty >= ic.min_value && total_ic_qty <= ic.max_value)
            .map(item => {  
                rates.push(parseFloat(item.rate))
            })
        })

        //compute total charges
        if(['L300','L300CV'].includes(invoice.vehicle_type)) {
            /** 
             * L300 Total Charges Computation
             * 1. Sort the rates in descending order
             * 2. Remove the first element from array
             * 3. Add the base rate
            */
            const sorted = rates.sort().reverse()
            sorted.shift();
            total_charges = round(Number(invoice.tariff.tariff_rate) + _.sum(sorted),2)
        }
        else {
            total_charges = round(_.sum(rates),2)
        }

        let total_weight  =round( _.sumBy(draft_bill_details, item => parseFloat(item.actual_weight)),2);
        let total_cbm     =round( _.sumBy(draft_bill_details, item => parseFloat(item.actual_cbm)),2);
        let total_qty     = round(_.sumBy(draft_bill_details, item => parseFloat(item.actual_qty)),2);

        if(!total_charges || Number(total_charges) <= 0 || isNaN(parseFloat(total_charges)))  {
            
            revenue_leak = revenue_leak.concat(getInvalidTotalCharges({
                invoices:invoices,
                draft_bill_details,
                total_charges
            }))
        }
        else {
            data.push({
                draft_bill_no:      null,
                draft_bill_date:    null,
                contract_type:      'BUY',
                service_type:       invoice.service_type,
                trip_no:            invoice.trip_no,
                contract_id:        invoice.contract_id,
                tariff_id:          invoice.tariff.tariff_id,
                customer:           invoice.principal_code,
                vendor:             invoice.trucker_id,
                location:           invoice.location,
                ship_from:          invoice.stc_from,
                ship_point:         invoice.stc_to,
                delivery_date:      invoice.rdd,
                trip_date:          invoice.trip_date,
                rate:               invoice.tariff.tariff_rate,
                min_rate:           invoice.tariff.min_rate,
                total_charges,
                vehicle_type:       invoice.vehicle_type,
                min_billable_value: invoice.tariff.min_value,
                max_billable_value: invoice.tariff.max_value,
                min_billable_unit:  invoice.tariff.min_billable_unit,
                total_cbm:          isNaN(total_cbm) ? null : total_cbm,
                total_qty:          isNaN(total_qty) ? null : total_qty,
                total_weight:       isNaN(total_weight) ? null :total_weight,     
                planned_trucker:        invoice.planned_trucker,
                planned_vehicle_type:   invoice.planned_vehicle_type,
                planned_vehicle_id:     invoice.planned_vehicle_id,
                kronos_trip_status:     invoice.kronos_trip_status,
                vehicle_id:             invoice.vehicle_id,
                draft_bill_details,
            })
        }
    })

    return {
        data,
        revenue_leak
    }
}

const draftBillCostAlloc = async(draft_bills=[], vehicleTypes = [], hasCostAlloc=[]) => {
 
    return draft_bills.map(draft_bill => {
        const isCostAlloc = hasCostAlloc.find(item => draft_bill.contract_type === item.draft_bill_type && draft_bill.service_type === item.service_type)
        const vehicleType = vehicleTypes.find(item => item.vehicle_type === draft_bill.vehicle_type)
        let cost_allocation_details = [];

        console.log(vehicleType)
        
        if(isCostAlloc) {
            Object.keys(_.groupBy(draft_bill.details,'principal_code')).map(principal => {
                const detail         = draft_bill.details.filter(item => principal === item.principal_code);
                const total_cbm      = round(_.sum(detail.map(item => Number(item.actual_cbm))),2);
                const total_cost     = draft_bill.total_charges;
               
                cost_allocation_details.push({
                    draft_bill_no:      draft_bill.draft_bill_no,
                    trip_no:            draft_bill.trip_no,
                    service_type:       draft_bill.service_type,
                    vendor_id:          draft_bill.vendor_id,
                    principal_code:     principal,
                    vehicle_type:       draft_bill.vehicle_type,
                    vehicle_capacity:   vehicleType?.overall_volume,
                    vendor_id:          draft_bill.vendor,
                    total_cbm,
                    total_cost
                })
            })

            //CHECKING OF UTILIZATION SIZE
            //total utilization size of cost allocation details
            const totalCBM = _.sum(cost_allocation_details.map(item => item.total_cbm));
            if(totalCBM >= vehicleType.overall_volume){
                cost_allocation_details     = cost_allocation_details.map(item => {
                    const allocation        = round((item.total_cbm / totalCBM) * 100, 2)
                    const allocated_cost    = round((item.total_cbm / totalCBM) * item.total_cost, 2)
                    return {
                        ...item,
                        allocation,
                        allocated_cost
                    }
                })
            }
            else{
                cost_allocation_details     = cost_allocation_details.map(item => {
                    const allocation        = round((item.total_cbm / item.vehicle_capacity) * 100, 2)
                    const allocated_cost    = round((item.total_cbm / item.vehicle_capacity) * item.total_cost, 2)
                    return {
                        ...item,
                        allocation,
                        allocated_cost
                    }
                })

                //computation for default principal
                const total_cbm  = vehicleType?.overall_volume - totalCBM;
                const allocation = round((total_cbm / vehicleType?.overall_volume * 100), 2);
                const allocated_cost = round((total_cbm / vehicleType?.overall_volume) * draft_bill.total_charges, 2);
                cost_allocation_details = cost_allocation_details.concat([
                        {
                            draft_bill_no:      draft_bill.draft_bill_no,
                            trip_no:            draft_bill.trip_no,
                            service_type:       draft_bill.service_type,
                            vendor_id:          draft_bill.vendor_id,
                            principal_code:     '000',
                            vehicle_type:       draft_bill.vehicle_type,
                            vehicle_capacity:   vehicleType?.overall_volume,
                            vendor_id:          draft_bill.vendor,
                            total_cbm,          
                            allocation,
                            allocated_cost,
                            total_cost:         draft_bill.total_charges
                        }
                    ])
                }
        }

        return {
            ...draft_bill,
            cost_allocation_details 
        }
    })
}

const tripValidation = async(draft_bill=[], revenue_leak=[], invoices=[], isRevLeak = false) => {
    let leak_invoice = [];
    const leak_trip = draft_bill.filter(db => revenue_leak.filter(rl => rl.revenue_leak_reason !== 'NOT BILLABLE').map(rl => rl.trip_no).includes(db.trip_no))

    leak_trip.map(item => {
        leak_invoice = leak_invoice.concat(item.draft_bill_details.map(dtl => {
            const invoice = invoices.find(i => i.tms_reference_no === dtl.fk_tms_reference_no)

            return {
                ...invoice,
                tms_reference_no: dtl.tms_reference_no,
                fk_tms_reference_no: dtl.fk_tms_reference_no,
                class_of_store: dtl.class_of_store,
                draft_bill_type: 'BUY',
                rdd: dtl.delivery_date,
                revenue_leak_reason: 'TRANSACTION ERROR',
                is_draft_bill: 0,
                trip_date: invoice.trip_date,
                details: invoice.details.filter(i => i.class_of_store === dtl.class_of_store)
            }
        }))
    })
    
    return {
        revenue_leak: leak_invoice,
        draft_bill: draft_bill.filter(item => !leak_trip.map(l => l.trip_no).includes(item.trip_no)),
    }
}

const getKronosVehicleTypes = async() => {
    return await kronos.query('Select * from vehicle_type',{
        type: Sequelize.QueryTypes.SELECT
    })
}

const outlierTagging = async(draft_bill_details = [], vehicleTypes = []) => {
    let trips  = [];
    
    const groupedDetails = _.groupBy(draft_bill_details, i => i.trip_plan)
    Object.keys(groupedDetails).map(tripPlanNo => {
        const trip = (groupedDetails[tripPlanNo])[0]
        const allTrips = groupedDetails[tripPlanNo]
        const vehicle_type =vehicleTypes.find(i => String(i.type).toUpperCase() === String(trip.vehicle_type).toUpperCase())

        const overall_volume =  vehicle_type ? Number(vehicle_type.overall_volume) : null;
        const threshold_base_cap = overall_volume * 1.1;
        const planned_volume = _.sum(allTrips.map(i => Number(i.planned_cbm)))

        let outlier_status = !vehicle_type ? 'NOT_APPLICABLE' : 
        planned_volume >  threshold_base_cap ? 'OUTLIER' : 'NON_OUTLIER';

        trips = trips.concat(
            allTrips.map(item => ({
                ...item,
                overall_volume,
                outlier_status
            }))
        )

        // trips.push({
        //     trip_plan_no: tripPlanNo,
        //     vehicle_type: trip.vehicle_type, 
        //     overall_volume,
        //     threshold_base_cap,
        //     planned_volume,
        //     outlier_status
        // })
    });

    

    return trips
}

const outlierTaggingLeak = async(leak_header=[], leak_details=[], vehicleTypes = []) => {
    let trips  = [];
    const groupedDetails = _.groupBy(leak_header, i => i.trip_no);
    Object.keys(groupedDetails).map(tripPlanNo => {
        const trip = (groupedDetails[tripPlanNo])[0]
        const allTrips = groupedDetails[tripPlanNo]
        const vehicle_type =vehicleTypes.find(i => String(i.type).toUpperCase() === String(trip.vehicle_type).toUpperCase())
        const overall_volume = !vehicle_type ? null : Number(vehicle_type.overall_volume)
        const threshold_base_cap = overall_volume * 1.1;
        const planned_volume = _.sum(leak_details.filter(i => i.trip_no === tripPlanNo).map(i => Number(i.planned_cbm)))

        let outlier_status = !vehicle_type ? 'NOT_APPLICABLE' : 
        planned_volume >  threshold_base_cap ? 'OUTLIER' : 'NON_OUTLIER';

        trips = trips.concat(allTrips.map(i => ({
            ...i,
            //planned_volume,
            overall_volume,
            outlier_status
        })))
    })

    //console.log(trips.filter(i => i.trip_no === 'TRP000301792'))
    //    console.log(trips.filter(i => i.tms_reference_no === 'BR002515272'))

    return trips
}

const joinedInvoices = async({from, to}) => {
    const pod = await getPodInvoices({
        from,
        to
    })

    const kronos = await getKronosTrips(pod.map(item => item.trip_no))

    return pod.map(item => {
        const vehicleData = kronos.find(a => a.trip_log_id === item.trip_no)

        return {
            ...item,
            trucker_id:             vehicleData?.trucker_id ?? null,
            vehicle_type:           vehicleData?.vehicle_type ?? null,
            vehicle_id:             vehicleData?.vehicle_id ?? null,
            kronos_trip_status:     vehicleData?.trip_status ?? null
        }
    })
}

const joinedHandedOverInvoices = async(trip_date) => {
    const pod = (await getHandedOverInvoices(trip_date)).filter(item => item.service_type === '2001')

    const kronos = await getKronosTrips(pod.map(item => item.trip_no))

    return pod.map(item => {
        const vehicleData = kronos.find(a => a.trip_log_id === item.trip_no)

        return {
            ...item,
            trucker_id:             vehicleData?.trucker_id ?? null,
            vehicle_type:           vehicleData?.vehicle_type ?? null,
            vehicle_id:             vehicleData?.vehicle_id ?? null,
            kronos_trip_status:     vehicleData?.trip_status ?? null
        }
    })
}

const podSell = async({ 
    data = [],
    from = null,
    to = null
}) => {
    let draft_bill = [];
    let revenue_leak = [];
    let invoice = [];

    const rawData = await groupByTripDate(data)
    const contracts = await getContract({
        from,
        to,
        contract_type:'SELL',
        principal_code: _.uniq(data.map(item => item.principal_code))
    })

    for(let trip_date of Object.keys(rawData))
    {
        let raw = await formatByClassOfStore(rawData[trip_date])
        raw = await getBillableInvoices(raw)
        revenue_leak = revenue_leak.concat(raw.revenue_leak)

        raw = await assignContract({ invoices: raw.data, contracts})
        revenue_leak = revenue_leak.concat(raw.revenue_leak)
        
        raw = await assignTariff({invoices: raw.data, contracts, contract_type: 'SELL'})
        revenue_leak = revenue_leak.concat(raw.revenue_leak)

        const withAgg = await draftBillWithAgg({
            invoices: raw.data,
            contract_type:'SELL'
        })

        const withoutAgg = await draftBillWithoutAgg({
            invoices: raw.data,
            contract_type:'SELL'
        })

        revenue_leak = revenue_leak.concat(withAgg.revenue_leak, withoutAgg.revenue_leak)

        raw = await sellValidation([].concat(withAgg.data,withoutAgg.data), revenue_leak,data,false)
        draft_bill = draft_bill.concat(await assignDraftBillNo(raw.draft_bill, draft_bill.length))
        revenue_leak = revenue_leak.concat(raw.revenue_leak)
    }

    return {
        draft_bill,
        revenue_leak,
        invoice,
    };
}

const podBuy = async({
    data = [],
    from = null,
    to = null
}) => {
    let draft_bill = [];
    let revenue_leak = [];
    let invoice = [];


    let assignVGroup = await assignVendorGroup(data);
    const raw_data = await groupByTripDate(assignVGroup);

    const contracts = await getContract({
        from,
        to,
        contract_type: 'BUY',
        vendor_group: _.uniq(assignVGroup.map(item => item.vg_code))
    })

    for(let trip_date of Object.keys(raw_data)) {
        let raw = await formatByClassOfStore(raw_data[trip_date])
        let temp_draft_bill = []; 
        let temp_rev_leak  = [];

        raw             = await getBillableInvoices(raw)
        temp_rev_leak   = temp_rev_leak.concat(raw.revenue_leak)

        raw             = await assignContract({ invoices: raw.data, contracts})
        temp_rev_leak   = temp_rev_leak.concat(raw.revenue_leak)

        raw             = await assignTariff({invoices: raw.data, contracts, contract_type: 'BUY'})
        temp_rev_leak   = temp_rev_leak.concat(raw.revenue_leak)

        const ic        = await draftBillIC({invoices: raw.data})
        const withAgg   = await draftBillWithAgg({invoices: raw.data, contract_type: 'BUY'})
        const withoutAgg =  await draftBillWithoutAgg({invoices: raw.data, contract_type:'BUY'})
 
        temp_rev_leak   = temp_rev_leak.concat(withAgg.revenue_leak,withoutAgg.revenue_leak, ic.revenue_leak)

        raw             = await tripValidation([].concat(ic.data, withAgg.data, withoutAgg.data), temp_rev_leak, assignVGroup, false)
        draft_bill      = draft_bill.concat(await assignDraftBillNo(raw.draft_bill, draft_bill.length));
        revenue_leak    = revenue_leak.concat(temp_rev_leak,raw.revenue_leak)
    }
   
    return {
        draft_bill,
        revenue_leak,
        invoice,
    }   
}

module.exports = {
    getContract,
    groupByTripDate,
    formatByClassOfStore,
    getBillableInvoices,
    getBillableInvoicesBuy,
    assignContract,
    assignTariff,
    draftBillWithAgg,
    draftBillWithoutAgg,
    sellValidation,
    assignVendorGroup,
    draftBillCostAlloc,
    getKronosVehicleTypes,
    outlierTagging,
    outlierTaggingLeak,
    joinedInvoices,
    joinedHandedOverInvoices,
    podSell,
    podBuy
}

