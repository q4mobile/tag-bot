import * as core from "@actions/core";
import * as github from "@actions/github";
import { Tag } from "./tag";
import { Version } from "./version";
import { 
  determineLastTag, 
  generateNextTag, 
  parseCommentBody, 
  PartToIncrement, 
  TagBotCommand, 
  createManualVersion,
  checkDuplicateTag,
  validateTagSafety,
  generateSafeTagName,
  findNextAvailableVersion
} from "./utils";
import { 
  validateGitHubContext, 
  validateGitHubResponse, 
  validatePRMergeStatus,
  validateRequiredStatusChecks,
  validateBranchProtection,
  logValidationError, 
  logError, 
  ValidationError 
} from "./validation";
import config from "./config";

async function run(): Promise<void> {
  try {
    // Validate GitHub token
    const token = core.getInput("token");
    if (!token || token.trim().length === 0) {
      throw new ValidationError("GitHub token is required but not provided");
    }

    // Validate GitHub context
    try {
      validateGitHubContext(github.context);
    } catch (error) {
      if (error instanceof ValidationError) {
        logValidationError(error);
      } else {
        logError(error as Error, "GitHub context validation");
      }
      return;
    }

    const octokit = github.getOctokit(token);
    const repo = github.context.repo;

    core.info("Starting tag creation process...");
    core.info(`Repository: ${repo.owner}/${repo.repo}`);
    core.info(`Pull Request: #${github.context.payload.pull_request!.number}`);
    core.info(`Commit SHA: ${github.context.sha}`);

    // 🔒 BRANCH PROTECTION & VALIDATION
    core.info("🔒 Validating branch protection and PR status...");
    
    try {
      // Validate branch protection rules
      await validateBranchProtection(octokit, repo, github.context.payload.pull_request!.base.ref);
    } catch (error) {
      core.warning(`Branch protection validation warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
      core.info("Continuing with tag creation process...");
    }

    // Fetch PR details for validation
    let prDetails: any;
    try {
      const prResponse = await octokit.rest.pulls.get({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: github.context.payload.pull_request!.number
      });

      validateGitHubResponse(prResponse.data, "PR response");
      prDetails = prResponse.data;
      
      core.info(`PR Title: ${prDetails.title || 'No title'}`);
      core.info(`PR State: ${prDetails.state}`);
      core.info(`PR Merged: ${prDetails.merged ? 'Yes' : 'No'}`);
      if (prDetails.merged) {
        core.info(`Merge Commit SHA: ${prDetails.merge_commit_sha}`);
        core.info(`Merged At: ${prDetails.merged_at}`);
      }
    } catch (error) {
      throw new ValidationError(`Failed to fetch PR details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate PR merge status
    try {
      validatePRMergeStatus(prDetails);
      core.info("✅ PR merge status validation passed");
    } catch (error) {
      if (error instanceof ValidationError) {
        logValidationError(error);
      } else {
        logError(error as Error, "PR merge status validation");
      }
      return;
    }

    // Validate required status checks
    try {
      // Get required checks from config or use default
      const requiredChecks = core.getInput("required_checks") ? 
        core.getInput("required_checks").split(',').map(check => check.trim()) : 
        undefined;
      
      await validateRequiredStatusChecks(octokit, repo, github.context.sha, requiredChecks);
      core.info("✅ Status checks validation passed");
    } catch (error) {
      if (error instanceof ValidationError) {
        logValidationError(error);
      } else {
        logError(error as Error, "Status checks validation");
      }
      return;
    }

    core.info("🔒 All branch protection and validation checks passed!");

    let partToIncrement: PartToIncrement = PartToIncrement.Minor; // default
    let shouldSkip = false;
    let manualVersion: string | undefined;

    // Fetch and validate PR comments
    try {
      const commentsResponse = await octokit.rest.issues.listComments({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: github.context.payload.pull_request!.number
      });

      validateGitHubResponse(commentsResponse.data, "Comments response");

      if (commentsResponse.data && Array.isArray(commentsResponse.data)) {
        commentsResponse.data.forEach((comment, index) => {
          if (comment && comment.body && comment.body.startsWith(config.commentIdentifier)) {
            try {
              const commandResult = parseCommentBody(comment.body);
              core.info(`Found tag-bot command: ${comment.body.trim()}`);
              
              if (commandResult.shouldSkip) {
                shouldSkip = true;
                core.info("Tag creation skipped due to /tag-bot skip command");
              } else if (commandResult.command === TagBotCommand.ManualVersion && commandResult.manualVersion) {
                manualVersion = commandResult.manualVersion;
                core.info(`Manual version specified: ${manualVersion}`);
              } else if (commandResult.command === TagBotCommand.Increment && commandResult.incrementType !== undefined) {
                partToIncrement = commandResult.incrementType;
                core.info(`Increment type specified: ${PartToIncrement[partToIncrement].toLowerCase()}`);
              }
            } catch (error) {
              core.warning(`Invalid tag-bot command in comment ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              // Continue with default behavior
            }
          }
        });
      }
    } catch (error) {
      core.warning(`Failed to fetch PR comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      core.info("Continuing with default minor version increment");
    }

    // Check if tagging should be skipped
    if (shouldSkip) {
      core.info("Tag creation skipped as requested. Exiting.");
      
      // Set outputs for skip case to help other actions understand what happened
      core.setOutput("skipped", "true");
      core.setOutput("tag", ""); // No tag created
      core.setOutput("previous_tag", ""); // No previous tag info
      core.setOutput("increment_type", "skipped");
      core.setOutput("version_source", "skipped");
      core.setOutput("repository", `${repo.owner}/${repo.repo}`);
      core.setOutput("pull_request", github.context.payload.pull_request!.number.toString());
      core.setOutput("branch", github.context.payload.pull_request!.base.ref);
      core.setOutput("action_timestamp", new Date().toISOString());
      
      core.info("GitHub Action outputs set for skip case");
      return;
    }

    // Fetch and validate repository tags
    let tagsResponse: any;
    try {
      tagsResponse = await octokit.rest.repos.listTags({
        owner: repo.owner,
        repo: repo.repo
      });

      validateGitHubResponse(tagsResponse.data, "Tags response");

      let lastTag: Tag;
      if (tagsResponse.data && tagsResponse.data.length > 0) {
        try {
          lastTag = determineLastTag(tagsResponse.data);
          core.info(`Last tag in repository: ${lastTag.toString()}`);
        } catch (error) {
          if (error instanceof ValidationError) {
            logValidationError(error);
          } else {
            logError(error as Error, "Tag determination");
          }
          return;
        }
      } else {
        lastTag = new Tag("v0.0.0");
        core.info("No existing tags found, starting from v0.0.0");
      }

      // Generate new tag
      let newTag: any;
      try {
        if (manualVersion) {
          // Use manual version if specified
          newTag = createManualVersion(manualVersion);
          core.info(`Using manual version: ${newTag.toString()}`);
        } else {
          // Generate next tag based on increment type
          newTag = generateNextTag(lastTag.version, partToIncrement);
          core.info(`Generated new tag: ${newTag.toString()}`);
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          logValidationError(error);
        } else {
          logError(error as Error, "Tag generation");
        }
        return;
      }

      // 🔍 DUPLICATE TAG PREVENTION
      core.info("🔍 Checking for duplicate tags and conflicts...");
      
      const tagName = newTag.toString();
      const duplicateCheck = checkDuplicateTag(tagsResponse.data, tagName);
      
      if (duplicateCheck.exists) {
        core.warning(`⚠️  Tag conflict detected: ${duplicateCheck.conflictType}`);
        core.warning(`   ${duplicateCheck.suggestedResolution}`);
        
        if (duplicateCheck.conflictType === 'exact_match') {
          // Check if the existing tag points to the same commit
          if (duplicateCheck.existingTag?.commit?.sha === github.context.sha) {
            core.info("✅ Existing tag points to the same commit - no action needed");
            core.setOutput("tag", tagName);
            core.setOutput("previous_tag", lastTag.toString());
            core.setOutput("increment_type", manualVersion ? "manual" : PartToIncrement[partToIncrement].toLowerCase());
            core.setOutput("version_source", manualVersion ? "manual_specification" : "automatic_increment");
            core.setOutput("repository", `${repo.owner}/${repo.repo}`);
            core.setOutput("pull_request", github.context.payload.pull_request!.number.toString());
            core.setOutput("branch", github.context.payload.pull_request!.base.ref);
            core.setOutput("action_timestamp", new Date().toISOString());
            core.setOutput("duplicate_resolved", "true");
            core.setOutput("existing_tag_sha", duplicateCheck.existingTag.commit.sha);
            
            core.info("Tag already exists and points to the same commit. Exiting successfully.");
            return;
          } else {
            // Different commit - this is a real conflict
            throw new ValidationError(
              `Tag ${tagName} already exists and points to a different commit (${duplicateCheck.existingTag.commit?.sha || 'unknown'}). ` +
              `Current commit: ${github.context.sha}. ` +
              `This suggests a version conflict or the tag was created by another process. ` +
              `Please use a different version or resolve the conflict manually.`
            );
          }
        } else if (duplicateCheck.conflictType === 'version_conflict') {
          // Version format conflict - try to find a safe alternative
          core.info("🔄 Attempting to find a safe alternative version...");
          
          try {
            const safeVersion = findNextAvailableVersion(
              new Version(parseInt(lastTag.version.split('.')[0]), parseInt(lastTag.version.split('.')[1]), parseInt(lastTag.version.split('.')[2])),
              partToIncrement,
              tagsResponse.data
            );
            
            const safeTagName = `v${safeVersion.toString()}`;
            core.info(`✅ Found safe alternative: ${safeTagName}`);
            newTag = safeVersion;
            
            // Update the tag name for creation
            core.info(`🔄 Using safe tag name: ${safeTagName}`);
          } catch (error) {
            throw new ValidationError(
              `Unable to resolve version conflict automatically. ${duplicateCheck.suggestedResolution} ` +
              `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      } else {
        core.info("✅ No duplicate tags found - safe to proceed");
      }

      // Final safety check before creation
      const finalSafetyCheck = validateTagSafety(tagsResponse.data, newTag.toString());
      if (!finalSafetyCheck.safe) {
        throw new ValidationError(`Final safety check failed: ${finalSafetyCheck.message}`);
      }

      // Create the tag
      try {
        core.info(`Creating new tag: ${newTag.toString()}`);
        const tag = await createTag(octokit, repo, newTag.toString());
        const ref = await createRef(octokit, repo, "refs/tags/" + tag.data.tag, tag.data.sha);
        
        core.info(`Successfully created tag: ${tag.data.tag}`);
        core.info(`Tag reference created: ${ref.data.ref}`);
        
        // Set comprehensive GitHub Action outputs
        core.setOutput("tag", tag.data.tag);                    // Newly created tag
        core.setOutput("previous_tag", lastTag.toString());     // Previous tag that was incremented from
        core.setOutput("sha", tag.data.sha);                   // Commit SHA of the tag
        core.setOutput("ref", ref.data.ref);                   // Git reference created
        
        // Version increment information
        if (manualVersion) {
          core.setOutput("increment_type", "manual");
          core.setOutput("manual_version", manualVersion);
          core.setOutput("version_source", "manual_specification");
        } else {
          core.setOutput("increment_type", PartToIncrement[partToIncrement].toLowerCase());
          core.setOutput("version_source", "automatic_increment");
        }
        
        // Additional context outputs
        core.setOutput("repository", `${repo.owner}/${repo.repo}`);
        core.setOutput("pull_request", github.context.payload.pull_request!.number.toString());
        core.setOutput("branch", github.context.payload.pull_request!.base.ref);
        core.setOutput("action_timestamp", new Date().toISOString());
        
        // Log all outputs for debugging
        core.info("GitHub Action outputs set:");
        core.info(`  tag: ${tag.data.tag}`);
        core.info(`  previous_tag: ${lastTag.toString()}`);
        core.info(`  increment_type: ${manualVersion ? "manual" : PartToIncrement[partToIncrement].toLowerCase()}`);
        core.info(`  sha: ${tag.data.sha}`);
        core.info(`  repository: ${repo.owner}/${repo.repo}`);
        core.info(`  pull_request: #${github.context.payload.pull_request!.number}`);
        
      } catch (error) {
        logError(error as Error, "Tag creation");
        return;
      }

    } catch (error) {
      if (error instanceof ValidationError) {
        logValidationError(error);
      } else {
        logError(error as Error, "Tags fetching");
      }
      return;
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      logValidationError(error);
    } else {
      logError(error as Error, "Main execution");
    }
  }
}

async function createRef(octokit: any, repo: any, ref: string, sha: string) {
  try {
    return await octokit.rest.git.createRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: ref,
      sha: sha
    });
  } catch (error) {
    throw new Error(`Failed to create reference ${ref}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function createTag(octokit: any, repo: any, newTag: string) {
  try {
    return await octokit.rest.git.createTag({
      owner: repo.owner,
      repo: repo.repo,
      tag: newTag,
      message: "Created by Tag Bot",
      object: github.context.sha,
      type: "commit",
      tagger: { name: "Tag Bot", email: "tagbot@q4inc.com" }
    });
  } catch (error) {
    throw new Error(`Failed to create tag ${newTag}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

run();
