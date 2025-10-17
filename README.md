# Math Village - Backend API

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.1.0-lightgrey.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-blue.svg)](https://www.sqlite.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-5.22.0-brightgreen.svg)](https://platform.openai.com/)

A robust RESTful API backend powering the Math Village intelligent learning platform. Built with Express.js and TypeScript, featuring AI-powered tutoring, comprehensive analytics tracking, and secure authentication.

## Overview

Math Village Backend is a full-featured API service that provides:

- **AI-Powered Math Tutoring**: Integration with OpenAI GPT-4 for intelligent, step-by-step math problem solving
- **User Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **Learning Analytics**: Comprehensive tracking of student progress, engagement patterns, and performance metrics
- **Teacher Dashboard API**: Detailed student analytics and class-wide insights for educators
- **Real-time Activity Tracking**: Page views, click patterns, and learning progress monitoring

## Key Features

### Authentication & Security
- JWT-based token authentication with 7-day expiry
- Bcrypt password hashing (10 rounds)
- CORS configuration for cross-origin requests
- Secure environment variable management

### AI Assistant
- OpenAI GPT-4 integration for math tutoring
- Automatic question categorization (Algebra, Geometry, Calculus, Statistics, etc.)
- Formatted responses with LaTeX mathematical notation
- Conversation history tracking with topic analysis

### Analytics & Tracking
- **User Activity Tracking**: Page views, clicks, session duration
- **Learning Progress**: Problem attempts, accuracy rates, topic mastery
- **Engagement Metrics**: Daily login patterns, time spent, interaction heatmaps
- **AI Usage Statistics**: Question topics, response ratings, usage patterns

### Teacher Features
- Class-wide performance overview
- Individual student detailed reports
- Difficult topics identification
- Weekly active user metrics
- Popular page analytics

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 20.x | Runtime environment |
| **TypeScript** | 5.4.5 | Type-safe development |
| **Express.js** | 5.1.0 | Web framework |
| **SQLite** | 3.x (better-sqlite3) | Embedded database |
| **OpenAI API** | 5.22.0 | AI tutoring service |
| **JWT** | 9.0.2 | Authentication tokens |
| **bcryptjs** | 3.0.2 | Password encryption |
| **CORS** | 2.8.5 | Cross-origin resource sharing |

## Project Structure

```
math-village-backend/
├── src/
│   └── server.ts          # Main application entry point
├── data/
│   └── app.db            # SQLite database (auto-generated)
├── dist/                 # Compiled JavaScript output
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env                  # Environment variables (not in git)
└── README.md            # This file
```

## Database Schema

The application uses SQLite with the following tables:

### Users
Stores user account information and activity metrics
- `id`, `username`, `password` (hashed)
- `created_at`, `last_login`, `login_count`
- `total_time_spent`, `last_activity`

### User Activities
Tracks all user interactions
- `user_id`, `activity_type`, `page_name`
- `activity_detail`, `duration`, `timestamp`

### Learning Progress
Records subject-specific performance
- `user_id`, `subject`, `topic`
- `problems_attempted`, `problems_solved`, `accuracy`
- `last_studied`

### Daily Logins
Aggregates daily user engagement
- `user_id`, `login_date`, `login_count`, `time_spent`

### Click Heatmap
Captures interaction patterns
- `user_id`, `page_name`, `element_id`, `element_type`
- `click_count`, `last_clicked`

### AI Conversations
Stores AI chat history
- `user_id`, `question`, `answer`
- `topic_category`, `helpful_rating`, `timestamp`

## API Endpoints

### Authentication
```
POST   /auth/register      # Create new user account
POST   /auth/login         # User login
GET    /auth/me            # Get current user info (protected)
```

### Activity Tracking
```
POST   /track/page-view    # Track page navigation (protected)
POST   /track/click        # Track user clicks (protected)
POST   /track/learning     # Record learning progress (protected)
```

### AI Assistant
```
POST   /ai/chat            # Get AI tutoring response (protected)
```

### User Reports
```
GET    /user/stats         # Get user statistics (protected)
GET    /user/learning-report # Get detailed learning report (protected)
```

### Teacher Dashboard
```
GET    /teacher/students         # List all students (teacher key required)
GET    /teacher/student/:userId  # Get student details (teacher key required)
GET    /teacher/class-stats      # Get class-wide analytics (teacher key required)
```

### Health Check
```
GET    /                   # API information
GET    /healthz            # Health check endpoint
```

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm or yarn package manager
- OpenAI API key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd math-village-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000

   # Security Keys
   JWT_SECRET=your-secret-key-change-this-in-production
   TEACHER_KEY=teacher-secret-key-2024

   # OpenAI Configuration
   OPENAI_API_KEY=your-openai-api-key-here
   OPENAI_MODEL=gpt-4

   # Database
   SQLITE_PATH=./data/app.db

   # CORS (for production)
   CORS_ORIGIN=https://your-frontend-domain.com,https://your-teacher-portal.com
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`

### Production Build

```bash
# Compile TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload (nodemon + ts-node)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled production server
- `npm run type-check` - Check TypeScript types without compiling
- `npm run lint` - Run ESLint on source files
- `npm run clean` - Remove compiled files

### API Testing

Test the API with curl or Postman:

```bash
# Health check
curl http://localhost:3000/healthz

# Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "password123"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "password123"}'
```

## Deployment

### Deploy to Render

1. **Create a new Web Service** on [Render](https://render.com)
2. **Connect your GitHub repository**
3. **Configure settings:**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node

4. **Set environment variables** in Render dashboard:
   - `OPENAI_API_KEY`
   - `JWT_SECRET`
   - `TEACHER_KEY`
   - `CORS_ORIGIN`
   - `PORT` (auto-configured by Render)

5. **Deploy** - Render will automatically build and deploy your app

### Other Deployment Options

The application can be deployed to any Node.js hosting platform:
- **Railway**: Similar to Render, auto-deploy from GitHub
- **Fly.io**: Supports SQLite with persistent volumes
- **Heroku**: Requires PostgreSQL addon instead of SQLite
- **DigitalOcean App Platform**: Node.js runtime support
- **AWS Elastic Beanstalk**: Full control over infrastructure

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port number |
| `JWT_SECRET` | Yes | - | Secret key for JWT signing |
| `TEACHER_KEY` | Yes | - | Authentication key for teacher endpoints |
| `OPENAI_API_KEY` | No* | - | OpenAI API key (* required for AI features) |
| `OPENAI_MODEL` | No | gpt-4 | OpenAI model to use |
| `SQLITE_PATH` | No | ./data/app.db | Path to SQLite database file |
| `CORS_ORIGIN` | No | - | Comma-separated list of allowed origins |

## Architecture Highlights

### Authentication Flow
1. User registers/logs in with username and password
2. Server validates credentials and generates JWT token
3. Client stores token and includes it in `Authorization: Bearer <token>` header
4. Server validates token on protected endpoints

### AI Chat Flow
1. Client sends conversation messages array
2. Server categorizes question topic
3. OpenAI GPT-4 generates formatted response with LaTeX
4. Response and metadata saved to database
5. Analytics updated with AI usage data

### Analytics Pipeline
1. Client triggers tracking events (page view, click, learning progress)
2. Server records event in appropriate database table
3. Aggregated data available via stats and report endpoints
4. Teacher dashboard queries aggregate all student data

## Performance Considerations

- **SQLite** is embedded and serverless - perfect for small to medium deployments
- **Synchronous queries** using better-sqlite3 for optimal performance
- **Database indexes** on foreign keys and frequently queried columns
- **Prepared statements** prevent SQL injection and improve query speed
- **In-memory JWT verification** avoids database lookups per request

## Security Best Practices

- Always use strong `JWT_SECRET` and `TEACHER_KEY` in production
- Never commit `.env` file to version control
- Passwords are hashed with bcrypt before storage
- CORS configured to whitelist specific origins
- SQL injection prevented via prepared statements
- Rate limiting should be added for production use

## Troubleshooting

### Common Issues

**OpenAI API errors:**
- Verify `OPENAI_API_KEY` is set correctly
- Check API quota and billing status
- Confirm model name is valid (e.g., `gpt-4`, `gpt-3.5-turbo`)

**Database locked errors:**
- SQLite locks during writes - reduce concurrent write operations
- Consider PostgreSQL for high-concurrency production deployments

**CORS errors:**
- Add frontend domain to `CORS_ORIGIN` environment variable
- Ensure protocol (http/https) matches exactly

**Authentication failures:**
- Verify JWT token is not expired (7-day expiry)
- Check `JWT_SECRET` matches between environments

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Contact & Support

For questions, issues, or feature requests, please contact me or create an issue in the repository.

---

**Built with care for Math Village students and teachers** | Powered by OpenAI GPT-4

**Built with care for Math Village students and teachers** | Powered by OpenAI GPT-4
