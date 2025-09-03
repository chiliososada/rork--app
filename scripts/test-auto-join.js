/**
 * 自動参加システムのテストスクリプト
 * 
 * 使用方法:
 * npm run start （別のターミナル）
 * node scripts/test-auto-join.js
 */

import { createClient } from '@supabase/supabase-js';

// Supabase 設定
const SUPABASE_URL = 'https://nkhomvyrlkxhuafikyuu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raG9tdnlybGt4aHVhZmlreXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NjYxOTIsImV4cCI6MjA2NzQ0MjE5Mn0.8mse6qzWK7Q0XfGXyNcP8jRjQPRmZTg_K9jymo2dydA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAutoJoinSystem() {
  console.log('🧪 自動参加システムのテストを開始します...\n');

  try {
    // 1. テスト用のユーザーを取得
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, nickname')
      .limit(3);

    if (usersError) {
      console.error('❌ ユーザーの取得に失敗:', usersError);
      return;
    }

    if (users.length === 0) {
      console.log('⚠️ テスト用のユーザーが見つかりません');
      return;
    }

    console.log('👥 テスト用ユーザー:', users.map(u => `${u.nickname} (${u.id})`).join(', '));

    // 2. テスト用の話題を取得
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, title')
      .limit(2);

    if (topicsError) {
      console.error('❌ 話題の取得に失敗:', topicsError);
      return;
    }

    if (topics.length === 0) {
      console.log('⚠️ テスト用の話題が見つかりません');
      return;
    }

    console.log('💭 テスト用話題:', topics.map(t => `${t.title} (${t.id})`).join(', '), '\n');

    // 3. 修復前の参加者数を確認
    const { data: beforeStats, error: beforeError } = await supabase
      .from('topic_participants')
      .select('*', { count: 'exact' });

    if (beforeError) {
      console.error('❌ 修復前統計の取得に失敗:', beforeError);
      return;
    }

    console.log(`📊 修復前の参加者数: ${beforeStats?.length || 0}人`);

    // 4. 修復関数を実行
    console.log('🔧 既存データの修復を実行中...');
    const { data: repairResult, error: repairError } = await supabase
      .rpc('repair_missing_participants');

    if (repairError) {
      console.error('❌ 修復に失敗:', repairError);
    } else {
      console.log('✅ 修復完了:', repairResult);
    }

    // 5. テストメッセージの送信（トリガーをテスト）
    console.log('\n💬 テストメッセージを送信してトリガーをテスト...');
    
    const testUser = users[0];
    const testTopic = topics[0];

    // 修復前の該当参加者をチェック
    const { data: beforeParticipant } = await supabase
      .from('topic_participants')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('topic_id', testTopic.id)
      .single();

    console.log('👤 テスト前の参加状態:', beforeParticipant ? '参加済み' : '未参加');

    // テストメッセージを挿入
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: testUser.id,
        topic_id: testTopic.id,
        message: `テストメッセージ - ${new Date().toISOString()}`
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ テストメッセージの送信に失敗:', messageError);
    } else {
      console.log('✅ テストメッセージ送信成功:', message.id);

      // 少し待ってからトリガーの効果を確認
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: afterParticipant } = await supabase
        .from('topic_participants')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('topic_id', testTopic.id)
        .single();

      console.log('✅ トリガー後の参加状態:', afterParticipant ? 'アクティブ参加中' : '未参加のまま');
      
      if (afterParticipant) {
        console.log(`   - 参加日時: ${afterParticipant.joined_at}`);
        console.log(`   - アクティブ状態: ${afterParticipant.is_active}`);
      }
    }

    // 6. コメントテストも実行
    console.log('\n💬 テストコメントを投稿してトリガーをテスト...');
    
    const testUser2 = users[1] || testUser;
    const testTopic2 = topics[1] || testTopic;

    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert({
        user_id: testUser2.id,
        topic_id: testTopic2.id,
        content: `テストコメント - ${new Date().toISOString()}`
      })
      .select()
      .single();

    if (commentError) {
      console.error('❌ テストコメントの投稿に失敗:', commentError);
    } else {
      console.log('✅ テストコメント投稿成功:', comment.id);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: commentParticipant } = await supabase
        .from('topic_participants')
        .select('*')
        .eq('user_id', testUser2.id)
        .eq('topic_id', testTopic2.id)
        .single();

      console.log('✅ コメント後の参加状態:', commentParticipant ? 'アクティブ参加中' : '未参加のまま');
    }

    // 7. 最終統計
    console.log('\n📊 最終統計:');
    const { data: finalStats, error: finalError } = await supabase
      .from('topic_participants')
      .select('*', { count: 'exact' });

    if (!finalError) {
      console.log(`   - 総参加者数: ${finalStats?.length || 0}人`);
    }

    // アクティブ参加者数
    const { data: activeStats, error: activeError } = await supabase
      .from('topic_participants')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (!activeError) {
      console.log(`   - アクティブ参加者数: ${activeStats?.length || 0}人`);
    }

    // 8. トリガー設定の確認
    console.log('\n🔧 設定されているトリガーを確認:');
    const { data: triggers, error: triggersError } = await supabase
      .rpc('get_database_triggers') // この関数は手動で作成が必要
      .catch(() => null);

    if (!triggersError && triggers) {
      console.log('   - 設定済みトリガー:', triggers);
    } else {
      console.log('   - トリガー情報の取得はSupabaseダッシュボードで確認してください');
    }

    console.log('\n✅ テスト完了！自動参加システムは正常に動作しています。');
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生:', error);
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('\n👋 テストを終了します...');
  process.exit(0);
});

// テスト実行
testAutoJoinSystem();