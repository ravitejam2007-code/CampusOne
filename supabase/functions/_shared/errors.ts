import { corsHeaders } from './cors.ts';

export type BackendErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR';

export interface BackendErrorBody {
  success: false;
  error: {
    code: BackendErrorCode;
    message: string;
    details?: any;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid RFC4122 UUID.
 */
export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Standard HTTP Error Response builder.
 */
export function createErrorResponse(
  status: number,
  code: BackendErrorCode,
  message: string,
  details: any = null
): Response {
  const payload: BackendErrorBody = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Safely parses request body as JSON. Returns error response immediately if malformed.
 */
export async function parseJsonBody<T = any>(
  req: Request
): Promise<{ data: T | null; errorResponse: Response | null }> {
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return { data: {} as T, errorResponse: null };
    }
    const data = JSON.parse(text);
    return { data, errorResponse: null };
  } catch (err: any) {
    return {
      data: null,
      errorResponse: createErrorResponse(
        400,
        'INVALID_JSON',
        'Malformed or unparseable JSON in request body',
        err.message
      ),
    };
  }
}

/**
 * Maps PostgreSQL and Supabase RPC errors into standard HTTP status codes and messages.
 */
export function mapPostgresError(error: any): { status: number; code: BackendErrorCode; message: string } {
  if (!error) {
    return { status: 500, code: 'INTERNAL_ERROR', message: 'An unknown database error occurred' };
  }

  const rawMessage = error.message || error.details || String(error);

  if (rawMessage.includes('UNAUTHENTICATED')) {
    return { status: 401, code: 'UNAUTHENTICATED', message: rawMessage.replace(/^UNAUTHENTICATED:\s*/, '') };
  }
  if (rawMessage.includes('FORBIDDEN')) {
    return { status: 403, code: 'FORBIDDEN', message: rawMessage.replace(/^FORBIDDEN:\s*/, '') };
  }
  if (rawMessage.includes('NOT_FOUND') || error.code === 'PGRST116' || rawMessage.includes('Cannot coerce the result to a single JSON object')) {
    return { status: 404, code: 'NOT_FOUND', message: 'Requested resource was not found' };
  }
  if (rawMessage.includes('CONFLICT') || rawMessage.includes('already checked in') || rawMessage.includes('capacity exceeded')) {
    return { status: 409, code: 'CONFLICT', message: rawMessage.replace(/^CONFLICT:\s*/, '') };
  }
  if (rawMessage.includes('INVALID_REQUEST') || rawMessage.includes('invalid input syntax')) {
    return { status: 400, code: 'INVALID_REQUEST', message: rawMessage.replace(/^INVALID_REQUEST:\s*/, '') };
  }

  // Handle Postgres SQLSTATE codes if present
  if (error.code === '23505') {
    return { status: 409, code: 'CONFLICT', message: 'Duplicate record already exists' };
  }
  if (error.code === '23503') {
    return { status: 400, code: 'INVALID_REQUEST', message: 'Referenced entity does not exist' };
  }
  if (error.code === '22P02') {
    return { status: 400, code: 'INVALID_REQUEST', message: 'Invalid data format or UUID syntax' };
  }

  return { status: 500, code: 'INTERNAL_ERROR', message: rawMessage };
}
