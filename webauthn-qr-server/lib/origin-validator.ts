const WEB_ORIGIN = process.env.ORIGIN || 'http://localhost:3000';
const ANDROID_PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || '';
const ANDROID_APK_KEY_HASHES = process.env.ANDROID_APK_KEY_HASHES 
  ? process.env.ANDROID_APK_KEY_HASHES.split(',').map(h => h.trim())
  : [];

interface OriginValidationResult {
  valid: boolean;
  reason?: string;
  type?: 'web' | 'android';
}

/**
 * Validates if the received origin is from an authorized source
 * Accepts either:
 * 1. The configured web origin (for browser/QR flow)
 * 2. Android origins matching the configured package and APK signature
 */
export function validateOrigin(receivedOrigin: string): OriginValidationResult {
  // Check web origin
  if (receivedOrigin === WEB_ORIGIN) {
    return { valid: true, type: 'web' };
  }

  // Check Android origin format
  if (receivedOrigin.startsWith('android:apk-key-hash:')) {
    // Extract the hash from the origin
    const apkKeyHash = receivedOrigin.replace('android:apk-key-hash:', '');

    // Validate against configured hashes
    if (ANDROID_APK_KEY_HASHES.length === 0) {
      return {
        valid: false,
        reason: 'No Android APK key hashes configured on server'
      };
    }

    if (!ANDROID_APK_KEY_HASHES.includes(apkKeyHash)) {
      return {
        valid: false,
        reason: `APK key hash ${apkKeyHash} not in allowed list. Expected one of: ${ANDROID_APK_KEY_HASHES.join(', ')}`
      };
    }

    return { valid: true, type: 'android' };
  }

  // Invalid origin
  return {
    valid: false,
    reason: `Origin ${receivedOrigin} not recognized. Expected ${WEB_ORIGIN} or android:apk-key-hash:<hash>`
  };
}

/**
 * Get the expected origin for verification based on the received origin
 * This is needed because Android and web use different origin formats
 */
export function getExpectedOriginForVerification(receivedOrigin: string): string {
  // For Android, we need to use the actual received origin (with the specific hash)
  if (receivedOrigin.startsWith('android:apk-key-hash:')) {
    return receivedOrigin;
  }
  
  // For web, use the configured web origin
  return WEB_ORIGIN;
}

/**
 * Extract origin from credential's clientDataJSON
 */
export function extractOriginFromCredential(credential: any): string | null {
  try {
    if (credential.response?.clientDataJSON) {
      const clientDataJSON = JSON.parse(
        Buffer.from(credential.response.clientDataJSON, 'base64').toString('utf-8')
      );
      return clientDataJSON.origin;
    }
  } catch (error) {
    console.error('Error extracting origin from credential:', error);
  }
  return null;
}