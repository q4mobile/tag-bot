import * as core from "@actions/core";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  lastError?: Error;
}

export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

/**
 * Default retry configuration for GitHub API calls
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Calculates delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const delay = Math.min(exponentialDelay, config.maxDelay);
  
  if (config.jitter) {
    // Add random jitter (±25%) to prevent thundering herd
    const jitterRange = delay * 0.25;
    const jitter = (Math.random() - 0.5) * jitterRange;
    return Math.max(100, delay + jitter); // Minimum 100ms delay
  }
  
  return delay;
}

/**
 * Extracts rate limit information from GitHub API response headers
 */
export function extractRateLimitInfo(headers: any): RateLimitInfo | null {
  try {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0');
    const reset = parseInt(headers['x-ratelimit-reset'] || '0');
    const limit = parseInt(headers['x-ratelimit-limit'] || '0');
    
    if (remaining >= 0 && reset > 0 && limit > 0) {
      return {
        remaining,
        reset,
        limit
      };
    }
    
    return null;
  } catch (error) {
    core.debug(`Failed to extract rate limit info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Checks if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const statusCode = error.status || error.code || 0;
  
  // Network and timeout errors
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  if (retryableStatusCodes.indexOf(statusCode) !== -1) {
    return true;
  }
  
  // GitHub API specific retryable errors
  const retryablePatterns = [
    /rate limit exceeded/i,
    /temporary/i,
    /timeout/i,
    /network error/i,
    /connection reset/i,
    /service unavailable/i
  ];
  
  return retryablePatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Determines if we should wait due to rate limiting
 */
export function shouldWaitForRateLimit(rateLimitInfo: RateLimitInfo | null, error: any): number | null {
  if (!rateLimitInfo) return null;
  
  // If we have no remaining requests, wait until reset
  if (rateLimitInfo.remaining <= 0) {
    const now = Math.floor(Date.now() / 1000);
    const waitTime = Math.max(0, rateLimitInfo.reset - now) * 1000; // Convert to milliseconds
    return waitTime;
  }
  
  // Check if error suggests rate limiting
  if (error && error.status === 429) {
    const retryAfter = error.headers?.['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter) * 1000; // Convert to milliseconds
    }
    
    // Fallback: wait until rate limit reset
    const now = Math.floor(Date.now() / 1000);
    const waitTime = Math.max(0, rateLimitInfo.reset - now) * 1000;
    return waitTime;
  }
  
  return null;
}

/**
 * Executes a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: string = "API operation"
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;
  
  core.info(`🔄 Starting ${context} with retry logic (max ${finalConfig.maxAttempts} attempts)`);
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      core.debug(`Attempt ${attempt}/${finalConfig.maxAttempts} for ${context}`);
      
      const result = await operation();
      
      const totalTime = Date.now() - startTime;
      core.info(`✅ ${context} succeeded on attempt ${attempt} (${totalTime}ms)`);
      
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTime
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = isRetryableError(lastError);
      
      core.warning(`❌ ${context} failed on attempt ${attempt}/${finalConfig.maxAttempts}: ${lastError.message}`);
      
      if (attempt === finalConfig.maxAttempts || !isRetryable) {
        const totalTime = Date.now() - startTime;
        core.error(`💥 ${context} failed permanently after ${attempt} attempts (${totalTime}ms)`);
        
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTime,
          lastError
        };
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, finalConfig);
      core.info(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached, but just in case
  const totalTime = Date.now() - startTime;
  return {
    success: false,
    error: lastError || new Error("Retry logic failed unexpectedly"),
    attempts: finalConfig.maxAttempts,
    totalTime,
    lastError
  };
}

/**
 * Executes a GitHub API operation with smart retry logic
 */
export async function withGitHubRetry<T>(
  operation: () => Promise<{ data: T; headers?: any }>,
  config: Partial<RetryConfig> = {},
  context: string = "GitHub API operation"
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;
  
  core.info(`🔄 Starting ${context} with GitHub-specific retry logic (max ${finalConfig.maxAttempts} attempts)`);
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      core.debug(`Attempt ${attempt}/${finalConfig.maxAttempts} for ${context}`);
      
      const result = await operation();
      
      const totalTime = Date.now() - startTime;
      core.info(`✅ ${context} succeeded on attempt ${attempt} (${totalTime}ms)`);
      
      // Log rate limit information if available
      if (result.headers) {
        const rateLimitInfo = extractRateLimitInfo(result.headers);
        if (rateLimitInfo) {
          core.info(`📊 Rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`);
        }
      }
      
      return {
        success: true,
        data: result.data,
        attempts: attempt,
        totalTime
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = isRetryableError(lastError);
      
      core.warning(`❌ ${context} failed on attempt ${attempt}/${finalConfig.maxAttempts}: ${lastError.message}`);
      
      // Check for rate limiting
      let rateLimitWait: number | null = null;
      if (error.headers) {
        const rateLimitInfo = extractRateLimitInfo(error.headers);
        rateLimitWait = shouldWaitForRateLimit(rateLimitInfo, error);
      }
      
      if (rateLimitWait && rateLimitWait > 0) {
        core.warning(`⏰ Rate limit detected. Waiting ${Math.ceil(rateLimitWait / 1000)}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, rateLimitWait));
        continue; // Retry immediately after rate limit wait
      }
      
      if (attempt === finalConfig.maxAttempts || !isRetryable) {
        const totalTime = Date.now() - startTime;
        core.error(`💥 ${context} failed permanently after ${attempt} attempts (${totalTime}ms)`);
        
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTime,
          lastError
        };
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, finalConfig);
      core.info(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached, but just in case
  const totalTime = Date.now() - startTime;
  return {
    success: false,
    error: lastError || new Error("GitHub retry logic failed unexpectedly"),
    attempts: finalConfig.maxAttempts,
    totalTime,
    lastError
  };
}

