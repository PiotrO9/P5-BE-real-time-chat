import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app: Express = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
	},
});

const PORT = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
	res.json({
		message: 'Express + TypeScript Server with WebSocket is running!',
		timestamp: new Date().toISOString(),
	});
});

server.listen(PORT, () => {
	console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

export { app, io };
