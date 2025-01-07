const {DWH_ACC_EXPENSE} = require('../queues/queues')
const reportService = require('../../services/reports.service');
const podReportService = require('../../services/podReport.service')
const podReportExcelService = require('../../services/podReport.excel.service')
const {v4:uuidv4}           = require('uuid');


const moment = require('moment')
const path = require('path')

module.exports = () => {
    DWH_ACC_EXPENSE.process(async(job, done) => {
        try{
            let draft_bill_header  = [];
            let draft_bill_details = [];
            let leak_header = [];
            let leak_details = [];

            const vehicle_types = await podReportService.getKronosVehicleTypes();

            const trip_date = job.data?.trip_date ? job.data.trip_date : moment().format('YYYY-MM-DD');

            const data = await podReportService.joinedHandedOverInvoices(trip_date);

            const draftBill = await podReportService.podBuy({
                data,
                from: trip_date,
                to: trip_date
            })

            for(let {details,...db} of  draftBill.draft_bill){
                const log_id = uuidv4();
                draft_bill_header.push({
                    id:log_id,
                    ...db
                })
    
                draft_bill_details = draft_bill_details.concat(details.map(item => ({
                    fk_header_id: log_id,
                    ...item
                })))
            }
            
            for(let {details,...leak} of  draftBill.revenue_leak){
                const log_id = uuidv4();
                leak_header.push({
                    ...leak,
                    id:log_id,
                    draft_bill_type:'BUY',
                })
                leak_details = leak_details.concat(details.map(items => ({
                    ...items,
                    fk_header_id: log_id,
                    class_of_store: leak.class_of_store,
                    draft_bill_type:'BUY'
                })))
            }

            //add outlier tagging
            draft_bill_details = await podReportService.outlierTagging(draft_bill_details,vehicle_types);
            leak_header = await podReportService.outlierTaggingLeak(leak_header,leak_details,vehicle_types)
            
            const root = global.appRoot;
            const fileName = moment().format('YYYYMMDDHHmmss')+'expense_daily_accrual_report.xlsx'
            const filePath = path.join( root,'/assets/reports/accrual/', fileName);
    
            await podReportExcelService.podAccrualTemplate(
                {
                    header:         draft_bill_header,
                    details:        draft_bill_details,
                    leak_header:    leak_header,
                    leak_details:   leak_details,
                    filePath,
                    type:'BUY',
                    from: moment(trip_date).format('MMMM DD, YYYY'),
                    to:moment(trip_date).format('MMMM DD, YYYY'),
                }
            )

            await reportService.createDwhLogs({
                draft_bill_header,
                draft_bill_details,
                leak_header,
                leak_details,
                job_id: job.id
            })

            await job.progress('completed')
            done(null,{
                filePath,
                fileName,
                transaction_date: trip_date
            });            
        }
        catch(e){
            done(e)
        }
    })

    DWH_ACC_EXPENSE.on('active', async(job) => {
        
        const isJobExists = await reportService.getReportLog({
            id: job.id
        })

        if(!isJobExists) {
            const report = await reportService.findReport({
                report_name: 'daily_accrual_expense'
            })
    
            await reportService.createReportLog({
                id: job.id,
                report_id: report.id,
                report_status:'INPROGRESS',
            })
        }

    })

    DWH_ACC_EXPENSE.on('completed', async(job) => {
       
        await reportService.updateReportLog({
            filter:{
                id: job.id,
            },
            data:{
                transaction_date: job.returnvalue.transaction_date,
                report_status:'DONE',
                file_path: job.returnvalue.filePath,
                file_name: job.returnvalue.fileName
            }
        })
        
        console.log(job.id)
        console.log('Daily Accrual Expense Report Done')
    })

    DWH_ACC_EXPENSE.on('failed', async(job,err) => {
        console.log(err)
        console.log(job.id)
        await reportService.updateReportLog({
            filter:{
                id: job.id,
            },
            data:{
                report_status:'FAILED',
                err_message: err.message
            }
        })

       
    })
}
