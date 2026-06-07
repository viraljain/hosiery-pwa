import sql from 'mssql';

// const config = {
//     user:"--",
//     password:"-----",
//     database:"AA_2023_2024",
//     server:"Y4_MAX",
//     options:{
//         encrypt:false,
//         trustServerCertificate:true
//     },
//     pool: {
//         max: 10,
//         min: 0,
//         idleTimeoutMillis: 30000
//     }
// };
const config = {
    user:process.env.SQLSERVER_USER!,password:process.env.SQLSERVER_PASSWORD!, database:process.env.SQLSERVER_DB!, server:process.env.SQLSERVER_SERVER!, port:Number(process.env.SQLSERVER_PORT!), 
	options:{encrypt:false, trustServerCertificate:true},
	pool: {max: 10,min: 0,idleTimeoutMillis: 30000}
	};


// const configJPDell = {
//     user:"--",
//     password:"-----",
//     database:"AA_2023_2024",
//     server:"jpdell",
//     port:55264,
//     options:{
//         encrypt:false,
//         trustServerCertificate:true
//     },
//     pool: {
//         max: 10,
//         min: 0,
//         idleTimeoutMillis: 30000
//     }
// };

let pool:sql.ConnectionPool|undefined;

export async function getPool(){
    if(!pool){
        // pool = await sql.connect(PROCESS.ENV.SQLSERVER_CONNECTION_STRING||config);
        // pool = await sql.connect(configJPDell);
        pool = await sql.connect(config);        
    }
    return pool;
}