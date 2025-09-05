# Task Sync API

## Overview

Backend API for a task management application with offline support and synchronization capabilities. Uses SQLite for local storage and implements a "last-write-wins" conflict resolution strategy.

## AI Usage Declaration

In accordance with the AI usage guidelines, I declare the following use of AI tools in this project:

### AI Tools Used
- GitHub Copilot: Used for code suggestions and auto-completion

### Usage Details
1. Concept Understanding:
   - Used AI to understand sync queue implementation patterns
   - Researched best practices for conflict resolution
   - Explored offline-first architecture concepts

2. Code Development:
   - Validated TypeScript types
   - Debugged error handling edge cases

3. AI Was NOT Used For:
   - Core business logic implementation
   - Critical sync algorithm design
   - Final code architecture decisions

All AI-generated code was thoroughly reviewed, tested, and modified to match project requirements. The final implementation represents my understanding and problem-solving approach.

## Implementation Approach

### Sync Strategy
1. Every offline operation is queued with a timestamp
2. Queue is processed in FIFO order during sync
3. Conflicts are resolved using last-write-wins based on timestamps
4. Failed operations are retried with exponential backoff
5. Batch processing for efficiency (configurable batch size)

### Data Integrity
- All operations are atomic
- Transaction rollback on partial batch failures
- Comprehensive error logging

## API Endpoints

### Task Management
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get a task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Sync Operations
- `POST /api/sync` - Trigger sync
- `GET /api/status` - Check sync status
- `GET /api/health` - Health check

## Assumptions Made

1. Network State:
   - No need for real-time sync notifications
   - Periodic sync checks are sufficient
   - Network state can be determined reliably

2. Data Volume:
   - Moderate task count per user
   - Sync queue won't grow unbounded
   - Batch size of 50 is optimal for most cases

3. Conflict Resolution:
   - No need for manual conflict resolution
   - Server timestamp is source of truth

## Tools & Resources Used

1. Development:
   - TypeScript for type safety
   - Express.js for API framework
   - SQLite for local storage
   - UUID for unique identifiers

2. Testing:
   - Vitest for unit/integration tests
   - In-memory SQLite for test database
   - Axios for HTTP requests

## Challenges & Solutions

1. Race Conditions:
   - Challenge: Concurrent updates to same task
   - Solution: Atomic operations with proper locking

2. Partial Sync Failures:
   - Challenge: Handling failed items in batch
   - Solution: Transaction rollback and item-level retry

3. Network State:
   - Challenge: Reliable online/offline detection
   - Solution: Health check endpoint with timeout

## Trade-offs Considered

1. Storage:
   - SQLite vs IndexedDB
   - Chose SQLite for simplicity and reliability

2. Sync Strategy:
   - Real-time vs Periodic
   - Chose periodic for simplicity and battery efficiency

3. Conflict Resolution:
   - Last-write-wins vs Three-way merge
   - Chose last-write-wins for simplicity and user expectation

4. Batch Processing:
   - Size vs Memory usage
   - Configurable batch size for flexibility

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup environment:
   ```bash
   cp .env.example .env
   ```

3. Run application:
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Features Implemented

- Task CRUD operations with offline support
- Automatic sync when online
- Last-write-wins conflict resolution
- Request validation
- Exponential backoff for retries
- Error handling and logging

## Testing

Run tests with:
```bash
npm test
```

This is a backend developer interview challenge focused on building a sync-enabled task management API. The challenge evaluates understanding of REST APIs, data synchronization, offline-first architecture, and conflict resolution.

## 📚 Documentation Overview

Please read these documents in order:

1. **[📋 Submission Instructions](./docs/SUBMISSION_INSTRUCTIONS.md)** - How to submit your solution (MUST READ)
2. **[📝 Requirements](./docs/REQUIREMENTS.md)** - Detailed challenge requirements and implementation tasks
3. **[🔌 API Specification](./docs/API_SPEC.md)** - Complete API documentation with examples
4. **[🤖 AI Usage Guidelines](./docs/AI_GUIDELINES.md)** - Guidelines for using AI tools during the challenge

**⚠️ Important**: DO NOT create pull requests against this repository. All submissions must be through private forks.

## Challenge Overview

Candidates are expected to implement a backend API that:
- Manages tasks (CRUD operations)
- Supports offline functionality with a sync queue
- Handles conflict resolution when syncing
- Provides robust error handling

## Project Structure

```
backend-interview-challenge/
├── src/
│   ├── db/             # Database setup and configuration
│   ├── models/         # Data models (if needed)
│   ├── services/       # Business logic (TO BE IMPLEMENTED)
│   ├── routes/         # API endpoints (TO BE IMPLEMENTED)
│   ├── middleware/     # Express middleware
│   ├── types/          # TypeScript interfaces
│   └── server.ts       # Express server setup
├── tests/              # Test files
├── docs/               # Documentation
└── package.json        # Dependencies and scripts
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run lint` - Run ESLint
- `npm run typecheck` - Check TypeScript types

## Your Task

### Key Implementation Files

You'll need to implement the following services and routes:

- `src/services/taskService.ts` - Task CRUD operations
- `src/services/syncService.ts` - Sync logic and conflict resolution  
- `src/routes/tasks.ts` - REST API endpoints
- `src/routes/sync.ts` - Sync-related endpoints

### Before Submission

Ensure all of these pass:
```bash
npm test          # All tests must pass
npm run lint      # No linting errors
npm run typecheck # No TypeScript errors
```

### Time Expectation

This challenge is designed to take 2-3 hours to complete.

## License

This project is for interview purposes only.