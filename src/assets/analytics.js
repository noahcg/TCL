import { inject } from './vercel-analytics.js';

// This module is included only in Vercel production builds.
// Keep an exported production build quiet when previewed over local HTTP.
if (location.protocol === 'https:') inject({ mode: 'production' });
