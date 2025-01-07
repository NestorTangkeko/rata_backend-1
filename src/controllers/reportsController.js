const reportService         = require('../services/reports.service');
const podReportService      = require('../services/podReport.service')
const podReportExcelService = require('../services/podReport.excel.service');
const moment                = require('moment');
const path                  = require('path');
const {REPORT_P2P, REPORT_CROSSDOCK, REPORT_REVERSE_LOGISTICS, REPORT_ACC_EXPENSE, REPORT_ACC_REVENUE} = require('../jobs/queues/queues')
const Queue                 = require('../jobs/queues/queues');
const redis                 = require('../../config').redis;
const {v4:uuidv4}           = require('uuid');
const sequelize             = require('sequelize');
const asciiService          = require('../services/asciiService');

const _ = require('lodash');

exports.createPodReport = async(req,res,next) => {
    try{

        res.end()
        
        // let draft_bill_header  = [];
        // let draft_bill_details = [];
        // let leak_header = [];
        // let leak_details = [];

        // const from = '2024-04-01'
        // const to = '2024-04-15'

        // const data = await podReportService.joinedInvoices({
        //     from,
        //     to
        // })

        // const draftBill = await podReportService.podSell({
        //     data,
        //     from,
        //     to
        // })

        // for(let {details,...db} of  draftBill.draft_bill){
        //     draft_bill_header.push(db)
        //     draft_bill_details = draft_bill_details.concat(details)
        // }
        
        // for(let {details,...leak} of  draftBill.revenue_leak){
        //     leak_header.push({
        //         ...leak,
        //         draft_bill_type:'SELL',
        //     })
        //     leak_details = leak_details.concat(details.map(items => ({
        //         ...items,
        //         class_of_store: leak.class_of_store,
        //         draft_bill_type:'SELL'
        //     })))
        // }

        // const root = global.appRoot;
        // const fileName = moment().format('YYYYMMDDHHmmss')+'revenue_accrual_report.xlsx'
        // const filePath = path.join( root,'/assets/reports/accrual/', fileName);

        // await podReportExcelService.podAccrualTemplate({
        //     header:         draft_bill_header,
        //     details:        draft_bill_details,
        //     leak_header:    leak_header,
        //     leak_details:   leak_details,
        //     filePath,
        //     type:'SELL',
        //     from: moment(from).format('MMMM DD, YYYY'),
        //     to:moment(to).format('MMMM DD, YYYY'),
        // })
        // res.status(200).json(draftBill)

    }
    catch(e){
        next(e)
    }
}

exports.createPodReportBuy = async(req,res,next) => {
    try{
        await REPORT_ACC_EXPENSE.add(null,{
            jobId:uuidv4(),
            removeOnFail:true,
            removeOnComplete:true,
        })

        

        res.end();

        // let draft_bill_header  = [];
        // let draft_bill_details = [];
        // let leak_header = [];
        // let leak_details = [];

        // const from = '2024-04-08'
        // const to = '2024-04-08'

        // const data = await podReportService.joinedInvoices({
        //     from,
        //     to
        // })

        // const draftBill = await podReportService.podBuy({
        //     data,
        //     from,
        //     to
        // })

        // for(let {details,...db} of  draftBill.draft_bill){
        //     draft_bill_header.push(db)
        //     draft_bill_details = draft_bill_details.concat(details)
        // }
        
        // for(let {details,...leak} of  draftBill.revenue_leak){
        //     leak_header.push({
        //         ...leak,
        //         draft_bill_type:'BUY',
        //     })
        //     leak_details = leak_details.concat(details.map(items => ({
        //         ...items,
        //         class_of_store: leak.class_of_store,
        //         draft_bill_type:'BUY'
        //     })))
        // }

        // const root = global.appRoot;
        // const fileName = moment().format('YYYYMMDDHHmmss')+'expense_accrual_report.xlsx'
        // const filePath = path.join( root,'/assets/reports/accrual/', fileName);

        // await podReportExcelService.podAccrualTemplate(
        //     {
        //         header:         draft_bill_header,
        //         details:        draft_bill_details,
        //         leak_header:    leak_header,
        //         leak_details:   leak_details,
        //         filePath,
        //         type:           'BUY',
        //         from:           moment(from).format('MMMM DD, YYYY'),
        //         to:             moment(to).format('MMMM DD, YYYY'),
        //     }
        // )
        // res.status(200).json(draftBill)
    }
    catch(e){
        next(e)
    }
}

