const { redis } = require('../../config');
const models = require('../models/rata');
const createHttpError = require('http-errors');

exports.randomCharGenerator = async(length) => {
    let result = '';

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

exports.getUser = async(filters={}) => {
  const data =  await models.user_tbl.findOne({
    where:{
      ...filters
    }
  })

  if(!data ) return null;
  
  return JSON.parse(JSON.stringify(data))
}

exports.updateUser = async({data,filters}) => {
  await models.user_tbl.update({
    ...data 
  },
  {
    where:{
      ...filters
    }
  })
}

exports.lockUserAccount = async({
  user_id,
  ...user_data
}) => {
  const redis_id = 'rata:session:'+user_id;
  const sessionData = await redis.json.get(redis_id);
  
  if(sessionData && sessionData.login_attempt === 5){
      await exports.updateUser({
        data:{
          is_lock: 1
        },
        filters:{
          id: user_id
        }
      })

      throw createHttpError(400, 'You reached the maximum number of login retries.')
  }

  const data = sessionData ? {
    ...sessionData,
    login_attempt: sessionData?.login_attempt + 1 ?? 1
  } : {
      id: user_id,
      login_attempt: 1,
    ...user_data,
  }

  await redis.json.set(redis_id, '$', data)
}

exports.createLoginLogs = async(user_id='') => {
  await models.user_logs_tbl.create({
    fk_user_id: user_id,
    login_time: moment().format('YYYY-MM-DD HH:mm:ss')
  })
}
