import sql from 'mssql';

const config = {
    user:"sa",
    password:"time@1Sa",
    database:"AA_2023_2024",
    server:"Y4_MAX",
    options:{
        encrypt:false,
        trustServerCertificate:true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool:sql.ConnectionPool|undefined;

export async function getPool(){
    if(!pool){
        pool = await sql.connect(config);
    }
    return pool;
}