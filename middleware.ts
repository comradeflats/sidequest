import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'vi'],

  // Used when no locale matches
  defaultLocale: 'en',

  // Only add /vi prefix, not /en (keep English as default without prefix)
  localePrefix: 'as-needed',

  // Auto-detect user's locale from browser Accept-Language header
  localeDetection: true
});

export const config = {
  // Match all pathnames except for API routes, Next.js internals, static files, and Firebase internals
  matcher: ['/((?!api|_next|_vercel|__|.*\\..*).*)']
};
