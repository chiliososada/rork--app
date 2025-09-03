# 自動参加システム セットアップガイド

## 🚨 重要: エラー解決手順

現在の「cannot change return type of existing function」エラーを解決するための完全なガイドです。

## 📋 実行手順（必須順序）

### ステップ 1: 既存システムのクリーンアップ

1. **Supabaseダッシュボード**にアクセス
   - https://supabase.com/dashboard
   - プロジェクト「nkhomvyrlkxhuafikyuu」を選択

2. **SQL Editor**を開く
   - 左サイドバーから「SQL Editor」をクリック

3. **クリーンアップスクリプトを実行**
   ```sql
   -- supabase/migrations/20250902_cleanup_auto_join.sql の内容をコピペ
   ```
   - ファイル: `/supabase/migrations/20250902_cleanup_auto_join.sql`
   - **必ず全ての内容をコピーして実行**
   - 「RUN」ボタンをクリック

4. **実行結果の確認**
   ```
   ✅ 期待される出力:
   - 「クリーンアップ完了」メッセージ
   - remaining_triggers: 0
   - remaining_functions: 0
   ```

### ステップ 2: 新しい自動参加システムのインストール

1. **最終版マイグレーションを実行**
   ```sql
   -- supabase/migrations/20250902_auto_join_final.sql の内容をコピペ
   ```
   - ファイル: `/supabase/migrations/20250902_auto_join_final.sql`
   - **必ず全ての内容をコピーして実行**
   - 「RUN」ボタンをクリック

2. **実行結果の確認**
   ```
   ✅ 期待される出力:
   - 「🎉 自動参加システムのインストールが完了しました」
   - インストールされたトリガー一覧
   - インストールされた関数一覧
   - 修復前後の統計
   ```

## 🧪 動作テスト

### テスト 1: メッセージ送信での自動参加

```sql
-- 1. テスト用ユーザーと話題を確認
SELECT u.id as user_id, u.nickname, t.id as topic_id, t.title 
FROM users u, topics t 
LIMIT 1;

-- 2. 参加前の状態確認
SELECT COUNT(*) as before_count FROM topic_participants 
WHERE user_id = 'USER_ID_HERE' AND topic_id = 'TOPIC_ID_HERE';

-- 3. テストメッセージ送信
INSERT INTO chat_messages (user_id, topic_id, message)
VALUES ('USER_ID_HERE', 'TOPIC_ID_HERE', 'テストメッセージ');

-- 4. 参加後の状態確認（自動参加されているはず）
SELECT COUNT(*) as after_count FROM topic_participants 
WHERE user_id = 'USER_ID_HERE' AND topic_id = 'TOPIC_ID_HERE';
```

### テスト 2: コメント投稿での自動参加

```sql
-- コメント投稿テスト
INSERT INTO comments (user_id, topic_id, content)
VALUES ('USER_ID_HERE', 'TOPIC_ID_HERE', 'テストコメント');

-- 参加確認
SELECT * FROM topic_participants 
WHERE user_id = 'USER_ID_HERE' AND topic_id = 'TOPIC_ID_HERE';
```

## 📊 統計確認クエリ

```sql
-- 1. 全体統計
SELECT 
    COUNT(*) as total_participants,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT topic_id) as unique_topics,
    COUNT(CASE WHEN is_active THEN 1 END) as active_participants
FROM topic_participants;

-- 2. 話題別参加者数トップ10
SELECT * FROM topic_participation_stats
WHERE active_participants > 0
ORDER BY active_participants DESC
LIMIT 10;

-- 3. 最新の参加者（直近20件）
SELECT 
    tp.joined_at,
    u.nickname as user_name,
    t.title as topic_title,
    tp.is_active
FROM topic_participants tp
JOIN users u ON u.id = tp.user_id
JOIN topics t ON t.id = tp.topic_id
ORDER BY tp.joined_at DESC
LIMIT 20;
```

## 🔧 トラブルシューティング

### エラー 1: 「function does not exist」

