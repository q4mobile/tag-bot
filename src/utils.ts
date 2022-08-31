import config from "./config";
import { Version } from "./version";

export enum PartToIncrement {
  Major,
  Minor,
  Patch
}

export function generateNextTag(lastTag: string, partToIncrememt: PartToIncrement | unknown) {
  let previousTag: Array<number> = lastTag.split('.').map(function (item) {
    return parseInt(item);
  });

  let newTag = new Version(previousTag[0], previousTag[1], previousTag[2]);
  switch (partToIncrememt)
  {
    case PartToIncrement.Major: {
      newTag.major++;
      break;
    }
    case PartToIncrement.Minor: {
      newTag.minor++;
      break;
    }
    case PartToIncrement.Patch: {
      newTag.patch++;
      break;
    }
  }

  return newTag.toString();
}

export function parseCommentBody(body: string): PartToIncrement | unknown {
  if(body.startsWith(config.commentIdentifier)) {

    let extractedPart: string = body.substring(config.commentIdentifier.length + 1);
    extractedPart = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);

    let partToIncrement:PartToIncrement = PartToIncrement[extractedPart as keyof typeof PartToIncrement];

    return partToIncrement;
  }

}
