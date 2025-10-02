import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getQRSession, updateQRSession, getUser, updateCredentialCounter } from '../../../lib/qr-session';

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
    // Handle QR-based login from mobile
    // ============================================
    if (sessionId) {
      console.log('📱 Processing QR-based login');
      
      const session = await getQRSession(sessionId);
      if (!session || session.type !== 'login') {
        console.log('❌ Invalid or expired QR session');
        return res.status(400).json({ error: 'Invalid session' });
      }

      if (session.status === 'completed') {
        console.log('❌ Session already completed');
        return res.status(400).json({ error: 'Session already completed' });
      }

      console.log('✅ QR session valid, username:', session.username);

      const user = await getUser(session.username);
      if (!user) {
        console.log('❌ User not found:', session.username);
        return res.status(400).json({ error: 'User not found' });
      }

      console.log('✅ User has', user.credentials.length, 'credentials');

      const expectedChallenge = session.challenge;
      console.log('🔑 Expected challenge:', expectedChallenge.substring(0, 20) + '...');

      // Find matching credential - direct string comparison (both base64url)
      console.log('🔍 Looking for credential ID:', credential.id);
      console.log('🔍 Available credentials:', user.credentials.map((c: any) => c.credentialID));

      const userCredential = user.credentials.find((cred: any) => {
        return cred.credentialID === credential.id;
      });

      if (!userCredential) {
        console.log('❌ Credential not found for user');
        console.log('Looking for:', credential.id);
        console.log('Available:', user.credentials.map((c: any) => c.credentialID));
        return res.status(400).json({ error: 'Credential not found' });
      }

      console.log('✅ Credential found, verifying authentication...');
      console.log('🔐 Stored counter:', userCredential.counter);

      let verification;
      try {
        // Convert base64url string back to Buffer for verification
        const credentialIdBuffer = Buffer.from(
          userCredential.credentialID
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
          'base64'
        );

        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          authenticator: {
            credentialID: credentialIdBuffer,
            credentialPublicKey: userCredential.credentialPublicKey,
            counter: userCredential.counter,
          },
          requireUserVerification: false,
        });
      } catch (verifyError: any) {
        console.error('❌ Verification threw error:', verifyError.message);
        console.error('Error stack:', verifyError.stack);
        return res.status(400).json({ 
          error: 'Verification failed', 
          details: verifyError.message 
        });
      }

      console.log('🔍 Verification result:', verification.verified);
      
      if (verification.authenticationInfo) {
        console.log('🔢 New counter:', verification.authenticationInfo.newCounter);
      }

      if (verification.verified) {
        await updateCredentialCounter(
          session.username,
          credential.id,
          verification.authenticationInfo.newCounter
        );

        await updateQRSession(sessionId, { 
          status: 'completed', 
          verified: true,
          completedAt: Date.now(),
        });

        console.log('✅ Login successful for:', session.username);
        console.log('⏱️ Request completed in', Date.now() - startTime, 'ms');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        return res.status(200).json({ verified: true });
      }

      await updateQRSession(sessionId, { status: 'failed', verified: false });
      console.log('❌ Verification failed');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return res.status(400).json({ verified: false });
    }

    // ============================================
    // Handle regular login (same device)
    // ============================================
    console.log('💻 Processing regular login');
    
    if (!username) {
      console.log('❌ No username provided');
      return res.status(400).json({ error: 'Username required' });
    }

    if (!credential) {
      console.log('❌ No credential provided');
      return res.status(400).json({ error: 'Credential required' });
    }
    
    const user = await getUser(username);
    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(400).json({ error: 'User not found' });
    }

    console.log('✅ User has', user.credentials.length, 'credentials');

    const expectedChallenge = user.currentChallenge;
    if (!expectedChallenge) {
      console.log('❌ No challenge found for user');
      return res.status(400).json({ error: 'No challenge found. Please try login again.' });
    }

    console.log('🔑 Expected challenge:', expectedChallenge.substring(0, 20) + '...');
    console.log('🌐 Expected origin:', origin);
    console.log('🏢 Expected RP ID:', rpID);

    // Find matching credential - direct string comparison (both base64url)
    console.log('🔍 Looking for credential ID:', credential.id);
    console.log('🔍 Available credentials:', user.credentials.map((c: any) => c.credentialID));

    const userCredential = user.credentials.find((cred: any) => {
      return cred.credentialID === credential.id;
    });

    if (!userCredential) {
      console.log('❌ Credential not found for user');
      console.log('Looking for:', credential.id);
      console.log('Available:', user.credentials.map((c: any) => c.credentialID));
      return res.status(400).json({ error: 'Credential not found' });
    }

    console.log('✅ Credential found, verifying authentication...');
    console.log('🔐 Stored counter:', userCredential.counter);

    let verification;
    try {
      // Convert base64url string back to Buffer for verification
      const credentialIdBuffer = Buffer.from(
        userCredential.credentialID
          .replace(/-/g, '+')
          .replace(/_/g, '/'),
        'base64'
      );

      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: credentialIdBuffer,
          credentialPublicKey: userCredential.credentialPublicKey,
          counter: userCredential.counter,
        },
        requireUserVerification: false,
      });
    } catch (verifyError: any) {
      console.error('❌ Verification threw error:', verifyError.message);
      console.error('Error stack:', verifyError.stack);
      return res.status(400).json({ 
        error: 'Verification failed', 
        details: verifyError.message 
      });
    }

    console.log('🔍 Verification result:', verification.verified);
    
    if (verification.authenticationInfo) {
      console.log('🔢 New counter:', verification.authenticationInfo.newCounter);
    }

    if (verification.verified) {
      await updateCredentialCounter(
        username,
        credential.id,
        verification.authenticationInfo.newCounter
      );

      console.log('✅ Login successful for:', username);
      console.log('⏱️ Request completed in', Date.now() - startTime, 'ms');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return res.status(200).json({ verified: true });
    }

    console.log('❌ Verification failed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return res.status(400).json({ verified: false, error: 'Verification failed' });
    
  } catch (error: any) {
    console.error('❌ LOGIN VERIFICATION ERROR:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return res.status(500).json({ 
      error: 'Verification failed', 
      details: error.message,
      name: error.name 
    });
  }
}