import { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
} from '../types/socket';

type AuthSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Socket.io authentication middleware
 * Verifies JWT token from cookies and attaches user data to socket
 */
export function socketAuthMiddleware(socket: AuthSocket, next: (err?: Error) => void) {
	try {
		// Get token from handshake auth or cookies
		const token =
			socket.handshake.auth.token ||
			socket.handshake.headers.cookie
				?.split('; ')
				.find(row => row.startsWith('accessToken='))
				?.split('=')[1];

		if (!token) {
			return next(new Error('Authentication required'));
		}

		// Verify token
		const decoded = verifyAccessToken(token);

		// Attach user data to socket
		socket.data.userId = decoded.userId;
		socket.data.email = decoded.email;

		next();
	} catch (error) {
		next(new Error('Invalid or expired token'));
	}
}
