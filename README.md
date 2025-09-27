# 🌅 Al-Anon Recovery Companion

A beautiful, peaceful web application designed specifically for Al-Anon members to support their recovery journey through daily readings, intentional journaling, and 12-step program tracking.

## ✨ Features

### 📖 Daily Readings
- Daily selections from "Courage to Change" and "One Day at a Time"
- Peaceful, centered reading experience
- Date-based reading system

### 📝 Daily Journaling
- **Morning Intentions**: Set your focus for the day
- **Evening Reflections**: Process your day's experiences
- **Gratitude Practice**: Cultivate thankfulness
- Auto-save functionality for seamless writing

### 🔢 12-Step Program Tracker
- Interactive tracker for all 12 Al-Anon steps
- Personal notes and reflections for each step
- Progress tracking with completion status
- Detailed step descriptions and guidance

### 👤 Secure User Accounts
- Simple registration and login
- Secure password protection
- Personal data privacy
- JWT-based authentication

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Application**
   ```bash
   npm start
   ```

3. **Open Your Browser**
   Navigate to `http://localhost:3000`

4. **Create Your Account**
   Register with your email and start your recovery journey!

## 🛠️ Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript with modern CSS
- **Backend**: Node.js with Express
- **Database**: SQLite (simple, file-based)
- **Authentication**: JWT tokens with bcrypt password hashing

### Database Schema
The app uses four main tables:
- `users` - User accounts and profiles
- `journal_entries` - Daily journal entries
- `step_progress` - 12-step program tracking
- `daily_readings` - Reading content (expandable)

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- Input validation and sanitization

## 📱 Mobile Friendly

The app is fully responsive and works beautifully on:
- Desktop computers
- Tablets
- Mobile phones

## 🎨 Design Philosophy

This app is designed with recovery in mind:
- **Calm, peaceful colors** that promote serenity
- **Clean, uncluttered interface** for focused reflection
- **Gentle gradients and soft shadows** for visual comfort
- **Accessible typography** for easy reading
- **Intuitive navigation** to reduce cognitive load

## 🔒 Privacy & Security

Your recovery journey is deeply personal. This app:
- Stores all data locally on your server
- Uses secure password hashing
- Protects against common web vulnerabilities
- Keeps your journal entries completely private

## 🌱 Al-Anon Program Integration

This app honors the Al-Anon program by:
- Following the official 12 steps exactly as written
- Encouraging daily reading and reflection
- Supporting personal inventory and growth
- Maintaining focus on recovery principles

## 📄 License

MIT License - Feel free to use, modify, and share this app to help others in their recovery journey.

## 💝 Contributing

This app was built with love for the Al-Anon community. If you'd like to contribute improvements or additional features, please feel free to submit pull requests or open issues.

---

*"Just for today, I will try to live through this day only, and not tackle my whole life problem at once."*

Remember: This app is a tool to support your recovery journey, but it's not a replacement for meetings, sponsors, or professional help. Please continue to engage with your Al-Anon community and seek appropriate support when needed.