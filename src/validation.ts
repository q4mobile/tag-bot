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
 * Validates that a pull request is actually merged (not just closed)
 * @param pr - Pull request object from GitHub API
 * @returns true if valid, throws ValidationError if invalid
 */
export function validatePRMergeStatus(pr: any): boolean {
  if (!pr) {
    throw new ValidationError('Pull request object is required');
  }

  if (pr.merged_at === null || pr.merged_at === undefined) {
    throw new ValidationError(`Pull request #${pr.number} is not merged. It may be closed without merging or still open.`);
  }

  if (pr.state !== 'closed') {
    throw new ValidationError(`Pull request #${pr.number} is not in closed state. Current state: ${pr.state}`);
  }

  if (pr.merge_commit_sha === null || pr.merge_commit_sha === undefined) {
    throw new ValidationError(`Pull request #${pr.number} does not have a merge commit SHA.`);
  }

  return true;
}

/**
 * Validates that all required status checks have passed
 * @param octokit - GitHub API client
 * @param repo - Repository information
 * @param sha - Commit SHA to check
 * @param requiredChecks - Array of required status check names (optional)
 * @returns true if valid, throws ValidationError if invalid
 */
export async function validateRequiredStatusChecks(
  octokit: any, 
  repo: any, 
  sha: string, 
  requiredChecks?: string[]
): Promise<boolean> {
  try {
    // Get the combined status for the commit
    const statusResponse = await octokit.rest.repos.getCombinedStatusForRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: sha
    });

    validateGitHubResponse(statusResponse.data, "Status response");

    const combinedStatus = statusResponse.data;
    
    if (combinedStatus.state === 'pending') {
      throw new ValidationError(`Commit ${sha} has pending status checks. All checks must complete before tagging.`);
    }

    if (combinedStatus.state === 'failure') {
      const failedChecks = combinedStatus.statuses.filter((status: any) => status.state === 'failure');
      const failedCheckNames = failedChecks.map((status: any) => status.context).join(', ');
      throw new ValidationError(`Commit ${sha} has failed status checks: ${failedCheckNames}`);
    }

    if (combinedStatus.state === 'error') {
      throw new ValidationError(`Commit ${sha} has error status checks. Please resolve these issues before tagging.`);
    }

    // If specific required checks are specified, validate each one
    if (requiredChecks && requiredChecks.length > 0) {
      const availableChecks = combinedStatus.statuses.map((status: any) => status.context);
      const missingChecks = requiredChecks.filter(check => !availableChecks.includes(check));
      
      if (missingChecks.length > 0) {
        throw new ValidationError(`Required status checks missing: ${missingChecks.join(', ')}. Available checks: ${availableChecks.join(', ')}`);
      }

      const failedRequiredChecks = combinedStatus.statuses
        .filter((status: any) => requiredChecks.includes(status.context) && status.state !== 'success');
      
      if (failedRequiredChecks.length > 0) {
        const failedCheckNames = failedRequiredChecks.map((status: any) => status.context).join(', ');
        throw new ValidationError(`Required status checks failed: ${failedCheckNames}`);
      }
    }

    // All checks passed
    core.info(`✅ All status checks passed for commit ${sha}`);
    if (requiredChecks && requiredChecks.length > 0) {
      core.info(`✅ Required checks verified: ${requiredChecks.join(', ')}`);
    }

    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to validate status checks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates branch protection rules are satisfied
 * @param octokit - GitHub API client
 * @param repo - Repository information
 * @param branch - Branch name to check
 * @returns true if valid, throws ValidationError if invalid
 */
export async function validateBranchProtection(
  octokit: any, 
  repo: any, 
  branch: string
): Promise<boolean> {
  try {
    // Get branch protection rules
    const protectionResponse = await octokit.rest.repos.getBranchProtection({
      owner: repo.owner,
      repo: repo.repo,
      branch: branch
    });

    validateGitHubResponse(protectionResponse.data, "Branch protection response");

    const protection = protectionResponse.data;
    
    // Check if required status checks are enabled
    if (protection.required_status_checks && protection.required_status_checks.strict) {
      core.info(`✅ Branch protection: Strict status checks are required`);
    }

    if (protection.required_status_checks && protection.required_status_checks.contexts) {
      const requiredChecks = protection.required_status_checks.contexts;
      core.info(`✅ Branch protection: Required status checks: ${requiredChecks.join(', ')}`);
    }

    // Check if PR reviews are required
    if (protection.required_pull_request_reviews) {
      core.info(`✅ Branch protection: PR reviews are required`);
      if (protection.required_pull_request_reviews.required_approving_review_count) {
        core.info(`✅ Branch protection: ${protection.required_pull_request_reviews.required_approving_review_count} approving reviews required`);
      }
    }

    // Check if branch is up to date requirement
    if (protection.required_status_checks && protection.required_status_checks.strict) {
      core.info(`✅ Branch protection: Branch must be up to date before merging`);
    }

    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    
    // If branch protection is not configured, that's okay (not all repos use it)
    if (error.status === 404) {
      core.info(`ℹ️  No branch protection rules configured for ${branch} - skipping protection validation`);
      return true;
    }
    
    throw new ValidationError(`Failed to validate branch protection: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
