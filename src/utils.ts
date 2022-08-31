import { Version } from "./version";

export enum PartToIncrement {
  Major,
  Minor,
  Patch
}

export function generateNextTag(lastTag: string, partToIncrememt: PartToIncrement) {
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
