// 测试 Realtime 连接的简单脚本
import { supabase } from './lib/supabase.js';

console.log('开始测试 Realtime 连接...');

// 测试连接到 chat_messages 表
const testChannel = supabase
  .channel('test-chat-messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
    },
    (payload) => {
      console.log('收到新消息:', payload);
    }
  )
  .subscribe((status) => {
    console.log('订阅状态:', status);
    if (status === 'SUBSCRIBED') {
      console.log('✅ Realtime 连接成功！');
    } else if (status === 'CHANNEL_ERROR') {
      console.log('❌ Realtime 连接失败！');
    }
  });

// 5秒后断开连接
setTimeout(() => {
  console.log('断开连接...');
  supabase.removeChannel(testChannel);
}, 5000);