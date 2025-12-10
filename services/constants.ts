/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values for maintainability
 */

// Time Constants (in milliseconds)
export const TIME = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60000,
  THIRTY_MINUTES: 1800000,
  ONE_HOUR: 3600000,
  ONE_DAY: 86400000,
} as const;

// Storage Constants
export const STORAGE = {
  MAX_SIZE_BYTES: 4 * 1024 * 1024, // 4MB safety limit for localStorage
  TASKS_KEY: 'authentiqc_tasks',
  SETTINGS_KEY: 'authentiqc_settings',
  USER_KEY: 'authentiqc_user',
} as const;

// QC Grading Constants
export const QC_GRADING = {
  PASS_THRESHOLD: 80,
  CAUTION_MIN: 61,
  CAUTION_MAX: 80,
  FAIL_THRESHOLD: 60,
} as const;

// Category Similarity Thresholds
export const SIMILARITY = {
  MIN_TOKEN_LENGTH: 2,
  THRESHOLD: 0.7,
  CATEGORY_THRESHOLD: 0.75,
} as const;

// Image Processing Constants
export const IMAGE = {
  MAX_DIMENSIONS: 2048,
  QUALITY: 0.85,
  COMPARISON_THRESHOLD: 0.1, // 10% difference threshold
} as const;

// API Constants
export const API = {
  GEMINI_TIMEOUT: 60000, // 60 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

// UI Constants
export const UI = {
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 5000,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
} as const;

// Validation Constants
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_IMAGE_SIZE_MB: 10,
  MAX_BATCH_SIZE: 20,
  MIN_PRODUCT_NAME_LENGTH: 2,
  MAX_PRODUCT_NAME_LENGTH: 200,
} as const;

// Model Configuration
export const MODELS = {
  FAST: 'gemini-2.0-flash-exp',
  DETAILED: 'gemini-1.5-pro',
} as const;

// Standard QC Section Names by Category
export const QC_SECTIONS: Record<string, string[]> = {
  watches: [
    'Dial & Hands',
    'Case & Bezel',
    'Crown & Pushers',
    'Bracelet/Strap',
    'Clasp',
    'Movement',
    'Case Back',
    'Packaging',
    'Documentation',
  ],
  bags: [
    'Exterior Material',
    'Interior Lining',
    'Hardware & Zippers',
    'Stitching',
    'Handles/Straps',
    'Logo & Stamps',
    'Dust Bag',
    'Authenticity Card',
    'Packaging',
  ],
  shoes: [
    'Upper Material',
    'Sole',
    'Stitching',
    'Logo & Branding',
    'Interior',
    'Laces',
    'Box & Packaging',
    'Authenticity Card',
  ],
  electronics: [
    'Display/Screen',
    'Body/Casing',
    'Ports & Buttons',
    'Camera/Lens',
    'Software/Interface',
    'Accessories',
    'Packaging',
    'Documentation',
  ],
  jewelry: [
    'Metal Quality',
    'Gemstones',
    'Clasp/Closure',
    'Engravings',
    'Finish/Polish',
    'Chain/Band',
    'Packaging',
    'Certificate',
  ],
  clothing: [
    'Fabric Quality',
    'Stitching',
    'Labels & Tags',
    'Hardware',
    'Construction',
    'Finish',
    'Packaging',
  ],
  default: [
    'Overall Quality',
    'Materials',
    'Construction',
    'Hardware',
    'Branding',
    'Finish',
    'Packaging',
    'Documentation',
  ],
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection and try again.',
  GEMINI_API: 'AI service error. Please check your API key and try again.',
  SUPABASE: 'Database error. Please try again later.',
  IMAGE_FETCH: 'Failed to fetch image. Please check the URL and try again.',
  IMAGE_SIZE: `Image size exceeds ${VALIDATION.MAX_IMAGE_SIZE_MB}MB limit.`,
  INVALID_INPUT: 'Invalid input. Please check your data and try again.',
  UNAUTHORIZED: 'Authentication required. Please log in.',
  SESSION_EXPIRED: 'Session expired. Please log in again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  PRODUCT_ADDED: 'Product added successfully',
  PRODUCT_UPDATED: 'Product updated successfully',
  PRODUCT_DELETED: 'Product deleted successfully',
  QC_COMPLETED: 'QC inspection completed',
  SETTINGS_SAVED: 'Settings saved successfully',
} as const;
