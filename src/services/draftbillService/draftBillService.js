/**
 * Generate Draft Bill Steps
 * 1. Format Invoice by class of store
 * 2. Identify Billable and with complete ship point information invoices
 * 3. Assign Contract
 * 4. Assign Tariff
 * 
 * BUY LOGIC 
 * 1. Identify IC Vendors; Create Draft Bill 
 * 2. Identify With Aggregation Invoices; Create Draft Bill
 * 3. Identify without aggregation invoices; create draft bill
 *  
 * SELL LOGIC
 * 1. Identify With Aggregation Invoices; Create Draft Bill
 * 2. Identify without aggregation invoices; create draft bill
 * 
 * Draft Bill Creation
 * 1. Concatenate Draft Bills
 * 2. Assign Draft Bill No
 * 
 * Revenue Leak Reasons
 *      - No Ship Point Information
		- Not Billable
		- No Contract
		- No Tariff
		- Duplicate Tariff 
		- No Formula or Condtion Match
		- Invalid Total Charges result
 */
const _ = require('lodash');
const { Sequelize,sequelize } = require('../../models/rata');
const models = require('../../models/rata');
const moment = require('moment')
const round = require('../../helpers/round');
const costAllocation = require('../costalloc.service');
const {v4: uuid} = require('uuid');

const {Op} = Sequelize;

const getSum = (details,uom,field) => {
    return _.sumBy(details.filter(item => item.uom === uom), item => isNaN(parseFloat(item[field])) ? 0 : parseFloat(item[field]))
}

