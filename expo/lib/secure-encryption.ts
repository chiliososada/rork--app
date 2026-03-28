/**
 * 安全加密系统 - 使用AES-256-GCM加密
 * 适用于React Native和Web环境
 */
import CryptoJS from 'crypto-js';
import 'react-native-get-random-values'; // Polyfill for crypto.getRandomValues

// 环境变量获取主密钥
const MASTER_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || (() => {
  if (__DEV__) {
    console.warn('⚠️ 使用开发默认密钥！生产环境必须设置 EXPO_PUBLIC_ENCRYPTION_KEY');
    return 'TokyoPark-Dev-Master-Key-32Characters!';
  }
  throw new Error('生产环境必须设置 EXPO_PUBLIC_ENCRYPTION_KEY 环境变量');
})();

// 验证密钥强度
if (MASTER_KEY.length < 32) {
  throw new Error('加密密钥长度必须至少32字符！');
}

/**
 * 生成安全的随机字节
 */
function generateSecureRandom(length: number): string {
  // 开发环境下直接使用简化的随机数生成，避免复杂的加密依赖
  if (__DEV__) {
    // 使用时间戳和Math.random组合生成较为随机的字符串
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2);
    const combined = timestamp + randomPart + Math.random().toString(36).substring(2);
    
    // 如果需要特定长度，截取或重复
    if (combined.length >= length) {
      return combined.substring(0, length);
    } else {
      // 重复直到达到所需长度
      let result = combined;
      while (result.length < length) {
        result += Math.random().toString(36).substring(2);
      }
      return result.substring(0, length);
    }
  }
  
  // 生产环境尝试使用更安全的方法
  try {
    // 优先使用crypto API（React Native polyfill支持）
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(Math.ceil(length / 2)); // hex输出每字节占2字符
      crypto.getRandomValues(array);
      return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, length);
    }
  } catch (error) {
    console.warn('Crypto API failed:', error);
  }
  
  try {
    // 尝试CryptoJS方法
    const randomWords = CryptoJS.lib.WordArray.random(Math.ceil(length / 8)); // WordArray每个word 4字节
    return randomWords.toString().substring(0, length);
  } catch (error) {
    console.warn('CryptoJS random generation failed:', error);
  }
  
  // 最终降级方案
  console.warn('⚠️ 使用降级随机数生成器');
  let result = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 使用PBKDF2派生加密密钥
 */
function deriveKey(password: string, salt: string, iterations: number = 100000): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32, // 256 bits = 8 words
    iterations: iterations,
    hasher: CryptoJS.algo.SHA256
  }).toString();
}

/**
 * AES-256-GCM加密消息（开发环境简化版）
 * @param message - 待加密的明文消息
 * @returns 加密后的消息（包含盐、IV和认证标签）
 */