**原因**: クリーンアップが不完全
**解決策**:
```sql
-- 手動で全ての関数を強制削除
DROP FUNCTION IF EXISTS auto_join_topic CASCADE;
DROP FUNCTION IF EXISTS trigger_auto_join_on_message CASCADE;
DROP FUNCTION IF EXISTS trigger_auto_join_on_comment CASCADE;
DROP FUNCTION IF EXISTS trigger_auto_join_on_topic_create CASCADE;
DROP FUNCTION IF EXISTS trigger_auto_join_on_like CASCADE;
DROP FUNCTION IF EXISTS repair_missing_participants CASCADE;
```

### エラー 2: 「trigger already exists」

**原因**: トリガーの削除が不完全
**解決策**:
```sql
-- 手動で全てのトリガーを強制削除
DROP TRIGGER IF EXISTS auto_join_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS auto_join_on_comment ON comments;
DROP TRIGGER IF EXISTS auto_join_on_topic_create ON topics;
DROP TRIGGER IF EXISTS auto_join_on_topic_like ON topic_likes;
```

### エラー 3: 「table does not exist」

**原因**: 必要なテーブルが作成されていない
**解決策**:
```sql
-- テーブル存在確認
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'topics', 'topic_participants', 'chat_messages', 'comments', 'topic_likes');

-- topic_participants テーブルが存在しない場合
CREATE TABLE IF NOT EXISTS public.topic_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(topic_id, user_id)
);
```

## 🔍 ログの確認方法

### Supabaseダッシュボードでのログ確認

1. **Logs** ページを開く
2. **Postgres Logs** タブを選択
3. 以下のキーワードで検索:
   - `[auto_join_topic]`
   - `[trigger_auto_join]`
   - `auto_join`

### 期待されるログ出力例

```
[auto_join_topic] 開始 - user_id: xxx, topic_id: yyy
[auto_join_topic] 新規参加者を追加: user_id=xxx, topic_id=yyy, participant_id=zzz
[trigger_auto_join_on_message] 成功 - action=joined, message_id=aaa
```

## ⚙️ 設定のカスタマイズ

### いいね時の自動参加を無効にする

```sql
-- いいね時の自動参加トリガーを削除
DROP TRIGGER IF EXISTS auto_join_on_topic_like ON topic_likes;
```

### いいね時の自動参加を有効にする

```sql
-- いいね時の自動参加トリガーを作成
CREATE TRIGGER auto_join_on_topic_like
    AFTER INSERT ON topic_likes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_join_on_like();
```

## 🚀 パフォーマンス最適化

### インデックスの確認

```sql
-- topic_participants テーブルのインデックス確認
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'topic_participants';

-- 必要に応じてインデックスを追加
CREATE INDEX IF NOT EXISTS topic_participants_user_active_idx 
ON topic_participants(user_id, is_active);

CREATE INDEX IF NOT EXISTS topic_participants_topic_active_idx 
ON topic_participants(topic_id, is_active);
```

## 📱 アプリケーションでの確認

### React Nativeアプリでの確認方法

1. **アプリを再起動**
   ```bash
   npm start
   ```

2. **デバッグログを確認**
   - コンソールで自動参加関連のログを確認

3. **リアルタイム接続の確認**
   - 接続ステータスが「connected」になることを確認

## 📞 サポート

### 問題が解決しない場合

1. **ログを収集**:
   - Supabase Postgres Logs
   - React Native コンソールログ

2. **現在の状態を確認**:
   ```sql
   -- システムの現在状態
   SELECT 'triggers' as type, trigger_name as name FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name LIKE '%auto_join%'
   UNION ALL
   SELECT 'functions' as type, routine_name as name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%auto_join%'
   UNION ALL
   SELECT 'participants' as type, COUNT(*)::text as name FROM topic_participants;
   ```

3. **エラーメッセージの全文を記録**

## ✅ 最終チェックリスト

- [ ] クリーンアップスクリプトを実行済み
- [ ] 最終版マイグレーションを実行済み
- [ ] エラーなく完了している
- [ ] トリガーが4つ作成されている
- [ ] 関数が5つ作成されている
- [ ] テストメッセージで自動参加が動作する
- [ ] アプリケーションが正常に動作する

---

**🎉 全てのステップが完了したら、自動参加システムが正常に動作します！**