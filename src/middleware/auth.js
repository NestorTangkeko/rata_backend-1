const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');

const APIError = require('../errors/api-error');
const {jwtSecret,redis} = require('../../config');

exports.authorize = async(req,res,next) => {
    const err = {
        message:'Invalid Access!',
        status: httpStatus.UNAUTHORIZED,
        isPublic: true
    };

    try{
        const token = req.headers['x-access-token'];
        if(!token){
            return next(new APIError(err))
        }
        
        jwt.verify(token,jwtSecret,async (error,result) => {
            if(error){
                //delete the redis session
                await redis.del(`rata:session:${result.id}`)
                return next(new APIError(err))            
            }

            const session = await redis.json.get(`rata:session:${result.id}`)

            if(!session){
                await redis.del(`rata:session:${result.id}`)
                return next(new APIError(err))
            }
            
            req.processor = {
                id: session.id                
            }

            return next()
        })
    }
    catch(e){
        return next(new APIError(err))
    }
}

exports.revokeAccess = async(req,res,next) => {
    try{
        const sessions = req.sessions;
        let filters = '';
        Object.keys(sessions).map(key => {
            filters = `@${key}:{${sessions[key].replace(/[-.@\\]/g, '\\$&')}}`
        })
        const redisSessions = await redis.ft.search('idx:ratasession',filters)
        
        //delete sessions
        redisSessions.documents.map(async docs => {
            await redis.del(docs.id)
        })

        res.status(200).end()
    }
    catch(e) {
        
        next(e)
    }
}

exports.lockAccount = async(req,res,next) => {
    try{
        const id = req.sessions.id;

      console.log('test')
      next()
    }
    catch(e){
        next(e)
    }
}