const getContracts = async ({trip_date,where}) => {
    try{
        return await models.contract_hdr_tbl.getContracts({
            where:{
                ...where,
                contract_status:'APPROVED',
                valid_from: {
                    [Op.lte]: trip_date
                },
                valid_to:{
                    [Op.gte]: trip_date
                }
            },
            options:{
                include:[
                    {
                        model:models.contract_tariff_dtl,
                        include:[
                            {
                               model: models.tariff_sell_hdr_tbl,
                            //    required:true,
                            //    where:{
                            //         tariff_status: 'APPROVED'
                            //    }
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
                        required:false,
                        where:{

                            status:'ACTIVE',
                            valid_from: {
                                [Op.lte]: trip_date
                            },
                            valid_to:{
                                [Op.gte]: trip_date
                            }
                        },
                   
                    },
                ]
            },
        })
    }
    catch(e){
        throw e
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

const getGroupedInvoices = async({invoices}) => {
    return _.groupBy(invoices,(item) => {
        return item.group_id
    })
}

const getRevenueLeakNoFormula = ({invoices,draft_bill_details}) => {
    //let revenue_leak = [];
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

const formatByClassOfStore = async({invoices}) => {
    try{
        let invoiceData = [];
        invoices.map(invoice => {
            const {helios_invoices_dtl_tbls,vendor_tbl,...header} = invoice;
            
            const group = _.groupBy(helios_invoices_dtl_tbls, item => item.class_of_store)
            Object.keys(group).map((class_of_store,i) => {
                const details = group[class_of_store];
                const tms_reference_no = i > 0 ? `${header.tms_reference_no}-${i}` : header.tms_reference_no
                invoiceData.push({
                    ...header,
                    tms_reference_no,
                    fk_tms_reference_no: header.tms_reference_no,
                    class_of_store: class_of_store,
                    details: details.map(item => {
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

const getBillableInvoices = async({invoices}) => {
    try{
        let revenue_leak = [];
        const data = invoices.filter(item => item.is_billable === 1 && item.ship_point_from && item.ship_point_to)
        
        const notBillable = invoices.filter(item => item.is_billable === 0)
        .map(item => {
            const {ship_point_from,ship_point_to,...header} = item;
            
            return {
                ...header,
                revenue_leak_reason: 'NOT BILLABLE'
            }
        })

        revenue_leak = revenue_leak.concat(notBillable)

        const noShipPoint = invoices.filter(item => !(item.ship_point_to && item.ship_point_from)).map(item => {
            const {ship_point_from,ship_point_to,...header} = item;
            return {
                ...header,
                revenue_leak_reason: 'NO SHIP POINT INFORMATION'
            }
        })

        revenue_leak = revenue_leak.concat(noShipPoint)

        return {
            data,
            revenue_leak
        }
    }
    catch(e){
        throw e
    }
}

const assignContract = async({invoices,contracts}) =>{
    try{
        let data = [];
        let revenue_leak = [];
        const revenue_leak_reason = 'NO CONTRACT'
        contracts.map(contract => {
            const filtered_data = invoices.filter(item => {
                if(contract.contract_type === 'SELL'){
                    return item.principal_code === contract.principal_code
                }
                else {
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
    catch(e){
        throw e
    }
}

const assignTariff = async({invoices,contracts,contract_type}) => {
    try{
        let data = []
        let revenue_leak = []
        const contract_tariffs = await getTariffs({contracts});

        invoices.map(invoice => {
            const {details,...header} = invoice;
            const tariffs = contract_tariffs
            .filter(item => item.contract_id === header.contract_id)
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

                if(String(contract_type).toUpperCase() === 'SELL'){
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
        }) 

        return {
            data,
            revenue_leak
        }
    }
    catch(e){
        throw e
    }
}

const draftBillIC = async({invoices}) => {
    try{
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
                
                const planned_qty       = getSum(details,item.tariff.min_billable_unit,'planned_qty') 
                const actual_qty        = getSum(details,item.tariff.min_billable_unit,'actual_qty')     
                const ic_qty            = _.sumBy(details,item => {
                    if(item.uom === 'PIECE') {
                        return 1
                    } 
                    return parseFloat(item.actual_qty)
                })

                const planned_weight    = _.sumBy(details, item => isNaN(parseFloat(item.planned_weight)) ? 0 : parseFloat(item.planned_weight))
                const planned_cbm       = _.sumBy(details, item => isNaN(parseFloat(item.planned_cbm)) ? 0 : parseFloat(item.planned_cbm))
                const actual_weight     = _.sumBy(details, item => isNaN(parseFloat(item.actual_weight)) ? 0 : parseFloat(item.actual_weight))
                const actual_cbm        = _.sumBy(details, item => isNaN(parseFloat(item.actual_cbm)) ? 0 : parseFloat(item.actual_cbm))
                const return_qty        = _.sumBy(details, item => isNaN(parseFloat(item.return_qty)) ? 0 : parseFloat(item.return_qty))

                draft_bill_details.push({
                    draft_bill_no:      '',
                    tms_reference_no:   item.tms_reference_no,
                    fk_tms_reference_no:item.fk_tms_reference_no,
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
                    planned_qty,
                    actual_qty,
                    ic_qty,
                    actual_weight,  
                    actual_cbm, 
                    planned_qty,     
                    planned_weight,
                    planned_cbm,
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
                    total_cbm: isNaN(total_cbm) ? null : total_cbm,
                    total_qty: isNaN(total_qty) ? null : total_qty,
                    total_weight: isNaN(total_weight) ? null :total_weight,       
                    draft_bill_details,
                })
            }
        })

        return {
            data,
            revenue_leak
        }

    }
    catch(e){
        throw e
    }
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
            const invoice = contract_type === 'SELL' ? groupedInvoice[0] : _.maxBy(groupedInvoice, i => i.tariff.tariff_rate)
            const parameters = invoice.tariff.parameter ? invoice.tariff.parameter.split(',') : null
           
            let draft_bill_details = [];
            
            //compute the sum of items per invoice
            groupedInvoice.map(item => {
                const details = item.details;
                const planned_qty       = _.sum(details.map(d => isNaN(Number(d.planned_qty)))           ? 0 : Number(d.planned_qty)) 
                const actual_qty        = _.sum(details.map(d => isNaN(Number(d.actual_qty))             ? 0 : Number(d.actual_qty)))    
                const planned_weight    = _.sumBy(details,item => isNaN(parseFloat(item.planned_weight)) ? 0 : parseFloat(item.planned_weight))
                const planned_cbm       = _.sumBy(details,item => isNaN(parseFloat(item.planned_cbm))    ? 0 :   parseFloat(item.planned_cbm))
                const actual_weight     = _.sumBy(details,item => isNaN(parseFloat(item.actual_weight))  ? 0 :   parseFloat(item.actual_weight))
                const actual_cbm        = _.sumBy(details,item => isNaN(parseFloat(item.actual_cbm))     ? 0 :   parseFloat(item.actual_cbm))
                const return_qty        = _.sumBy(details,item => isNaN(parseFloat(item.return_qty))     ? 0 :   parseFloat(item.return_qty))

                draft_bill_details.push({
                    draft_bill_no:      '',
                    tms_reference_no:   item.tms_reference_no,
                    fk_tms_reference_no:item.fk_tms_reference_no,
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
                    planned_qty,
                    actual_qty,
                    actual_weight,  
                    actual_cbm, 
                    planned_qty,     
                    planned_weight,
                    planned_cbm,
                    return_qty     
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
                parameters,
                conditions: invoice.tariff.conditions,
                tariff:     invoice.tariff,
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
                    total_cbm:      isNaN(Number(total_cbm))    ? 0 : round(total_cbm,2),
                    total_weight:   isNaN(Number(total_weight)) ? 0 : round(total_weight,2),
                    total_qty:      isNaN(Number(total_qty))    ? 0 : round(total_qty,2)
                }
            }
            else{
                const total_cbm     = _.sumBy(draft_bill.draft_bill_details,item => isNaN(parseFloat(item.actual_cbm)) ? 0 :    parseFloat(item.actual_cbm))
                const total_weight  = _.sumBy(draft_bill.draft_bill_details,item => isNaN(parseFloat(item.actual_weight))? 0 :  parseFloat(item.actual_weight))
                    
                aggregatedValues = {
                    ...aggregatedValues,
                    total_cbm:      isNaN(Number(total_cbm))    ? 0 : round(total_cbm,2),
                    total_weight:   isNaN(Number(total_weight)) ? 0 : round(total_weight,2),
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
                draft_bill_details: header.draft_bill_details.map(( item,index) => {
                    let billing = 0;

                    if(String(header.min_billable_unit).toLowerCase() === 'cbm'){
                        billing = ( item.actual_cbm / aggregatedValues.total_cbm ) * total_charges
                    }     
                    
                    else if(String(header.min_billable_unit).toLowerCase() === 'weight'){
                        billing = ( item.actual_weight / aggregatedValues.total_weight ) * total_charges
                    }

                    else if(['CASE','PIECE'].includes(String(header.min_billable_unit).toUpperCase())){
                        billing = ( item.actual_qty / aggregatedValues.total_qty ) * total_charges
                    }
                    
                    else {
                        if(index === header.draft_bill_details.length - 1){
                            billing=Math.floor(total_charges/header.draft_bill_details.length)  + (total_charges%header.draft_bill_details.length)
                        }   
                        else{
                            billing=Math.floor(total_charges/header.draft_bill_details.length)
                        }  
                    }

                    return {
                        ...item,
                        billing: isNaN(billing.toFixed(2)) ? null : round(billing,4) //billing.toFixed(2)
                    }
                })
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
            const planned_qty       = getSum(details,invoice.tariff.min_billable_unit,'planned_qty') 
            const actual_qty        = getSum(details,invoice.tariff.min_billable_unit,'actual_qty')     
         
            const planned_weight    = _.sumBy(details, item => isNaN(Number(item.planned_weight)) ? 0 : Number(item.planned_weight))
            const planned_cbm       = _.sumBy(details, item => isNaN(Number(item.planned_cbm)) ? 0 :    Number(item.planned_cbm))
            const actual_weight     = _.sumBy(details, item => isNaN(Number(item.actual_weight)) ? 0 :  Number(item.actual_weight))
            const actual_cbm        = _.sumBy(details, item => isNaN(Number(item.actual_cbm)) ? 0 :     Number(item.actual_cbm))
            const return_qty        = _.sumBy(details, item => isNaN(Number(item.return_qty)) ? 0 :     Number(item.return_qty))

            let aggCondition = {
                condition:null,
                formula:null,
            }

            let total_charges = null;
            let total_data = {
                total_cbm:      round(actual_cbm,2),
                total_weight:   round(actual_weight,2),
                total_qty:      round(actual_qty,2)
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
                min_billable_value: Number(invoice.tariff.min_value) || null,
                max_billable_value: Number(invoice.tariff.max_value) || null,
                min_billable_unit:  invoice.tariff.min_billable_unit,
                ...aggCondition,
                ...total_data,
                total_charges,
                draft_bill_details: [
                    {
                        draft_bill_no:      null,
                        tms_reference_no:   invoice.tms_reference_no,
                        fk_tms_reference_no:invoice.fk_tms_reference_no,
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
                        principal_code:     invoice.principal_code,
                        planned_qty,
                        actual_qty,
                        actual_weight,  
                        actual_cbm, 
                        planned_qty,     
                        planned_weight,
                        planned_cbm,
                        return_qty,
                        billing: total_charges     
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

const assignDraftBillNo = async({draft_bill}) => {
    try{
        let count = await models.draft_bill_hdr_tbl.max('draft_bill_no', {
            where:{
                draft_bill_date: moment().format('YYYY-MM-DD')
            }
        }).then(result => {
            return Number(String(result).substring(7))
        })
      
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

const createDraftBill = async({draft_bill, revenue_leak,invoices, contract_type,job_id}) => {
    try{
        return await sequelize.transaction (async t => {
            let revenue_leak_details = [];
            await models.draft_bill_hdr_tbl.bulkCreateData({
                data:draft_bill.map(item => {
                    return {
                        ...item,
                        job_id
                    }
                }),
                options:{
                    transaction: t,
                    include:[
                        {
                            model:models.draft_bill_details_tbl,
                            as:'details'
                        },
                        {
                            model: models.draft_bill_cost_alloc_tbl,
                            as:'cost_allocation_details'
                        }
                    ]
                }
            })

            const updateData = contract_type === 'SELL' ? {
                is_processed_sell: 1
            } : 
            {
                is_processed_buy: 1
            }

            await models.helios_invoices_hdr_tbl.updateData({
                data:{
                    ...updateData
                },
                where:{
                    tms_reference_no: invoices.map(item => item.tms_reference_no)
                },
                options:{
                    transaction: t
                },
            })

            await models.transport_rev_leak_hdr_tbl.bulkCreateData({
                data: revenue_leak.map(item => {
                    revenue_leak_details = revenue_leak_details.concat(item.details)
                    return {
                        tms_reference_no: item.tms_reference_no,
                        fk_tms_reference_no: item.fk_tms_reference_no,
                        class_of_store: item.class_of_store,
                        draft_bill_type: contract_type,
                        is_draft_bill: 0,
                        rdd: item.rdd,
                        trip_date: item.trip_date,
                        revenue_leak_reason: item.revenue_leak_reason,
                        job_id
                    }
                }),
                options:{
                    transaction: t,
                    ignoreDuplicates: true
                }
            })

            await models.tranport_rev_leak_dtl_tbl.bulkCreateData({
                data: revenue_leak_details.map(item => {
                    return {
                        ...item,
                        id: uuid(),
                        draft_bill_type: contract_type
                    }
                }),
                options:{
                    transaction: t,
                    ignoreDuplicates: true
                }
            })
        })
    }
    catch(e){
        throw e
    }
}

const createRevenueLeak = async({draft_bill, revenue_leak, invoices, type, user=null}) => {
    try{
        return await sequelize.transaction(async t => {
            await models.draft_bill_hdr_tbl.bulkCreateData({
                data:draft_bill,
                options:{
                    transaction: t,
                    include:[
                        {
                            model:models.draft_bill_details_tbl,
                            as:'details'
                        },
                        {
                            model: models.draft_bill_cost_alloc_tbl,
                            as: 'cost_allocation_details'
                        }
                    ]
                }
            })

            await models.transport_rev_leak_hdr_tbl.updateData({
                data:{
                    is_draft_bill: 1,
                    updated_by: user
                },
                where:{
                    tms_reference_no: invoices.map(item => item.tms_reference_no),
                    draft_bill_type: type
                },
                options:{
                    transaction: t
                }
            })

            await models.transport_rev_leak_hdr_tbl.bulkCreateData({
                data: revenue_leak,
                options:{
                    transaction: t,
                    updateOnDuplicate: ['revenue_leak_reason','updatedAt']
                }
            })
        })
    }
    catch(e){
        throw e
    }
}

const tripValidation = async(draft_bill=[], revenue_leak=[], invoices=[], isRevLeak = false) => {
    let leak_invoice = [];
    const leak_trip = draft_bill.filter(db => revenue_leak.filter(rl => rl.revenue_leak_reason !== 'NOT BILLABLE').map(rl => rl.trip_no).includes(db.trip_no))

    leak_trip.map(item => {
        leak_invoice = leak_invoice.concat(item.draft_bill_details.map(dtl => {
            const invoice = invoices.find(i => i.tms_reference_no === dtl.fk_tms_reference_no)
            return {
                tms_reference_no: dtl.tms_reference_no,
                fk_tms_reference_no: dtl.fk_tms_reference_no,
                class_of_store: dtl.class_of_store,
                draft_bill_type: 'BUY',
                rdd: dtl.delivery_date,
                revenue_leak_reason: 'TRANSACTION ERROR',
                job_id: invoice.job_id,
                is_draft_bill: 0,
                trip_date: invoice.trip_date,
                details: isRevLeak ? invoice.tranport_rev_leak_dtl_tbls : invoice.helios_invoices_dtl_tbls.filter(i => i.class_of_store === dtl.class_of_store)
            }
        }))
    })
    
    return {
        revenue_leak: leak_invoice,
        draft_bill: draft_bill.filter(item => !leak_trip.map(l => l.trip_no).includes(item.trip_no)),
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
                tms_reference_no: dtl.tms_reference_no,
                fk_tms_reference_no: dtl.fk_tms_reference_no,
                class_of_store: dtl.class_of_store,
                draft_bill_type: 'SELL',
                rdd: dtl.delivery_date,
                revenue_leak_reason: 'TRANSACTION ERROR',
                job_id: invoice.job_id,
                is_draft_bill: 0,
                trip_date: invoice.trip_date,
                details: isRevLeak ? invoice.tranport_rev_leak_dtl_tbls : invoice.details
            }
        }))
    })
    
    return {
        revenue_leak: leak_invoice,
        draft_bill: draft_bill.filter(item => !leak_trip.map(l => l.trip_no+l.customer).includes(item.trip_no+item.customer)),
    }
    
}

const buy = async ({
    invoices,
    trip_date,
    job_id
}) => {
    try{
        let data;
        let revenue_leak = [];
        let draft_bill = [];

        const contracts = await getContracts({
            trip_date,
            where:{
                contract_type:'BUY',
                vendor_group: _.uniq(invoices.map(item => item.vg_code))
            }
        })

        //1. format data by class of store
        const raw_data = await formatByClassOfStore({
            invoices
        })

        //2. Identify Billable invoices
        data = await getBillableInvoices({invoices:raw_data});
        revenue_leak = revenue_leak.concat(data.revenue_leak);

        //3. Assign Contract
        data = await assignContract({invoices:data.data,contracts})
        revenue_leak = revenue_leak.concat(data.revenue_leak)

        //4. Assign Tariff
        data = await assignTariff({invoices:data.data,contracts,contract_type:'BUY'})
        revenue_leak = revenue_leak.concat(data.revenue_leak)

        //5. Draft Bill IC
        const ic =          await draftBillIC({invoices: data.data})
        const withAgg =     await draftBillWithAgg({invoices: data.data, contract_type:'BUY'})
        const withoutAgg =  await draftBillWithoutAgg({invoices: data.data, contract_type:'BUY'})

        draft_bill = draft_bill.concat(ic.data,withAgg.data,withoutAgg.data)
        //draft_bill = await assignDraftBillNo({draft_bill})
        revenue_leak = revenue_leak.concat(withAgg.revenue_leak,withoutAgg.revenue_leak, ic.revenue_leak)

        data = await tripValidation(draft_bill, revenue_leak, invoices, false);
        draft_bill = await assignDraftBillNo({draft_bill:data.draft_bill});
        revenue_leak = revenue_leak.concat(data.revenue_leak);

        //cost allocation function
        draft_bill = await costAllocation.draftBillCostAlloc(draft_bill)
        /*insert to db*/
        await createDraftBill({
            draft_bill:draft_bill,
            revenue_leak: revenue_leak,
            invoices,
            contract_type: 'BUY',
            job_id: job_id || null
        })

        return {
            //data
            data: draft_bill,
            revenue_leak,
        }
    }
    catch(e){
        throw e
    }

}

const sell = async ({
    invoices,
    trip_date,
    job_id
}) => {
    try{
        let data;
        let revenue_leak = [];
        let draft_bill = []

        const contracts = await getContracts({
            trip_date,
            where:{
                principal_code:_.uniq(invoices.map(item => item.principal_code)),
                contract_type:'SELL'
            }
        })

        //1. format data by class of store
        const raw_data = await formatByClassOfStore({
            invoices
        })

        //2. Identify Billable invoices
        data = await getBillableInvoices({invoices:raw_data});
        revenue_leak = revenue_leak.concat(data.revenue_leak);

        //3. Assign Contract
        data = await assignContract({invoices:data.data,contracts})
        revenue_leak = revenue_leak.concat(data.revenue_leak)

        //4. Assign Tariff
        data = await assignTariff({invoices:data.data,contracts,contract_type:'SELL'})
        revenue_leak = revenue_leak.concat(data.revenue_leak)
      
        //6. compute normal draft bill with agg
        const withAgg = await draftBillWithAgg({invoices:data.data,contract_type:'SELL'})

        //7. compute normal draft bill without agg
        const withoutAgg = await draftBillWithoutAgg({invoices: data.data,contract_type:'SELL'})

        draft_bill = draft_bill.concat(withAgg.data,withoutAgg.data)
        revenue_leak = revenue_leak.concat(withAgg.revenue_leak,withoutAgg.revenue_leak)

        data = await sellValidation(draft_bill,revenue_leak,raw_data,false);
        draft_bill = await assignDraftBillNo({draft_bill: data.draft_bill})
        revenue_leak = revenue_leak.concat(data.revenue_leak);

        //insert to db
        await createDraftBill({
            draft_bill:draft_bill,
            revenue_leak: revenue_leak,
            invoices,
            contract_type: 'SELL',
            job_id: job_id || null
        })

        return {
            data:draft_bill,
            revenue_leak: revenue_leak,
        }

    }
    catch(e){
        throw e
    }
}

const replanBuy = async({invoices,trip_date, user=null}) => {
    try{
        let data;
        let revenue_leak = [];
        let draft_bill = [];

        const contracts = await getContracts({
            trip_date,
            where:{
                contract_type:'BUY',
                vendor_group: _.uniq(invoices.map(item => item.vg_code))
            }
        })

        data = await getBillableInvoices({invoices});
        revenue_leak = revenue_leak.concat(data.revenue_leak);

        data = await assignContract({
            invoices: data.data,
            contracts
        })

        revenue_leak = revenue_leak.concat(data.revenue_leak);


        data = await assignTariff({
            invoices:data.data,
            contracts,
            contract_type:'BUY'
        })

        revenue_leak = revenue_leak.concat(data.revenue_leak);

        const ic =          await draftBillIC({invoices: data.data})
        const withAgg =     await draftBillWithAgg({invoices: data.data, contract_type:'BUY'})
        const withoutAgg =  await draftBillWithoutAgg({invoices: data.data, contract_type:'BUY'})

        draft_bill = draft_bill.concat(ic.data,withAgg.data,withoutAgg.data)
        // draft_bill = await assignDraftBillNo({draft_bill})
        revenue_leak = revenue_leak.concat(withAgg.revenue_leak,withoutAgg.revenue_leak)

        data = await tripValidation(draft_bill, revenue_leak, invoices, true);
        draft_bill = await assignDraftBillNo({draft_bill:data.draft_bill})
        revenue_leak = revenue_leak.concat(data.revenue_leak);

        draft_bill = await costAllocation.draftBillCostAlloc(draft_bill)

        //get invoices with draft bill
        data = invoices.filter(item => {
            return !revenue_leak.map(leak => leak.tms_reference_no).includes(item.tms_reference_no)
        })
        .map(item => {
            return {
                tms_reference_no: item.tms_reference_no,
                is_draft_bill: 1
            }
        })

        await createRevenueLeak({
            draft_bill,
            revenue_leak,
            invoices:data,
            type:'BUY',
            user
        })

        return {
            data: data,
            revenue_leak: revenue_leak,
            draft_bill: draft_bill            
        }
    }
    catch(e){
        throw e
    }
}

const replanSell = async({invoices,trip_date, user=null}) => {
    try{
        let data;
        let revenue_leak = [];
        let draft_bill = []

        const contracts = await getContracts({
            trip_date,
            where:{
                principal_code:_.uniq(invoices.map(item => item.principal_code)),
                contract_type:'SELL'
            }        
        })

        data = await getBillableInvoices({invoices});
        revenue_leak = revenue_leak.concat(data.revenue_leak);

        //3. Assign Contract
        data = await assignContract({invoices:data.data,contracts})
        revenue_leak = revenue_leak.concat(data.revenue_leak)

         //4. Assign Tariff
        data = await assignTariff({invoices:data.data,contracts,contract_type:'SELL'})
        revenue_leak = revenue_leak.concat(data.revenue_leak)
        
        //6. compute normal draft bill with agg
        const withAgg = await draftBillWithAgg({invoices:data.data,contract_type:'SELL'})

        //7. compute normal draft bill without agg
        const withoutAgg = await draftBillWithoutAgg({invoices: data.data,contract_type:'SELL'})

        draft_bill = draft_bill.concat(withAgg.data,withoutAgg.data)
        //concatenate revenue_leaks
        revenue_leak = revenue_leak.concat(withAgg.revenue_leak,withoutAgg.revenue_leak)

        data = await sellValidation(draft_bill,revenue_leak,invoices,true)
        draft_bill = await assignDraftBillNo({draft_bill: data.draft_bill})
        revenue_leak = revenue_leak.concat(data.revenue_leak)

        //get invoices with draft bill
        data = invoices.filter(item => {
            return !revenue_leak.map(leak => leak.tms_reference_no).includes(item.tms_reference_no)
        })
        .map(item => {
            return {
                tms_reference_no: item.tms_reference_no,
                is_draft_bill: 1,
            }
        });
        
        await createRevenueLeak({
            draft_bill,
            revenue_leak,
            invoices:data,
            type:'SELL',
            user
        });

        return {
            draft_bill,
            revenue_leak,
            data
        }
    }
    catch(e){
        throw e
    }
}

module.exports = {
    buy,
    sell,
    replanBuy,
    replanSell,

    formatByClassOfStore,
    getBillableInvoices,
    assignContract,
    assignTariff,
    draftBillWithAgg,
    draftBillWithoutAgg,
    sellValidation,
    assignDraftBillNo,
    draftBillIC,
    tripValidation,
    
}