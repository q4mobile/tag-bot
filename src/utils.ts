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

export function parseCommentBody(body: string): PartToIncrement {
  try {
    validateCommentBody(body);
  } catch (error) {
    throw new ValidationError(`Invalid comment body: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!body.startsWith(config.commentIdentifier)) {
    throw new ValidationError(`Comment must start with ${config.commentIdentifier}`);
  }

  let extractedPart: string = body.substring(config.commentIdentifier.length + 1);
  if (!extractedPart || extractedPart.trim().length === 0) {
    throw new ValidationError(`No version increment type specified after ${config.commentIdentifier}`);
  }

  extractedPart = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);

  let partToIncrement: PartToIncrement = PartToIncrement[extractedPart as keyof typeof PartToIncrement];
  
  if (partToIncrement === undefined) {
    throw new ValidationError(`Invalid version increment type: ${extractedPart}. Must be one of: major, minor, patch`);
  }

  return partToIncrement;
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
