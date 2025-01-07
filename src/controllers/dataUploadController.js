const {tariff,geography,shipPoint,principal,contract,vendor} = require('../../services');
const locationService = require('../../services/location')
const dataUploadService = require('../services/dataUploadService')
const models = require('../models/rata');
const path = require('path');
const mime = require('mime');
const fs = require('fs');
const _ =require('lodash');
const moment = require('moment');
const round = require('../helpers/round');

exports.uploadWMSContractTariff = async(req,res,next) => {
    try{
        const {data}    = req.body;
        const contracts   = data.contracts;
        const details     = data.contract_details;

        // validation variables
        let contract_header = []
        let contract_details = []

        if(typeof data.contracts === 'undefined' || typeof data.contract_details === 'undefined'){
            return res.status(400).json({
                message:'Invalid File!'
            })
        }
        
        //Validate if the principal is valid
        const principals = await principal.getAllPrincipal({
            filters:{
                //principal_code:contracts.map(item => item.principal_code)
            }
        })

        const getContracts = await contract.getAllWMSContracts({
            filters:{
                //contract_id: contracts.map(item => item.contract_id)
            }
        })

        const getCustomers = await contract.getAllWMSContracts({
            filters:{
                principal_code: contracts.map(item => item.principal_code)
            }
        })

        for(let i in contracts){
            const contractData = contracts[i];

            const dbContract = _.find(getContracts,(value)=>{
                return value.contract_id === contractData.contract_id
            })

            if(dbContract?.contract_status === 'CANCELLED'){
                contract_header.push({
                    contract_id:contractData.contract_id,
                    reason:'Cancelled Contract'
                })
            }

            const isPrincipal = _.find(principals,(value)=> {
                return String(value.principal_code).toLowerCase() == String(contractData.principal_code).toLowerCase()
            })

            if(!isPrincipal){
                contract_header.push({
                    contract_id:contractData.contract_id,
                    reason: `Principal Code ${contractData.principal_code} is not maintained`
                })
            }

            const isCustomerExists = _.find(getCustomers,(value)=>{
                return value.principal_code == contractData.principal_code
            }) 

            if(isCustomerExists && isCustomerExists?.contract_status === 'APPROVED'){
                contract_header.push({
                    contract_id:contractData.contract_id,
                    reason:'Principal is already mapped to a contract'
                })
            }   
        }

        //Contract Details Validation
        const getTariffs = await tariff.getAllWMSTariff({
            filters:{
                tariff_id:_.uniq(details.map(item => item.tariff_id))
            }
        })

        for(let i in details){
            const contract_tariff = details[i]
    
            const tariff = _.find(getTariffs,(value)=>{
                return String(value.tariff_id).toLowerCase()=== String(contract_tariff.tariff_id).toLowerCase()
            })

            if(!tariff){
                contract_details.push({
                    contract_id:contract_tariff.contract_id,
                    tariff_id:contract_tariff.tariff_id,
                    reason:'Tariff does not exists!'
                })

                continue;
            }

            if(tariff.tariff_status === 'DRAFT'){
                contract_details.push({
                    contract_id:contract_tariff.contract_id,
                    tariff_id:contract_tariff.tariff_id,
                    reason:'Tariff is in DRAFT Status'
                })

                continue;
            }

            const dbContract = _.find(getContracts,(value)=>{
                return value.contract_id === contract_tariff.contract_id
            })

            if(!dbContract){
                contract_details.push({
                    contract_id:contract_tariff.contract_id,
                    tariff_id:contract_tariff.tariff_id,
                    reason:'Contract does not exists!'
                })
            }
        }

        await contract.bulkCreateWMSContractDetails({
            contract:contracts.filter(item => !contract_header.map(x => x.contract_id).includes(item.contract_id)).map(item => {
                return {
                    ...item,
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            }),
            details: details.filter(item => {
                const isInvalid = _.some(contract_details,{
                    contract_id:item.contract_id,
                    tariff_id:item.tariff_id
                })
    
                return !isInvalid
            })
            .map(item => {
                return{
                    ...item,
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            })
        })

        if(contract_header.length === 0 && contract_details.length === 0){
            return res.end();
        }

        res.status(200).json({contract_header,
            contract_details
        })

    }
    catch(e){
        next(e)
    }
}

exports.uploadWMSTariff = async(req,res,next) => {
    try{
        let {data} = req.body;
        let tariff_header = [];

        const tariffs = await tariff.getAllWMSTariff({
            filters:{
                tariff_id: data.tariff.map(item => item.tariff_id)
            }
        })

        const locations = await locationService.getAllLocation({
            filters:{}
        })

        for(let i in data.tariff){
            const tariff=data.tariff[i]
            const isExists=_.find(tariffs,(value)=>{
                return value.tariff_id === tariff.tariff_id
            }) 

            const isLocation = _.find(locations,(value) => {
                return String(value.loc_code).toLowerCase() === String(tariff.location).toLowerCase()
            }) 

            if(isExists){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'Tariff Already Exists!'
                })
            }

            if(!tariff.service_type || tariff.service_type===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'Service Type is required'
                })
            }

            if(!tariff.location || tariff.location===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'Location is required'
                })
            }

            if(!isLocation) {
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:`Location ${tariff.location} is not maintained`
                })
            }
        }

        await tariff.bulkCreateWMSTariff({
            data:data.tariff.filter(item => !_.uniq(tariff_header.map(item => item.tariff_id)).includes(item.tariff_id)).map(item => {
                return {
                    ...item,
                    tariff_id:String(item.tariff_id).trim(),
                    location:String(item.location).toLowerCase(),
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            })
        })

        if(tariff_header.length === 0){
            return res.end();
        }

        res.status(200).json({tariff_header})

    }   
    catch(e){
        next(e)
    }
}

