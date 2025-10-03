import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { generateQRData, storeQRSession, getUser, createUser, updateUserChallenge } from '../../../lib/qr-session';

const rpName = process.env.RP_NAME || 'My WebAuthn App';
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
  console.log('📝 REGISTRATION OPTIONS REQUEST');
  console.log('Time (UTC):', new Date().toISOString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { username, useQR } = req.body;

    if (!username) {
      console.log('❌ No username provided');
      return res.status(400).json({ error: 'Username required' });
    }

    console.log('👤 Username:', username);
    console.log('📱 Use QR:', useQR || false);

    // Get user or create new one
    let user = await getUser(username);
    if (!user) {
      console.log('✨ User does not exist, creating...');
      user = await createUser(username);
    } else {
      console.log('✅ User found with', user.credentials.length, 'credentials');
    }

    // Convert credential IDs from base64url strings to Buffers for excludeCredentials
    const excludeCredentials = user.credentials.map((cred: any) => {
      // Convert base64url string back to Buffer
      const credentialIdBuffer = Buffer.from(
        cred.credentialID
          .replace(/-/g, '+')
          .replace(/_/g, '/'),
        'base64'
      );

      return {
        id: credentialIdBuffer,
        type: 'public-key' as const,
        transports: cred.transports || [],
      };
    });

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'discouraged',
        authenticatorAttachment: useQR ? undefined : 'platform',
      },
      excludeCredentials,
    });

    console.log('🔑 Challenge generated:', options.challenge.substring(0, 20) + '...');
    console.log('🔐 User verification:', options.authenticatorSelection?.userVerification);

    // Store challenge
    await updateUserChallenge(username, options.challenge);

    // If QR code flow, generate session
    if (useQR) {
      const qrData = generateQRData({
        type: 'register',
        username,
        options,
        rpID,
        origin,
      });
      
      await storeQRSession(qrData.sessionId, {
        type: 'register',
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
    console.error('❌ REGISTRATION OPTIONS ERROR:', error);
    console.error('Stack:', error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}