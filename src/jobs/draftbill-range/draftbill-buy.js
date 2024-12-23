const {RATA_DRAFT_BILL_BUY_RANGED} = require('../queues/queues');
const models = require('../../models/rata');
const draftBill = require('../../services/draftbill-ranged.service')

module.exports = () => {
    const scheduler_id = 'RATA_DRAFT_BILL_BUY_RANGED';
    RATA_DRAFT_BILL_BUY_RANGED.process(async(job,done) => {
        try{    
            const {from, to} = job.data;
            const id = job.id;

            await draftBill.buy(from,to, id)
        
            await  job.progress('completed')
            done(null , {

            })

        }
        catch(e){
            done(e)
        }
    })

    RATA_DRAFT_BILL_BUY_RANGED.on('active',async(job) => {
        await models.scheduler_auto_sync_trckr_tbl.create({
            job_id: job.id,
            transaction_date: job.data.from,
            scheduler_id,
            job_status: 'INPROGRESS'
        })

        console.log(scheduler_id+" has started")
    })

    RATA_DRAFT_BILL_BUY_RANGED.on('completed',async(job) => {
        await models.scheduler_auto_sync_trckr_tbl.update({
            job_status: 'COMPLETED',
        },
        {
            where:{
                job_id: job.id
            }
        })

        console.log(scheduler_id+" is complete")
    })

    RATA_DRAFT_BILL_BUY_RANGED.on('failed',async(job,err) => {
        await models.scheduler_auto_sync_trckr_tbl.update({
            job_status: 'FAILED',
            error_info: err.message
        },
        {
            where:{
                job_id: job.id
            }
        })
        console.log(err)
        console.log(scheduler_id+" job failed")  
    })
}