import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getQRSession, updateQRSession, getUser, updateCredentialCounter } from '../../../lib/qr-session';

const rpID = process.env.RP_ID || 'localhost';
const webOrigin = process.env.ORIGIN || 'http://localhost:3000';

// 👇 Add your APK key hash origin here (base64url, not hex or base64 with +/=)
const androidApkHash =
  process.env.ANDROID_APK_HASH ||
  'H8aaJx3lOZCaxVnsZU5__ALkVjXJALA11rtegEE0Ldc';

// 👇 Valid origins (web + android)
const expectedOrigins = [webOrigin, `android:apk-key-hash:${androidApkHash}`];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ LOGIN VERIFY REQUEST');
  console.log('Time (UTC):', new Date().toISOString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { username, credential, sessionId } = req.body;

    console.log('👤 Username:', username);
    console.log('📱 Session ID:', sessionId || 'N/A');
    console.log('🔐 Has Credential:', !!credential);

    if (credential) {
      console.log('🔍 Credential ID:', credential.id);
      console.log('🔍 Credential Type:', credential.type);
    }

    // ============================================
    // Handle QR-based login
    // ============================================
    if (sessionId) {
      console.log('📱 Processing QR-based login');

      const session = await getQRSession(sessionId);
      if (!session || session.type !== 'login') {
        return res.status(400).json({ error: 'Invalid session' });
      }
      if (session.status === 'completed') {
        return res.status(400).json({ error: 'Session already completed' });
      }

      const user = await getUser(session.username);
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      const expectedChallenge = session.challenge;

      const userCredential = user.credentials.find((cred: any) => cred.credentialID === credential.id);
      if (!userCredential) {
        return res.status(400).json({ error: 'Credential not found' });
      }

      let verification;
      try {
        const credentialIdBuffer = Buffer.from(
          userCredential.credentialID.replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        );

        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin: expectedOrigins, // ✅ Accept both
          expectedRPID: rpID,
          authenticator: {
            credentialID: credentialIdBuffer,
            credentialPublicKey: userCredential.credentialPublicKey,
            counter: userCredential.counter,
          },
          requireUserVerification: false,
        });
      } catch (err: any) {
        return res.status(400).json({ error: 'Verification failed', details: err.message });
      }

      if (verification.verified) {
        await updateCredentialCounter(session.username, credential.id, verification.authenticationInfo.newCounter);
        await updateQRSession(sessionId, { status: 'completed', verified: true, completedAt: Date.now() });
        return res.status(200).json({ verified: true });
      }

      await updateQRSession(sessionId, { status: 'failed', verified: false });
      return res.status(400).json({ verified: false });
    }

    // ============================================
    // Handle regular login (same device)
    // ============================================
    console.log('💻 Processing regular login');

    if (!username || !credential) {
      return res.status(400).json({ error: 'Username and credential required' });
    }

    const user = await getUser(username);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const expectedChallenge = user.currentChallenge;
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No challenge found. Please try login again.' });
    }

    const userCredential = user.credentials.find((cred: any) => cred.credentialID === credential.id);
    if (!userCredential) {
      return res.status(400).json({ error: 'Credential not found' });
    }

    let verification;
    try {
      const credentialIdBuffer = Buffer.from(
        userCredential.credentialID.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      );

      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: expectedOrigins, // ✅ Accept both
        expectedRPID: rpID,
        authenticator: {
          credentialID: credentialIdBuffer,
          credentialPublicKey: userCredential.credentialPublicKey,
          counter: userCredential.counter,
        },
        requireUserVerification: false,
      });
    } catch (err: any) {
      return res.status(400).json({ error: 'Verification failed', details: err.message });
    }

    if (verification.verified) {
      await updateCredentialCounter(username, credential.id, verification.authenticationInfo.newCounter);
      return res.status(200).json({ verified: true });
    }

    return res.status(400).json({ verified: false, error: 'Verification failed' });

  } catch (error: any) {
    return res.status(500).json({ error: 'Verification failed', details: error.message });
  }
}