exports.uploadTariff = async (req,res,next) => {  
    try{
        let {data} = req.body;

        let tariff_header = [];
        let tariff_ic = [];

        if(typeof data.tariff === 'undefined' || typeof data.tariff_ic === 'undefined'){
            return res.status(400).json({
                message:'Invalid File!'
            })
        }

        const getRegion=    await geography.getGeoRegion({
            filters:{is_active:true}
        });
        const getProvince=  await geography.getGeoProvince({
            filters:{is_active:true}
        });
        const getCity=      await geography.getGeoCity({
            filters:{is_active:true}
        });
        const getBrgy =     await geography.getGeoBrgy({
            filters:{is_active:true}
        });
        const getShipPoint =await shipPoint.getAllShipPoint({
            filters:{is_active:true}
        });

        const {results} = await tariff.isTariffExists({
            tariff_ids:data.tariff.map(item => item.tariff_id)
        })

        for(let i in data.tariff){
            const tariff=data.tariff[i]
            const isExists=_.find(results,(value)=>{
                return value.tariff_id === tariff.tariff_id
            }) 

            if(isExists){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'Tariff Already Exists!'
                })
            }

            if(!tariff.service_type || tariff.service_type===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'Service Type is required'
                })
            }

            if(!tariff.location || tariff.location===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'Location is required'
                })
            }

            if(!tariff.from_geo_type || tariff.from_geo_type===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'From Geo Type is Required'
                })
            }

            if(!tariff.from_geo || tariff.from_geo===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'From Geo is Required'
                })
            }

            if(!tariff.to_geo_type || tariff.to_geo_type===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'To Geo Type is Required'
                })
            }

            if(!tariff.to_geo || tariff.to_geo===''){
                tariff_header.push({
                    tariff_id:tariff.tariff_id,
                    reason:'To Geo is Required'
                })
            }

            if(tariff.from_geo_type){
                let isFromGeoExist;
                if(String(tariff.from_geo_type).toLowerCase() === 'region'){
                    // console.log(tariff.from_geo_type)
                    isFromGeoExist  = _.find(getRegion,{region_code:tariff.from_geo})
                }
                if(String(tariff.from_geo_type).toLowerCase() === 'province'){
                    // console.log(tariff.from_geo_type)
                    isFromGeoExist  = _.find(getProvince,{province_code:tariff.from_geo})
                }
                if(String(tariff.from_geo_type).toLowerCase() === 'city'){
                    // console.log(tariff.from_geo_type)
                    isFromGeoExist  = _.find(getCity,{city_code:tariff.from_geo})
                }
                if(String(tariff.from_geo_type).toLowerCase() === 'barangay'){
                    // console.log(tariff.from_geo_type)
                    isFromGeoExist  = _.find(getBrgy,{barangay_code:tariff.from_geo})
                }
                if(String(tariff.from_geo_type).toLowerCase() === 'stc_code'){
                    // console.log(tariff.from_geo_type)
                    isFromGeoExist  = _.find(getShipPoint,  {stc_code:tariff.from_geo})
                }

                if(!isFromGeoExist){
                    tariff_header.push({
                        tariff_id:tariff.tariff_id,
                        reason:`Geo Type From ${tariff.from_geo_type}: ${tariff.from_geo} does not exists!`
                    })
                }
            }

            if(tariff.to_geo_type){
                let isToGeoExist;
                if(String(tariff.to_geo_type).toLowerCase() === 'region'){
                    isToGeoExist  = _.find(getRegion,{region_code:tariff.to_geo})
                }
                if(String(tariff.to_geo_type).toLowerCase() === 'province'){
                    isToGeoExist  = _.find(getProvince,{province_code:tariff.to_geo})
                }
                if(String(tariff.to_geo_type).toLowerCase() === 'city'){
                    isToGeoExist  = _.find(getCity,{city_code:tariff.to_geo})
                }
                if(String(tariff.to_geo_type).toLowerCase() === 'barangay'){
                    isToGeoExist  = _.find(getBrgy,{barangay_code:tariff.to_geo})
                }
                if(String(tariff.to_geo_type).toLowerCase() === 'stc_code'){
                    isToGeoExist  = _.find(getShipPoint,{stc_code:tariff.to_geo})
                    
                }

                if(!isToGeoExist){
                    tariff_header.push({
                        tariff_id:tariff.tariff_id,
                        reason:`Geo Type To ${tariff.to_geo_type}: ${tariff.to_geo} does not exists!`
                    })
                }
            }
        }

        //insert into database
        await models.tariff_sell_hdr_tbl.bulkCreateData({
            data: data.tariff.filter(item => !_.uniq(tariff_header.map(item => item.tariff_id))
            .includes(item.tariff_id))
            .map(item => {
                return {
                    ...item,
                    min_value: item.min_value === 0 ? null : round(item.min_value,2),
                    max_value: round(item.max_value,2),
                    tariff_status:'DRAFT',
                    tariff_id:String(item.tariff_id).trim(),
                    from_geo:String(item.from_geo).trim(),
                    to_geo:String(item.to_geo).trim(),
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            }),
            options: {
                ignoreDuplicates:true
            }
        })

        //run tariff ic algo validations
        tariff_ic = await dataUploadService.tariffICUpload(data.tariff_ic)

        //insert into database
        await models.tariff_ic_algo_tbl.bulkCreateData({
            data: data.tariff_ic.filter(item => !tariff_ic.map(x => x.tariff_id).includes(item.tariff_id))
        })

        if(tariff_header.length === 0 && tariff_ic.length === 0){
            return res.end();
        }
        
        res.status(200).json({
            tariff_header,
            tariff_ic
        })

    }
    catch(e){
        next(e)
    }
}

