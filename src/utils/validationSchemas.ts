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

export const createChatSchema = z
	.object({
		// For 1-on-1 chat
		participantId: z.string().uuid('Invalid participant ID').optional(),
		// For group chat
		name: z
			.string()
			.min(1, 'Chat name is required')
			.max(100, 'Chat name must be less than 100 characters')
			.optional(),
		participantIds: z.array(z.string().uuid('Invalid participant ID')).optional(),
	})
	.refine(data => data.participantId || (data.name && data.participantIds), {
		message:
			'Either participantId (for 1-on-1 chat) or name and participantIds (for group chat) must be provided',
	})
	.refine(data => !(data.participantId && (data.name || data.participantIds)), {
		message: 'Cannot create both 1-on-1 and group chat at the same time',
	})
	.refine(data => !data.participantIds || data.participantIds.length >= 2, {
		message: 'Group chat must have at least 2 participants',
		path: ['participantIds'],
	});

export const updateChatSchema = z.object({
	name: z
		.string()
		.min(1, 'Chat name is required')
		.max(100, 'Chat name must be less than 100 characters'),
});
