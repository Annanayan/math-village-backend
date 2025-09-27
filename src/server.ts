import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import OpenAI from 'openai';
import { InputMessage } from "openai/resources/beta/responses";
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from root and local .env files
config({ path: '../../.env' }); // Root .env file
config(); // Local .env file (overrides root if present)

const TEACHER_KEY = process.env.TEACHER_KEY || 'teacher-secret-key-2024';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

console.log('[BOOT]', {
  file: import.meta.url,
  cwd: process.cwd(),
  started: new Date().toISOString()
});

const app = express();
const PORT = process.env.PORT || 3000;

// Configure OpenAI (optional)
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI API configured');
} else {
  console.log('⚠️  OpenAI API key not provided - AI features will be disabled');
}

// Database setup
const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'app.db');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Types
interface User {
  id: number;
  username: string;
  password: string;
  created_at: string;
  last_login?: string;
  login_count: number;
  total_time_spent: number;
  last_activity?: string;
}

interface AuthRequest extends express.Request {
  user?: {
    userId: number;
    username: string;
  };
}

// Initialize database tables
function initializeDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      login_count INTEGER DEFAULT 0,
      total_time_spent INTEGER DEFAULT 0,
      last_activity DATETIME
    )
  `);

  // Create user activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      activity_type TEXT NOT NULL,
      activity_detail TEXT,
      page_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create learning progress table
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      subject TEXT,
      topic TEXT,
      problems_attempted INTEGER DEFAULT 0,
      problems_solved INTEGER DEFAULT 0,
      accuracy REAL DEFAULT 0,
      last_studied DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      UNIQUE(user_id, subject, topic)
    )
  `);

  // Create daily logins table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      login_date DATE,
      login_count INTEGER DEFAULT 1,
      time_spent INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id),
      UNIQUE(user_id, login_date)
    )
  `);

  // Create click heatmap table
  db.exec(`
    CREATE TABLE IF NOT EXISTS click_heatmap (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      page_name TEXT,
      element_id TEXT,
      element_type TEXT,
      click_count INTEGER DEFAULT 1,
      last_clicked DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      UNIQUE(user_id, page_name, element_id)
    )
  `);

  // Create AI conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      question TEXT,
      answer TEXT,
      topic_category TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      helpful_rating INTEGER,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  console.log('✅ Database tables initialized');
}

initializeDatabase();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Allow all localhost origins for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // Check environment variable for specific origins
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// JWT authentication middleware
const authenticateToken = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ========== Authentication Endpoints ==========

// Register endpoint
app.post('/auth/register', async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required'
      });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        error: 'Username must be 3-20 characters long'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT username FROM users WHERE LOWER(username) = LOWER(?)').get(username);

    if (existingUser) {
      return res.status(400).json({
        error: 'Username already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (username, password, login_count, last_login, last_activity)
      VALUES (?, ?, 1, ?, ?)
    `);

    const result = insertUser.run(username, hashedPassword, now, now);
    const userId = result.lastInsertRowid as number;

    // Record first login
    const today = new Date().toISOString().split('T')[0];
    const insertLogin = db.prepare(`
      INSERT OR REPLACE INTO daily_logins (user_id, login_date, login_count)
      VALUES (?, ?, 1)
    `);
    insertLogin.run(userId, today);

    // Record registration activity
    const insertActivity = db.prepare(`
      INSERT INTO user_activities (user_id, activity_type, activity_detail)
      VALUES (?, ?, ?)
    `);
    insertActivity.run(userId, 'REGISTRATION', 'New user registered');

    const token = jwt.sign(
      { userId: userId, username: username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`New user registered: ${username}`);

    res.json({
      success: true,
      message: 'Registration successful',
      token: token,
      userId: userId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed. Please try again.'
    });
  }
});

