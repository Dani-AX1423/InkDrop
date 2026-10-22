/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const rawServerUrl =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.NEXT_PUBLIC_SOCKET_SERVER_URL ||
      '';

    let serverConnectOrigins = '';
    if (rawServerUrl) {
      try {
        const parsed = new URL(rawServerUrl);
        const wsProto = parsed.protocol === 'https:' ? 'wss' : 'ws';
        serverConnectOrigins = `${parsed.origin} ${wsProto}://${parsed.host}`;
      } catch {
        serverConnectOrigins = rawServerUrl;
      }
    }

    // Connect sources: self, resolved server origin (both http(s) and ws(s)), and local fallbacks
    const connectSrc = [
      "'self'",
      serverConnectOrigins,
      'ws:',
      'wss:',
      'http://localhost:*',
      'ws://localhost:*',
    ]
      .filter(Boolean)
      .join(' ');

    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob:;
      font-src 'self' data:;
      connect-src ${connectSrc};
      media-src 'self' data: blob:;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
    `
      .replace(/\s{2,}/g, ' ')
      .trim();

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
