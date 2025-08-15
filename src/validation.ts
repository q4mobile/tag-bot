import * as core from "@actions/core";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
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
 * @param data - API response data to validate
 * @param context - Context for error messages
 * @returns true if valid, throws ValidationError if invalid
 */
export function validateGitHubResponse(data: any, context: string): boolean {
  if (data === null || data === undefined) {
    throw new ValidationError(`${context}: API response data is null or undefined`);
  }

  if (Array.isArray(data) && data.length === 0) {
    // Empty arrays are valid for some endpoints like listTags
    return true;
  }

  if (typeof data !== 'object') {
    throw new ValidationError(`${context}: API response data must be an object or array, got ${typeof data}`);
  }

  return true;
}

/**
 * Validates that required GitHub context properties exist
 * @param context - GitHub context object
 * @returns true if valid, throws ValidationError if invalid
 */
export function validateGitHubContext(context: any): boolean {
  if (!context) {
    throw new ValidationError('GitHub context is not available');
  }

  if (!context.repo || !context.repo.owner || !context.repo.repo) {
    throw new ValidationError('Repository information is missing from GitHub context');
  }

  if (!context.payload || !context.payload.pull_request) {
    throw new ValidationError('Pull request information is missing from GitHub context');
  }

  if (!context.payload.pull_request.number) {
    throw new ValidationError('Pull request number is missing from GitHub context');
  }

  if (!context.sha) {
    throw new ValidationError('Commit SHA is missing from GitHub context');
  }

  return true;
}

/**
 * Validates comment body for tag-bot commands
 * @param commentBody - Comment body to validate
 * @returns true if valid, throws ValidationError if invalid
 */
export function validateCommentBody(commentBody: string): boolean {
  if (!commentBody || typeof commentBody !== 'string') {
    throw new ValidationError(`Comment body must be a non-empty string, got ${typeof commentBody}`);
  }

  if (commentBody.trim().length === 0) {
    throw new ValidationError('Comment body cannot be empty');
  }

  return true;
}

/**
 * Validates tag name format
 * @param tagName - Tag name to validate
 * @returns true if valid, throws ValidationError if invalid
 */
export function validateTagName(tagName: string): boolean {
  if (!tagName || typeof tagName !== 'string') {
    throw new ValidationError(`Tag name must be a non-empty string, got ${typeof tagName}`);
  }

  if (tagName.trim().length === 0) {
    throw new ValidationError('Tag name cannot be empty');
  }

  // Check for invalid characters in tag names
  const invalidTagPattern = /[~^:?*[\\]/;
  if (invalidTagPattern.test(tagName)) {
    throw new ValidationError(`Tag name contains invalid characters: ${tagName}`);
  }

  return true;
}

/**
 * Logs validation errors with proper formatting
 * @param error - Validation error to log
 */
export function logValidationError(error: ValidationError): void {
  core.error(`Validation Error: ${error.message}`);
  core.setFailed(error.message);
}

/**
 * Logs general errors with proper formatting
 * @param error - Error to log
 * @param context - Context where the error occurred
 */
export function logError(error: Error, context: string): void {
  core.error(`Error in ${context}: ${error.message}`);
  if (error.stack) {
    core.debug(`Stack trace: ${error.stack}`);
  }
  core.setFailed(error.message);
}
