-- チャット関連データの全削除
-- 開発段階でのデータクリア用

-- 外部キー制約に配慮した削除順序

-- 1. プライベートメッセージを削除（private_chatsを参照しているため最初）
DELETE FROM public.private_messages;

-- 2. プライベートチャットを削除
DELETE FROM public.private_chats;

-- 3. 話題のチャットメッセージを削除
DELETE FROM public.chat_messages;

-- 4. 話題参加者を削除（チャット機能に関連）
DELETE FROM public.topic_participants;

-- 削除結果の確認用クエリ（コメントアウト）
-- SELECT 
--   (SELECT COUNT(*) FROM public.private_messages) as private_messages_count,
--   (SELECT COUNT(*) FROM public.private_chats) as private_chats_count,
--   (SELECT COUNT(*) FROM public.chat_messages) as chat_messages_count,
--   (SELECT COUNT(*) FROM public.topic_participants) as topic_participants_count;