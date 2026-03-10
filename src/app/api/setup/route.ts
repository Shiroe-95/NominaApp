import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

function getErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
    return error instanceof Error ? error.message : fallback;
}

export async function POST() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        return NextResponse.json(
            { error: 'DATABASE_URL not set. Run the schema.sql manually in the Supabase SQL Editor (Project > SQL Editor).' },
            { status: 500 }
        );
    }

    try {
        const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(schemaSql);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        await pool.end();

        return NextResponse.json({ success: true, message: 'Database schema successfully initialized.' });
    } catch (error: unknown) {
        console.error('Database Initialization Error:', error);
        return NextResponse.json(
            {
                error: getErrorMessage(error, 'Failed to initialize database.'),
                hint: 'If the direct connection fails, run src/lib/db/schema.sql manually in the Supabase SQL Editor.',
            },
            { status: 500 }
        );
    }
}
