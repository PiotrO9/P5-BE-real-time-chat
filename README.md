# 🚀 Express.js + TypeScript + WebSocket Server

Modern Express.js server with TypeScript and WebSocket support using Socket.IO.

## ✨ Features

- **Express.js** - Web framework for Node.js
- **TypeScript** - Static typing for JavaScript
- **Socket.IO** - Bidirectional real-time communication
- **CORS** - Cross-Origin Resource Sharing
- **Nodemon** - Automatic server restart during development

## 🛠️ Configuration and Setup

### Requirements

- Node.js (v18 or newer)
- npm

### Installation

```bash
npm install
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

## 📡 API Endpoints

### HTTP REST API

- `GET /` - Server status check
- `GET /api/health` - Health check with additional information
- `GET /api/stats` - WebSocket server statistics

### WebSocket Events

#### Client → Server

- `joinRoom({ roomId: string, username: string })` - Join a room
- `leaveRoom(roomId: string)` - Leave a room
- `sendMessage({ roomId: string, content: string })` - Send a message
- `ping()` - Ping the server

#### Server → Client

- `connected({ message: string, timestamp: Date })` - Connection confirmation
- `userJoined(user: User)` - New user joined the room
- `userLeft(user: User)` - User left the room
- `messageReceived(message: Message)` - New message in the room
- `roomJoined(room: Room)` - Room join confirmation
- `roomLeft(roomId: string)` - Room leave confirmation
- `roomUsers(users: User[])` - List of users in the room
- `error(error: string)` - Error message

## 🧪 Testing

### WebSocket Test Client

Open your browser and navigate to:

```
http://localhost:3000
```

You will find an interactive WebSocket client that allows you to:

- Connect to the server
- Join rooms
- Send messages
- Check user status

### JavaScript Client Code Example

```javascript
const socket = io('http://localhost:3000');

// Connection
socket.on('connect', () => {
	console.log('Connected to server');
});

// Join room
socket.emit('joinRoom', {
	roomId: 'room1',
	username: 'JohnDoe',
});

// Send message
socket.emit('sendMessage', {
	roomId: 'room1',
	content: 'Hello world!',
});

// Receive message
socket.on('messageReceived', message => {
	console.log(`${message.username}: ${message.content}`);
});
```

## 📁 Project Structure

```
src/
├── app.ts              # Main application file
├── routes/             # Express routers
│   └── api.ts         # API endpoints
├── socket/             # WebSocket handling
│   └── socketHandlers.ts
├── types/              # TypeScript type definitions
│   └── socket.types.ts
└── controllers/        # Controllers (for future development)

public/
└── index.html          # WebSocket test client

dist/                   # Compiled files (after npm run build)
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file (optional):

```
PORT=3000
NODE_ENV=development
```

### TypeScript

Configuration in `tsconfig.json` is already set up for:

- ES2020 target
- CommonJS modules
- Strict typing
- Source maps
- Decorators

### Socket.IO

- CORS enabled for all origins
- Multi-room support
- Automatic cleanup of empty rooms
- In-memory storage of users and messages

## 🚀 Future Development

### Expansion Suggestions:

1. **Database** - Integration with MongoDB/PostgreSQL for persistent storage
2. **Authorization** - JWT tokens and permissions system
3. **Redis** - For scaling WebSocket across multiple instances
4. **Logging** - Winston or similar library for logging
5. **Tests** - Jest, Supertest for unit and integration tests
6. **Docker** - Application containerization
7. **API Rate limiting** - Request rate limiting
8. **WebRTC** - For audio/video connections
9. **File upload** - File upload via WebSocket
10. **Notifications** - Push notification system

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
