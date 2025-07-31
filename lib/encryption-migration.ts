/**
 * 加密迁移工具
 * 用于将旧版本XOR加密的消息升级为AES-256-GCM加密
 */
import { supabase } from '@/lib/supabase';
import { encryptMessage, decryptMessage, isEncrypted, getEncryptionVersion } from '@/lib/secure-encryption';

interface MigrationProgress {
  total: number;
  processed: number;
  upgraded: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
}

/**
 * 批量升级数据库中的旧版本加密消息
 */
export async function migrateEncryptedMessages(
  batchSize: number = 100,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationProgress> {
  const progress: MigrationProgress = {
    total: 0,
    processed: 0,
    upgraded: 0,
    errors: 0,
    startTime: new Date()
  };

  try {
    console.log('开始加密迁移...');
    
    // 1. 获取需要升级的消息总数
    const { count, error: countError } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .or('message.like.ENC_%,message.like.ENC2_%');

    if (countError) {
      throw new Error(`获取消息数量失败: ${countError.message}`);
    }

    progress.total = count || 0;
    console.log(`发现 ${progress.total} 条需要升级的消息`);

    if (progress.total === 0) {
      progress.endTime = new Date();
      return progress;
    }

    // 2. 分批处理消息
    let offset = 0;
    
    while (offset < progress.total) {
      try {
        // 获取一批消息
        const { data: messages, error: fetchError } = await supabase
          .from('chat_messages')
          .select('id, message')
          .or('message.like.ENC_%,message.like.ENC2_%')
          .range(offset, offset + batchSize - 1);

        if (fetchError) {
          console.error(`获取消息批次失败 (offset: ${offset}):`, fetchError);
          progress.errors += batchSize;
          offset += batchSize;
          continue;
        }

        if (!messages || messages.length === 0) {
          break;
        }

        // 3. 并行处理这批消息
        const upgradePromises = messages.map(async (message) => {
          try {
            const version = getEncryptionVersion(message.message);
            
            if (version === 'v1' || version === 'v2') {
              // 解密旧版本消息
              const decryptedText = decryptMessage(message.message);
              
              // 用新版本重新加密
              const newEncryptedMessage = encryptMessage(decryptedText);
              
              // 更新数据库
              const { error: updateError } = await supabase
                .from('chat_messages')
                .update({ message: newEncryptedMessage })
                .eq('id', message.id);

              if (updateError) {
                throw updateError;
              }

              return { success: true, upgraded: true };
            } else {
              return { success: true, upgraded: false };
            }
          } catch (error) {
            console.error(`升级消息失败 (id: ${message.id}):`, error);
            return { success: false, upgraded: false };
          }
        });

        // 等待这批消息处理完成
        const results = await Promise.allSettled(upgradePromises);
        
        // 统计结果
        results.forEach((result) => {
          progress.processed++;
          
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              if (result.value.upgraded) {
                progress.upgraded++;
              }
            } else {
              progress.errors++;
            }
          } else {
            progress.errors++;
          }
        });

        // 调用进度回调
        if (onProgress) {
          onProgress({ ...progress });
        }

        console.log(`已处理 ${progress.processed}/${progress.total} 条消息，升级 ${progress.upgraded} 条`);

        offset += batchSize;
        
        // 添加小延迟避免过度负载数据库
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`处理批次失败 (offset: ${offset}):`, error);
        progress.errors += batchSize;
        offset += batchSize;
      }
    }

    progress.endTime = new Date();
    
    console.log('加密迁移完成:', {
      总数: progress.total,
      已处理: progress.processed,
      已升级: progress.upgraded,
      错误: progress.errors,
      耗时: `${(progress.endTime.getTime() - progress.startTime.getTime()) / 1000}秒`
    });

    return progress;
    
  } catch (error) {
    progress.endTime = new Date();
    console.error('加密迁移失败:', error);
    throw error;
  }
}

/**
 * 验证迁移结果
 */
export async function verifyMigration(): Promise<{
  legacy: number;
  upgraded: number;
  unencrypted: number;
  errors: string[];
}> {
  const result = {
    legacy: 0,
    upgraded: 0,
    unencrypted: 0,
    errors: [] as string[]
  };

  try {
    // 分批检查所有消息
    let offset = 0;
    const batchSize = 500;
    
    while (true) {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, message')
        .range(offset, offset + batchSize - 1);

      if (error) {
        result.errors.push(`获取消息失败 (offset: ${offset}): ${error.message}`);
        break;
      }

      if (!messages || messages.length === 0) {
        break;
      }

      // 检查每条消息的加密版本
      messages.forEach((message) => {
        try {
          const version = getEncryptionVersion(message.message);
          
          switch (version) {
            case 'v3':
              result.upgraded++;
              break;
            case 'v1':
            case 'v2':
              result.legacy++;
              break;
            case 'none':
              result.unencrypted++;
              break;
          }
        } catch (error) {
          result.errors.push(`检查消息失败 (id: ${message.id}): ${error}`);
        }
      });

      if (messages.length < batchSize) {
        break;
      }

      offset += batchSize;
    }

    console.log('迁移验证结果:', result);
    return result;
    
  } catch (error) {
    result.errors.push(`验证失败: ${error}`);
    return result;
  }
}

/**
 * 清理旧版本加密函数的遗留文件
 */
export function cleanupLegacyEncryption(): {
  success: boolean;
  message: string;
} {
  try {
    // 这个函数主要是提醒开发者手动删除旧文件
    const legacyFiles = [
      '/lib/encryption.ts',
      // 其他可能的旧加密相关文件
    ];

    console.warn('请手动删除以下旧版本加密文件:');
    legacyFiles.forEach(file => console.warn(`- ${file}`));
    
    console.warn('并确保所有import语句已更新为使用 /lib/secure-encryption.ts');

    return {
      success: true,
      message: '清理提醒已显示，请手动完成文件删除'
    };
  } catch (error) {
    return {
      success: false,
      message: `清理失败: ${error}`
    };
  }
}

/**
 * 一键执行完整的加密迁移流程
 */
export async function executeFullMigration(
  onProgress?: (progress: MigrationProgress) => void
): Promise<{
  migrationResult: MigrationProgress;
  verificationResult: any;
  cleanupResult: any;
}> {
  console.log('开始完整的加密迁移流程...');
  
  // 1. 执行迁移
  const migrationResult = await migrateEncryptedMessages(100, onProgress);
  
  // 2. 验证结果
  console.log('验证迁移结果...');
  const verificationResult = await verifyMigration();
  
  // 3. 清理提醒
  const cleanupResult = cleanupLegacyEncryption();
  
  console.log('完整迁移流程执行完成');
  
  return {
    migrationResult,
    verificationResult,
    cleanupResult
  };
}