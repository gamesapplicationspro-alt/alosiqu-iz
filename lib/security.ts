// Security and Validation Utilities
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

// Input validation functions
export const validateRoomCode = (code: string): ValidationResult => {
  if (!code || typeof code !== 'string') {
    return { isValid: false, error: 'Ο κωδικός δωματίου είναι απαιτούμενος' };
  }
  
  const sanitized = code.trim().toUpperCase();
  
  if (sanitized.length < 4) {
    return { isValid: false, error: 'Ο κωδικός πρέπει να είναι τουλάχιστον 4 χαρακτήρες' };
  }
  
  if (sanitized.length > 10) {
    return { isValid: false, error: 'Ο κωδικός δεν μπορεί να υπερβαίνει τους 10 χαρακτήρες' };
  }
  
  if (!/^[A-Z0-9]+$/.test(sanitized)) {
    return { isValid: false, error: 'Ο κωδικός μπορεί να περιέχει μόνο κεφαλαία γράμματα και αριθμούς' };
  }
  
  return { isValid: true, sanitized };
};

export const validatePlayerName = (name: string): ValidationResult => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Το όνομα παίκτη είναι απαιτούμενο' };
  }
  
  const sanitized = name.trim();
  
  if (sanitized.length < 2) {
    return { isValid: false, error: 'Το όνομα πρέπει να είναι τουλάχιστον 2 χαρακτήρες' };
  }
  
  if (sanitized.length > 20) {
    return { isValid: false, error: 'Το όνομα δεν μπορεί να υπερβαίνει τους 20 χαρακτήρες' };
  }
  
  if (!/^[a-zA-Z\u0391-\u03FF\u0370-\u03FF0-9\s\-']+$/.test(sanitized)) {
    return { isValid: false, error: 'Το όνομα περιέχει μη έγκυρους χαρακτήρες' };
  }
  
  // Check for inappropriate words (basic filter)
  const inappropriateWords = ['admin', 'root', 'system', 'null', 'undefined', 'test'];
  if (inappropriateWords.some(word => sanitized.toLowerCase().includes(word))) {
    return { isValid: false, error: 'Αυτό το όνομα δεν επιτρέπεται' };
  }
  
  return { isValid: true, sanitized };
};

export const validateQuizAnswer = (answer: string): ValidationResult => {
  if (!answer || typeof answer !== 'string') {
    return { isValid: false, error: 'Η απάντηση είναι απαιτούμενη' };
  }
  
  const sanitized = answer.trim();
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Η απάντηση δεν μπορεί να είναι κενή' };
  }
  
  if (sanitized.length > 500) {
    return { isValid: false, error: 'Η απάντηση είναι πολύ μεγάλη' };
  }
  
  return { isValid: true, sanitized };
};

// Rate limiting
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(private maxAttempts: number = 5, private windowMs: number = 60000) {} // 5 attempts per minute
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = userAttempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);
    return true;
  }
  
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

// Sanitization functions
export const sanitizeHtml = (html: string): string => {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

// Security headers for API responses
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
};

// Error handling utilities
export class GameError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export const createErrorResponse = (error: GameError) => ({
  error: {
    code: error.code,
    message: error.message,
    timestamp: new Date().toISOString()
  }
});

// Room security validation
export const validateRoomAccess = (roomCode: string, playerId?: string): ValidationResult => {
  const codeValidation = validateRoomCode(roomCode);
  if (!codeValidation.isValid) {
    return codeValidation;
  }
  
  if (playerId && !/^[a-zA-Z0-9\-_]+$/.test(playerId)) {
    return { isValid: false, error: 'Μη έγκυρο ID παίκτη' };
  }
  
  return { isValid: true };
};

// Game state validation
export const validateGameState = (room: any): ValidationResult => {
  if (!room || typeof room !== 'object') {
    return { isValid: false, error: 'Μη έγκυρη κατάσταση δωματίου' };
  }
  
  if (!room.questions || !Array.isArray(room.questions)) {
    return { isValid: false, error: 'Μη έγκυρες ερωτήσεις' };
  }
  
  if (room.questions.length === 0) {
    return { isValid: false, error: 'Το δωμάτιο πρέπει να έχει ερωτήσεις' };
  }
  
  if (room.questions.length > 50) {
    return { isValid: false, error: 'Πάρα πολλές ερωτήσεις (μέγιστο 50)' };
  }
  
  return { isValid: true };
};

// Export all security utilities
export const SecurityUtils = {
  validateRoomCode,
  validatePlayerName,
  validateQuizAnswer,
  validateRoomAccess,
  validateGameState,
  sanitizeHtml,
  sanitizeInput,
  RateLimiter,
  GameError,
  createErrorResponse,
  securityHeaders
};