// Login endpoint
app.post('/auth/login', async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required'
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username) as User;

    if (!user) {
      return res.status(401).json({
        error: 'Invalid username or password'
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid username or password'
      });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Update user login info
    const updateUser = db.prepare(`
      UPDATE users
      SET last_login = ?, login_count = login_count + 1, last_activity = ?
      WHERE id = ?
    `);
    updateUser.run(now, now, user.id);

    // Update daily login record
    const updateLogin = db.prepare(`
      INSERT INTO daily_logins (user_id, login_date, login_count, time_spent)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(user_id, login_date)
      DO UPDATE SET login_count = login_count + 1
    `);
    updateLogin.run(user.id, today);

    // Record login activity
    const insertActivity = db.prepare(`
      INSERT INTO user_activities (user_id, activity_type, activity_detail)
      VALUES (?, ?, ?)
    `);
    insertActivity.run(user.id, 'LOGIN', 'User logged in');

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`User logged in: ${username}`);

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      userId: user.id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed. Please try again.'
    });
  }
});

// Get current user
app.get('/auth/me', authenticateToken, (req: AuthRequest, res: express.Response) => {
  try {
    const user = db.prepare('SELECT id, username, created_at, last_login, login_count FROM users WHERE id = ?')
      .get(req.user!.userId) as Omit<User, 'password'>;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ========== Activity Tracking Endpoints ==========

// Track page view
app.post('/track/page-view', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const { pageName, duration = 0 } = req.body;
  const userId = req.user!.userId;

  try {
    const insertActivity = db.prepare(`
      INSERT INTO user_activities (user_id, activity_type, page_name, duration, activity_detail)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertActivity.run(userId, 'PAGE_VIEW', pageName, duration, `Viewed ${pageName}`);

    // Update user last activity
    const updateUser = db.prepare('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?');
    updateUser.run(userId);

    // Update today's time spent
    if (duration > 0) {
      const today = new Date().toISOString().split('T')[0];
      const updateTime = db.prepare(`
        UPDATE daily_logins
        SET time_spent = time_spent + ?
        WHERE user_id = ? AND login_date = ?
      `);
      updateTime.run(duration, userId, today);

      const updateTotalTime = db.prepare('UPDATE users SET total_time_spent = total_time_spent + ? WHERE id = ?');
      updateTotalTime.run(duration, userId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Track page view error:', error);
    res.status(500).json({ error: 'Failed to track page view' });
  }
});

// Track click event
app.post('/track/click', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const { elementId, elementType, pageName } = req.body;
  const userId = req.user!.userId;

  try {
    // Record click activity
    const insertActivity = db.prepare(`
      INSERT INTO user_activities (user_id, activity_type, page_name, activity_detail)
      VALUES (?, ?, ?, ?)
    `);
    insertActivity.run(userId, 'CLICK', pageName, `Clicked ${elementType}: ${elementId}`);

    // Update click heatmap
    const insertHeatmap = db.prepare(`
      INSERT INTO click_heatmap (user_id, page_name, element_id, element_type, click_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, page_name, element_id)
      DO UPDATE SET
        click_count = click_count + 1,
        last_clicked = CURRENT_TIMESTAMP
    `);
    insertHeatmap.run(userId, pageName, elementId, elementType);

    res.json({ success: true });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// Track learning progress
app.post('/track/learning', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const { subject, topic, attempted, solved } = req.body;
  const userId = req.user!.userId;

  try {
    const accuracy = attempted > 0 ? (solved / attempted * 100) : 0;

    const insertProgress = db.prepare(`
      INSERT INTO learning_progress (user_id, subject, topic, problems_attempted, problems_solved, accuracy)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, subject, topic)
      DO UPDATE SET
        problems_attempted = problems_attempted + ?,
        problems_solved = problems_solved + ?,
        accuracy = ((problems_solved + ?) * 100.0 / (problems_attempted + ?)),
        last_studied = CURRENT_TIMESTAMP
    `);
    insertProgress.run(userId, subject, topic, attempted, solved, accuracy, attempted, solved, solved, attempted);

    // Record learning activity
    const insertActivity = db.prepare(`
      INSERT INTO user_activities (user_id, activity_type, activity_detail)
      VALUES (?, ?, ?)
    `);
    insertActivity.run(userId, 'LEARNING', `${subject} - ${topic}: ${solved}/${attempted} solved`);

    res.json({ success: true });
  } catch (error) {
    console.error('Track learning error:', error);
    res.status(500).json({ error: 'Failed to track learning progress' });
  }
});

// ========== AI Chat Endpoint ==========

function categorizeQuestion(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('algebra') || q.includes('equation') || q.includes('variable')) return 'Algebra';
  if (q.includes('geometry') || q.includes('angle') || q.includes('triangle')) return 'Geometry';
  if (q.includes('calculus') || q.includes('derivative') || q.includes('integral')) return 'Calculus';
  if (q.includes('probability') || q.includes('statistics') || q.includes('mean')) return 'Statistics';
  if (q.includes('fraction') || q.includes('decimal') || q.includes('percent')) return 'Arithmetic';
  return 'General Math';
}

// ========== Enhanced Chat Endpoint (with OpenAI Responses API) ==========
app.post('/ai/chat', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  try {
    console.log('Chat request received:', new Date().toLocaleString());
    const userId = req.user!.userId;
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Invalid request format. Messages array is required.'
      });
    }

    // Check if OpenAI is available
    if (!openai) {
      return res.status(503).json({
        content: "Sorry, AI assistance is currently unavailable. Please contact your administrator to configure the OpenAI API key.",
        error: true
      });
    }

    // Get user question (last user message)
    const userQuestion = messages[messages.length - 1]?.content || '';

    // Analyze question category
    const topicCategory = categorizeQuestion(userQuestion);

    // Try to use Responses API if available, fallback to Chat Completions
    let content = "";

    try {
      // ✅ Use OpenAI Responses API (supports gpt-5)
      console.log('[AI] Using Responses API @ gpt-5');

      const completion = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5",
        const input: InputMessage[] = [
          {
            role: "system",
            content:[
              {
                type: "text",
                text: `You are an expert K12 Mathematics tutor. Your role is to:
                        1. Give clear step-by-step explanations that are mathematically correct
                        2. Use simple real-world examples when helpful
                        3. Use LaTeX formatting for math: inline $x^2$ or block $$x^2$$
                        4. Be encouraging and friendly
                        5. Gently correct mistakes with proper reasoning
                        6. ALWAYS perform actual verification by substituting values back into the original equation and show the calculations

                        IMPORTANT formatting rules:
                        - Write step titles as: **Step 1: Description** (no extra formatting)
                        - Use normal paragraph flow without excessive line breaks
                        - Put math expressions inline with text when possible
                        - Only use block math ($$...$$) for complex multi-line equations
                        - Do NOT use markdown headers (###) or horizontal rules (---)
                        - Do NOT use bullet points (- or *) for listing items in steps
                        - Keep formatting simple and readable
                        - In the verification step, you MUST substitute the solution back and show the actual calculation` 
              }
            ]
            
          },
          ...messages.map(m => ({
            role: m.role,
            content: [{ type: "input_text", text: m.content }]
          }))
        ];

        // Fallback to Chat Completions API
        const completion = await openai.responses.create({
          model: process.env.OPENAI_MODEL || "gpt-5",
          input,
          max_tokens: 1500,
        });
  
        const content = completion.output_text || "";
    }
  

    // Record AI conversation
    const insertConversation = db.prepare(`
      INSERT INTO ai_conversations (user_id, question, answer, topic_category)
      VALUES (?, ?, ?, ?)
    `);
    insertConversation.run(userId, userQuestion, content, topicCategory);

    // Record AI usage activity
    const insertActivity = db.prepare(`
      INSERT INTO user_activities (user_id, activity_type, page_name, activity_detail)
      VALUES (?, ?, ?, ?)
    `);
    insertActivity.run(userId, 'AI_CHAT', 'AI Assistant', `Asked about ${topicCategory}`);

    console.log('Successfully generated AI response');
    res.json({
      content: content,
      success: true
    });

  } catch (error: any) {
    console.error('AI Chat error:', error);

    if (error.code === 'insufficient_quota') {
      res.status(402).json({
        content: "Sorry, the API quota has been exceeded. Please check your OpenAI account.",
        error: true
      });
    } else if (error.code === 'invalid_api_key') {
      res.status(401).json({
        content: "API key configuration error. Please check the server setup.",
        error: true
      });
    } else {
      res.status(500).json({
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        error: true
      });
    }
  }
});

// ========== User Stats & Reports ==========

app.get('/user/stats', authenticateToken, (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user!.userId;

    // Get basic user info
    const basicInfo = db.prepare(`
      SELECT username, created_at, last_login, login_count, total_time_spent
      FROM users WHERE id = ?
    `).get(userId);

    // Get recent logins (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentLogins = db.prepare(`
      SELECT login_date, login_count, time_spent
      FROM daily_logins
      WHERE user_id = ? AND login_date >= ?
      ORDER BY login_date DESC
    `).all(userId, sevenDaysAgo.toISOString().split('T')[0]);

    // Get learning progress
    const learningProgress = db.prepare(`
      SELECT subject, topic, problems_attempted, problems_solved, accuracy, last_studied
      FROM learning_progress
      WHERE user_id = ?
      ORDER BY last_studied DESC
      LIMIT 10
    `).all(userId);

    // Get top pages
    const topPages = db.prepare(`
      SELECT page_name, COUNT(*) as visit_count
      FROM user_activities
      WHERE user_id = ? AND activity_type = 'PAGE_VIEW'
      GROUP BY page_name
      ORDER BY visit_count DESC
      LIMIT 5
    `).all(userId);

    // Get AI usage stats
    const aiUsage = db.prepare(`
      SELECT COUNT(*) as total_questions,
             COUNT(DISTINCT topic_category) as topics_covered
      FROM ai_conversations
      WHERE user_id = ?
    `).get(userId);

    // Get click patterns
    const clickPatterns = db.prepare(`
      SELECT page_name, element_type, SUM(click_count) as total_clicks
      FROM click_heatmap
      WHERE user_id = ?
      GROUP BY page_name, element_type
      ORDER BY total_clicks DESC
      LIMIT 10
    `).all(userId);

    res.json({
      basicInfo,
      recentLogins,
      learningProgress,
      topPages,
      aiUsage,
      clickPatterns
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

app.get('/user/learning-report', authenticateToken, (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user!.userId;

    // Get summary stats
    const summary = db.prepare(`
      SELECT
        SUM(problems_attempted) as total_attempted,
        SUM(problems_solved) as total_solved,
        AVG(accuracy) as average_accuracy,
        COUNT(DISTINCT subject) as subjects_studied,
        COUNT(DISTINCT topic) as topics_covered
      FROM learning_progress
      WHERE user_id = ?
    `).get(userId);

    // Get details by subject
    const bySubject = db.prepare(`
      SELECT
        subject,
        SUM(problems_attempted) as attempted,
        SUM(problems_solved) as solved,
        AVG(accuracy) as accuracy,
        MAX(last_studied) as last_studied
      FROM learning_progress
      WHERE user_id = ?
      GROUP BY subject
      ORDER BY accuracy DESC
    `).all(userId);

    // Get activity trend (last 30 days)
    const activityTrend = db.prepare(`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as activities,
        SUM(CASE WHEN activity_type = 'LEARNING' THEN 1 ELSE 0 END) as learning_activities
      FROM user_activities
      WHERE user_id = ? AND timestamp >= date('now', '-30 days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `).all(userId);

    // Generate recommendations
    const recommendations = [];
    if (summary && summary.average_accuracy < 60) {
      recommendations.push("Consider reviewing basic concepts before attempting harder problems");
    }
    if (bySubject.length > 0) {
      const weakestSubject = bySubject[bySubject.length - 1];
      if (weakestSubject.accuracy < 50) {
        recommendations.push(`Focus more on ${weakestSubject.subject} to improve your overall performance`);
      }
    }
    recommendations.push("Keep up the great work! Consistency is key to mastering mathematics.");

    res.json({
      summary,
      details: {
        bySubject,
        activityTrend
      },
      recommendations
    });
  } catch (error) {
    console.error('Get learning report error:', error);
    res.status(500).json({ error: 'Failed to generate learning report' });
  }
});

// ========== Teacher Dashboard API ==========

app.get('/teacher/students', (req: express.Request, res: express.Response) => {
  const teacherKey = req.headers['x-teacher-key'];
  if (teacherKey !== TEACHER_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const students = db.prepare(`
      SELECT
        id, username, created_at, last_login, login_count,
        total_time_spent, last_activity
      FROM users
      ORDER BY last_activity DESC
    `).all();

    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/teacher/student/:userId', (req: express.Request, res: express.Response) => {
  const teacherKey = req.headers['x-teacher-key'];
  if (teacherKey !== TEACHER_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = req.params.userId;

    // Get basic info
    const basicInfo = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!basicInfo) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get daily activities (last 30 days)
    const dailyActivities = db.prepare(`
      SELECT DATE(timestamp) as date, COUNT(*) as activities,
             SUM(duration) as total_duration
      FROM user_activities
      WHERE user_id = ? AND timestamp >= date('now', '-30 days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `).all(userId);

    // Get learning progress
    const learningProgress = db.prepare(`
      SELECT * FROM learning_progress
      WHERE user_id = ?
      ORDER BY last_studied DESC
    `).all(userId);

    // Get AI usage by topic
    const aiUsageByTopic = db.prepare(`
      SELECT topic_category, COUNT(*) as count,
             AVG(CASE WHEN helpful_rating IS NOT NULL THEN helpful_rating ELSE 3 END) as avg_rating
      FROM ai_conversations
      WHERE user_id = ?
      GROUP BY topic_category
    `).all(userId);

    // Get page engagement
    const pageEngagement = db.prepare(`
      SELECT page_name, COUNT(*) as visits, SUM(duration) as total_time
      FROM user_activities
      WHERE user_id = ? AND activity_type = 'PAGE_VIEW'
      GROUP BY page_name
      ORDER BY total_time DESC
    `).all(userId);

    res.json({
      basicInfo,
      dailyActivities,
      learningProgress,
      aiUsageByTopic,
      pageEngagement
    });
  } catch (error) {
    console.error('Get student details error:', error);
    res.status(500).json({ error: 'Failed to get student details' });
  }
});

app.get('/teacher/class-stats', (req: express.Request, res: express.Response) => {
  const teacherKey = req.headers['x-teacher-key'];
  if (teacherKey !== TEACHER_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get overview stats
    const overview = db.prepare(`
      SELECT
        COUNT(DISTINCT id) as total_students,
        COUNT(DISTINCT CASE WHEN last_activity >= datetime('now', '-1 day') THEN id END) as active_today,
        COUNT(DISTINCT CASE WHEN last_activity >= datetime('now', '-7 days') THEN id END) as active_week,
        AVG(total_time_spent) as avg_time_spent
      FROM users
    `).get();

    // Get popular pages
    const popularPages = db.prepare(`
      SELECT page_name, COUNT(*) as total_visits, COUNT(DISTINCT user_id) as unique_users
      FROM user_activities
      WHERE activity_type = 'PAGE_VIEW'
      GROUP BY page_name
      ORDER BY total_visits DESC
      LIMIT 5
    `).all();

    // Get difficult topics
    const difficultTopics = db.prepare(`
      SELECT subject, topic, AVG(accuracy) as avg_accuracy, COUNT(DISTINCT user_id) as student_count
      FROM learning_progress
      GROUP BY subject, topic
      HAVING avg_accuracy < 70
      ORDER BY avg_accuracy ASC
      LIMIT 10
    `).all();

    // Get weekly AI usage
    const aiUsageWeekly = db.prepare(`
      SELECT
        COUNT(*) as total_questions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT topic_category) as topics_covered
      FROM ai_conversations
      WHERE timestamp >= datetime('now', '-7 days')
    `).get();

    res.json({
      overview,
      popularPages,
      difficultTopics,
      aiUsageWeekly
    });
  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({ error: 'Failed to get class stats' });
  }
});

// ========== Health Check ==========

app.get('/healthz', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'OK',
    message: 'Math Village API is running!',
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  });
});

app.get('/', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'OK',
    message: 'Math Village API is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['/auth/register', '/auth/login', '/auth/me'],
      tracking: ['/track/page-view', '/track/click', '/track/learning'],
      ai: ['/ai/chat'],
      user: ['/user/stats', '/user/learning-report'],
      teacher: ['/teacher/students', '/teacher/student/:id', '/teacher/class-stats']
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✅ Math Village API v3 started!`);
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/healthz`);
  console.log(`📍 Database: ${dbPath}`);
  console.log('========================================');
  console.log('Press Ctrl+C to stop server');

  if (!process.env.OPENAI_API_KEY) {
    console.log('\n⚠️  Warning: OPENAI_API_KEY not detected!');
    console.log('Please set your OpenAI API Key in .env file');
  } else {
    console.log('\n✅ OpenAI API Key configured');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close();
  process.exit(0);
});
