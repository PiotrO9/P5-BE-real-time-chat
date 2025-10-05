import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { router as apiRoutes } from './routes/api';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Express = express();
const server = createServer(app);

app.use(
	cors({
		origin: process.env.CLIENT_URL || 'http://localhost:3000',
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	}),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const io = new Server(server, {
	cors: {
		origin: process.env.CLIENT_URL || 'http://localhost:3000',
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
	},
});

const PORT = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
	res.json({
		message: 'Real-time Chat API Server',
		version: '1.0.0',
		timestamp: new Date().toISOString(),
		status: 'Running 🚀',
	});
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

server.listen(PORT, () => {
	console.log(`🚀 Server is running on http://localhost:${PORT}`);
	console.log(`📚 API available at http://localhost:${PORT}/api`);
	console.log(`💾 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, io };