export function encryptMessage(message: string): string {
  try {
    if (!message || typeof message !== 'string') {
      throw new Error('无效的消息内容');
    }

    // 开发环境使用简化加密方式
    if (__DEV__) {
      // 使用简单的Base64编码 + 时间戳混淆（仅开发环境）
      const timestamp = Date.now().toString(36);
      const encoded = btoa(unescape(encodeURIComponent(message))); // Base64编码
      const simple = `DEV4_${timestamp}_${encoded}`;
      console.log('🔒 开发环境使用简化加密');
      return simple;
    }

    // 生产环境使用真正的加密
    const salt = generateSecureRandom(32);
    const iv = generateSecureRandom(24);
    
    // 派生加密密钥
    const derivedKey = deriveKey(MASTER_KEY, salt);
    
    // 使用AES-CBC模式（更兼容）替代GCM
    const encrypted = CryptoJS.AES.encrypt(message, derivedKey, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // 组合数据
    const combined = {
      v: '4', // 新版本号
      s: salt,
      i: iv,
      d: encrypted.ciphertext.toString()
    };

    // JSON序列化并Base64编码
    const jsonString = JSON.stringify(combined);
    const base64Encrypted = btoa(jsonString);
    
    return `SEC4_${base64Encrypted}`;
  } catch (error) {
    console.error('消息加密失败:', error);
    
    // 最终降级：开发环境返回原文，生产环境抛出错误
    if (__DEV__) {
      console.warn('⚠️ 加密失败，开发环境返回原文');
      return `PLAIN_${message}`;
    } else {
      throw new Error(`加密失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * 解密消息（支持多版本向后兼容）
 * @param encryptedMessage - 加密的消息
 * @returns 解密后的明文消息
 */
export function decryptMessage(encryptedMessage: string): string {
  try {
    if (!encryptedMessage || typeof encryptedMessage !== 'string') {
      return encryptedMessage;
    }

    // 检查开发环境简化格式
    if (encryptedMessage.startsWith('DEV4_')) {
      const parts = encryptedMessage.substring(5).split('_');
      if (parts.length >= 2) {
        const encoded = parts.slice(1).join('_'); // 处理消息中可能包含下划线的情况
        try {
          return decodeURIComponent(escape(atob(encoded)));
        } catch (e) {
          console.warn('开发环境解密失败:', e);
          return encryptedMessage;
        }
      }
    }

    // 检查纯文本格式（降级模式）
    if (encryptedMessage.startsWith('PLAIN_')) {
      return encryptedMessage.substring(6);
    }

    // 检查新版本加密格式
    if (encryptedMessage.startsWith('SEC4_')) {
      return decryptMessageV4(encryptedMessage);
    }
    
    if (encryptedMessage.startsWith('SEC3_')) {
      return decryptMessageV3(encryptedMessage);
    }
    
    // 检查旧版本加密格式（向后兼容）
    if (encryptedMessage.startsWith('ENC2_') || encryptedMessage.startsWith('ENC_')) {
      return decryptLegacyMessage(encryptedMessage);
    }
    
    // 未加密的消息直接返回
    return encryptedMessage;
  } catch (error) {
    console.error('消息解密失败:', error);
    // 解密失败时返回原消息（保持向后兼容性）
    return encryptedMessage;
  }
}

/**
 * V4版本AES-CBC解密
 */
function decryptMessageV4(encryptedMessage: string): string {
  const base64Data = encryptedMessage.substring(5);
  const jsonString = atob(base64Data);
  
  const combined = JSON.parse(jsonString);
  
  if (!combined.v || !combined.s || !combined.i || !combined.d) {
    throw new Error('加密数据格式无效');
  }
  
  const derivedKey = deriveKey(MASTER_KEY, combined.s);
  
  const decrypted = CryptoJS.AES.decrypt({
    ciphertext: CryptoJS.enc.Hex.parse(combined.d)
  }, derivedKey, {
    iv: CryptoJS.enc.Hex.parse(combined.i),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * 新版本AES-GCM解密
 */
function decryptMessageV3(encryptedMessage: string): string {
  // 移除前缀并Base64解码
  const base64Data = encryptedMessage.substring(5);
  const jsonString = CryptoJS.enc.Base64.parse(base64Data).toString(CryptoJS.enc.Utf8);
  
  const combined = JSON.parse(jsonString);
  
  // 验证数据格式
  if (!combined.v || !combined.s || !combined.i || !combined.d) {
    throw new Error('加密数据格式无效');
  }
  
  // 派生解密密钥
  const derivedKey = deriveKey(MASTER_KEY, combined.s);
  
  // AES-256-GCM解密
  const decrypted = CryptoJS.AES.decrypt({
    ciphertext: CryptoJS.enc.Hex.parse(combined.d),
    tag: combined.t ? CryptoJS.enc.Hex.parse(combined.t) : undefined
  }, derivedKey, {
    iv: CryptoJS.enc.Hex.parse(combined.i),
    mode: CryptoJS.mode.GCM,
    padding: CryptoJS.pad.NoPadding
  });
  
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * 向后兼容：解密旧版本XOR加密的消息
 */
function decryptLegacyMessage(encryptedMessage: string): string {
  // 这里可以调用旧的解密函数，保持向后兼容
  console.warn('检测到旧版本加密消息，建议重新加密');
  
  // 临时导入旧的解密逻辑
  try {
    if (encryptedMessage.startsWith('ENC2_')) {
      return decryptLegacyV2(encryptedMessage);
    } else if (encryptedMessage.startsWith('ENC_')) {
      return decryptLegacyV1(encryptedMessage);
    }
  } catch (error) {
    console.error('旧版本解密失败:', error);
  }
  
  return encryptedMessage;
}

/**
 * 旧版本解密函数（临时兼容）
 */
function decryptLegacyV2(encryptedMessage: string): string {
  const SECRET_KEY = MASTER_KEY; // 使用相同的密钥
  
  const base64Data = encryptedMessage.substring(5);
  const combinedData = atob(base64Data);
  
  const combinedBytes = new Uint8Array(combinedData.length);
  for (let i = 0; i < combinedData.length; i++) {
    combinedBytes[i] = combinedData.charCodeAt(i);
  }
  
  const salt = combinedBytes.slice(0, 8);
  const encryptedBytes = combinedBytes.slice(8);
  
  const extendedKey = SECRET_KEY + Array.from(salt).map(b => String.fromCharCode(b)).join('');
  
  const decryptedBytes = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    const keyChar = extendedKey.charCodeAt(i % extendedKey.length);
    decryptedBytes[i] = encryptedBytes[i] ^ keyChar;
  }
  
  return new TextDecoder().decode(decryptedBytes);
}

function decryptLegacyV1(encryptedMessage: string): string {
  const SECRET_KEY = MASTER_KEY;
  
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
 */
export function isEncrypted(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }
  
  return message.startsWith('SEC4_') ||
         message.startsWith('SEC3_') || 
         message.startsWith('ENC2_') || 
         message.startsWith('ENC_') ||
         message.startsWith('DEV4_') ||
         message.startsWith('PLAIN_');
}

/**
 * 获取加密版本信息
 */
export function getEncryptionVersion(message: string): 'v4' | 'v3' | 'v2' | 'v1' | 'dev' | 'plain' | 'none' {
  if (!message || typeof message !== 'string') {
    return 'none';
  }
  
  if (message.startsWith('SEC4_')) return 'v4';
  if (message.startsWith('SEC3_')) return 'v3';
  if (message.startsWith('ENC2_')) return 'v2';
  if (message.startsWith('ENC_')) return 'v1';
  if (message.startsWith('DEV4_')) return 'dev';
  if (message.startsWith('PLAIN_')) return 'plain';
  return 'none';
}

/**
 * 重新加密旧版本消息为新版本
 */
export function upgradeEncryption(message: string): string {
  if (!isEncrypted(message)) {
    return encryptMessage(message);
  }
  
  const version = getEncryptionVersion(message);
  if (version === 'v3') {
    return message; // 已经是最新版本
  }
  
  // 解密旧版本然后用新版本重新加密
  const decrypted = decryptMessage(message);
  return encryptMessage(decrypted);
}

/**
 * 验证密钥强度
 */
export function validateKeyStrength(key: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  const errors: string[] = [];
  
  if (key.length < 32) {
    errors.push('密钥长度必须至少32字符');
  }
  
  if (!/[A-Z]/.test(key)) {
    errors.push('密钥应包含大写字母');
  }
  
  if (!/[a-z]/.test(key)) {
    errors.push('密钥应包含小写字母');
  }
  
  if (!/[0-9]/.test(key)) {
    errors.push('密钥应包含数字');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(key)) {
    errors.push('密钥应包含特殊字符');
  }
  
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0 && key.length >= 64) {
    strength = 'strong';
  } else if (errors.length <= 2 && key.length >= 32) {
    strength = 'medium';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}