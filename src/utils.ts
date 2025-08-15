import { compareVersions } from "compare-versions";
import config from "./config";
import { Tag } from "./tag";
import { Version } from "./version";
import { validateGitHubResponse, validateCommentBody, ValidationError } from "./validation";

export enum PartToIncrement {
  Major,
  Minor,
  Patch
}

export enum TagBotCommand {
  Skip = "skip",
  ManualVersion = "manual",
  Increment = "increment"
}

export interface TagBotCommandResult {
  command: TagBotCommand;
  incrementType?: PartToIncrement;
  manualVersion?: string;
  shouldSkip: boolean;
}

/**
 * Parses tag-bot comment and returns command details
 * @param body - Comment body to parse
 * @returns TagBotCommandResult with parsed command information
 */
export function parseCommentBody(body: string): TagBotCommandResult {
  try {
    validateCommentBody(body);
  } catch (error) {
    throw new ValidationError(`Invalid comment body: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!body.startsWith(config.commentIdentifier)) {
    throw new ValidationError(`Comment must start with ${config.commentIdentifier}`);
  }

  // Extract the command part after /tag-bot
  const commandPart = body.substring(config.commentIdentifier.length).trim();
  
  if (!commandPart || commandPart.length === 0) {
    throw new ValidationError(`No command specified after ${config.commentIdentifier}. Use: skip, major, minor, patch, or v1.2.3`);
  }

  // Check for skip command
  if (commandPart.toLowerCase() === 'skip') {
    return {
      command: TagBotCommand.Skip,
      shouldSkip: true
    };
  }

  // Check for manual version specification (e.g., v2.5.0)
  if (commandPart.startsWith('v') && commandPart.match(/^v\d+\.\d+\.\d+$/)) {
    const version = commandPart.substring(1); // Remove 'v' prefix
    return {
      command: TagBotCommand.ManualVersion,
      manualVersion: version,
      shouldSkip: false
    };
  }

  // Check for manual version specification without 'v' prefix (e.g., 2.5.0)
  if (commandPart.match(/^\d+\.\d+\.\d+$/)) {
    return {
      command: TagBotCommand.ManualVersion,
      manualVersion: commandPart,
      shouldSkip: false
    };
  }

  // Check for increment commands (major, minor, patch)
  const incrementType = commandPart.charAt(0).toUpperCase() + commandPart.slice(1).toLowerCase();
  const partToIncrement = PartToIncrement[incrementType as keyof typeof PartToIncrement];
  
  if (partToIncrement === undefined) {
    throw new ValidationError(
      `Invalid command: "${commandPart}". Valid commands are:\n` +
      `• skip - Skip tagging for this PR\n` +
      `• major - Increment major version\n` +
      `• minor - Increment minor version\n` +
      `• patch - Increment patch version\n` +
      `• v1.2.3 - Specify exact version`
    );
  }

  return {
    command: TagBotCommand.Increment,
    incrementType: partToIncrement,
    shouldSkip: false
  };
}

/**
 * Creates a new tag with the specified manual version
 * @param manualVersion - Manual version string (e.g., "2.5.0")
 * @returns Version object
 */
export function createManualVersion(manualVersion: string): Version {
  if (!manualVersion || typeof manualVersion !== 'string') {
    throw new ValidationError(`Manual version must be a non-empty string, got ${typeof manualVersion}`);
  }

  // Validate version format
  const versionPattern = /^\d+\.\d+\.\d+$/;
  if (!versionPattern.test(manualVersion)) {
    throw new ValidationError(`Invalid version format: must be in format x.y.z (e.g., 2.5.0), got ${manualVersion}`);
  }

  const parts = manualVersion.split('.').map(part => {
    const num = parseInt(part);
    if (isNaN(num) || num < 0) {
      throw new ValidationError(`Invalid version part: ${part} is not a non-negative integer`);
    }
    return num;
  });

  if (parts.length !== 3) {
    throw new ValidationError(`Version must have exactly 3 parts, got ${parts.length} parts`);
  }

  return new Version(parts[0], parts[1], parts[2]);
}

export function generateNextTag(lastTag: string, partToIncrememt: PartToIncrement): Version {
  if (!lastTag || typeof lastTag !== 'string') {
    throw new ValidationError(`Last tag must be a non-empty string, got ${typeof lastTag}`);
  }

  let previousTag: Array<number> = lastTag.split('.').map(function (item) {
    const parsed = parseInt(item);
    if (isNaN(parsed)) {
      throw new ValidationError(`Invalid version part: ${item} is not a number`);
    }
    return parsed;
  });

  if (previousTag.length !== 3) {
    throw new ValidationError(`Version must have exactly 3 parts, got ${previousTag.length} parts`);
  }

  let newTag = new Version(previousTag[0], previousTag[1], previousTag[2]);
  switch (partToIncrememt)
  {
    case PartToIncrement.Major: {
      newTag.major++;
      newTag.minor = 0;
      newTag.patch = 0;
      break;
    }
    case PartToIncrement.Minor: {
      newTag.minor++;
      newTag.patch = 0;
      break;
    }
    case PartToIncrement.Patch: {
      newTag.patch++;
      break;
    }
    default: {
      throw new ValidationError(`Invalid part to increment: ${partToIncrememt}`);
    }
  }

  return newTag;
}

export function determineLastTag(tags: Array<any>): Tag {
  try {
    validateGitHubResponse(tags, "Tags list");
  } catch (error) {
    throw new ValidationError(`Failed to validate tags response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!Array.isArray(tags)) {
    throw new ValidationError(`Tags must be an array, got ${typeof tags}`);
  }

  if (tags.length === 0) {
    throw new ValidationError("No tags found in repository");
  }

  let Tags: Array<Tag> = new Array<Tag>();

  tags.forEach((element, index) => {
    if (!element || !element.name) {
      throw new ValidationError(`Tag at index ${index} is missing name property`);
    }
    
    try {
      const newTag = new Tag(element.name);
      Tags.push(newTag);
    } catch (error) {
      throw new ValidationError(`Invalid tag at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  if (Tags.length === 0) {
    throw new ValidationError("No valid tags found after validation");
  }

  try {
    Tags.sort((a, b) => compareVersions(a.version, b.version));
  } catch (error) {
    throw new ValidationError(`Failed to sort tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return Tags[Tags.length - 1];
}
