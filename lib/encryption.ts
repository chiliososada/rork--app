// React Native対応の簡易暗号化実装
// 注意: これは基本的な難読化であり、本格的な暗号化ではありません
// 本番環境では、より強力な暗号化ライブラリの使用を検討してください

const SECRET_KEY = 'TokyoPark-E2EE-Secret-Key-2024';

/**
 * 簡易的な文字列暗号化（XOR + Base64エンコード）
 * @param message - 暗号化するメッセージ
 * @returns 暗号化されたメッセージ
 */
export function encryptMessage(message: string): string {
  try {
    // UTF-8エンコードしてからXOR暗号化
    const utf8Message = new TextEncoder().encode(message);
    const encryptedBytes = new Uint8Array(utf8Message.length);
    
    for (let i = 0; i < utf8Message.length; i++) {
      const keyChar = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      encryptedBytes[i] = utf8Message[i] ^ keyChar;
    }
    
    // Base64エンコードして返す
    const base64Encrypted = btoa(String.fromCharCode(...encryptedBytes));
    return `ENC_${base64Encrypted}`; // プレフィックスを付けて暗号化済みであることを示す
  } catch (error) {
    console.error('メッセージの暗号化に失敗:', error);
    // 暗号化に失敗した場合は元のメッセージを返す（開発段階では継続性を重視）
    return message;
  }
}

/**
 * 簡易的な文字列復号化（Base64デコード + XOR）
 * @param encryptedMessage - 復号化する暗号化メッセージ
 * @returns 復号化されたメッセージ
 */
export function decryptMessage(encryptedMessage: string): string {
  try {
    // 暗号化されたメッセージかどうかを確認
    if (!encryptedMessage.startsWith('ENC_')) {
      // 暗号化されていない場合はそのまま返す（既存の平文メッセージ対応）
      return encryptedMessage;
    }
    
    // プレフィックスを削除してBase64デコード
    const base64Data = encryptedMessage.substring(4);
    const encryptedData = atob(base64Data);
    
    // 文字列をUint8Arrayに変換
    const encryptedBytes = new Uint8Array(encryptedData.length);
    for (let i = 0; i < encryptedData.length; i++) {
      encryptedBytes[i] = encryptedData.charCodeAt(i);
    }
    
    // XOR復号化
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      const keyChar = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      decryptedBytes[i] = encryptedBytes[i] ^ keyChar;
    }
    
    // UTF-8デコードして文字列に戻す
    const decrypted = new TextDecoder().decode(decryptedBytes);
    return decrypted;
  } catch (error) {
    console.error('メッセージの復号化に失敗:', error);
    // 復号化に失敗した場合は元のメッセージを返す
    return encryptedMessage;
  }
}

/**
 * メッセージが暗号化されているかどうかを判定します
 * @param message - 判定するメッセージ
 * @returns 暗号化されている場合はtrue
 */
export function isEncrypted(message: string): boolean {
  try {
    // 新しい暗号化方式では 'ENC_' プレフィックスで判定
    return message.startsWith('ENC_');
  } catch (error) {
    return false;
  }
}