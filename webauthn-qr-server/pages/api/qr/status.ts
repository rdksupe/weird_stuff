import type { NextApiRequest, NextApiResponse } from 'next';
import { getQRSession } from '../../../lib/qr-session';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 QR STATUS CHECK');
  console.log('Time (UTC):', new Date().toISOString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      console.log('❌ No session ID provided');
      return res.status(400).json({ error: 'Session ID required' });
    }

    console.log('🔍 Checking session:', sessionId);

    // ✅ FIXED: Added await here
    const session = await getQRSession(sessionId);

    // ✅ FIXED: Check if session exists before accessing properties
    if (!session) {
      console.log('❌ Session not found or expired:', sessionId);
      return res.status(404).json({ 
        error: 'Session not found', 
        status: 'expired' 
      });
    }

    console.log('✅ Session found, status:', session.status);
    console.log('📋 Session details:', {
      type: session.type,
      username: session.username,
      status: session.status,
      verified: session.verified,
      createdAt: new Date(session.createdAt).toISOString(),
    });

    // Check if session is expired (5 minutes)
    const FIVE_MINUTES = 5 * 60 * 1000;
    const sessionAge = Date.now() - session.createdAt;
    
    if (sessionAge > FIVE_MINUTES) {
      console.log('⏱️ Session expired (age:', Math.round(sessionAge / 1000), 'seconds)');
      return res.status(410).json({ 
        error: 'Session expired', 
        status: 'expired' 
      });
    }

    const timeRemaining = Math.round((FIVE_MINUTES - sessionAge) / 1000);
    console.log('⏱️ Session expires in', timeRemaining, 'seconds');
    console.log('⏱️ Request completed in', Date.now() - startTime, 'ms');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return res.status(200).json({
      status: session.status,
      verified: session.verified,
      type: session.type,
      expiresIn: timeRemaining, // Bonus: tell client when it expires
    });
  } catch (error: any) {
    console.error('❌ QR STATUS ERROR:', error);
    console.error('Stack:', error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}