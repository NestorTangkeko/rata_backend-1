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

