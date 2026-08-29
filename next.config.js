const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // /faq was renamed to /ordering when the page grew to cover the order
      // sequence and documentation, not just questions. 308 so the rename is
      // permanent and search engines move the ranking across.
      { source: '/faq', destination: '/ordering', permanent: true },
    ];
  },
};

// Source map upload is skipped automatically (with a log line, not a build
// failure) if SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN aren't set.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  webpack: { treeshake: { removeDebugLogging: true } },
});
