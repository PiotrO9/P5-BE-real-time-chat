import express, { Express, Request, Response } from 'express';

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
	res.json({
		message: 'Express + TypeScript Server is running!',
		timestamp: new Date().toISOString(),
	});
});

app.listen(PORT, () => {
	console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

export { app };
