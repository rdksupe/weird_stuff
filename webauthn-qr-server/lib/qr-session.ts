import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_KEY:', supabaseKey ? 'Set' : 'Missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface QRSession {
  type: 'register' | 'login';
  username: string;
  challenge: string;
  status: 'pending' | 'completed' | 'failed';
  verified?: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface QRData {
  sessionId: string;
  type: 'register' | 'login';
  username: string;
  rpID: string;
  origin: string;
  challenge: string;
  options: any;
}

export interface User {
  id: string;
  username: string;
  credentials: any[];
  currentChallenge?: string;
}

// ============================================
// User Storage Functions
// ============================================

export async function getUser(username: string): Promise<User | null> {
  try {
    console.log('🔍 Getting user from Supabase:', username);
    
    // Get user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError || !userData) {
      console.log('❌ User not found in DB:', username);
      return null;
    }

    // Get credentials for this user
    const { data: credData, error: credError } = await supabase
      .from('credentials')
      .select('*')
      .eq('user_id', userData.id);

    const credentials = credData || [];
    
    console.log('✅ User found:', username, 'with', credentials.length, 'credentials');

    return {
      id: userData.user_id,
      username: userData.username,
      credentials: credentials.map((cred: any) => {
        // 🔧 FIX: Don't convert credential_id - keep as base64url string
        // The browser sends it as base64url, so we store and compare as base64url
        return {
          credentialID: cred.credential_id, // ← Keep as string (base64url)
          credentialPublicKey: Buffer.from(cred.credential_public_key, 'base64'),
          counter: cred.counter,
          transports: cred.transports || [],
          createdViaQR: cred.created_via_qr,
        };
      }),
      currentChallenge: userData.current_challenge,
    };
  } catch (error) {
    console.error('❌ Error getting user:', error);
    throw error;
  }
}

export async function createUser(username: string): Promise<User> {
  try {
    console.log('✨ Creating new user:', username);
    
    const userId = Buffer.from(username).toString('base64url');
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      // Check if user already exists
      if (error.code === '23505') {
        console.log('⚠️ User already exists, fetching:', username);
        return await getUser(username) as User;
      }
      throw error;
    }

    console.log('✅ User created:', username);

    return {
      id: data.user_id,
      username: data.username,
      credentials: [],
    };
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

export async function addCredentialToUser(
  username: string,
  credential: any
): Promise<void> {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('➕ ADDING CREDENTIAL TO USER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Username:', username);
    
    // Get user's database ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError || !userData) {
      console.error('❌ User not found:', username);
      throw new Error('User not found');
    }

    console.log('✅ Found user with DB ID:', userData.id);

    const userId = userData.id;

    // 🔧 FIX: Convert to base64url (not base64)
    let credentialIdBase64url: string;
    let publicKeyBase64: string;

    try {
      if (Buffer.isBuffer(credential.credentialID)) {
        // Convert to base64url (URL-safe, no padding)
        credentialIdBase64url = credential.credentialID
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      } else if (credential.credentialID instanceof Uint8Array) {
        credentialIdBase64url = Buffer.from(credential.credentialID)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      } else if (typeof credential.credentialID === 'string') {
        // Already a string, assume it's base64url
        credentialIdBase64url = credential.credentialID;
      } else {
        throw new Error('Invalid credentialID type');
      }

      // Public key can stay as regular base64
      if (Buffer.isBuffer(credential.credentialPublicKey)) {
        publicKeyBase64 = credential.credentialPublicKey.toString('base64');
      } else if (credential.credentialPublicKey instanceof Uint8Array) {
        publicKeyBase64 = Buffer.from(credential.credentialPublicKey).toString('base64');
      } else if (typeof credential.credentialPublicKey === 'string') {
        publicKeyBase64 = credential.credentialPublicKey;
      } else {
        throw new Error('Invalid publicKey type');
      }

      console.log('✅ Converted:');
      console.log('  - Credential ID (base64url):', credentialIdBase64url);
      console.log('  - Public key (base64):', publicKeyBase64.substring(0, 30) + '...');
      
    } catch (conversionError: any) {
      console.error('❌ Error converting:', conversionError);
      throw conversionError;
    }

    console.log('💾 Inserting credential into database...');
    
    const { data: insertedData, error: insertError } = await supabase
      .from('credentials')
      .insert({
        user_id: userId,
        credential_id: credentialIdBase64url, // ← Now base64url
        credential_public_key: publicKeyBase64,
        counter: credential.counter || 0,
        transports: credential.transports || [],
        created_via_qr: credential.createdViaQR || false,
      })
      .select();

    if (insertError) {
      console.error('❌ Supabase insert error:', insertError);
      throw insertError;
    }

    console.log('✅ Credential inserted successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ CRITICAL ERROR IN addCredentialToUser');
    console.error('Full error:', error);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    throw error;
  }
}

