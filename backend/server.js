const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const Database = require('../database/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Database setup
const database = new Database();
let db;

// Initialize database connection
async function initializeApp() {
    try {
        await database.connect();
        db = database;
        console.log('Database connected and initialized');

        // Seed daily readings if none exist
        await seedReadingsIfEmpty();

        // Start server after database is ready
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Al-Anon Recovery App running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
}

// Auto-seed readings if database is empty
async function seedReadingsIfEmpty() {
    try {
        const existingCount = await db.get('SELECT COUNT(*) as count FROM daily_readings');
        if (existingCount.count === 0) {
            console.log('Seeding daily readings...');
            const readings = generateYearlyReadings();

            for (const reading of readings) {
                await db.run(
                    'INSERT INTO daily_readings (day_of_year, book, title, content, page_number) VALUES (?, ?, ?, ?, ?)',
                    [reading.day_of_year, reading.book, reading.title, reading.content, reading.page_number]
                );
            }
            console.log(`Seeded ${readings.length} daily readings`);
        }
    } catch (error) {
        console.log('Note: Could not auto-seed readings:', error.message);
    }
}

initializeApp();

// Database tables are now initialized in the Database class

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Routes

// User registration
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, firstName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.run(
            'INSERT INTO users (email, password, first_name) VALUES (?, ?, ?) RETURNING id',
            [email, hashedPassword, firstName]
        );

        const userId = result.lastID;
        const token = jwt.sign({ userId, email }, JWT_SECRET);
        res.json({ token, userId, message: 'Registration successful' });
    } catch (error) {
        if (error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, userId: user.id, firstName: user.first_name });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get daily reading
app.get('/api/daily-reading', async (req, res) => {
    try {
        // Use Pacific Time (PST/PDT) for consistency with California users
        const today = new Date();
        const pacificTime = new Date(today.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const dayOfYear = getDayOfYear(pacificTime);

        const reading = await db.get(
            'SELECT * FROM daily_readings WHERE day_of_year = ?',
            [dayOfYear]
        );

        if (!reading) {
            // Fallback to a default reading
            const defaultReading = {
                day_of_year: dayOfYear,
                date: pacificTime.toISOString().split('T')[0],
                book: 'Courage to Change',
                title: 'One Day at a Time',
                content: 'Just for today, I will try to live through this day only, and not tackle my whole life problem at once. I can do something for twelve hours that would appall me if I felt that I had to keep it up for a lifetime.',
                page_number: dayOfYear
            };
            return res.json(defaultReading);
        }

        // Add today's date to the response (in Pacific time)
        reading.date = pacificTime.toISOString().split('T')[0];
        res.json(reading);
    } catch (error) {
        console.error('Daily reading error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to get day of year (1-366)
function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

// Seed daily readings (admin endpoint)
app.post('/api/admin/seed-readings', async (req, res) => {
    try {
        const readings = generateYearlyReadings();

        for (const reading of readings) {
            try {
                // Try PostgreSQL syntax first
                await db.run(
                    'INSERT INTO daily_readings (day_of_year, book, title, content, page_number) VALUES (?, ?, ?, ?, ?) ON CONFLICT (day_of_year) DO UPDATE SET book = EXCLUDED.book, title = EXCLUDED.title, content = EXCLUDED.content, page_number = EXCLUDED.page_number',
                    [reading.day_of_year, reading.book, reading.title, reading.content, reading.page_number]
                );
            } catch (error) {
                // Fallback to simple insert for SQLite
                try {
                    await db.run(
                        'INSERT INTO daily_readings (day_of_year, book, title, content, page_number) VALUES (?, ?, ?, ?, ?)',
                        [reading.day_of_year, reading.book, reading.title, reading.content, reading.page_number]
                    );
                } catch (insertError) {
                    console.log(`Skipping duplicate day ${reading.day_of_year}`);
                }
            }
        }

        res.json({ message: `Seeded ${readings.length} daily readings` });
    } catch (error) {
        console.error('Seeding error:', error);
        res.status(500).json({ error: 'Failed to seed readings' });
    }
});

// Generate yearly readings
function generateYearlyReadings() {
    const readings = [];
    const alAnonThemes = [
        'Acceptance', 'Letting Go', 'Serenity', 'One Day at a Time', 'Progress Not Perfection',
        'Keep It Simple', 'Courage to Change', 'Detachment', 'Self-Care', 'Gratitude',
        'Hope', 'Faith', 'Trust', 'Boundaries', 'Inner Peace', 'Recovery', 'Wisdom',
        'Compassion', 'Understanding', 'Forgiveness', 'Strength', 'Growth', 'Healing'
    ];

    const sampleReadings = [
        {
            title: 'Acceptance',
            content: 'Acceptance is the answer to all my problems today. When I am disturbed, it is because I find some person, place, thing or situation unacceptable to me. I can find no serenity until I accept that person, place, thing or situation as being exactly the way it is supposed to be at this moment.'
        },
        {
            title: 'One Day at a Time',
            content: 'Just for today, I will try to live through this day only, and not tackle my whole life problem at once. I can do something for twelve hours that would appall me if I felt that I had to keep it up for a lifetime.'
        },
        {
            title: 'Letting Go',
            content: 'Letting go means realizing that some people are a part of your history, but not a part of your destiny. In Al-Anon, I learn that I am powerless over other people and their choices.'
        },
        {
            title: 'Serenity',
            content: 'God, grant me the serenity to accept the things I cannot change, the courage to change the things I can, and the wisdom to know the difference.'
        },
        {
            title: 'Progress Not Perfection',
            content: 'I strive for progress, not perfection. Each day I take small steps forward in my recovery, knowing that growth is a journey, not a destination.'
        },
        {
            title: 'Detachment',
            content: 'Detachment is not that I do not care. It is that I learn to love, care, and be involved without going crazy. I detach from the outcome and focus on my own recovery.'
        },
        {
            title: 'Self-Care',
            content: 'Taking care of myself is not selfish. It is essential. When I nurture my own well-being, I am better able to support others in healthy ways.'
        },
        {
            title: 'Gratitude',
            content: 'Gratitude turns what we have into enough. Today I will focus on the blessings in my life, no matter how small they may seem.'
        },
        {
            title: 'Courage to Change',
            content: 'The courage to change the things I can begins with changing myself. I cannot control others, but I can control my reactions and choices.'
        },
        {
            title: 'Keep It Simple',
            content: 'Life is as complicated as I make it. Today I will keep things simple and focus on what truly matters in my recovery journey.'
        }
    ];

    for (let day = 1; day <= 366; day++) {
        const themeIndex = (day - 1) % alAnonThemes.length;
        const readingIndex = (day - 1) % sampleReadings.length;
        const theme = alAnonThemes[themeIndex];
        const reading = sampleReadings[readingIndex];

        readings.push({
            day_of_year: day,
            book: 'Courage to Change',
            title: `${theme} - Day ${day}`,
            content: reading.content,
            page_number: day
        });
    }

    return readings;
}

// Get journal entry for today
app.get('/api/journal/today', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const entry = await db.get(
            'SELECT * FROM journal_entries WHERE user_id = ? AND date = ?',
            [req.user.userId, today]
        );

        res.json(entry || {});
    } catch (error) {
        console.error('Journal get error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get journal history
app.get('/api/journal/history', authenticateToken, async (req, res) => {
    try {
        const entries = await db.all(
            'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT 30',
            [req.user.userId]
        );

        res.json(entries);
    } catch (error) {
        console.error('Journal history error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Save/update journal entry
app.post('/api/journal', authenticateToken, async (req, res) => {
    try {
        const { date, morningIntention, eveningReflection, gratitude } = req.body;
        const entryDate = date || new Date().toISOString().split('T')[0];

        const existing = await db.get(
            'SELECT * FROM journal_entries WHERE user_id = ? AND date = ?',
            [req.user.userId, entryDate]
        );

        if (existing) {
            // Update existing entry
            await db.run(
                `UPDATE journal_entries
                 SET morning_intention = ?, evening_reflection = ?, gratitude = ?
                 WHERE user_id = ? AND date = ?`,
                [morningIntention, eveningReflection, gratitude, req.user.userId, entryDate]
            );
            res.json({ message: 'Journal entry updated' });
        } else {
            // Create new entry
            await db.run(
                `INSERT INTO journal_entries (user_id, date, morning_intention, evening_reflection, gratitude)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.user.userId, entryDate, morningIntention, eveningReflection, gratitude]
            );
            res.json({ message: 'Journal entry saved' });
        }
    } catch (error) {
        console.error('Journal save error:', error);
        res.status(500).json({ error: 'Failed to save journal entry' });
    }
});

// Get step progress
app.get('/api/steps', authenticateToken, async (req, res) => {
    try {
        const steps = await db.all(
            'SELECT * FROM step_progress WHERE user_id = ? ORDER BY step_number',
            [req.user.userId]
        );
        res.json(steps);
    } catch (error) {
        console.error('Steps get error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get step work entries for a specific step
app.get('/api/steps/:stepNumber/entries', authenticateToken, async (req, res) => {
    try {
        const { stepNumber } = req.params;

        const entries = await db.all(
            'SELECT * FROM step_work_entries WHERE user_id = ? AND step_number = ? ORDER BY created_at DESC',
            [req.user.userId, stepNumber]
        );
        res.json(entries);
    } catch (error) {
        console.error('Step entries get error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add new step work entry
app.post('/api/steps/:stepNumber/entries', authenticateToken, async (req, res) => {
    try {
        const { stepNumber } = req.params;
        const { entryText, workDate } = req.body;
        const entryDate = workDate || new Date().toISOString().split('T')[0];

        if (!entryText || !entryText.trim()) {
            return res.status(400).json({ error: 'Entry text is required' });
        }

        const result = await db.run(
            'INSERT INTO step_work_entries (user_id, step_number, entry_text, work_date) VALUES (?, ?, ?, ?) RETURNING id',
            [req.user.userId, stepNumber, entryText.trim(), entryDate]
        );

        res.json({
            message: 'Step work entry saved',
            entryId: result.lastID
        });
    } catch (error) {
        console.error('Step entry save error:', error);
        res.status(500).json({ error: 'Failed to save step work entry' });
    }
});

// Update step work entry
app.put('/api/steps/:stepNumber/entries/:entryId', authenticateToken, async (req, res) => {
    try {
        const { stepNumber, entryId } = req.params;
        const { entryText } = req.body;

        if (!entryText || !entryText.trim()) {
            return res.status(400).json({ error: 'Entry text is required' });
        }

        const result = await db.run(
            'UPDATE step_work_entries SET entry_text = ? WHERE id = ? AND user_id = ? AND step_number = ?',
            [entryText.trim(), entryId, req.user.userId, stepNumber]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ message: 'Step work entry updated' });
    } catch (error) {
        console.error('Step entry update error:', error);
        res.status(500).json({ error: 'Failed to update step work entry' });
    }
});

// Delete step work entry
app.delete('/api/steps/:stepNumber/entries/:entryId', authenticateToken, async (req, res) => {
    try {
        const { stepNumber, entryId } = req.params;

        const result = await db.run(
            'DELETE FROM step_work_entries WHERE id = ? AND user_id = ? AND step_number = ?',
            [entryId, req.user.userId, stepNumber]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ message: 'Step work entry deleted' });
    } catch (error) {
        console.error('Step entry delete error:', error);
        res.status(500).json({ error: 'Failed to delete step work entry' });
    }
});

// Update step progress
app.post('/api/steps/:stepNumber', authenticateToken, async (req, res) => {
    try {
        const { stepNumber } = req.params;
        const { completed, notes } = req.body;
        const completedDate = completed ? new Date().toISOString().split('T')[0] : null;

        const existing = await db.get(
            'SELECT * FROM step_progress WHERE user_id = ? AND step_number = ?',
            [req.user.userId, stepNumber]
        );

        if (existing) {
            // Update existing
            await db.run(
                `UPDATE step_progress
                 SET completed = ?, notes = ?, completed_date = ?
                 WHERE user_id = ? AND step_number = ?`,
                [completed, notes, completedDate, req.user.userId, stepNumber]
            );
            res.json({ message: 'Step progress updated' });
        } else {
            // Create new
            await db.run(
                `INSERT INTO step_progress (user_id, step_number, completed, notes, completed_date)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.user.userId, stepNumber, completed, notes, completedDate]
            );
            res.json({ message: 'Step progress saved' });
        }
    } catch (error) {
        console.error('Step progress error:', error);
        res.status(500).json({ error: 'Failed to save step progress' });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});