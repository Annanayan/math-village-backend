# Math Village - Backend API

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.1.0-lightgrey.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-blue.svg)](https://www.sqlite.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-5.22.0-brightgreen.svg)](https://platform.openai.com/)

A RESTful API backend powering the Math Village intelligent learning platform. Built with Express.js and TypeScript, featuring AI-powered tutoring, comprehensive analytics tracking, and secure authentication.

## Overview

Math Village Backend is a full-featured API service that provides:

- **AI-Powered Math Tutoring**: Integration with OpenAI GPT-4 for intelligent, step-by-step math problem solving
- **User Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **Learning Analytics**: Comprehensive tracking of student progress, engagement patterns, and performance metrics
- **Teacher Dashboard API**: Detailed student analytics and class-wide insights for educators
- **Real-time Activity Tracking**: Page views, click patterns, and learning progress monitoring


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

## License

This project is private and proprietary.

---

**Built with care for Math Village students and teachers** | Powered by OpenAI GPT-4

