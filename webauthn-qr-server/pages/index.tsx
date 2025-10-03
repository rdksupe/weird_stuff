import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export default function Home() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username) {
      setMessage('Please enter a username');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Get registration options
      const optionsRes = await fetch('/api/register/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, useQR: false }),
      });

      const options = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error(options.error);
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

  const handleLogin = async () => {
    if (!username) {
      setMessage('Please enter a username');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Get authentication options
      const optionsRes = await fetch('/api/login/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, useQR: false }),
      });

      const options = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error(options.error);
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8F9FA',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        paddingTop: '60px'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '50px'
        }}>
          <div style={{
            display: 'inline-block',
            padding: '16px 24px',
            backgroundColor: '#FF6B35',
            borderRadius: '50px',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
          }}>
            <span style={{ fontSize: '32px' }}>🔐</span>
          </div>
          <h1 style={{
            fontSize: '42px',
            fontWeight: '700',
            margin: '0 0 12px 0',
            color: '#1A1A1A',
            background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            SecureAuth
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            margin: 0,
            fontWeight: '400'
          }}>
            Passwordless authentication made simple
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '48px 36px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #F0F0F0'
        }}>
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '18px 24px',
              fontSize: '16px',
              marginBottom: '32px',
              border: '2px solid #E5E7EB',
              borderRadius: '14px',
              outline: 'none',
              transition: 'all 0.3s ease',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              color: '#1A1A1A'
            }}
            onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
            onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
          />

          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '17px',
              fontWeight: '600',
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: loading ? 0.6 : 1,
              transform: 'translateY(0)',
              boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
              fontFamily: 'inherit'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)', e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 107, 53, 0.3)')}
          >
            {loading ? 'Processing...' : '🔑 Register'}
          </button>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '17px',
              fontWeight: '600',
              backgroundColor: 'white',
              color: '#FF6B35',
              border: '2px solid #FF6B35',
              borderRadius: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: loading ? 0.6 : 1,
              transform: 'translateY(0)',
              fontFamily: 'inherit'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#FFF5F0', e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white', e.currentTarget.style.transform = 'translateY(0)')}
          >
            {loading ? 'Processing...' : '✅ Login'}
          </button>

          {message && (
            <div style={{
              marginTop: '28px',
              padding: '18px 24px',
              backgroundColor: message.includes('✅') ? '#ECFDF5' : message.includes('❌') ? '#FEF2F2' : '#FFF5F0',
              borderRadius: '14px',
              borderLeft: `4px solid ${message.includes('✅') ? '#10B981' : message.includes('❌') ? '#EF4444' : '#FF6B35'}`,
              color: '#1F2937',
              fontSize: '15px',
              fontWeight: '500'
            }}>
              {message}
            </div>
          )}
        </div>

        {/* Instructions Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '36px',
          marginTop: '28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #F0F0F0'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: '700',
            marginBottom: '24px',
            color: '#1A1A1A'
          }}>
            📋 How It Works
          </h3>
          
          <ol style={{
            margin: 0,
            paddingLeft: '24px',
            color: '#6B7280',
            fontSize: '15px',
            lineHeight: '2'
          }}>
            <li>Enter a username</li>
            <li>Click "Register" to create credentials</li>
            <li>Use Face ID, Touch ID, or Windows Hello</li>
            <li>Click "Login" to authenticate securely</li>
          </ol>

          <div style={{
            marginTop: '24px',
            padding: '18px',
            backgroundColor: '#FFF5F0',
            borderRadius: '14px',
            borderLeft: '4px solid #FF6B35'
          }}>
            <strong style={{ color: '#FF6B35' }}>💡 Note:</strong>
            <span style={{ color: '#6B7280', fontSize: '14px', marginLeft: '8px' }}>
              Your biometric data never leaves your device
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingBottom: '40px',
          color: '#9CA3AF',
          fontSize: '14px'
        }}>
          <p style={{ margin: 0 }}>🔒 Secured with WebAuthn & Passkeys</p>
        </div>
      </div>
    </div>
  );
}