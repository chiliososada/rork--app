#!/usr/bin/env npx tsx
/**
 * Encryption Migration Script
 * 
 * This script migrates old XOR encrypted messages to AES-256-GCM encryption.
 * It processes chat messages in batches to upgrade encryption without affecting performance.
 * 
 * Usage:
 * npm run migrate-encryption [--dry-run] [--batch-size=100] [--max-batches=10]
 * 
 * Options:
 * --dry-run: Show what would be migrated without making changes
 * --batch-size: Number of messages to process in each batch (default: 100)
 * --max-batches: Maximum number of batches to process (default: unlimited)
 */

import { createClient } from '@supabase/supabase-js';
import { 
  encryptMessage, 
  decryptMessage, 
  isEncrypted
} from '../lib/secure-encryption';

// Configuration
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase環境変数が設定されていません');
  console.error('REACT_APP_SUPABASE_URL と REACT_APP_SUPABASE_ANON_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  maxBatches?: number;
}

interface MigrationStats {
  totalMessages: number;
  processedMessages: number;
  upgradedMessages: number;
  errorCount: number;
  skippedMessages: number;
  batches: number;
}

class EncryptionMigration {
  private options: MigrationOptions;
  private stats: MigrationStats;

  constructor(options: MigrationOptions) {
    this.options = options;
    this.stats = {
      totalMessages: 0,
      processedMessages: 0,
      upgradedMessages: 0,
      errorCount: 0,
      skippedMessages: 0,
      batches: 0,
    };
  }

  async run(): Promise<void> {
    console.log('🚀 暗号化マイグレーション開始');
    console.log(`設定: ${JSON.stringify(this.options, null, 2)}`);
    
    try {
      // Get total count first
      await this.getTotalCount();
      
      if (this.stats.totalMessages === 0) {
        console.log('✅ マイグレーションが必要なメッセージはありません');
        return;
      }

      console.log(`📊 合計 ${this.stats.totalMessages} 件のメッセージを処理します`);
      
      if (this.options.dryRun) {
        console.log('🔍 ドライランモード: 実際の変更は行いません');
      }

      // Process in batches
      let hasMore = true;
      let offset = 0;

      while (hasMore && (!this.options.maxBatches || this.stats.batches < this.options.maxBatches)) {
        console.log(`\n📦 バッチ ${this.stats.batches + 1} 処理中...`);
        
        const processed = await this.processBatch(offset);
        
        if (processed === 0) {
          hasMore = false;
        } else {
          offset += processed;
          this.stats.processedMessages += processed;
          this.stats.batches++;
        }

        // Progress report
        const progress = Math.round((this.stats.processedMessages / this.stats.totalMessages) * 100);
        console.log(`進捗: ${this.stats.processedMessages}/${this.stats.totalMessages} (${progress}%)`);
        
        // Brief pause between batches to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.printFinalReport();
      
    } catch (error) {
      console.error('❌ マイグレーション中にエラーが発生しました:', error);
      process.exit(1);
    }
  }

  private async getTotalCount(): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .like('message', 'ENC_%'); // Old encryption patterns

      if (error) {
        throw error;
      }

      this.stats.totalMessages = count || 0;
    } catch (error) {
      console.error('メッセージ数の取得に失敗:', error);
      throw error;
    }
  }

  private async processBatch(offset: number): Promise<number> {
    try {
      // Fetch batch of messages that need migration
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, message, created_at')
        .like('message', 'ENC_%') // Old encryption patterns
        .order('created_at', { ascending: true })
        .range(offset, offset + this.options.batchSize - 1);

      if (error) {
        throw error;
      }

      if (!messages || messages.length === 0) {
        return 0;
      }

      console.log(`  ${messages.length} 件のメッセージを処理中...`);

      for (const message of messages) {
        await this.processMessage(message);
      }

      return messages.length;
    } catch (error) {
      console.error(`バッチ処理エラー (offset: ${offset}):`, error);
      this.stats.errorCount++;
      return 0;
    }
  }

  private async processMessage(message: any): Promise<void> {
    try {
      const { id, message: encryptedText } = message;

      // Check if this message needs upgrading
      if (!isEncrypted(encryptedText)) {
        this.stats.skippedMessages++;
        return;
      }

      // Check if it's already using new encryption
      if (!encryptedText.startsWith('ENC_') && !encryptedText.startsWith('ENC2_')) {
        this.stats.skippedMessages++;
        return;
      }

      try {
        // Try to decrypt the old message
        const decryptedText = decryptMessage(encryptedText);
        
        if (this.options.dryRun) {
          console.log(`  [DRY RUN] ${id}: 暗号化アップグレード対象`);
          this.stats.upgradedMessages++;
          return;
        }

        // Upgrade to new encryption
        const newEncryptedText = encryptMessage(decryptedText);

        // Update in database
        const { error: updateError } = await supabase
          .from('chat_messages')
          .update({ message: newEncryptedText })
          .eq('id', id);

        if (updateError) {
          throw updateError;
        }

        this.stats.upgradedMessages++;
        console.log(`  ✅ ${id}: 暗号化アップグレード完了`);

      } catch (decryptError) {
        console.warn(`  ⚠️ ${id}: 復号化失敗 - スキップ`);
        this.stats.skippedMessages++;
      }

    } catch (error) {
      console.error(`  ❌ メッセージ処理エラー (${message.id}):`, error);
      this.stats.errorCount++;
    }
  }

  private printFinalReport(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📋 マイグレーション完了レポート');
    console.log('='.repeat(50));
    console.log(`合計メッセージ数: ${this.stats.totalMessages}`);
    console.log(`処理済みメッセージ数: ${this.stats.processedMessages}`);
    console.log(`アップグレード済み: ${this.stats.upgradedMessages}`);
    console.log(`スキップ済み: ${this.stats.skippedMessages}`);
    console.log(`エラー数: ${this.stats.errorCount}`);
    console.log(`処理バッチ数: ${this.stats.batches}`);
    
    if (this.options.dryRun) {
      console.log('\n🔍 これはドライランでした。実際の変更は行われていません。');
      console.log('実際にマイグレーションを実行するには --dry-run フラグを削除してください。');
    } else {
      console.log('\n✅ マイグレーション完了！');
      
      if (this.stats.errorCount > 0) {
        console.log(`⚠️ ${this.stats.errorCount} 件のエラーが発生しました。ログを確認してください。`);
      }
    }
  }
}

// Parse command line arguments
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: false,
    batchSize: 100,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10) || 100;
    } else if (arg.startsWith('--max-batches=')) {
      options.maxBatches = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
暗号化マイグレーションスクリプト

使用方法:
  npm run migrate-encryption [オプション]

オプション:
  --dry-run          実際の変更を行わずに結果を表示
  --batch-size=N     バッチサイズを指定 (デフォルト: 100)
  --max-batches=N    最大バッチ数を制限
  --help, -h         このヘルプを表示

例:
  npm run migrate-encryption --dry-run
  npm run migrate-encryption --batch-size=50 --max-batches=5
      `);
      process.exit(0);
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    const migration = new EncryptionMigration(options);
    await migration.run();
  } catch (error) {
    console.error('スクリプト実行エラー:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { EncryptionMigration, MigrationOptions, MigrationStats };