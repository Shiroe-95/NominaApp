const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSetup() {
    console.log("Starting DB initialization...");
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("❌ No database connection string found. Set POSTGRES_URL or DATABASE_URL.");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const schemaPath = path.join(__dirname, '..', 'src', 'lib', 'db', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log("Schema file read successfully. Executing...");

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(schemaSql);
            console.log("Executing transaction...");
            await client.query('COMMIT');
            console.log("✅ Database schema successfully initialized.");
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Database Initialization Error:', error);
    } finally {
        await pool.end();
    }
}

runSetup();