export async function updateUserChallenge(
  username: string,
  challenge: string
): Promise<void> {
  try {
    console.log('💾 Updating challenge for:', username);
    
    const { error } = await supabase
      .from('users')
      .update({ 
        current_challenge: challenge,
        updated_at: new Date().toISOString(),
      })
      .eq('username', username);

    if (error) throw error;

    console.log('✅ Challenge updated for:', username);
  } catch (error) {
    console.error('❌ Error updating challenge:', error);
    throw error;
  }
}

export async function updateCredentialCounter(
  username: string,
  credentialId: string, // Now a base64url string
  newCounter: number
): Promise<void> {
  try {
    console.log('🔄 Updating counter for:', username);
    console.log('🔍 Credential ID:', credentialId);
    
    // Get user's database ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const userId = userData.id;

    // 🔧 FIX: credentialId is already base64url string, use directly
    const { error } = await supabase
      .from('credentials')
      .update({ counter: newCounter })
      .eq('user_id', userId)
      .eq('credential_id', credentialId); // ← Direct comparison

    if (error) throw error;

    console.log('✅ Counter updated to:', newCounter);
  } catch (error) {
    console.error('❌ Error updating counter:', error);
    throw error;
  }
}

// ============================================
// QR Session Functions
// ============================================

export function generateQRData(params: {
  type: 'register' | 'login';
  username: string;
  options: any;
  rpID: string;
  origin: string;
}): QRData {
  const sessionId = generateRandomString(32);
  
  return {
    sessionId,
    type: params.type,
    username: params.username,
    rpID: params.rpID,
    origin: params.origin,
    challenge: params.options.challenge,
    options: params.options,
  };
}

export async function storeQRSession(sessionId: string, session: QRSession): Promise<void> {
  try {
    console.log('📱 Storing QR session:', sessionId);
    
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const createdAt = new Date(session.createdAt);

    const { error } = await supabase
      .from('qr_sessions')
      .insert({
        id: sessionId,
        type: session.type,
        username: session.username,
        challenge: session.challenge,
        status: session.status,
        verified: session.verified || false,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (error) throw error;

    console.log('✅ QR session stored:', sessionId);
  } catch (error) {
    console.error('❌ Error storing QR session:', error);
    throw error;
  }
}

export async function getQRSession(sessionId: string): Promise<QRSession | null> {
  try {
    console.log('🔍 Getting QR session:', sessionId);
    
    // Clean up expired sessions first
    await supabase
      .from('qr_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    const { data, error } = await supabase
      .from('qr_sessions')
      .select('*')
      .eq('id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      console.log('❌ QR session not found or expired:', sessionId);
      return null;
    }

    console.log('✅ QR session found:', sessionId, 'status:', data.status);

    return {
      type: data.type as 'register' | 'login',
      username: data.username,
      challenge: data.challenge,
      status: data.status as 'pending' | 'completed' | 'failed',
      verified: data.verified,
      createdAt: new Date(data.created_at).getTime(),
      completedAt: data.completed_at ? new Date(data.completed_at).getTime() : undefined,
    };
  } catch (error) {
    console.error('❌ Error getting QR session:', error);
    return null;
  }
}

export async function updateQRSession(
  sessionId: string,
  updates: Partial<QRSession>
): Promise<void> {
  try {
    console.log('🔄 Updating QR session:', sessionId, updates);
    
    const updateData: any = {};

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.verified !== undefined) {
      updateData.verified = updates.verified;
    }

    if (updates.status === 'completed' || updates.completedAt !== undefined) {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('qr_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) throw error;

    console.log('✅ QR session updated:', sessionId);
  } catch (error) {
    console.error('❌ Error updating QR session:', error);
    throw error;
  }
}

export async function deleteQRSession(sessionId: string): Promise<void> {
  try {
    await supabase
      .from('qr_sessions')
      .delete()
      .eq('id', sessionId);
      
    console.log('🗑️ QR session deleted:', sessionId);
  } catch (error) {
    console.error('❌ Error deleting QR session:', error);
    throw error;
  }
}

// Helper function
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}