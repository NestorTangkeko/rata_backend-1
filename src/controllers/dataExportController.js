const models = require('../models/rata');
const {Sequelize:{Op}} = models;

const dataExportService = require('../services/dataExportService');

exports.exportInvoice = async(req,res,next) => {
    try{
        const {
            trip_date_from,
            trip_date_to,
            cleared_date_from,
            cleared_date_to
        } = req.query;

        const headers= []
        let details = []

        let filter = {}

        if(trip_date_from && trip_date_to) {
            filter = {
                ...filter,
                trip_date:{
                    [Op.between]: [trip_date_from,trip_date_to]
                }
            }
        }

        if(cleared_date_from,cleared_date_to) {
            filter = {
                ...filter,
                cleared_date:{
                    [Op.between]: [cleared_date_from,cleared_date_to]
                }
            }
        }
    
        const headerLabel = {
            tms_reference_no: 'TMS Reference No',	
            trip_no:'Trip No',	
            trip_date:'Trip Date',	
            location: 'Location',	
            trip_status: 'Trip Status',	
            trucker_id: 'Trucker ID',	
            vehicle_type: 'Vehicle Type',	
            vehicle_id: 'Vehicle ID',	
            planned_trucker: 'Planned Trucker',	
            planned_vehicle_type: 'Planned Vehicle Type',	
            planned_vehicle_id:'Planned Vehicle ID',	
            service_type: 'TMS Service Type',
            ascii_service_type: 'Ascii Service Type',	
            sub_service_type: 'Sub Service Type',	
            invoice_no: 'Invoice No',	
            rdd:'RDD',	
            dr_no:'DR No',
            shipment_manifest: 'Shipment Manifest',	
            principal_code: 'Principal Code',	
            stc_from: 'STC From',	
            stc_to: 'STC To',	
            br_status: 'BR Status',	
            delivery_status: 'Delivery Status',	
            rud_status: 'RUD Status',	
            reason_code:'Reason Code',	
            redel_remarks: 'Redel Remarks',	
            is_billable: 'Is Billable?',	
            is_processed_sell: 'Is Processed Sell?',	
            is_processed_buy: 'Is Processed Buy?',	
            cleared_date: 'Cleared Date',	
            trucker_cleared_date: 'Trucker Cleared Date',
            job_id: 'Job ID',	
            createdAt: 'Created At',	
            updatedAt: 'Updated At'
        }

        const getInvoices = await models.helios_invoices_hdr_tbl.getData({
            where:{
               ...filter
            },
            options: {
                include: [
                    {
                        model: models.helios_invoices_dtl_tbl,
                        required: false
                    },
                    {
                        model: models.service_type_tbl,
                        required: false
                    }
                ]
            }
        })

        getInvoices.map(item => {
            const {helios_invoices_dtl_tbls,service_type_tbl,...header} = item;
       
            headers.push({
                ...header,
                ascii_service_type: service_type_tbl?.ascii_service_type
            })

            details = details.concat(helios_invoices_dtl_tbls)
        })

        const xlsx = await dataExportService.generateExcel({
            headers: [headerLabel].concat(headers),
            details
        })

        res.set('Content-disposition',`transport_invoice.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportDraftBill = async(req,res,next) => {
    try{
        const {
            type,
            from,
            to
        } = req.query;

        const headers=[];
        let db_details=[];
        let cost_alloc_details=[];

        const getDraftBills = await models.draft_bill_hdr_tbl.getData({
            where:{
                [type]:{
                    [Op.between] : [moment(from).format('YYYY-MM-DD'),moment(to).format('YYYY-MM-DD')]
                }
            },
            options:{
                include: [
                    {
                        model: models.draft_bill_details_tbl,
                        required: false,
                        as:'details',
                        include:[
                            {
                                model: models.helios_invoices_hdr_tbl,
                                as:'invoice',
                                include: [
                                    {
                                        model: models.principal_tbl,
                                        required:false
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        model: models.service_type_tbl,
                        required: false
                    },
                    {
                        model: models.draft_bill_cost_alloc_tbl,
                        as:'cost_allocation_details',
                        required: false
                    }
                ]
            }
        })

        const headerLabel = {
            draft_bill_no:      'Draft Bill No.',	
            customer:           'Customer',	
            contract_type:      'Contract Type',	
            draft_bill_date:    'Draft Bil Date',
            contract_id:        'Contract ID',
            tariff_id:          'Tariff ID',
            trip_no:            'Trip No.',
            vendor:             'Vendor',
            location:           'Location',
            rate:               'Contracted Rate',
            min_rate:           'Contracted Min. Rate',
            vehicle_type:       'Vehicle Type',
            stc_from:           'Ship From',
            stc_to:             'Ship To',
            min_billable_value: 'Min. Billable Value',
            max_billable_value: 'Max. Billable Value',
            min_billable_unit:  'Min. Billable Unit',	
            total_charges:      'Total Charges',
            status:             'Status',
            condition:          'Condition',
            formula:            'Formula',
            service_type:       'TMS Service Type',
            ascii_service_type: 'Ascii Service Type',
            sub_service_type:   'Sub Service Type',
            job_id:             'Job ID',
            createdAt:          'Created Date',
            updatedAt:          'Updated Date',
        };

        getDraftBills.map(item => {
            const {details,created_by,updated_by,service_type_tbl,cost_allocation_details,...header} = item

            headers.push({
                ...header,
                ascii_service_type: service_type_tbl?.ascii_service_type
            })

            db_details = db_details.concat(details.map(item =>{
                const {invoice,...itms} = item;
                const principal_code = invoice?.principal_tbl?.principal_code;

                return {
                    ...itms,
                    planned_vehicle_type: invoice.planned_vehicle_type,
                    principal_code,
                    cleared_date: invoice.cleared_date,
                    trucker_cleared_date: invoice.trucker_cleared_date
                }
            }))

            cost_alloc_details = cost_alloc_details.concat(cost_allocation_details.map(item => {
                return {
                    ...item,
                    location: header.location,
                    contract_type:header.contract_type,
                    vehicle_type: header.vehicle_type,
                }
            }))
        })

        const xlsx = await dataExportService.generateExcel({
            headers: [headerLabel].concat(headers),
            details: db_details,
            cost_allocation_details: cost_alloc_details
        })

        res.set('Content-disposition',`transport_draft_bill.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
     
        
    }
    catch(e){
        next(e)
    }
}

exports.exportRevenueLeak = async(req,res,next) => {
    try{
        const {from,to} = req.query;
        const headers = [];
        let details = [];
        const getRevenueLeaks = await models.transport_rev_leak_hdr_tbl.getData({
            where:{
                trip_date: {
                    [Op.between] : [from,to]
                }
            },
            options:{
                include: [
                    {
                        model:models.helios_invoices_hdr_tbl,
                        required:false,
                        include:[
                            {
                                model: models.service_type_tbl,
                                required: false
                            }
                        ]
                    },
                    {
                        model:models.tranport_rev_leak_dtl_tbl,
                        required: false
                    },
                    
                ]
            }
        })

        const headerLabel = {
            tms_reference_no:'TMS Reference No.',	
            draft_bill_type:'Draft Bill Type',	
            class_of_store:'Class of Store',	
            fk_tms_reference_no:'FK TMS Reference No',	
            rdd	:'RDD',
            trip_date:'Trip Date',
            revenue_leak_reason: 'Revenue Leak Reason',	
            is_draft_bill:'Is Draft Bill?',	
            createdAt:'Created Date',	
            updatedAt:'Updated Date',
            trip_no:'Trip No',	
            location:'Location',	
            trip_status:'Trip Status',	
            trucker_id:'Trucker ID',	
            vehicle_type:'Vehicle Type',	
            vehicle_id:'Vehicle ID',	
            planned_trucker:'Planned Trucker',	
            planned_vehicle_type:'Planned Vehicle Type',	
            planned_vehicle_id:'Planned Vehicle ID',	
            service_type:'TMS Service Type',
            ascii_service_type: 'Ascii Service Type',
            sub_service_type:'Sub Service Type',	
            invoice_no:'Invoice No',	
            dr_no:'DR No',	
            shipment_manifest:'Shipment Manifest',	
            principal_code:'Principal Code',	
            stc_from:'STC From',	
            stc_to:'STC To',	
            br_status:'BR Status',	
            delivery_status:'Delivery Status',	
            rud_status:'RUD Status',	
            reason_code:'Reason Code',	
            redel_remarks:'Redel Remarks',	
            cleared_date:'Cleared Date',
        };

        getRevenueLeaks.map(item => {
            const {helios_invoices_hdr_tbl,tranport_rev_leak_dtl_tbls,created_by,updated_by,job_id,...header} = item;
            const {is_billable,is_processed_sell,is_processed_buy,service_type_tbl,...invoices_header} = helios_invoices_hdr_tbl;
            headers.push({
                ...header,
                ...invoices_header,
                is_draft_bill:  header.is_draft_bill === 1 ? 'true' : 'false',
                tms_reference_no: header.tms_reference_no,
                ascii_service_type: service_type_tbl?.ascii_service_type
            })
            details = details.concat(tranport_rev_leak_dtl_tbls)
        })

        const xlsx = await dataExportService.generateExcel({
            headers: [headerLabel].concat(headers),
            details
        })

        res.set('Content-disposition',`transport_revenue_leak.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    
        res.send(xlsx)

    }
    catch(e){
        next(e)
    }
}

exports.exportContract = async(req,res,next) => {
    try{
        const {contract_id, from, to,service_type} = req.query;
        const contracts = [];
        let tariffs = [];
        let filter = {};
        let serviceTypeFilter = {};

        if(from && to) {    
            filter = {
                [Op.and] : {
                    valid_from: {
                        [Op.gte]:from
                    },
                    valid_to: {
                        [Op.lte]:to
                    }
                }   
            }
        }

        if(service_type) {
            serviceTypeFilter.service_type = service_type;
        }

        const getContracts = await models.contract_hdr_tbl.getContracts({   
            where:{
                contract_id,
            },
            options:{
                include: [
                    {
                        model: models.contract_tariff_dtl,
                        include: [
                            {
                                model: models.tariff_sell_hdr_tbl,
                                required: true,
                                where:{
                                    ...serviceTypeFilter
                                }
                            }
                        ],
                        where: {
                            status: 'ACTIVE',
                            ...filter
                        },
                        required: false
                    }
                ]
            }
        })

        getContracts.map(item => {
            const {contract_tariff_dtls,...header} = item;
            contracts.push(header)
            tariffs = tariffs.concat(contract_tariff_dtls)
        })

        const xlsx = await dataExportService.generateExcel({
            contracts,
            tariffs
        })

        res.set('Content-disposition',  `transport_contract.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)

    }
    catch(e){
        next(e)
    }
}

exports.exportTariff = async(req,res,next) => {
    try{
        const {location} = req.query;
        
        const getTariffs = await models.tariff_sell_hdr_tbl.getData({
            where:{
                location
            }
        })
        const xlsx = await dataExportService.generateExcel({
            tariff: getTariffs
        })

        res.set('Content-disposition',`transport_tariff.xlsx`);
        res.set('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportGeography = async(req,res,next) => {
    try{
        
        const country = await models.geo_country_tbl.getData({})
        const regions = await models.geo_region_tbl.getData({})
        const province = await models.geo_province_tbl.getData({})
        const city = await models.geo_city_tbl.getData({})
        const brgy = await models.geo_barangay_tbl.getData({})

        const xlsx = await dataExportService.generateExcel({
            country,
            regions,
            province,
            city,
            brgy
        })

        res.set('Content-disposition',  `geography.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportVendor = async(req,res,next) => {
    try{
        const vendors = await models.vendor_tbl.getData({})
        const vendor_groups = await models.vendor_group_tbl.getData({})
        const vendor_group_detail = await models.vendor_group_dtl_tbl.getData({})
        
        
        const xlsx = await dataExportService.generateExcel({
            vendors,
            vendor_groups,
            vendor_group_detail
        })

        res.set('Content-disposition',  `vendors.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportPrincipal = async(req,res,next) => {
    try{
        const principals = await models.principal_tbl.getData({})
        
        const xlsx = await dataExportService.generateExcel({
            principals
        })

        res.set('Content-disposition',  `principals.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportShipPoint = async(req,res,next) => {
    try{
        const ship_points = await models.ship_point_tbl.getData({})
        
        const xlsx = await dataExportService.generateExcel({
            ship_points
        })

        res.set('Content-disposition',  `ship_points.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportLocation = async(req,res,next) => {
    try{
        const locations = await models.location_tbl.getData({})
        
        const xlsx = await dataExportService.generateExcel({
            locations
        })

        res.set('Content-disposition',  `location.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportQuickCode = async (req,res,next) => {
    try{
        const quickCodes = await models.quick_code_tbl.getData({})

        const xlsx = await dataExportService.generateExcel({
            'quick-code':quickCodes
        })

        res.set('Content-disposition',  `quick-codes.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportAlgorithm = async(req,res,next) => {
    try{
        const algorithm = await models.agg_tbl.getData({})
        const details = await models.agg_conditions_tbl.getData({})

        const xlsx = await dataExportService.generateExcel({
            algorithm,
            details
        })

        res.set('Content-disposition',  `algorithm.xlsx`);
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}

exports.exportTransmittal = async(req,res,next) => {
    try{
        
        const data = await dataExportService.exportTransmittal(req.query)
        const xlsx = await dataExportService.generateExcel({
            data
        })

        res.set('Content-disposition',  `transmittal.xlsx`)
        res.set('Content-type',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');    

        res.send(xlsx)
    }
    catch(e){
        next(e)
    }
}