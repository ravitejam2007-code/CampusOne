import { describe, it, expect } from 'vitest';
import {
  isBackendError,
  formatBackendErrorMessage,
  isValidUuid,
  type BackendErrorCode,
  type BackendErrorPayload,
} from './index';

describe('Backend Error Handling & Validation Standards', () => {
  it('validates RFC4122 compliant UUID formats', () => {
    // Valid UUIDs
    expect(isValidUuid('f5e9754f-124b-449e-b8d4-f6738c823ea9')).toBe(true);
    expect(isValidUuid('90cfbc35-21d3-4061-8b9a-f4efb7e47cfd')).toBe(true);
    expect(isValidUuid('E4A77DF3-6C8F-4D64-9B88-EC94541FF91B')).toBe(true); // case-insensitive

    // Invalid UUIDs
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('12345')).toBe(false);
    expect(isValidUuid('f5e9754f-124b-449e-b8d4-f6738c823ea9-extra')).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
  });

  it('correctly identifies backend error responses via isBackendError', () => {
    const validErrorPayload: BackendErrorPayload = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Checkout with ID not found',
      },
    };

    expect(isBackendError(validErrorPayload)).toBe(true);

    // Negative cases
    expect(isBackendError({ success: true, data: { id: '123' } })).toBe(false);
    expect(isBackendError(null)).toBe(false);
    expect(isBackendError(undefined)).toBe(false);
    expect(isBackendError('error string')).toBe(false);
    expect(isBackendError({ success: false })).toBe(false);
  });

  it('formats various error formats into human-readable messages', () => {
    // Standard backend error object
    const backendErr = {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only staff can record payments' },
    };
    expect(formatBackendErrorMessage(backendErr)).toBe('Only staff can record payments');

    // Standard JavaScript Error
    const jsErr = new Error('Network request failed');
    expect(formatBackendErrorMessage(jsErr)).toBe('Network request failed');

    // Simple string
    expect(formatBackendErrorMessage('Direct failure reason')).toBe('Direct failure reason');

    // Null and undefined fallbacks
    expect(formatBackendErrorMessage(null)).toBe('An unknown error occurred');
    expect(formatBackendErrorMessage(undefined)).toBe('An unknown error occurred');
  });

  it('covers all standard backend error codes', () => {
    const errorCodes: BackendErrorCode[] = [
      'BAD_REQUEST',
      'INVALID_JSON',
      'INVALID_REQUEST',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'UNPROCESSABLE_ENTITY',
      'RATE_LIMITED',
      'CONFIG_ERROR',
      'INTERNAL_ERROR',
    ];

    expect(errorCodes).toHaveLength(11);
    expect(errorCodes).toContain('UNAUTHENTICATED');
    expect(errorCodes).toContain('FORBIDDEN');
    expect(errorCodes).toContain('NOT_FOUND');
    expect(errorCodes).toContain('CONFLICT');
  });
});
