const redis = require('./redis');
const ioredis = require('./ioredis');
const vars = require('./vars');
const redisIndex = require('./redisIndex');

const podConfig = {
    username:       process.env.POD_DB_USER_NAME,
    password:       process.env.POD_DB_PASSWORD,
    host:           process.env.POD_DB_HOST,
    database:       process.env.POD_DB,
    dialect:        'mssql',
    dialectOptions : {
        options:{
            requestTimeout: 3600000,
            useUTC: false
        }
    },
    pool: { 
        max: 1000000,
        min: 0,
        idle: 2000000,
        acquire: 2000000,
        idleTimeoutMillis: 50,
        evictionRunIntervalMillis: 5,
        softIdleTimeoutMillis: 5,
        logging: false
    }
}

const dbConfig = {
    host:       process.env.DB_HOST,
    username:   process.env.DB_USER,
    password:   process.env.DB_PASSWORD,
    dialect:    'mysql',
    database:   process.env.DB,
    // logging: false,
    pool:{
        max: 10,
        min: 1,
        idle: 2000000,
        acquire: 2000000
    },
    dialectOptions: {
		//useUTC: false, //for reading from database
		dateStrings: true,
		typeCast: true
	},
	timezone: '+08:00' /**for writing to database**/,
    // define:{
    //     version:true
    // }

}

const scmdbConfig = {
    username:       process.env.SCMDB_DB_USER,
    password:       process.env.SCMDB_DB_PASSWORD,
    host:           process.env.SCMDB_DB_HOST,
    database:       process.env.SCMDB_DB,
    dialect:        'mssql',
    dialectOptions : {
        options:{
            requestTimeout: 3600000
        }
    },
    pool: { 
        max: 1000000,
        min: 0,
        idle: 2000000,
        acquire: 2000000,
        idleTimeoutMillis: 50,
        evictionRunIntervalMillis: 5,
        softIdleTimeoutMillis: 5,
        logging: false
    }
}

const redisConfig = {
    host: process.env.REDIS_URL,
    port: process.env.REDIS_PORT
}

const asciiConfig = {
    host:       process.env.ASCII_DB_HOST,
    username:   process.env.ASCII_DB_USER_NAME,
    password:   process.env.ASCII_DB_PASSWORD,
    dialect:    'mysql',
    database:   process.env.ASCII_DB,
    // logging: false,
    pool:{
        max: 10,
        min: 1,
        idle: 2000000,
        acquire: 2000000
    },
    dialectOptions: {
		//useUTC: false, //for reading from database
		dateStrings: true,
		typeCast: true
	},
}

const dwConfig = {
    host:       process.env.DW_DB_HOST,
    username:   process.env.DW_DB_USER_NAME,
    password:   process.env.DW_DB_PASSWORD,
    dialect:    'mysql',
    //database:   process.env.DW_DB,
    //logging: false,
    pool:{
        max: 10,
        min: 1,
        idle: 2000000,
        acquire: 2000000
    },
    dialectOptions: {
		//useUTC: false, //for reading from database
		dateStrings: true,
		typeCast: true
	},
}

const dwbConfig = {
    host:       process.env.DWB_DB_HOST,
    username:   process.env.DWB_DB_USER_NAME,
    password:   process.env.DWB_DB_PASSWORD,
    dialect:    'mysql',
    database:   process.env.DWB_DB,
    //logging: false,
    pool:{
        max: 10,
        min: 1,
        idle: 2000000,
        acquire: 2000000
    },
    dialectOptions: {
		//useUTC: false, //for reading from database
		dateStrings: true,
		typeCast: true
	},
    timezone: '+08:00'
}



const dwPodConfig = {
    username:       process.env.DWPOD_DB_USER,
    password:       process.env.DWPOD_DB_PASSWORD,
    host:           process.env.DWPOD_DB_HOST,
    database:       process.env.DWPOD_DB,
    dialect:        'mssql',
    dialectOptions : {
        options:{
            requestTimeout: 3600000
        }
    },
    pool: { 
        max: 1000000,
        min: 0,
        idle: 2000000,
        acquire: 2000000,
        idleTimeoutMillis: 50,
        evictionRunIntervalMillis: 5,
        softIdleTimeoutMillis: 5,
        logging: false
    }
}

const kronosConfig = {
    host:       process.env.KRONOS_DB_HOST,
    username:   process.env.KRONOS_DB_USER,
    password:   process.env.KRONOS_DB_PASSWORD,
    dialect:    'mysql',
    database:   process.env.KRONOS_DB,
    // logging: false,
    pool:{
        max: 10,
        min: 1,
        idle: 2000000,
        acquire: 2000000
    },
    dialectOptions: {
		//useUTC: false, //for reading from database
		dateStrings: true,
		typeCast: true
	},
}


module.exports = {
    dbConfig,
    podConfig,
    scmdbConfig,
    redisConfig,
    asciiConfig,
    redis,
    ioredis,
    redisIndex, 
    dwConfig,
    dwPodConfig,
    kronosConfig,
    dwbConfig,
    ...vars,
    
}