exports.createPreBillingReport = async(req,res,next) => {
    try{

        await REPORT_CROSSDOCK.add(null, {
            jobId:uuidv4(),
            removeOnFail:true,
            removeOnComplete:true,
        });

        res.end();

        // const filter = reportService.generateFilter();

        // const root = global.appRoot;
        //     const fileName = moment().format('YYYYMMDDHHmmss')+'p2p.xlsx';
        //     const filePath = path.join(root,'/assets/reports/pre-billing/',fileName);
            
        //     const draftBills = await reportService.getDraftBill({
        //         customer: '10005',
        //         service_type:'2003',
        //         updatedAt:{
        //             [sequelize.Op.between]:['2024-03-15 00:00:00', '2024-04-14 00:00:00']
        //             //[sequelize.Op.between]: [filters.from,filters.to]
        //         }
        //     });

        //     const ascii = await asciiService.getSalesOrder(draftBills.map(item => item.draft_bill_no))

        //     await reportService.p2p({
        //         data: draftBills.filter(item => ascii.map(a => a.SO_CODE).includes(item.draft_bill_no)),
        //         dates:filter,
        //         filePath
        //     })

        //     res.end();

        // const data = await asciiService.getSalesOrder({
        //     from: filters.from,
        //     to:filters.to
        // });
        // res.status(200).json(data)
     
        // const draftBill = await reportService.getDraftBill({
        //     service_type:'2001',
        //     updatedAt: {
        //         [sequelize.Op.between]:['2024-03-15 00:00:00', '2024-04-14 00:00:00']
        //     },
        // })

        // const ascii = await asciiService.getSalesOrder(draftBill.map(item => item.draft_bill_no))

        // res.status(200).json({
        //     data:draftBill.filter(item => ascii.map(a => a.SO_CODE).includes(item.draft_bill_no)),
        // });
    }
    catch(e){
        next(e)
    }
}

exports.createP2PReport = async(req,res,next) => {
    try{
       
        const filters = await reportService.generateFilter();
        const draftBills = await reportService.getDraftBill({
            customer: '10005',
            service_type:'2003',
            updatedAt:{
                [sequelize.Op.between]: [filters.from,filters.to]
            },
        });

        await REPORT_P2P.add(null, {
            jobId:uuidv4(),
            removeOnFail:true,
            removeOnComplete:true
        });
        res.json(draftBills);
    }
    catch(e){
        next(e)
    }
}

exports.getPaginatedReports = async(req,res,next) => {
    try{    
        const data = await reportService.getReporHeader(req.query);
        
        res.status(200).json({
            data: data.rows,
            rows:data.count,
            pageCount: data.pageCount
        })
    }
    catch(e){
        next(e)
    }
}

exports.getPaginatedReportDetails = async(req,res,next) => {
    const {report_name} = req.params;
    const query = req.query;

    const data = await reportService.getReportLogs(query, report_name);
        
    res.status(200).json({
        data: data.rows,
        rows:data.count,
        pageCount: data.pageCount
    })
}

