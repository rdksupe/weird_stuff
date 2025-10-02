import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getQRSession, updateQRSession, getUser, addCredentialToUser } from '../../../lib/qr-session';

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
  console.log('✅ REGISTRATION VERIFY REQUEST');
  console.log('Time (UTC):', new Date().toISOString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { username, credential, sessionId } = req.body;

    console.log('👤 Username:', username);
    console.log('📱 Session ID:', sessionId || 'N/A');
    console.log('🔐 Has Credential:', !!credential);
    
    if (credential) {
      console.log('🔍 Credential ID:', credential.id?.substring(0, 30) + '...');
      console.log('🔍 Credential Type:', credential.type);
      console.log('🔍 Response Keys:', Object.keys(credential.response || {}));
    }

    // ============================================
    // Handle QR-based registration from mobile
    // ============================================
    if (sessionId) {
      console.log('📱 Processing QR-based registration');
      
      const session = await getQRSession(sessionId);
      if (!session || session.type !== 'register') {
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

      const expectedChallenge = session.challenge;
      console.log('🔑 Expected challenge:', expectedChallenge.substring(0, 20) + '...');
      console.log('🌐 Expected origin:', origin);
      console.log('🏢 Expected RP ID:', rpID);

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: false, // ← Don't require UV
        });
      } catch (verifyError: any) {
        console.error('❌ Verification threw error:', verifyError.message);
        return res.status(400).json({ 
          error: 'Verification failed', 
          details: verifyError.message 
        });
      }

      console.log('🔍 Verification result:', verification.verified);

      if (verification.verified && verification.registrationInfo) {
        const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

        console.log('➕ Adding credential to user:', session.username);
        console.log('🆔 Credential ID length:', credentialID.length);
        console.log('🔑 Public key length:', credentialPublicKey.length);
        console.log('🔢 Counter:', counter);
        
        try {
          await addCredentialToUser(session.username, {
            credentialID,
            credentialPublicKey,
            counter,
            transports: credential.response.transports || [],
            createdViaQR: true,
          });
          
          console.log('✅ Credential successfully added!');
        } catch (addError: any) {
          console.error('❌ Failed to add credential:', addError.message);
          console.error('Stack:', addError.stack);
          return res.status(500).json({ 
            error: 'Failed to save credential',
            details: addError.message 
          });
        }

        await updateQRSession(sessionId, { status: 'completed', verified: true });

        console.log('✅ Registration successful for:', session.username);
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
    // Handle regular registration (same device)
    // ============================================
    console.log('💻 Processing regular registration');
    
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

    const expectedChallenge = user.currentChallenge;
    if (!expectedChallenge) {
      console.log('❌ No challenge found for user');
      return res.status(400).json({ error: 'No challenge found. Please try registration again.' });
    }

    console.log('🔑 Expected challenge:', expectedChallenge.substring(0, 20) + '...');
    console.log('🌐 Expected origin:', origin);
    console.log('🏢 Expected RP ID:', rpID);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false, // ← Don't require UV
      });
    } catch (verifyError: any) {
      console.error('❌ Verification threw error:', verifyError.message);
      console.error('Error details:', verifyError);
      return res.status(400).json({ 
        error: 'Verification failed', 
        details: verifyError.message 
      });
    }

    console.log('🔍 Verification result:', verification.verified);
    
    if (verification.registrationInfo) {
      console.log('📋 Registration info received:');
      console.log('  - Credential ID length:', verification.registrationInfo.credentialID.length);
      console.log('  - Public key length:', verification.registrationInfo.credentialPublicKey.length);
      console.log('  - Counter:', verification.registrationInfo.counter);
    }

    if (verification.verified && verification.registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

      console.log('➕ Adding credential to user:', username);
      
      try {
        await addCredentialToUser(username, {
          credentialID,
          credentialPublicKey,
          counter,
          transports: credential.response?.transports || [],
        });
        
        console.log('✅ Credential successfully added to database!');
        
        // Verify it was added
        const updatedUser = await getUser(username);
        console.log('🔍 Verification: User now has', updatedUser?.credentials.length, 'credentials');
        
      } catch (addError: any) {
        console.error('❌ Failed to add credential:', addError.message);
        console.error('Stack:', addError.stack);
        return res.status(500).json({ 
          error: 'Failed to save credential',
          details: addError.message 
        });
      }

      console.log('✅ Registration successful for:', username);
      console.log('⏱️ Request completed in', Date.now() - startTime, 'ms');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return res.status(200).json({ verified: true });
    }

    console.log('❌ Verification failed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return res.status(400).json({ verified: false, error: 'Verification failed' });
  } catch (error: any) {
    console.error('❌ VERIFICATION ERROR:', error);
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