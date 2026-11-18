import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export function createSocketRedis(url: string) {
	const publisher = new Redis(url, { connectTimeout: 5000, maxRetriesPerRequest: 1 });
	const subscriber = publisher.duplicate();
	publisher.on('error', () => console.error('Socket.IO Redis publisher connection error'));
	subscriber.on('error', () => console.error('Socket.IO Redis subscriber connection error'));

	const isReady = () => publisher.status === 'ready' && subscriber.status === 'ready';
	let pending: Promise<boolean> | undefined;

	function waitForReady(): Promise<boolean> {
		if (isReady()) return Promise.resolve(true);

		pending ??= new Promise<boolean>(resolve => {
			const finish = (ready: boolean) => {
				clearTimeout(timeout);
				publisher.off('ready', onReady);
				subscriber.off('ready', onReady);
				resolve(ready);
			};
			const onReady = () => {
				if (isReady()) finish(true);
			};
			const timeout = setTimeout(() => finish(false), 5000);
			publisher.on('ready', onReady);
			subscriber.on('ready', onReady);
		}).finally(() => {
			pending = undefined;
		});

		return pending;
	}

	return {
		adapter: createAdapter(publisher, subscriber, { key: 'realtime-chat' }),
		waitForReady,
	};
}