exports.updateReport = async(req,res,next) => {
    try{
        const {report_name} = req.params;
        const body = req.body;

        await reportService.updateReport({
            filter:{
                report_name
            },
            data:{
                is_active: body.is_active,
                cron: body.cron
            }
        })

        await redis.json.set(body.id,'.',{
            redis_key: body.redis_key,
            is_active: body.is_active,
            start_time_cron: body.cron
        })

        if(body.is_active === 0){
            await Queue[body.id].obliterate({force: true})
        }
        else{
            await Queue[body.id].obliterate({force: true})
            await Queue[body.id].add({
                isRepeatable: true
            },
            {
                
                removeOnFail:true,
                removeOnComplete:true,
                repeat:{
                    cron: body.cron
                }
            })
        }

        res.end();
    }
    catch(e){
        next(e)
    }
}

exports.downloadReport = async(req,res,next) => {
    try{
        const {filePath} = req.body;
        
        res.download(filePath)
    }
    catch(e){
        next(e  )
    }
}

exports.reverseLogistics = async(req,res,next) => {
    try{

        await REPORT_REVERSE_LOGISTICS.add(null, {
            jobId:uuidv4(),
            removeOnFail:true,
            removeOnComplete:true,
        })
        // const draftBill = await reportService.getDraftBill({
        //     service_type:'2004',
        //     updatedAt: {
        //         [sequelize.Op.between]:['2024-01-01 00:00:00', '2024-01-31 00:00:00']
        //         //[sequelize.Op.between]:[filter.from,filter.to]
        //     },
        // })

        // const ascii = await asciiService.getSalesOrder(draftBill.length === 0 ? '' : draftBill.map(item => item.draft_bill_no))
        // const root = global.appRoot;
        // const fileName = moment().format('YYYYMMDDHHmmss')+'reverse_logistics.xlsx';
        // const filePath = path.join( root,'/assets/reports/pre-billing/', fileName);

        // const asciiValidation = draftBill.filter(item => ascii.map(a => a.SO_CODE).includes(item.draft_bill_no))
        // const generateCount = _.uniq(asciiValidation.map(item => item.draft_bill_no)).map((item,index) => ({
        //     draft_bill_no: item,
        //     count: index + 1
        // }))

        // const asciiEventDetails = await reportService.getAsciiEvents(_.uniq(asciiValidation.map(item => item.trip_plan)))

        // const data = asciiValidation.map(item => {
        //     const count = generateCount.find(a => a.draft_bill_no === item.draft_bill_no)
        //     const eventDvry = asciiEventDetails.find(a => a.trip_log_id === item.trip_plan && a.to_location === item.to_stc && a.type === 'DELIVERY')
        //     const eventPckp = asciiEventDetails.find(a => a.trip_log_id === item.trip_plan && a.from_location === item.ship_from && a.type === 'PICKUP')
        //     return {
        //         ...item,
        //         ...count,
        //         trip_rate: item.rate,
        //         drvy_actual_datetime: eventDvry?.actual_datetime ?? null,
        //         actual_datetime: eventPckp?.actual_datetime ?? null
        //     }
        // })

        // await reportService.reverseLogistics({
        //     data,
        //     filePath,
        //     dates:{
        //         from: '2024-04-01',
        //         to:'2024-04-15'
        //     }
        // })

        res.status(200).end();
    }
    catch(e){
        next(e)
    }
}

