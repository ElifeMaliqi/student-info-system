import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
  // The Registrations page became the superadmin "Users" page; keep old links working.
  async redirects() {
    return [
      { source: '/registrations', destination: '/users', permanent: false },
    ];
  },
  // Avatars uploaded after the last build aren't in the static public/ file list,
  // so serve them through the avatar route instead (files present at build time
  // are still served statically; rewrites only apply when no file matches).
  async rewrites() {
    return [
      { source: '/uploads/avatars/:file', destination: '/api/upload/avatar?file=:file' },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
