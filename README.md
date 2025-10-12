# 🚀 Real-time Chat API - Express.js + TypeScript + WebSocket

Modern chat application backend with REST API and real-time WebSocket communication.

## ✨ Features

- **Express.js** - Web framework for Node.js
- **TypeScript** - Static typing for JavaScript
- **Socket.IO** - Real-time bidirectional communication
- **Prisma** - Modern ORM for PostgreSQL
- **JWT Authentication** - Secure token-based authentication
- **Hybrid Architecture** - REST API for operations, WebSocket for real-time updates
- **CORS** - Cross-Origin Resource Sharing
- **Docker** - Containerized development environment
- **Nodemon** - Automatic server restart during development

## 🛠️ Configuration and Setup

### Requirements

- Node.js (v18 or newer)
- npm or pnpm
- PostgreSQL database
- Docker (optional, for containerized development)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chatdb?schema=public"

# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# JWT
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
```

### Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Or push schema to database (development)
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Running in development mode

```bash
npm run dev
```

### Building the project

```bash
npm run build
```

### Running in production mode

```bash
npm run build
npm start
```

### Docker

```bash
# Start all services (database + backend)
npm run docker:up

# Stop services
npm run docker:down

# Clean up (removes volumes)
npm run docker:clean
```

## 📡 API Endpoints

### HTTP REST API

#### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user data

#### Users

- `GET /api/users` - Get all users (paginated)
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/password` - Update user password
- `GET /api/users/:id/status` - Get user online status

#### Friends

- `GET /api/friends` - Get all friends
- `GET /api/friends/invites` - Get friend invites
- `POST /api/friends/invite` - Send friend invite
- `POST /api/friends/accept/:id` - Accept friend invite
- `POST /api/friends/reject/:id` - Reject friend invite
- `DELETE /api/friends/:id` - Remove friend

#### Chats

- `GET /api/chats` - Get all user's chats
- `GET /api/chats/:id` - Get chat details
- `POST /api/chats` - Create new chat (1-on-1 or group)
- `PUT /api/chats/:id` - Update chat
- `DELETE /api/chats/:id` - Delete chat
- `POST /api/chats/:id/members` - Add members to chat
- `DELETE /api/chats/:id/members` - Remove members from chat
- `PUT /api/chats/:id/members/:userId/role` - Update member role

#### Messages

- `GET /api/messages/:chatId` - Get messages (paginated)
- `POST /api/messages/:chatId` - Send message
- `PUT /api/messages/:messageId` - Edit message
- `DELETE /api/messages/:messageId` - Delete message
- `GET /api/messages/:messageId/replies` - Get message replies
- `POST /api/messages/:messageId/reactions` - Add reaction
- `DELETE /api/messages/:messageId/reactions/:emoji` - Remove reaction
- `POST /api/messages/:messageId/read` - Mark as read
- `GET /api/messages/:messageId/readers` - Get message readers

### WebSocket Events

**📚 Szczegółowa dokumentacja:** [WEBSOCKET_DOCUMENTATION.md](./WEBSOCKET_DOCUMENTATION.md)

#### Client → Server

- `typing:start` - User starts typing
- `typing:stop` - User stops typing
- `chat:join` - Manually join chat room

#### Server → Client

**Messages:**

- `message:new` - New message received
- `message:updated` - Message edited
- `message:deleted` - Message deleted

**Reactions:**

- `reaction:added` - Reaction added to message
- `reaction:removed` - Reaction removed from message

**Read Status:**

- `message:read` - Message marked as read

**Typing Indicators:**

- `typing:start` - User is typing
- `typing:stop` - User stopped typing

**User Status:**

- `user:status` - User online/offline status changed

**Chat Management:**

- `chat:created` - New chat created
- `chat:updated` - Chat updated
- `member:added` - Member added to chat
- `member:removed` - Member removed from chat

## 🧪 Testing

### REST API

You can use tools like Postman, Insomnia, or curl to test the REST API endpoints.

Example with curl:

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"password123"}'

# Get current user (with cookies)
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt
```

### WebSocket Client

**Vue 3 Example:**

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
	withCredentials: true, // Important! Sends JWT cookies
	autoConnect: true,
});

// Connection
socket.on('connect', () => {
	console.log('Connected to WebSocket');
});

// Receive new message
socket.on('message:new', data => {
	console.log('New message:', data.message);
	// Update your UI
});

// Send typing indicator
socket.emit('typing:start', { chatId: 'your-chat-id' });

// Stop typing
socket.emit('typing:stop', { chatId: 'your-chat-id' });
```

