// React Native対応の簡易暗号化実装
// 注意: これは基本的な難読化であり、本格的な暗号化ではありません
// 本番環境では、より強力な暗号化ライブラリの使用を検討してください

// 环境变量获取密钥，如果没有设置则使用默认值（仅用于开发）
const SECRET_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || 'TokyoPark-Dev-Fallback-Key-2024';

// 开发模式下检查是否使用了默认密钥
if (__DEV__ && !process.env.EXPO_PUBLIC_ENCRYPTION_KEY) {
  console.warn('⚠️ 使用默认加密密钥！生产环境请设置 EXPO_PUBLIC_ENCRYPTION_KEY 环境变量');
}

// 验证密钥强度（至少16字符）
if (SECRET_KEY.length < 16) {
  console.error('❌ 加密密钥长度不足！请使用至少16字符的密钥');
}

/**
 * 改进的字符串加密（XOR + 随机盐 + Base64编码）
 * @param message - 待加密的消息
 * @returns 加密后的消息
 */
export function encryptMessage(message: string): string {
  try {
    // UTF-8编码
    const utf8Message = new TextEncoder().encode(message);
    
    // 生成随机盐（8字节）
    const salt = new Uint8Array(8);
    for (let i = 0; i < salt.length; i++) {
      salt[i] = Math.floor(Math.random() * 256);
    }
    
    // 创建扩展密钥（原密钥 + 盐）
    const extendedKey = SECRET_KEY + Array.from(salt).map(b => String.fromCharCode(b)).join('');
    
    // XOR加密
    const encryptedBytes = new Uint8Array(utf8Message.length);
    for (let i = 0; i < utf8Message.length; i++) {
      const keyChar = extendedKey.charCodeAt(i % extendedKey.length);
      encryptedBytes[i] = utf8Message[i] ^ keyChar;
    }
    
    // 将盐和加密数据合并
    const combined = new Uint8Array(salt.length + encryptedBytes.length);
    combined.set(salt);
    combined.set(encryptedBytes, salt.length);
    
    // Base64编码并添加版本前缀
    const base64Encrypted = btoa(String.fromCharCode(...combined));
    return `ENC2_${base64Encrypted}`; // 使用新版本前缀
  } catch (error) {
    console.error('消息加密失败:', error);
    // 加密失败时返回原消息（开发阶段保持连续性）
    return message;
  }
}

/**
 * 改进的字符串解密（支持新旧格式）
 * @param encryptedMessage - 待解密的加密消息
 * @returns 解密后的消息
 */
export function decryptMessage(encryptedMessage: string): string {
  try {
    // 检查是否为新格式加密消息
    if (encryptedMessage.startsWith('ENC2_')) {
      return decryptMessageV2(encryptedMessage);
    }
    
    // 检查是否为旧格式加密消息
    if (encryptedMessage.startsWith('ENC_')) {
      return decryptMessageV1(encryptedMessage);
    }
    
    // 未加密的消息直接返回
    return encryptedMessage;
  } catch (error) {
    console.error('消息解密失败:', error);
    return encryptedMessage;
  }
}

/**
 * 新版本解密（支持盐）
 */
function decryptMessageV2(encryptedMessage: string): string {
  // 移除前缀并Base64解码
  const base64Data = encryptedMessage.substring(5);
  const combinedData = atob(base64Data);
  
  // 转换为Uint8Array
  const combinedBytes = new Uint8Array(combinedData.length);
  for (let i = 0; i < combinedData.length; i++) {
    combinedBytes[i] = combinedData.charCodeAt(i);
  }
  
  // 提取盐（前8字节）
  const salt = combinedBytes.slice(0, 8);
  const encryptedBytes = combinedBytes.slice(8);
  
  // 创建扩展密钥
  const extendedKey = SECRET_KEY + Array.from(salt).map(b => String.fromCharCode(b)).join('');
  
  // XOR解密
  const decryptedBytes = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    const keyChar = extendedKey.charCodeAt(i % extendedKey.length);
    decryptedBytes[i] = encryptedBytes[i] ^ keyChar;
  }
  
  // UTF-8解码
  return new TextDecoder().decode(decryptedBytes);
}

/**
 * 旧版本解密（向后兼容）
 */
function decryptMessageV1(encryptedMessage: string): string {
  const base64Data = encryptedMessage.substring(4);
  const encryptedData = atob(base64Data);
  
  const encryptedBytes = new Uint8Array(encryptedData.length);
  for (let i = 0; i < encryptedData.length; i++) {
    encryptedBytes[i] = encryptedData.charCodeAt(i);
  }
  
  const decryptedBytes = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    const keyChar = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    decryptedBytes[i] = encryptedBytes[i] ^ keyChar;
  }
  
  return new TextDecoder().decode(decryptedBytes);
}

/**
 * 判断消息是否已加密
 * @param message - 待判断的消息
 * @returns 如果已加密返回true
 */
export function isEncrypted(message: string): boolean {
  try {
    // 支持新旧两种加密格式
    return message.startsWith('ENC2_') || message.startsWith('ENC_');
  } catch (error) {
    return false;
  }
}

/**
 * 获取加密版本信息
 * @param message - 消息
 * @returns 加密版本 ('v1', 'v2', 'none')
 */
export function getEncryptionVersion(message: string): 'v1' | 'v2' | 'none' {
  if (message.startsWith('ENC2_')) return 'v2';
  if (message.startsWith('ENC_')) return 'v1';
  return 'none';
}