/** @type {import('next').NextConfig} */
const path = require('path'); // Add this import

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'"
            ].join('; ')
          }
        ]
      }
    ]
  },
  // outputFileTracingRoot: path.join(__dirname, '../../'),  // Comment out or remove
}

module.exports = nextConfig