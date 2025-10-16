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
| Logging using [winston](https://github.com/winstonjs/winston)                                                 |
| HTTP access control using [cors](https://github.com/expressjs/cors)                                         |
| HTTP status code and message using [http-status](https://github.com/adaltas/node-http-status)               |
| Authentication using [AWS Cognito](https://aws.amazon.com/cognito/) and [JSON Web Tokens](https://jwt.io/)  |
| An easy-to-use multi SQL dialect ORM for Node.js using [Sequelize](https://sequelize.org)                   |
|                                                                                                             |


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
