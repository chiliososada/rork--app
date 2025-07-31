// グローバル型定義
// React NativeとWebでの型の違いを統一

declare global {
  // タイマー関数の戻り値型を統一
  type TimerHandle = ReturnType<typeof setTimeout>;
  type IntervalHandle = ReturnType<typeof setInterval>;
  type Timeout = ReturnType<typeof setTimeout>;
  
  // React Native / Expo 環境変数
  const __DEV__: boolean;
}

// Module declarations for libraries without type definitions
declare module 'crypto-js' {
  interface CryptoJSStatic {
    AES: {
      encrypt(message: string, secretPassphrase: string): any;
      decrypt(encryptedMessage: any, secretPassphrase: string): any;
    };
    PBKDF2: (password: string, salt: string, config: { keySize: number; iterations: number; hasher: any }) => any;
    enc: {
      Utf8: {
        stringify(words: any): string;
      };
    };
    lib: {
      WordArray: {
        create(array: Uint8Array): any;
        random(bytes: number): any;
      };
    };
    algo: {
      SHA256: any;
    };
  }
  const CryptoJS: CryptoJSStatic;
  export default CryptoJS;
}

export {};