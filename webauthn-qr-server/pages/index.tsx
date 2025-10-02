import { useState, useEffect } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import QRCode from 'qrcode';

export default function Home() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showQR, setShowQR] = useState(false);

  // Poll for QR session status
  useEffect(() => {
    if (!sessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/qr/status?sessionId=${sessionId}`);
        const data = await res.json();

        if (data.status === 'completed' && data.verified) {
          setMessage(`✅ ${data.type === 'register' ? 'Registration' : 'Login'} successful via QR code!`);
          setQrCodeUrl('');
          setSessionId('');
          setShowQR(false);
          clearInterval(pollInterval);
        } else if (data.status === 'failed') {
          setMessage('❌ Authentication failed. Please try again.');
          setQrCodeUrl('');
          setSessionId('');
          setShowQR(false);
          clearInterval(pollInterval);
        } else if (data.status === 'expired') {
          setMessage('⏱️ QR code expired. Please try again.');
          setQrCodeUrl('');
          setSessionId('');
          setShowQR(false);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [sessionId]);

  const generateQRCode = async (data: any) => {
    try {
      const qrString = JSON.stringify(data);
      const qrDataUrl = await QRCode.toDataURL(qrString, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('QR generation error:', error);
    }
  };

  const handleRegister = async (useQR = false) => {
    if (!username) {
      setMessage('Please enter a username');
      return;
    }

    setLoading(true);
    setMessage('');
    setQrCodeUrl('');

    try {
      // Get registration options
      const optionsRes = await fetch('/api/register/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, useQR }),
      });

      const options = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error(options.error);
      }

      if (useQR && options.qrData) {
        // Generate QR code
        await generateQRCode(options.qrData);
        setSessionId(options.qrData.sessionId);
        setShowQR(true);
        setMessage('📱 Scan QR code with your Android app to register');
        setLoading(false);
        return;
      }

      // Start registration (platform authenticator)
      const credential = await startRegistration(options);

      // Verify registration
      const verifyRes = await fetch('/api/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, credential }),
      });

      const verifyResult = await verifyRes.json();

      if (verifyResult.verified) {
        setMessage('✅ Registration successful! You can now login.');
      } else {
        setMessage('❌ Registration failed. Please try again.');
      }
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (useQR = false) => {
    if (!username) {
      setMessage('Please enter a username');
      return;
    }

    setLoading(true);
    setMessage('');
    setQrCodeUrl('');

    try {
      // Get authentication options
      const optionsRes = await fetch('/api/login/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, useQR }),
      });

      const options = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error(options.error);
      }

      if (useQR && options.qrData) {
        // Generate QR code
        await generateQRCode(options.qrData);
        setSessionId(options.qrData.sessionId);
        setShowQR(true);
        setMessage('📱 Scan QR code with your Android app to login');
        setLoading(false);
        return;
      }

      // Start authentication (platform authenticator)
      const credential = await startAuthentication(options);

      // Verify authentication
      const verifyRes = await fetch('/api/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, credential }),
      });

      const verifyResult = await verifyRes.json();

      if (verifyResult.verified) {
        setMessage('✅ Login successful!');
      } else {
        setMessage('❌ Login failed. Please try again.');
      }
    } catch (error: any) {
      console.error(error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cancelQR = () => {
    setQrCodeUrl('');
    setSessionId('');
    setShowQR(false);
    setMessage('');
  };

  

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <h1>🔐 WebAuthn Demo</h1>
      <p>Passwordless authentication with platform and mobile passkeys</p>

      <div style={{ marginTop: '30px' }}>
        <input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={showQR}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            marginBottom: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />

        {!showQR ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>Platform Authenticator</h3>
              <button
                onClick={() => handleRegister(false)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  marginBottom: '10px',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Processing...' : '🔑 Register (This Device)'}
              </button>

              <button
                onClick={() => handleLogin(false)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Processing...' : '✅ Login (This Device)'}
              </button>
            </div>

            <div>
              <h3 style={{ marginBottom: '10px' }}>Mobile Authenticator</h3>
              <button
                onClick={() => handleRegister(true)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  marginBottom: '10px',
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Processing...' : '📱 Register via QR Code'}
              </button>

              <button
                onClick={() => handleLogin(true)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  backgroundColor: '#4ecdc4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Processing...' : '📱 Login via QR Code'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {qrCodeUrl && (
              <div style={{ 
                backgroundColor: 'white', 
                padding: '20px', 
                borderRadius: '8px',
                marginBottom: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <img src={qrCodeUrl} alt="QR Code" style={{ maxWidth: '100%' }} />
              </div>
            )}
            <button
              onClick={cancelQR}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {message && (
          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              borderLeft: '4px solid #0070f3',
            }}
          >
            {message}
          </div>
        )}
      </div>

      <div style={{ marginTop: '40px', fontSize: '14px', color: '#666' }}>
        <h3>📋 Instructions:</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <h4>Platform Authenticator (This Device):</h4>
          <ol>
            <li>Enter a username</li>
            <li>Click "Register (This Device)"</li>
            <li>Follow your browser's prompts (Face ID, Touch ID, Windows Hello)</li>
            <li>Click "Login (This Device)" to authenticate</li>
          </ol>
        </div>

        <div>
          <h4>Mobile Authenticator (QR Code):</h4>
          <ol>
            <li>Enter a username</li>
            <li>Click "Register via QR Code" or "Login via QR Code"</li>
            <li>Scan the QR code with your Android app</li>
            <li>Complete authentication on your mobile device</li>
            <li>The web page will automatically update when complete</li>
          </ol>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
          <strong>⚠️ Note:</strong> You need the companion Android app to use QR code authentication.
          See the Android app code in the repository.
        </div>
      </div>
    </div>
  );
}