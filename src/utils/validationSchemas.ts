import { z } from 'zod';

export const registerSchema = z.object({
	email: z.string().email('Invalid email format'),
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters')
		.max(30, 'Username must be less than 30 characters'),
	password: z
		.string()
		.min(6, 'Password must be at least 6 characters')
		.max(100, 'Password must be less than 100 characters'),
});

export const loginSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(1, 'Password is required'),
});

export const updatePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Current password is required'),
	newPassword: z
		.string()
		.min(8, 'New password must be at least 8 characters')
		.max(128, 'New password must be less than 128 characters')
		.regex(/[a-z]/, 'New password must contain at least one lowercase letter')
		.regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
		.regex(/[0-9]/, 'New password must contain at least one number')
		.regex(/[^a-zA-Z0-9]/, 'New password must contain at least one special character'),
});

export const inviteFriendSchema = z.object({
	username: z.string().min(1, 'Username is required'),
});
