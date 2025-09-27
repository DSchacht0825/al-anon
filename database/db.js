const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

class Database {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.db = null;
        this.pool = null;
    }

    async connect() {
        if (this.isProduction) {
            // PostgreSQL for production
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
            });
            console.log('Connected to PostgreSQL database');
        } else {
            // SQLite for local development
            this.db = new sqlite3.Database('./database/alanon.db', (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                } else {
                    console.log('Connected to SQLite database');
                }
            });
        }

        await this.initializeDatabase();
    }

    async initializeDatabase() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Journal entries table
            `CREATE TABLE IF NOT EXISTS journal_entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                date DATE NOT NULL,
                morning_intention TEXT,
                evening_reflection TEXT,
                gratitude TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Step progress table
            `CREATE TABLE IF NOT EXISTS step_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                step_number INTEGER NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                notes TEXT,
                completed_date DATE
            )`,

            // Step work entries table
            `CREATE TABLE IF NOT EXISTS step_work_entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                step_number INTEGER NOT NULL,
                entry_text TEXT NOT NULL,
                work_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Daily readings table
            `CREATE TABLE IF NOT EXISTS daily_readings (
                id SERIAL PRIMARY KEY,
                day_of_year INTEGER UNIQUE NOT NULL,
                book TEXT NOT NULL,
                title TEXT,
                content TEXT NOT NULL,
                page_number INTEGER
            )`
        ];

        for (const tableQuery of tables) {
            await this.run(tableQuery);
        }

        console.log('Database tables initialized');
    }

    async run(query, params = []) {
        if (this.isProduction) {
            // PostgreSQL
            try {
                // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
                let pgQuery = query;
                for (let i = 0; i < params.length; i++) {
                    pgQuery = pgQuery.replace('?', `$${i + 1}`);
                }

                const result = await this.pool.query(pgQuery, params);
                return {
                    lastID: result.rows[0]?.id || result.rows[0]?.user_id || null,
                    changes: result.rowCount
                };
            } catch (error) {
                throw error;
            }
        } else {
            // SQLite
            return new Promise((resolve, reject) => {
                this.db.run(query, params, function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
        }
    }

    async get(query, params = []) {
        if (this.isProduction) {
            // PostgreSQL
            let pgQuery = query;
            for (let i = 0; i < params.length; i++) {
                pgQuery = pgQuery.replace('?', `$${i + 1}`);
            }
            const result = await this.pool.query(pgQuery, params);
            return result.rows[0];
        } else {
            // SQLite
            return new Promise((resolve, reject) => {
                this.db.get(query, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
    }

    async all(query, params = []) {
        if (this.isProduction) {
            // PostgreSQL
            let pgQuery = query;
            for (let i = 0; i < params.length; i++) {
                pgQuery = pgQuery.replace('?', `$${i + 1}`);
            }
            const result = await this.pool.query(pgQuery, params);
            return result.rows;
        } else {
            // SQLite
            return new Promise((resolve, reject) => {
                this.db.all(query, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    }

    close() {
        if (this.isProduction && this.pool) {
            this.pool.end();
        } else if (this.db) {
            this.db.close();
        }
    }
}

module.exports = Database;