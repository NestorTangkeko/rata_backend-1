const { result } = require('lodash');
const moment = require('moment');
const {podDB} = require('../../../database');
const {sequelize,Sequelize} = podDB;

const getInvoices = async({
    rdd,
    location
}) => {
    try{
        return await sequelize.query('sp_get_rb_invoices :rdd, :location',{
            type:Sequelize.QueryTypes.SELECT,
            replacements:{
                rdd,
                location
            }
        })
    }
    catch(e){
        throw e
    }
}

const getInvoicesDtl = async({
    rdd,
    location
}) => {
    try{
        return await sequelize.query('sp_get_rb_invoices_dtl :rdd, :location',{
            type:Sequelize.QueryTypes.SELECT,
            replacements:{
                rdd,
                location
            }
        })
    }
    catch(e){
        throw e
    }
}

const getBookingRequest = async ({
    rdd
}) => {
    try{
        return await sequelize.query(`
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
            b.date_cleared          'trucker_cleared_date',   
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
            d.is_billable_buy		'is_billable_buy',
            c.date_cleared		    'cleared_date'    
            from trip_br_dtl_tbl a    
            left join trip_plan_hdr_tbl b on a.tripPlan = b.tripPlanNo    
            left join booking_request_hdr_tbl c on a.brNo = c.bookingRequestNo    
            left join reason_codes_tbl d on c.reasonCode = d.code    
            where cast(c.date_cleared as date) between :from and :to
            and c.rudStatus = 'CLEARED'
            and c.brStatus = 'VERIFIED_COMPLETE'
            and b.tripStatus <> 'SHORT_CLOSED'
            and a.isDeleted <> 1
        `,{
            type:Sequelize.QueryTypes.SELECT,
            replacements:{
                from:moment(rdd).subtract(1,'months').format('YYYY-MM-DD'),
                to: rdd
            }
        })
        .then(result => JSON.parse(JSON.stringify(result)))
    }
    catch(e){
        throw e
    }
}

const getBookingRequestDetails = async({
    rdd
})=>{
    try{
        return await sequelize.query(`Select distinct    
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
        left join trip_plan_hdr_tbl bx on ax.tripPlan = bx.tripPlanNo and ax.isDeleted = 0    
        left join booking_request_hdr_tbl cx on ax.brNo = cx.bookingRequestNo and ax.isDeleted = 0    
        where cx.rudStatus = 'CLEARED'  
        and bx.tripStatus <> 'SHORT_CLOSED'  
        and cast(cx.date_cleared as date) between :from and :to
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
        ) b`,
       {
            type:Sequelize.QueryTypes.SELECT,
            replacements:{
                from:moment(rdd).subtract(1,'months').format('YYYY-MM-DD'),
                to: rdd
            }
       })
       .then(result => JSON.parse(JSON.stringify(result)))
       
    }
    catch(e){
        throw e
    }

}

module.exports = {getInvoices,getInvoicesDtl,getBookingRequest,getBookingRequestDetails}