exports.uploadContract=async(req,res,next)=>{
    try{
        const {data}    = req.body;
        let contracts   = data.contracts;
        let details     = data.contract_details;
        const today     = moment().format('YYYY-MM-DD')
        
        let contract_header = []
        let contract_details = []

        if(typeof data.contracts === 'undefined' || typeof data.contract_details === 'undefined'){
            return res.status(400).json({
                message:'Invalid File!'
            })
        }

        //Contract Header validation
        const getContracts = await contract.getAllContracts({
            filters:{
                contract_id: contracts.map(item => item.contract_id)
            }
        })

        const getCustomers = await contract.getAllContracts({
            filters:{
                principal_code: contracts.map(item => item.principal_code)
            }
        })

        for(let i in contracts){
            const contract = contracts[i];

            const dbContract = _.find(getContracts,(value)=>{
                return value.contract_id === contract.contract_id
            })

            const valid_from =  moment(contract?.valid_from).format('YYYY-MM-DD');
            const valid_to   =  moment(contract?.valid_to).format('YYYY-MM-DD');
            
            if(!moment(today).isBetween(valid_from,valid_to)){

                contract_header.push({
                    contract_id:contract.contract_id,
                    reason:'Invalid contract validity'
                })
            }

            if(!dbContract){    
                continue;
            }

            if(dbContract?.contract_status === 'CANCELLED'){
                contract_header.push({
                    contract_id:contract.contract_id,
                    reason:'Cancelled Contract'
                })
            }

            const isCustomerExists = _.find(getCustomers,(value)=>{
                return value.principal_code == contract.principal_code
            }) 

            if(isCustomerExists && isCustomerExists?.contract_status === 'APPROVED'){
                contract_header.push({
                    contract_id:contract.contract_id,
                    reason:'Principal already mapped to a contract'
                })
            }
        }

        //Contract Tariff Validation
        const getTariffs = await tariff.getAllTariff({
            filters:{
                tariff_id:_.uniq(details.map(item => item.tariff_id))
            }
        })

        for(let i in details){
            const contract_tariff = details[i]

            const valid_from=moment(contract_tariff?.valid_from).format('YYYY-MM-DD')
            const valid_to=moment(contract_tariff?.valid_to).format('YYYY-MM-DD')

            const tariff = _.find(getTariffs,(value)=>{
                return String(value.tariff_id).toLowerCase() === String(contract_tariff.tariff_id).toLowerCase()
            })

            if(!tariff){
                contract_details.push({
                    contract_id:contract_tariff.contract_id,
                    tariff_id:contract_tariff.tariff_id,
                    reason:'Tariff does not exists!'
                })

                continue;
            }

            if(tariff.tariff_status === 'DRAFT'){
                contract_details.push({
                    contract_id:contract_tariff.contract_id,
                    tariff_id:contract_tariff.tariff_id,
                    reason:'Tariff is in DRAFT Status'
                })

                continue;
            }
        }

        await contract.bulkCreateContractDetails({
            contract:contracts.filter(item => !contract_header.map(x => x.contract_id).includes(item.contract_id)).map(item => {
                return {
                    ...item,
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            }),
            details: details.filter(item => {
                const isInvalid = _.some(contract_details,{
                    contract_id:item.contract_id,
                    tariff_id:item.tariff_id
                })
    
                return !isInvalid
            })
            .map(item => {  
                
                return{
                    ...item,
                    tariff_rate: round(item.tariff_rate,2),
                    min_rate: String(item.min_rate) === 'null' ? null : round(item.min_rate,2),
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            })
        })
       

        if (contract_header.length === 0 && contract_details.length === 0){
                return res.end();
        }

        res.status(200).json({
            contract_header,
            contract_details
        })
    }
    catch(e){
        next(e)
    }
}

exports.uploadVendor=async(req,res,next)=>{
    try{
        const {data} = JSON.parse(JSON.stringify(req.body));
        let vendor_header=[];
        let vendor_group=[];
        let vendor_group_details=[];

        if(typeof data.vendor === 'undefined' || typeof data.vendor_group === 'undefined' || typeof data.vendor_group_details === 'undefined'){
            return res.status(400).json({
                message:'Invalid File!'
            })
        }

        const getVendor = await vendor.getAllVendor({
            filters:{
                vendor_id: data.vendor.map(item => item.vendor_id)
            }
        })

        const getVendorGroup = await vendor.getAllVendorGroup({
            filters:{
                vg_code :data.vendor_group.map(item =>item.vg_code)
            }
        })

        const getVendorGroupDetails = await dataUploadService.getVendorGroupDtl()
        

        for(let i in data.vendor){
            const vendor = data.vendor[i]

            const isExist = _.find(getVendor,(value)=>{
                return value.vendor_id === vendor.vendor_id
            })

            const isICFlagInvalid = ![1,0,true,false].includes(vendor.is_ic) 
        
            if(isExist){
                vendor_header.push({
                    vendor_id: vendor.vendor_id,
                    reason:'Vendor already exists!'
                })

                continue;
            }

            if(isICFlagInvalid){
                vendor_header.push({
                    vendor_id: vendor.vendor_id,
                    reason:'Incorrect IC flag'
                })

                continue;
            }
        }

        for(let i in data.vendor_group){
            const vendorGroup = data.vendor_group[i];

            const isExist = _.find(getVendorGroup,(value)=>{
                return value.vg_code === vendorGroup.vg_code
            })

            if(isExist){
                vendor_group.push({
                    vg_code: vendorGroup.vg_code,
                    reason:'Vendor Code already exists!'
                })

                continue;
            }

        }

        for(let i in data.vendor_group_details){
            const vendorGroupDetails = data.vendor_group_details[i];

            const isExist = _.find(getVendorGroupDetails,(value)=>{
                return String(value.location).toLowerCase() === String(vendorGroupDetails.location).toLowerCase() && String(value.vg_vendor_id).toLowerCase() === String(vendorGroupDetails.vg_vendor_id).toLowerCase() 
            })

            if(isExist){
                vendor_group_details.push({
                    vg_code: vendorGroupDetails.vg_code,
                    vg_vendor_id: vendorGroupDetails.vg_vendor_id,
                    reason:'Vendor mapping exists!'
                })
            }  
        }
        
        await vendor.bulkCreateTransaction({
            vendor:             data.vendor.filter(item => !vendor_header.map(x=>x.vendor_id).includes(item.vendor_id)).map(item => {
                return {
                    ...item,
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            }),
            vendorGroup:        data.vendor_group.filter(item => !vendor_group.map(x=>x.vg_code).includes(item.vg_code)).map(item => {
                return {
                    ...item,
                    created_by: req.processor.id,
                    updated_by: req.processor.id
                }
            }),
            vendorGroupDetails: data.vendor_group_details.filter(item => {
                const isInvalid = _.some(vendor_group_details,{
                    vg_code:item.vg_code,
                    vg_vendor_id:item.vg_vendor_id
                })

                return !isInvalid
            }).
            map(item => {
                return {
                    ...item,
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            })
        })

        if(vendor_header.length === 0 && vendor_group.length === 0 && vendor_group_details.length === 0){
            return res.end();
        }

        res.status(200).json({
            vendor_header,
            vendor_group,
            vendor_group_details
        })

    }   
    catch(e){
        next(e)
    }
}

exports.uploadPrincipal = async(req,res,next)=>{
    try{

        const {data}=req.body
        let principal_validation = [];

        if(typeof data.principal === 'undefined'){
            return res.status(400).json({
                message:'Invalid File!'
            })
        }

        const allPrincipals = await principal.getAllPrincipal({
            filters:{
                is_active:true
            }
        })

        for(let i in data.principal){
            const principalData = data.principal[i];
            const isExists = allPrincipals.filter(item => item.principal_code === String(principalData.principal_code))
          
            if(isExists.length > 0){
                principal_validation.push({
                    principal_code:principalData.principal_code,
                    reason:'Principal already exists!'
                })

                continue;
            }

            if(!principalData.principal_code){
                principal_validation.push({
                    principal_code:principalData.principal_code,
                    reason:'Principal code is required'
                })
            }

            if(!principalData.principal_name){
                principal_validation.push({
                    principal_code:principalData.principal_code,
                    reason:'Principal name is required'
                })
            }

            if(!principalData.ascii_principal_code){
                principal_validation.push({
                    principal_code:principalData.principal_code,
                    reason:'Principal code mapping to ascii is required!'
                })
            }

            if(!principalData.ascii_customer_code){
                principal_validation.push({
                    principal_code:principalData.principal_code,
                    reason:'Customer code mapping to ascii is required!'
                })
            }
        }

        await models.principal_tbl.bulkCreateData({
            data:_.differenceBy(data.principal,principal_validation,'principal_code').map(item => {
                return {
                    ...item,
                    created_by:req.processor.id,
                    modified_by:req.processor.id
                }
            }),
            options:{
                ignoreDuplicates:true
            }
        })

        if(principal_validation.length === 0){
            return res.end();
        }

        res.status(200).json({
            principal: principal_validation
        })
    }
    catch(e){
        next(e)
    }
}

exports.uploadShipPoint = async(req,res,next)=>{
    try{
        const {data} = JSON.parse(JSON.stringify(req.body));

        let shipPoint_validation = [];
        if(typeof data.ship_point === 'undefined'){
            return res.status(400).json({
                message:'Invalid File!'
            })
        }

        const allShipPoints = await shipPoint.getAllShipPoint({})

        const getRegion =   await geography.getGeoRegion({
            filters:{is_active:true}
        });
        const getProvince=  await geography.getGeoProvince({
            filters:{is_active:true}
        });
        const getCity=      await geography.getGeoCity({
            filters:{is_active:true}
        });

        for(const i in data.ship_point){
            const ship_point = data.ship_point[i]
            // console.log(ship_point)
            const isExists        = allShipPoints.filter(item => item.stc_code === ship_point.stc_code)
            const isRegionExists  = _.find(getRegion,   {region_code:   String(ship_point.region)})
            const isProviceExists = _.find(getProvince, {province_code: String(ship_point.province)})
            const isCityExists    = _.find(getCity,     {city_code:     String(ship_point.city)})
            
            if(isExists.length > 0){
                shipPoint_validation.push({
                    stc_code:ship_point.stc_code,
                    reason:'Ship Point already exists!'
                })
    
                continue;
            }

            if(!ship_point.stc_code){
                shipPoint_validation.push({
                    stc_code:ship_point.stc_code,
                    reason:'Ship Point code is required!'
                })
            }

            if(!ship_point.stc_description){
                shipPoint_validation.push({
                    stc_code:ship_point.stc_code,
                    reason:'Description is required!'
                })
            }

            if(!ship_point.stc_name){
                shipPoint_validation.push({
                    stc_code:ship_point.stc_code,
                    reason:'Ship Point name is required!'
                })
            }

            if(!isRegionExists){
                shipPoint_validation.push({
                    stc_code:ship_point.stc_code,
                    reason:`Region ${ship_point.region} does not exists!`
                })
            }

            if(!isProviceExists){
                shipPoint_validation.push({
                    stc_code:ship_point.stc_code,
                    reason:`Province ${ship_point.province} does not exists!`
                })

            }
            if(!isCityExists){
                shipPoint_validation.push({
                    stc_code:ship_point.stc_code,
                    reason:`City ${ship_point.city} does not exists!`
                })

            }

        }

        await shipPoint.bulkCreateShipPoint({
            data:_.differenceBy(data.ship_point,shipPoint_validation,'stc_code').map(item => {
                return {
                    ...item,
                    created_by:req.processor.id,
                    updated_by:req.processor.id
                }
            })
        })

        if(shipPoint_validation.length === 0){
            return res.end();
        }

        res.status(200).json({
          ship_point: shipPoint_validation
        })
        
         
        
    }
    catch(e){
        next(e)
    }
}

exports.getTemplate = (req,res,next) => {
    try{
        const {type} = req.body;    

        if(type === '' || type === null || typeof type === 'undefined' ){
            return res.status(400).json({
                message:'Invalid Template Type'
            })
        }   

        const file = path.join(path.resolve(__dirname,'../../'),`/assets/templates/${type}_upload_template.xlsx`)
        const filename = path.basename(file);
        const mimeType = mime.lookup(file);

        res.set('Content-disposition',filename);
        res.set('Content-type', mimeType);    

        const filestream = fs.createReadStream(file);
        filestream.pipe(res);
    }
    catch(e){
        next(e)
    }
}
