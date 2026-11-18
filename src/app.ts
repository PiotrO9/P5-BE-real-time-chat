import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { router as apiRoutes } from './routes/api';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeSocketHandlers } from './socket/socketHandlers';
import { initializeSocketEmitters } from './socket/socketEmitters';
import { createSocketRedis } from './socket/socketRedis';
import {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
} from './types/socket';

const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production' || isVercel;
const clientUrl = process.env.CLIENT_URL?.trim();
const redisUrl = process.env.REDIS_URL?.trim();

if (isProduction && (!clientUrl || !process.env.DATABASE_URL?.trim())) {
	throw new Error('CLIENT_URL and DATABASE_URL are required in production');
}
if (isVercel && !redisUrl) {
	throw new Error('REDIS_URL is required on Vercel');
}

const clientOrigin = clientUrl ? new URL(clientUrl).origin : 'http://localhost:3001';
const redis = redisUrl ? createSocketRedis(redisUrl) : undefined;
const app: Express = express();
const server = createServer(app);

if (isVercel) {
	app.set('trust proxy', 1);
}

app.use(
	cors({
		origin: clientOrigin,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
		allowedHeaders: [
			'Content-Type',
			'Authorization',
			'X-Requested-With',
			'Accept',
			'Origin',
			'Access-Control-Request-Method',
			'Access-Control-Request-Headers',
		],
		exposedHeaders: ['Set-Cookie'],
		preflightContinue: false,
		optionsSuccessStatus: 204,
	}),
);

app.use(async (_req, res, next) => {
	if (redis && !(await redis.waitForReady())) {
		res.status(503).json({ success: false, message: 'Realtime service unavailable' });
		return;
	}
	next();
});

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
	server,
	{
		...(redis && { adapter: redis.adapter }),
		...(isVercel && { transports: ['websocket'] }),
		allowRequest: async (req, done) => {
			if (isProduction && req.headers.origin && req.headers.origin !== clientOrigin) {
				done('Origin not allowed', false);
				return;
			}
			if (redis && !(await redis.waitForReady())) {
				done('Realtime service unavailable', false);
				return;
			}
			done(null, true);
		},
		cors: {
			origin: clientOrigin,
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
		},
	},
);

initializeSocketEmitters(io);
initializeSocketHandlers(io);

const PORT = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
	res.json({
		message: 'Real-time Chat API Server',
		version: '1.0.0',
		timestamp: new Date().toISOString(),
		status: 'Running 🚀',
	});
});

const swaggerOptions = {
	definition: {
		openapi: '3.0.0',
		info: {
			title: 'API Docs',
			version: '1.0.0',
			description: 'Automatically generated API documentation',
		},
		servers: [
			{
				url: `http://localhost:${PORT}`,
				description: 'Development server',
			},
		],
		components: {
			securitySchemes: {
				BearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
					description: 'Enter JWT token in format: Bearer {token}',
				},
			},
		},
	},
	apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module && !isVercel && process.env.NODE_ENV !== 'test') {
	server.listen(PORT, () => {
		console.log(`🚀 Server is running on http://localhost:${PORT}`);
		console.log(`📖 Swagger docs available at http://localhost:${PORT}/api/docs`);
		console.log(`🔌 WebSocket server initialized`);
		console.log(`💾 Environment: ${process.env.NODE_ENV || 'development'}`);
	});
}

export { app, io };
export default server;