**Full documentation:** [WEBSOCKET_DOCUMENTATION.md](./WEBSOCKET_DOCUMENTATION.md)

## 📁 Project Structure

```
src/
├── app.ts                      # Main application file
├── controllers/                # Request handlers
│   ├── authController.ts       # Authentication
│   ├── userController.ts       # User management
│   ├── friendsController.ts    # Friends management
│   ├── chatController.ts       # Chat operations
│   └── messagesController.ts   # Message operations
├── services/                   # Business logic
│   ├── authService.ts
│   ├── userService.ts
│   ├── friendsService.ts
│   ├── chatService.ts
│   └── messageService.ts
├── routes/                     # Express routers
│   ├── api.ts                  # Main API router
│   ├── authRoutes.ts
│   ├── userRoutes.ts
│   ├── friendsRoutes.ts
│   ├── chatRoutes.ts
│   └── messagesRoutes.ts
├── socket/                     # WebSocket handling
│   ├── socketAuth.ts           # Socket authentication
│   ├── socketHandlers.ts       # Socket event handlers
│   └── socketEmitters.ts       # Helper functions for emitting
├── middleware/                 # Express middleware
│   ├── auth.ts                 # JWT authentication
│   └── errorHandler.ts         # Error handling
├── types/                      # TypeScript type definitions
│   ├── socket.ts
│   ├── auth.ts
│   ├── user.ts
│   ├── chat.ts
│   └── friends.ts
└── utils/                      # Utility functions
    ├── jwt.ts                  # JWT utilities
    ├── responseHelper.ts       # Response formatters
    └── validationSchemas.ts    # Zod validation schemas

prisma/
├── schema.prisma               # Database schema
├── migrations/                 # Database migrations
└── generated/                  # Generated Prisma Client

dist/                           # Compiled files (after build)
```

## 🔧 Configuration

### Environment Variables

Required variables in `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chatdb?schema=public"

# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# JWT (generate strong secrets in production!)
JWT_ACCESS_SECRET=your-strong-secret-key-for-access-tokens
JWT_REFRESH_SECRET=your-strong-secret-key-for-refresh-tokens
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

### TypeScript

Configuration in `tsconfig.json`:

- ES2020 target
- CommonJS modules
- Strict typing enabled
- Source maps for debugging
- Path aliases support

### Socket.IO

- CORS enabled for CLIENT_URL
- Credentials support (cookies)
- JWT authentication via cookies or handshake
- Automatic room management
- User online/offline tracking

### Database Schema

**Models:**

- User (authentication, profile)
- RefreshToken (JWT refresh tokens)
- Friendship (friend relationships)
- FriendInvite (pending invitations)
- Chat (1-on-1 and group chats)
- ChatUser (chat membership)
- Message (chat messages)
- MessageReaction (emoji reactions)
- MessageRead (read receipts)

## 🏗️ Architecture

### Hybrid REST + WebSocket

This application uses a **hybrid architecture**:

- **REST API** → Execute operations (create, update, delete)
- **WebSocket** → Receive real-time updates

**Benefits:**

- ✅ RESTful principles maintained
- ✅ Real-time updates without polling
- ✅ Backwards compatible (can work without WebSocket)
- ✅ Scalable and efficient

### Authentication Flow

1. User logs in via REST API (`POST /api/auth/login`)
2. Server sets JWT tokens in HTTP-only cookies
3. Client connects to WebSocket with credentials
4. WebSocket verifies JWT from cookies
5. User joins their chat rooms automatically

### Message Flow

1. **Send:** REST API `POST /api/messages/:chatId`
2. **Broadcast:** Server emits `message:new` via WebSocket
3. **Receive:** All chat members get update in real-time

## 🚀 Future Enhancements

### Possible Improvements:

1. ✅ **PostgreSQL** - Already integrated with Prisma
2. ✅ **JWT Auth** - Already implemented
3. ✅ **Docker** - Already containerized
4. **Redis** - For scaling WebSocket across multiple instances
5. **Logging** - Winston for structured logging
6. **Tests** - Jest, Supertest for testing
7. **Rate Limiting** - Protect against abuse
8. **File Upload** - Images, videos in messages
9. **Push Notifications** - FCM/APNS integration
10. **WebRTC** - Voice/video calling
11. **Message Search** - Full-text search with Elasticsearch
12. **Message Encryption** - End-to-end encryption

## 📝 License

ISC License

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

Enjoy building with WebSockets! 🎉
