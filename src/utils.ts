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

export interface DuplicateTagInfo {
  exists: boolean;
  tagName: string;
  existingTag?: any;
  conflictType: 'exact_match' | 'version_conflict' | 'none';
  suggestedResolution?: string;
}

/**
 * Checks if a tag already exists in the repository
 * @param tags - Array of existing tags from GitHub API
 * @param tagName - Tag name to check
 * @returns DuplicateTagInfo with detailed conflict information
 */
export function checkDuplicateTag(tags: Array<any>, tagName: string): DuplicateTagInfo {
  if (!tags || !Array.isArray(tags)) {
    return {
      exists: false,
      tagName,
      conflictType: 'none'
    };
  }

  // Check for exact match
  const exactMatch = tags.find(tag => tag.name === tagName);
  if (exactMatch) {
    return {
      exists: true,
      tagName,
      existingTag: exactMatch,
      conflictType: 'exact_match',
      suggestedResolution: `Tag ${tagName} already exists and points to commit ${exactMatch.commit?.sha || 'unknown'}. Consider using a different version or verify if this tag is correct.`
    };
  }

  // Check for version conflicts (same version number, different format)
  const cleanTagName = tagName.startsWith('v') ? tagName.substring(1) : tagName;
  const versionConflict = tags.find(tag => {
    const cleanExisting = tag.name.startsWith('v') ? tag.name.substring(1) : tag.name;
    return cleanExisting === cleanTagName;
  });

  if (versionConflict) {
    return {
      exists: true,
      tagName,
      existingTag: versionConflict,
      conflictType: 'version_conflict',
      suggestedResolution: `Version ${cleanTagName} already exists as tag ${versionConflict.name}. This suggests a version format conflict. Consider using a different version or standardizing your tag format.`
    };
  }

  return {
    exists: false,
    tagName,
    conflictType: 'none'
  };
}

/**
 * Finds the next available version that doesn't conflict with existing tags
 * @param baseVersion - Base version to start from
 * @param incrementType - Type of increment to apply
 * @param existingTags - Array of existing tags
 * @param maxAttempts - Maximum attempts to find a non-conflicting version
 * @returns Version object with non-conflicting version
 */
export function findNextAvailableVersion(
  baseVersion: Version, 
  incrementType: PartToIncrement, 
  existingTags: Array<any>, 
  maxAttempts: number = 10
): Version {
  let currentVersion = new Version(baseVersion.major, baseVersion.minor, baseVersion.patch);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate next version based on increment type
    let nextVersion: Version;
    switch (incrementType) {
      case PartToIncrement.Major:
        nextVersion = new Version(currentVersion.major + 1, 0, 0);
        break;
      case PartToIncrement.Minor:
        nextVersion = new Version(currentVersion.major, currentVersion.minor + 1, 0);
        break;
      case PartToIncrement.Patch:
        nextVersion = new Version(currentVersion.major, currentVersion.minor, currentVersion.patch + 1);
        break;
      default:
        throw new ValidationError(`Invalid increment type: ${incrementType}`);
    }

    // Check if this version conflicts
    const conflictCheck = checkDuplicateTag(existingTags, nextVersion.toString());
    if (!conflictCheck.exists) {
      return nextVersion;
    }

    // Move to next iteration
    currentVersion = nextVersion;
  }

  throw new ValidationError(
    `Unable to find a non-conflicting version after ${maxAttempts} attempts. ` +
    `Consider manually specifying a version or resolving existing tag conflicts.`
  );
}

/**
 * Validates that a proposed tag name is safe to create
 * @param tags - Array of existing tags
 * @param proposedTag - Proposed tag name
 * @param allowOverwrite - Whether to allow overwriting existing tags (default: false)
 * @returns Validation result with conflict information
 */
export function validateTagSafety(
  tags: Array<any>, 
  proposedTag: string, 
  allowOverwrite: boolean = false
): { safe: boolean; conflictInfo?: DuplicateTagInfo; message: string } {
  const conflictInfo = checkDuplicateTag(tags, proposedTag);
  
  if (!conflictInfo.exists) {
    return {
      safe: true,
      message: `Tag ${proposedTag} is safe to create - no conflicts detected.`
    };
  }

  if (allowOverwrite) {
    return {
      safe: true,
      conflictInfo,
      message: `Tag ${proposedTag} conflicts with existing tag ${conflictInfo.existingTag?.name}, but overwrite is allowed.`
    };
  }

  return {
    safe: false,
    conflictInfo,
    message: `Tag ${proposedTag} cannot be created due to conflicts. ${conflictInfo.suggestedResolution}`
  };
}

/**
 * Generates a safe tag name that doesn't conflict with existing tags
 * @param baseVersion - Base version to start from
 * @param incrementType - Type of increment to apply
 * @param existingTags - Array of existing tags
 * @param tagPrefix - Prefix for tags (e.g., 'v')
 * @returns Safe tag name string
 */
export function generateSafeTagName(
  baseVersion: Version, 
  incrementType: PartToIncrement, 
  existingTags: Array<any>, 
  tagPrefix: string = 'v'
): string {
  try {
    const safeVersion = findNextAvailableVersion(baseVersion, incrementType, existingTags);
    return `${tagPrefix}${safeVersion.toString()}`;
  } catch (error) {
    // If we can't find a safe version, try with a timestamp suffix
    const timestamp = new Date().getTime();
    const fallbackVersion = new Version(baseVersion.major, baseVersion.minor, baseVersion.patch);
    
    switch (incrementType) {
      case PartToIncrement.Major:
        fallbackVersion.major++;
        fallbackVersion.minor = 0;
        fallbackVersion.patch = 0;
        break;
      case PartToIncrement.Minor:
        fallbackVersion.minor++;
        fallbackVersion.patch = 0;
        break;
      case PartToIncrement.Patch:
        fallbackVersion.patch++;
        break;
    }
    
    return `${tagPrefix}${fallbackVersion.toString()}-${timestamp}`;
  }
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

  // Validate the version format
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
