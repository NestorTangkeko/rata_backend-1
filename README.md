## Installing / Getting started

### Clone the repository.

```shell
$ git clone 
$ cd rata_backend-1/
$ npm install
```

The above commands clone the repository and install the dependencies.

## Developing

### Built With
|                                                                                                             |
|-------------------------------------------------------------------------------------------------------------|
| Code linting using [ESLint](http://eslint.org/)                                                             |
| Automatic syntax formatting using [prettier](https://github.com/prettier/prettier)                          |
| Auto-restart server using [nodemon](https://nodemon.io/)                                                    |
| Logging using [winston](https://github.com/winstonjs/winston)                                               |
| HTTP access control using [cors](https://github.com/expressjs/cors)                                         |
| HTTP status code and message using [http-status](https://github.com/adaltas/node-http-status)               |
| Authentication using [AWS Cognito](https://aws.amazon.com/cognito/) and [JSON Web Tokens](https://jwt.io/)  |
| An easy-to-use multi SQL dialect ORM for Node.js using [Sequelize](https://sequelize.org)                   |
| Redis-based queue for Node [Bull](https://github.com/OptimalBits/bull)   
| Crontab for man                                                                                                


### Setting up Dev

#### Create .env file

```shell
$ nano .env
```

Replace the values of the following fields:

```shell
# Node
NODE_ENV=<required>
NODE_PORT=<required>

# Database
# RBDB Database Setup
DB_HOST=<required>
DB=<required>
DB_USER=<required>
DB_PASSWORD=<required>

#Kronos Database Setup
KRONOS_DB_HOST=<required>  
KRONOS_DB_USER=<required>     
KRONOS_DB_PASSWORD=<required> 
KRONOS_DB=<required>          

#POD Database Setup
POD_DB_USER_NAME=<required>
POD_DB_PASSWORD=<required> 
POD_DB=<required>          
POD_DB_HOST=<required>

#Ascii Database Setup
ASCII_DB_HOST=<required>    
ASCII_DB_USER_NAME=<required>
ASCII_DB_PASSWORD=<required>
ASCII_DB=<required>  

#Datawarehouse Database Setup
DWPOD_DB_HOST=<required>    
DWPOD_DB_USER=<required>     
DWPOD_DB_PASSWORD=<required> 
DWPOD_DB=<required>

#Redis Setup
REDIS_URL=<required>           
REDIS_PORT=<required>          
REDIS_SESSION_EXPIRE=''

#Node Mailer Setup
NODEMAILER_EMAIL=<required>
NODEMAILER_PASSWORD=<required>

#Frontend URL
RATA_URL=<required>

```


#### To start developing with code linter,
```shell
$ npm run server
```
# 💰 Draft Bill Generation Process

This document outlines the core steps and logic used to generate Draft Bills, covering both vendor (BUY) and customer (SELL) financial processes, as well as common reasons for revenue leakage.

---

## 1. Core Draft Bill Generation Steps

This sequential process must be followed for every invoice to qualify it for draft billing.

1.  **Format Invoice:** Standardize the invoice structure based on the **class of store**.
2.  **Identify Billable Invoices:** Validate that the invoice is **Billable** and has **complete ship point information**.
3.  **Assign Contract:** Match the validated invoice to an active **Contract**.
4.  **Assign Tariff:** Match the validated invoice to the appropriate **Tariff** based on the contract and service type.

---

## 2. Process Logic: BUY (Vendor/IC Billing)

This logic is used for identifying vendor or inter-company (IC) charges and creating the corresponding Draft Bill.

1.  **Identify IC Vendors:** Create Draft Bill for all identified Inter-Company Vendors.
2.  **Identify Invoices With Aggregation:** Group and create Draft Bill for invoices requiring aggregation rules.
3.  **Identify Invoices Without Aggregation:** Create Draft Bill for all remaining, individual invoices.

---

## 3. Process Logic: SELL (Customer Billing)

This logic is used for identifying customer charges and creating the corresponding Draft Bill.

1.  **Identify Invoices With Aggregation:** Group and create Draft Bill for customer invoices requiring aggregation rules.
2.  **Identify Invoices Without Aggregation:** Create Draft Bill for all remaining, individual customer invoices.

---

## 4. Final Draft Bill Creation

After all line items have been processed by the BUY or SELL logic, the final bills are assembled.

1.  **Concatenate Draft Bills:** Combine all individual line-item records into final bill structures.
2.  **Assign Draft Bill No:** Generate and assign a unique **Draft Bill Number** to each final bill.

---

## 5. ⚠️ Revenue Leak Reasons (Why a Bill Fails)

The following conditions will prevent an invoice from successfully completing the billing process, leading to potential revenue leakage:

* **No Ship Point Information**
* **Not Billable** (Invoice fails business-rule validation)
* **No Contract**
* **No Tariff**
* **Duplicate Tariff** (Conflict in assigned tariff rules)
* **No Formula or Condition Match** (Tariff calculation failed to match a rule)
* **Invalid Total Charges Result** (Calculated charge amount is zero, negative, or otherwise invalid)
* **Trnsaction Error** (When an Invoice is matched with 2 different draft bills)

# Use Crontab Guru for generating cron expressions
* [CrontTab Guru](https://crontab.guru/)

#### Project Structure
```
.
├── node_modules
├── api
│   ├── authentication.js
│   ├── contract-tariff.js
│   ├── data-download.js
│   ├── data-management.js
│   ├── data-upload.js
│   ├── draft-bill.js
│   ├── helios.js
│   ├── index.js
│   ├── roles.js
│   ├── scheduler.js
│   ├── select.js
│   ├── test.js
│   └── users.js
├── assets
│   ├── image
│   │   └── klilogo.png
│   ├── reports
│   │   ├── accrual
│   │   └── pre-billing
│   ├── templates
│   │   ├── contract_upload_template.xlsx
│   │   ├── cr_upload_template.xlsx
│   │   ├── export_draft_bill.xlsx
│   │   ├── location_upload_template.xlsx
│   │   ├── principal_upload_template.xlsx
│   │   ├── ship-point_upload_template.xlsx
│   │   ├── so_upload_template.xlsx
│   │   ├── tariff_upload_template.xlsx
│   │   ├── vendor_upload_template.xlsx
│   │   ├── wms-contract_upload_template.xlsx
│   │   └── wms-tariff_upload_template.xlsx
│   └── uploads
├── config
│   ├── index.js
│   ├── ioredis.js
│   ├── redis.js
│   ├── redisIndex.js
│   └── vars.js
├── database
│   ├── index.js
│   ├── podDB.js
│   └── scmdb.js
├── ecosystem.config.js
├── helper
│   ├── index.js
│   ├── redisHelper.js
│   ├── redisIndex.js
│   ├── useFormatFilters.js
│   └── viewFilters.js
├── index.js
├── loaders
│   ├── dbLoader.js
│   ├── index.js
│   └── middleware.js
├── models
│   ├── agg_conditions_tbl.js
│   ├── agg_tbl.js
│   ├── contract_hdr_tbl.js
│   ├── contract_tariff_dtl.js
│   ├── contract_tariff_wms_tbl.js
│   ├── contract_wms_tbl.js
│   ├── draft_bill_hdr_tbl.js
│   ├── draft_bill_invoice_tbl.js
│   ├── geo_barangay_tbl.js
│   ├── geo_city_tbl.js
│   ├── geo_country_tbl.js
│   ├── geo_province_tbl.js
│   ├── geo_region_tbl.js
│   ├── helios_invoices_dtl_tbl.js
│   ├── helios_invoices_hdr_tbl.js
│   ├── index.js
│   ├── invoices_cleared_hdr.js
│   ├── invoices_dtl_tbl.js
│   ├── invoices_rev_leak_tbl.js
│   ├── location_tbl.js
│   ├── principal_tbl.js
│   ├── quick_code_tbl.js
│   ├── role_modules_tbl.js
│   ├── role_tbl.js
│   ├── scheduler_auto_sync_trckr_tbl.js
│   ├── scheduler_setup_tbl.js
│   ├── service_type_tbl.js
│   ├── ship_point_tbl.js
│   ├── tariff_sell_hdr_tbl.js
│   ├── tariff_type_cond.js
│   ├── tariff_type_tbl.js
│   ├── tariff_wms_tbl.js
│   ├── user_tbl.js
│   ├── vendor_group_dtl_tbl.js
│   ├── vendor_group_tbl.js
│   ├── vendor_tbl.js
│   ├── wms_data_details_tbl.js
│   ├── wms_data_header_tbl.js
│   ├── wms_draft_bill_dtl_tbl.js
│   ├── wms_draft_bill_hdr_tbl.js
│   ├── wms_rev_leak_dtl_tbl.js
│   └── wms_rev_leak_tbl.js
├── services
│   ├── Helios
│   │   ├── Bookings
│   │   │   ├── bookings.js
│   │   │   ├── bookingsDatalayer.js
│   │   │   └── package.json
│   │   └── index.js
│   ├── aggregation
│   │   ├── aggregation.js
│   │   ├── aggregationDatalayer.js
│   │   └── package.json
│   ├── ascii
│   │   ├── asciiService.js
│   │   └── package.json
│   ├── auth
│   │   ├── auth.js
│   │   ├── datalayer.js
│   │   └── package.json
│   ├── contract
│   │   ├── contractDatalayer.js
│   │   ├── contractService.js
│   │   └── package.json
│   ├── dataDownload
│   │   ├── dataDownload.js
│   │   └── package.json
│   ├── dataMaster
│   │   ├── dataMasterDataLayer.js
│   │   ├── dataMasterService.js
│   │   └── package.json
│   ├── draftBill
│   │   ├── buyLogic.js
│   │   ├── draftBillDatalayer.js
│   │   ├── draftBillService.js
│   │   ├── draftBillService_v1.js
│   │   ├── draftBillTest.js
│   │   └── package.json
│   ├── generateDraftBill
│   │   ├── generateDraftBill.js
│   │   ├── generateDraftBillDatalayer.js
│   │   └── package.json
│   ├── geography
│   │   ├── geographyDataLayer.js
│   │   └── index.js
│   ├── index.js
│   ├── invoice
│   │   ├── invoiceDataLayer.js
│   │   ├── invoiceService.js
│   │   └── package.json
│   ├── location
│   │   ├── index.js
│   │   └── locationDataLayer.js
│   ├── principal
│   │   ├── index.js
│   │   └── principalDatalayer.js
│   ├── quickCodes
│   │   ├── index.js
│   │   └── quickCodesDatalayer.js
│   ├── revenueLeak
│   │   ├── package.json
│   │   ├── revenueLeakDataLayer.js
│   │   └── revenueLeakService.js
│   ├── roles
│   │   ├── package.json
│   │   ├── rolesDataLayer.js
│   │   └── rolesService.js
│   ├── scheduler
│   │   ├── package.json
│   │   ├── schedulerDataLayer.js
│   │   └── schedulerService.js
│   ├── shipPoint
│   │   ├── dataLayer.js
│   │   └── index.js
│   ├── tariff
│   │   ├── package.json
│   │   ├── tariffDatalayer.js
│   │   └── tariffService.js
│   ├── users
│   │   ├── package.json
│   │   ├── users.js
│   │   └── usersDataLayer.js
│   ├── vendor
│   │   ├── package.json
│   │   ├── vendorDatalayer.js
│   │   └── vendorService.js
│   ├── wms
│   │   ├── package.json
│   │   ├── wmsDatalayer.js
│   │   └── wmsService.js
│   ├── wms-draftbill
│   │   ├── index.js
│   │   ├── wms-draftbill.js
│   │   ├── wms.draftBillDatalayer.js
│   │   └── wms.draftbillService.js
│   └── wms-revenueLeak
│       ├── index.js
│       ├── wms.revenueLeak.js
│       ├── wms.revenueLeakDatalayer.js
│       └── wms.revenueLeakService.js
└── src
    ├── api
    │   ├── administration.js
    │   ├── ascii.js
    │   ├── authentication.js
    │   ├── contract.js
    │   ├── cr-upload.js
    │   ├── data-export.js
    │   ├── data-management.js
    │   ├── data-upload.js
    │   ├── draftbill.js
    │   ├── index.js
    │   ├── invoices.js
    │   ├── reports.js
    │   ├── revenue-leak.js
    │   ├── scheduler.js
    │   ├── select.js
    │   ├── so-upload.js
    │   └── tariff.js
    ├── controllers
    │   ├── administrationController.js
    │   ├── asciiControllers.js
    │   ├── authController.js
    │   ├── contractController.js
    │   ├── costAllocController.js
    │   ├── crUploadController.js
    │   ├── dataExportController.js
    │   ├── dataManagementController.js
    │   ├── dataUploadController.js
    │   ├── draftbillController.js
    │   ├── invoiceController.js
    │   ├── reportsController.js
    │   ├── revenueLeakController.js
    │   ├── schedulerController.js
    │   ├── select.controller.js
    │   ├── soUploadController.js
    │   ├── tariffController.js
    │   └── vehicleTypesController.js
    ├── errors
    │   ├── api-error.js
    │   └── extendable-error.js
    ├── helpers
    │   ├── filters.js
    │   └── round
    │       └── index.js
    ├── jobs
    │   ├── crons
    │   │   ├── cron.js
    │   │   └── package.json
    │   ├── draftbill-range
    │   │   ├── draftbill-buy.js
    │   │   └── draftbill-sell.js
    │   ├── dwh.workers
    │   │   ├── expense.accrual.worker.js
    │   │   └── revenue.accrual.worker.js
    │   ├── index.js
    │   ├── queues
    │   │   └── queues.js
    │   ├── reports
    │   │   ├── accrualExpense.js
    │   │   ├── accrualRevenue.js
    │   │   ├── crossdockWorker.js
    │   │   ├── p2pWorker.js
    │   │   └── reverseLogistics.js
    │   ├── transportWorker.js
    │   └── warehouseWorker.js
    ├── middleware
    │   ├── auth.js
    │   ├── body-validator.middleware.js
    │   ├── bull-board.js
    │   ├── error.js
    │   ├── multer.js
    │   └── query-validator.middlerware.js
    ├── models
    │   ├── datawarehouse
    │   │   ├── index.js
    │   │   ├── rata_daily_accrual_details.js
    │   │   ├── rata_daily_accrual_header.js
    │   │   ├── rata_daily_accrual_leak_details.js
    │   │   └── rata_daily_accrual_leak_header.js
    │   ├── index.js
    │   ├── kronos
    │   │   ├── index.js
    │   │   └── vehicle_type.js
    │   ├── logistikus_si
    │   │   └── index.js
    │   └── rata
    │       ├── agg_conditions_tbl.js
    │       ├── agg_tbl.js
    │       ├── contract_hdr_tbl.js
    │       ├── contract_history_tbl.js
    │       ├── contract_tariff_dtl.js
    │       ├── contract_tariff_history_tbl.js
    │       ├── cost_alloc_setup_tbl.js
    │       ├── cr_upload_details_tbl.js
    │       ├── cr_upload_errors_tbl.js
    │       ├── cr_upload_header_tbl.js
    │       ├── draft_bill_ascii_dtl_tbl.js
    │       ├── draft_bill_ascii_hdr_tbl.js
    │       ├── draft_bill_cost_alloc_tbl.js
    │       ├── draft_bill_details_tbl.js
    │       ├── draft_bill_hdr_tbl.js
    │       ├── draft_bill_invoice_tbl.js
    │       ├── geo_barangay_tbl.js
    │       ├── geo_city_tbl.js
    │       ├── geo_country_tbl.js
    │       ├── geo_province_tbl.js
    │       ├── geo_region_tbl.js
    │       ├── helios_invoices_dtl_tbl.js
    │       ├── helios_invoices_hdr_tbl.js
    │       ├── index.js
    │       ├── location_tbl.js
    │       ├── principal_tbl.js
    │       ├── quick_code_tbl.js
    │       ├── report_schedule_tbl.js
    │       ├── report_tbl.js
    │       ├── role_access_tbl.js
    │       ├── role_module.js
    │       ├── role_tbl.js
    │       ├── scheduler_auto_sync_trckr_tbl.js
    │       ├── scheduler_email_tbl.js
    │       ├── scheduler_setup_tbl.js
    │       ├── service_type_tbl.js
    │       ├── ship_point_tbl.js
    │       ├── so_upload_details_tbl.js
    │       ├── so_upload_errors_tbl.js
    │       ├── so_upload_header_tbl.js
    │       ├── tariff_ic_algo_tbl.js
    │       ├── tariff_sell_hdr_tbl.js
    │       ├── tranport_rev_leak_dtl_tbl.js
    │       ├── transport_rev_leak_hdr_tbl.js
    │       ├── user_logs_tbl.js
    │       ├── user_tbl.js
    │       ├── vehicle_types_tbl.js
    │       ├── vendor_group_dtl_tbl.js
    │       ├── vendor_group_tbl.js
    │       ├── vendor_tbl.js
    │       ├── wms_data_details_tbl.js
    │       ├── wms_data_header_tbl.js
    │       ├── wms_draft_bill_dtl_tbl.js
    │       ├── wms_draft_bill_hdr_tbl.js
    │       └── wms_rev_leak_tbl.js
    ├── services
    │   ├── asciiService
    │   │   ├── asciiService.js
    │   │   └── package.json
    │   ├── contract.service.js
    │   ├── costalloc.service.js
    │   ├── crUploadService.js
    │   ├── dataExportService
    │   │   ├── dataExportService.js
    │   │   └── package.json
    │   ├── dataUploadService
    │   │   ├── dataUploadService.js
    │   │   └── package.json
    │   ├── draftbill-ranged.service.js
    │   ├── draftbillService
    │   │   ├── draftBillService.js
    │   │   └── package.json
    │   ├── emailService
    │   │   ├── emailService.js
    │   │   └── package.json
    │   ├── geography.service.js
    │   ├── invoice.service.js
    │   ├── podReport.excel.service.js
    │   ├── podReport.service.js
    │   ├── reports.service.js
    │   ├── schedulerService
    │   │   ├── package.json
    │   │   └── schedulerService.js
    │   ├── serviceType.service.js
    │   ├── shipPoint.service.js
    │   ├── soUploadService.js
    │   ├── transportRevenueLeak
    │   │   ├── package.json
    │   │   └── transportRevenueLeak.js
    │   ├── user.service.js
    │   └── vehicle_types.service.js
    └── validations
        ├── contract.validation.js
        ├── cost-alloc.validation.js
        ├── data-export.validation.js
        ├── draft-bill.validation.js
        ├── index.js
        └── tariff.validation.js    
```

