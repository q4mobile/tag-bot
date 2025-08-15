import * as core from "@actions/core";
import * as github from "@actions/github";
import { Tag } from "./tag";
import { determineLastTag, generateNextTag, parseCommentBody, PartToIncrement, TagBotCommand, createManualVersion } from "./utils";
import { validateGitHubContext, validateGitHubResponse, logValidationError, logError, ValidationError } from "./validation";
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
      core.setOutput("skipped", "true");
      return;
    }

    // Fetch and validate repository tags
    try {
      const tagsResponse = await octokit.rest.repos.listTags({
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

      // Create the tag
      try {
        core.info(`Creating new tag: ${newTag.toString()}`);
        const tag = await createTag(octokit, repo, newTag.toString());
        const ref = await createRef(octokit, repo, "refs/tags/" + tag.data.tag, tag.data.sha);
        
        core.info(`Successfully created tag: ${tag.data.tag}`);
        core.info(`Tag reference created: ${ref.data.ref}`);
        core.setOutput("tag", tag.data.tag);
        core.setOutput("sha", tag.data.sha);
        core.setOutput("increment_type", manualVersion ? "manual" : PartToIncrement[partToIncrement].toLowerCase());
        if (manualVersion) {
          core.setOutput("manual_version", manualVersion);
        }
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
