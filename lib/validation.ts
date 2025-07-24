import { z } from 'zod';

/**
 * 话题创建验证Schema
 */
export const createTopicSchema = z.object({
  title: z
    .string()
    .min(1, 'タイトルは必須です')
    .max(50, 'タイトルは50文字以内で入力してください')
    .trim(),
  description: z
    .string()
    .min(1, '内容は必須です')
    .max(500, '内容は500文字以内で入力してください')
    .trim(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional()
  }),
  imageUrl: z.string().url().optional(),
  aspectRatio: z.enum(['1:1', '4:5', '1.91:1']).optional(),
  originalWidth: z.number().positive().optional(),
  originalHeight: z.number().positive().optional()
});

/**
 * 评论创建验证Schema
 */
export const createCommentSchema = z.object({
  text: z
    .string()
    .min(1, 'コメントは必須です')
    .max(500, 'コメントは500文字以内で入力してください')
    .trim(),
  topicId: z.string().uuid('無効なトピックIDです')
});

/**
 * 用户注册验证Schema
 */
export const userRegistrationSchema = z.object({
  email: z
    .string()
    .email('有効なメールアドレスを入力してください')
    .optional(),
  phone: z
    .string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, '有効な電話番号を入力してください')
    .optional(),
  nickname: z
    .string()
    .min(1, 'ニックネームは必須です')
    .max(20, 'ニックネームは20文字以内で入力してください')
    .trim(),
  avatar_url: z.string().url().optional(),
  gender: z.enum(['male', 'female', 'other']).optional()
});

// 类型导出
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;