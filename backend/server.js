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
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
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
        const today = new Date().toISOString().split('T')[0];

        const reading = await db.get(
            'SELECT * FROM daily_readings WHERE date = ?',
            [today]
        );

        if (!reading) {
            // Return a default reading if none exists for today
            const defaultReading = {
                date: today,
                book: 'Courage to Change',
                title: 'One Day at a Time',
                content: 'Just for today, I will try to live through this day only, and not tackle my whole life problem at once. I can do something for twelve hours that would appall me if I felt that I had to keep it up for a lifetime.',
                page_number: 1
            };
            return res.json(defaultReading);
        }

        res.json(reading);
    } catch (error) {
        console.error('Daily reading error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

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

app.listen(PORT, () => {
    console.log(`Al-Anon Recovery App running on port ${PORT}`);
});