/**
 * Validates that a version string follows semantic versioning format
 * @param version - Version string to validate
 * @returns true if valid, throws ValidationError if invalid
 */
export function validateVersionString(version: string): boolean {
  if (!version || typeof version !== 'string') {
    throw new ValidationError(`Invalid version: must be a non-empty string, got ${typeof version}`);
  }

  // Remove 'v' prefix if present
  const cleanVersion = version.startsWith('v') ? version.substring(1) : version;
  
  // Check if version matches semantic versioning pattern (x.y.z)
  const versionPattern = /^\d+\.\d+\.\d+$/;
  if (!versionPattern.test(cleanVersion)) {
    throw new ValidationError(`Invalid version format: must be in format x.y.z (e.g., 1.0.0), got ${version}`);
  }

  // Check if all parts are valid numbers
  const parts = cleanVersion.split('.');
  for (let i = 0; i < parts.length; i++) {
    const part = parseInt(parts[i]);
    if (isNaN(part) || part < 0) {
      throw new ValidationError(`Invalid version part at index ${i}: must be a non-negative integer, got ${parts[i]}`);
    }
  }

  return true;
}

/**
 * Validates GitHub API response data
 */
export function validateGitHubResponse(data: any, context: string): void {
  if (data === null || data === undefined) {
    throw new ValidationError(`${context} response is null or undefined`);
  }

  if (Array.isArray(data) && data.length === 0) {
    // Empty arrays are valid for some endpoints like listTags
    return;
  }

  if (typeof data !== 'object') {
    throw new ValidationError(`${context} response data must be an object or array, got ${typeof data}`);
  }
}

/**
 * Validates GitHub context properties
 */
export function validateGitHubContext(context: any): void {
  if (!context) {
    throw new ValidationError("GitHub context is not available");
  }
  
  if (!context.repo || !context.repo.owner || !context.repo.repo) {
    throw new ValidationError("Repository information is missing from GitHub context");
  }
  
  if (!context.payload || !context.payload.pull_request) {
    throw new ValidationError("Pull request information is missing from GitHub context");
  }
  
  if (!context.sha) {
    throw new ValidationError("Commit SHA is missing from GitHub context");
  }
}

/**
 * Validates PR merge status
 */
export function validatePRMergeStatus(pr: any): void {
  if (!pr) {
    throw new ValidationError("Pull request data is required");
  }
  
  if (pr.state !== 'closed') {
    throw new ValidationError(`Pull request is not closed (state: ${pr.state})`);
  }
  
  if (!pr.merged) {
    throw new ValidationError("Pull request is closed but not merged");
  }
  
  if (!pr.merged_at) {
    throw new ValidationError("Pull request merge timestamp is missing");
  }
  
  if (!pr.merge_commit_sha) {
    throw new ValidationError("Pull request merge commit SHA is missing");
  }
}

/**
 * Validates required status checks
 */
