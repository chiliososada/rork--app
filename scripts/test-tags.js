// 测试脚本：检查数据库中的标签数据
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nkhomvyrlkxhuafikyuu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raG9tdnlybGt4aHVhZmlreXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NjYxOTIsImV4cCI6MjA2NzQ0MjE5Mn0.8mse6qzWK7Q0XfGXyNcP8jRjQPRmZTg_K9jymo2dydA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTags() {
  try {
    console.log('检查数据库中的话题和标签...');
    
    // 获取最近的几个话题
    const { data, error } = await supabase
      .from('topics')
      .select('id, title, tags, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('错误:', error);
      return;
    }
    
    console.log('最近的话题:');
    data.forEach((topic, index) => {
      console.log(`${index + 1}. ${topic.title}`);
      console.log(`   ID: ${topic.id}`);
      console.log(`   Tags: ${topic.tags}`);
      console.log(`   Created: ${topic.created_at}`);
      console.log('---');
    });
    
    // 检查是否有带标签的话题
    const topicsWithTags = data.filter(t => t.tags && t.tags !== '[]');
    console.log(`带标签的话题数量: ${topicsWithTags.length} / ${data.length}`);
    
    if (topicsWithTags.length > 0) {
      console.log('\n带标签的话题示例:');
      topicsWithTags.forEach(topic => {
        try {
          const tags = JSON.parse(topic.tags);
          console.log(`- ${topic.title}: ${JSON.stringify(tags)}`);
        } catch (e) {
          console.log(`- ${topic.title}: 标签解析错误 - ${topic.tags}`);
        }
      });
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testTags();