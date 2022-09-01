import { compareVersions } from "compare-versions";
import config from "./config";
import { Tag } from "./tag";
import { Version } from "./version";

export enum PartToIncrement {
  Major,
  Minor,
  Patch
}

export function generateNextTag(lastTag: string, partToIncrememt: PartToIncrement): Version {
  let previousTag: Array<number> = lastTag.split('.').map(function (item) {
    return parseInt(item);
  });

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
  }

  return newTag;
}

export function parseCommentBody(body: string): PartToIncrement {
    let extractedPart: string = body.substring(config.commentIdentifier.length + 1);
    extractedPart = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);

    let partToIncrement:PartToIncrement = PartToIncrement[extractedPart as keyof typeof PartToIncrement];

    return partToIncrement;
}

export function determineLastTag(tags: Array<any>): Tag {
  
    let Tags: Array<Tag> = new Array<Tag>();

    tags.forEach(element => {
      const newTag = new Tag(element.name);
      Tags.push(newTag);
    });

    Tags.sort((a, b) => compareVersions(a.version, b.version));

    return Tags[Tags.length - 1];

}