exports.dailyPodSell = async(req,res,next) => {
    try{
        const vehicle_types = await podReportService.getKronosVehicleTypes();
        res.status(200).json(vehicle_types)

        // let draft_bill_header  = [];
        // let draft_bill_details = [];
        // let leak_header = [];
        // let leak_details = [];

        // const trip_date = req.query.trip_date;

        // const data = await podReportService.joinedHandedOverInvoices(trip_date);
        // const vehicle_types = await podReportService.getKronosVehicleTypes();

        // const draftBill = await podReportService.podSell({
        //     data,
        //     from:   trip_date,
        //     to:     trip_date
        // })

        // for(let {details,...db} of  draftBill.draft_bill){
        //     const log_id = uuidv4();
        //     draft_bill_header.push({
        //         id:log_id,
        //         ...db
        //     })

        //     draft_bill_details = draft_bill_details.concat(details.map(item => ({
        //         ...item,
        //         fk_header_id: log_id
        //     })))
        // }
        
        // for(let {details,...leak} of  draftBill.revenue_leak){
        //     const log_id = uuidv4();
        //     leak_header.push({
        //         ...leak,
        //         id:log_id,
        //         draft_bill_type:'SELL',
        //     })
        //     leak_details = leak_details.concat(details.map(items => ({
        //         ...items,
        //         fk_header_id: log_id,
        //         class_of_store: leak.class_of_store,
        //         draft_bill_type:'SELL'
        //     })))
        // }

        // //add outlier tagging
        // draft_bill_details = await podReportService.outlierTagging(draft_bill_details,vehicle_types);
        // leak_header = await podReportService.outlierTaggingLeak(leak_header,leak_details,vehicle_types)
        // // const root = global.appRoot;
        // // const fileName = moment().format('YYYYMMDDHHmmss')+'revenue_daily_accrual_report.xlsx'
        // // const filePath = path.join( root,'/assets/reports/accrual/', fileName);

        // // await podReportExcelService.podAccrualTemplate({
        // //     header:         draft_bill_header,
        // //     details:        draft_bill_details,
        // //     leak_header:    leak_header,
        // //     leak_details:   leak_details,
        // //     filePath,
        // //     type:'SELL',
        // //     from: moment(trip_date).format('MMMM DD, YYYY'),
        // //     to:moment(trip_date).format('MMMM DD, YYYY'),
        // // })

        // // await reportService.createDwhLogs({
        // //     draft_bill_header,
        // //     draft_bill_details,
        // //     leak_header,
        // //     leak_details,
        // //     job_id: null
        // // })
        
        // res.status(200).json({
        //     draft_bill_header,
        //     draft_bill_details,
        //     leak_header,
        //     leak_details,
            
        // })
    }
    catch(e){
        next(e)
    }
}

exports.dailyPodBuy = async(req,res,next) => {
    try{
        let draft_bill_header  = [];
        let draft_bill_details = [];
        let leak_header = [];
        let leak_details = [];

        const trip_date = req.query.trip_date;

        const data = await podReportService.joinedHandedOverInvoices(trip_date);

        const draftBill = await podReportService.podBuy({
            data: data,
            from: trip_date,
            to: trip_date
        })

        
        for(let {details,...db} of  draftBill.draft_bill){
            draft_bill_header.push({
                ...db
            })
            draft_bill_details = draft_bill_details.concat(details.map(item => ({
                ...item,
            })))
        }
        
        for(let {details,...leak} of  draftBill.revenue_leak){
            leak_header.push({
                ...leak,
                draft_bill_type:'BUY',
            })
            leak_details = leak_details.concat(details.map(items => ({
                ...items,
                class_of_store: leak.class_of_store,
                draft_bill_type:'BUY'
            })))
        }

        // const root = global.appRoot;
        // const fileName = moment().format('YYYYMMDDHHmmss')+'expense_daily_accrual_report.xlsx'
        // const filePath = path.join( root,'/assets/reports/accrual/', fileName);

        // await podReportExcelService.podAccrualTemplate(
        //     {
        //         header:         draft_bill_header,
        //         details:        draft_bill_details,
        //         leak_header:    leak_header,
        //         leak_details:   leak_details,
        //         filePath,
        //         type:'BUY',
        //         from: moment(trip_date).format('MMMM DD, YYYY'),
        //         to:moment(trip_date).format('MMMM DD, YYYY'),
        //     }
        // )

        await reportService.createDwhLogs({
            draft_bill_header,
            draft_bill_details,
            leak_header,
            leak_details,
            job_id: uuidv4()
        })
        
        res.status(200).json(draft_bill_header);
        
    }
    catch(e){
        console.log(e)
        next(e)
    }
}


