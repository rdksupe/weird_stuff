export const rpID = process.env.RP_ID || 'localhost';
export const rpName = 'WebAuthn QR Demo';
export const origin = process.env.ORIGIN || 'http://localhost:3000';

// Android app configuration
export const androidPackageName = process.env.ANDROID_PACKAGE_NAME || 'com.dashlane.dashlanepasskeydemo';
export const androidOrigin = process.env.ANDROID_APP_ORIGIN || '';

// All allowed origins
export const allowedOrigins = [
  origin,
  androidOrigin,
  'http://localhost:3000', // For local development
].filter(Boolean); // Remove empty strings

export const timeout = 60000;

// Helper function to check if origin is allowed
export function isOriginAllowed(checkOrigin: string): boolean {
  return allowedOrigins.some(allowed => 
    allowed === checkOrigin || 
    (allowed.startsWith('android:apk-key-hash:') && checkOrigin.startsWith('android:apk-key-hash:'))
  );
}