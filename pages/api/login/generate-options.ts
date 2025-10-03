import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { generateQRData, storeQRSession, getUser, updateUserChallenge } from '../../../lib/qr-session';

const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || 'http://localhost:3000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔓 LOGIN OPTIONS REQUEST');
  console.log('Time (UTC):', new Date().toISOString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { username, useQR } = req.body;

    console.log('👤 Username:', username);
    console.log('📱 Use QR:', useQR || false);

    const user = await getUser(username);
    if (!user || user.credentials.length === 0) {
      console.log('❌ User not found or no credentials for:', username);
      return res.status(400).json({ error: 'User not found or no credentials' });
    }

    console.log('✅ User found with', user.credentials.length, 'credentials');

    // Log credential details
    user.credentials.forEach((cred, index) => {
      console.log(`📋 Credential ${index + 1}:`);
      console.log('  - ID (string):', cred.credentialID);
      console.log('  - ID type:', typeof cred.credentialID);
      console.log('  - Transports:', cred.transports);
    });

    // Convert credential IDs from base64url strings to Buffers
    const allowCredentials = user.credentials.map((cred: any) => {
      // Convert base64url string back to Buffer
      const credentialIdBuffer = Buffer.from(
        cred.credentialID
          .replace(/-/g, '+')
          .replace(/_/g, '/'),
        'base64'
      );

      console.log('🔄 Converting credential:');
      console.log('  - From (base64url):', cred.credentialID);
      console.log('  - To Buffer length:', credentialIdBuffer.length);

      return {
        id: credentialIdBuffer,
        type: 'public-key' as const,
        transports: cred.transports || [],
      };
    });

    console.log('✅ Converted', allowCredentials.length, 'credentials to Buffers');

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    console.log('🔑 Challenge generated:', options.challenge.substring(0, 20) + '...');
    console.log('🔐 User verification:', options.userVerification);
    console.log('📋 Allow credentials count:', options.allowCredentials?.length || 0);
    
    // Log the first credential ID in the options (for debugging)
    if (options.allowCredentials && options.allowCredentials.length > 0) {
      const firstCredId = options.allowCredentials[0].id;
      console.log('🆔 First credential ID in options:', firstCredId);
      console.log('🆔 First credential ID type:', typeof firstCredId);
      console.log('🆔 First credential ID is Buffer:', Buffer.isBuffer(firstCredId));
    }

    await updateUserChallenge(username, options.challenge);

    // If QR code flow, generate session
    if (useQR) {
      const qrData = generateQRData({
        type: 'login',
        username,
        options,
        rpID,
        origin,
      });
      
      await storeQRSession(qrData.sessionId, {
        type: 'login',
        username,
        challenge: options.challenge,
        status: 'pending',
        createdAt: Date.now(),
      });

      console.log('📱 QR session created:', qrData.sessionId);
      console.log('⏱️ Request completed in', Date.now() - startTime, 'ms');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return res.status(200).json({
        ...options,
        qrData,
      });
    }

    console.log('⏱️ Request completed in', Date.now() - startTime, 'ms');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return res.status(200).json(options);
  } catch (error: any) {
    console.error('❌ LOGIN OPTIONS ERROR:', error);
    console.error('Stack:', error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}