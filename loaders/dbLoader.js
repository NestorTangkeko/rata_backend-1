const models  = require('../models');
const asciiModels = require('../src/models/logistikus_si');
const {podDB,scmdb,} = require('../database');
const {redis,redisIndex} = require('../config');
const {kronos, pod} = require('../src/models/datawarehouse')
const jobs = require('../src/jobs')

module.exports = async() => {
    try{

        (async()=> {
            redis.on("error", (error) => console.error(`Error : ${error}`));
            await redis.connect(); 
            await redisIndex.userSessionIndex(redis);
            // await redisIndex.testIndex(redis);
        })();

        //background worker v2
        // jobs();

        await models.sequelize.authenticate().then(() => {
            console.log('Connected to RB DB')
        });
        
        await podDB.sequelize.authenticate().then(()=> {
            console.log('Connected to POD DB')
        });

        // await scmdb.sequelize.authenticate().then(()=>{
        //     console.log('Connected to SCMDB')
        // })       
        
        await asciiModels.sequelize.authenticate().then(()=>{
            console.log('Connected to ASCII')
        })

        await kronos.authenticate().then(() => {
            console.log('Connected to DW Kronos DB')
        })

        await pod.authenticate().then(() => {
            console.log('Connected to DW Helios DB')
        })
    }
    catch(e){
        console.log(e)
    }
}