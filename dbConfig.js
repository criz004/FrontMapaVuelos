// dbConfig.js
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'admin_DB_DatosCIRUM',
    password: process.env.DB_PASSWORD || 'CIRUM/*4dm1n1str4t0r2026',
    server: process.env.DB_SERVER || '172.16.2.125', 
    database: process.env.DB_NAME || 'DatosCIRUM',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

module.exports = config;