export async function validateRequiredStatusChecks(
  octokit: any, 
  repo: any, 
  sha: string, 
  requiredChecks?: string[]
): Promise<void> {
  try {
    const statusResponse = await octokit.rest.repos.getCombinedStatusForRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: sha
    });
    
    validateGitHubResponse(statusResponse.data, "Status checks response");
    
    if (!statusResponse.data.statuses || statusResponse.data.statuses.length === 0) {
      core.warning("No status checks found for this commit");
      return;
    }
    
    const allChecksPassed = statusResponse.data.statuses.every((status: any) => status.state === 'success');
    if (!allChecksPassed) {
      const failedChecks = statusResponse.data.statuses
        .filter((status: any) => status.state !== 'success')
        .map((status: any) => `${status.context} (${status.state})`);
      
      throw new ValidationError(
        `Not all status checks have passed. Failed checks: ${failedChecks.join(', ')}`
      );
    }
    
    // If specific checks are required, validate they exist and passed
    if (requiredChecks && requiredChecks.length > 0) {
      const checkContexts = statusResponse.data.statuses.map((status: any) => status.context);
      const missingChecks = requiredChecks.filter(check => !checkContexts.includes(check));
      
      if (missingChecks.length > 0) {
        throw new ValidationError(
          `Required status checks are missing: ${missingChecks.join(', ')}. ` +
          `Available checks: ${checkContexts.join(', ')}`
        );
      }
      
      const requiredChecksPassed = requiredChecks.every(check => 
        statusResponse.data.statuses.some((status: any) => 
          status.context === check && status.state === 'success'
        )
      );
      
      if (!requiredChecksPassed) {
        throw new ValidationError(
          `Not all required status checks have passed. Required: ${requiredChecks.join(', ')}`
        );
      }
    }
    
    core.info(`✅ All status checks passed (${statusResponse.data.statuses.length} checks)`);
    
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to validate status checks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates branch protection rules
 */
export async function validateBranchProtection(
  octokit: any, 
  repo: any, 
  branch: string
): Promise<void> {
  try {
    const protectionResponse = await octokit.rest.repos.getBranchProtection({
      owner: repo.owner,
      repo: repo.repo,
      branch: branch
    });
    
    validateGitHubResponse(protectionResponse.data, "Branch protection response");
    
    core.info(`🔒 Branch protection rules for ${branch}:`);
    
    if (protectionResponse.data.required_status_checks) {
      const requiredChecks = protectionResponse.data.required_status_checks.contexts || [];
      core.info(`   Required status checks: ${requiredChecks.length > 0 ? requiredChecks.join(', ') : 'None'}`);
    }
    
    if (protectionResponse.data.required_pull_request_reviews) {
      const requiredReviews = protectionResponse.data.required_pull_request_reviews;
      core.info(`   Required PR reviews: ${requiredReviews.required_approving_review_count || 0}`);
      core.info(`   Dismiss stale reviews: ${requiredReviews.dismiss_stale_reviews || false}`);
    }
    
    if (protectionResponse.data.enforce_admins) {
      core.info(`   Admin enforcement: ${protectionResponse.data.enforce_admins.enabled || false}`);
    }
    
  } catch (error: any) {
    if (error.status === 404) {
      core.info(`ℹ️  No branch protection rules configured for ${branch}`);
    } else {
      core.warning(`⚠️  Could not fetch branch protection rules for ${branch}: ${error.message}`);
    }
  }
}

/**
 * Validates comment body
 */
export function validateCommentBody(commentBody: string): void {
  if (!commentBody || typeof commentBody !== 'string') {
    throw new ValidationError("Comment body must be a non-empty string");
  }
  
  if (commentBody.trim().length === 0) {
    throw new ValidationError("Comment body cannot be empty or whitespace only");
  }
}

/**
 * Validates tag name
 */
export function validateTagName(tagName: string): void {
  if (!tagName || typeof tagName !== 'string') {
    throw new ValidationError("Tag name must be a non-empty string");
  }
  
  if (tagName.trim().length === 0) {
    throw new ValidationError("Tag name cannot be empty or whitespace only");
  }
  
  // Check for invalid characters in Git tag names
  const invalidChars = /[~^:?*[\\]@{}]/;
  if (invalidChars.test(tagName)) {
    throw new ValidationError(`Tag name contains invalid characters: ${tagName}. Git tag names cannot contain: ~ ^ : ? * [ \\ ] @ { }`);
  }
  
  // Check for control characters
  if (/[\x00-\x1f\x7f]/.test(tagName)) {
    throw new ValidationError("Tag name contains control characters which are not allowed");
  }
}

/**
 * Logs validation errors with core.error and sets action as failed
 */
export function logValidationError(error: ValidationError): void {
  core.error(`Validation Error: ${error.message}`);
  core.setFailed(`Action failed due to validation error: ${error.message}`);
}

/**
 * Logs general errors with context and sets action as failed
 */
export function logError(error: Error, context: string): void {
  core.error(`Error in ${context}: ${error.message}`);
  if (error.stack) {
    core.debug(`Stack trace: ${error.stack}`);
  }
  core.setFailed(`Action failed in ${context}: ${error.message}`);
}
