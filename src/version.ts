import { validateVersionString, ValidationError } from "./validation";

export class Version {

  major: number;
  minor: number;
  patch: number;
  
  constructor(newMajor: number, newMinor: number, newPatch: number) {
    if (typeof newMajor !== 'number' || isNaN(newMajor) || newMajor < 0) {
      throw new ValidationError(`Major version must be a non-negative number, got ${newMajor}`);
    }
    if (typeof newMinor !== 'number' || isNaN(newMinor) || newMinor < 0) {
      throw new ValidationError(`Minor version must be a non-negative number, got ${newMinor}`);
    }
    if (typeof newPatch !== 'number' || isNaN(newPatch) || newPatch < 0) {
      throw new ValidationError(`Patch version must be a non-negative number, got ${newPatch}`);
    }

    this.major = newMajor;
    this.minor = newMinor;
    this.patch = newPatch;
  }

  static fromString(versionString: string): Version {
    if (!versionString || typeof versionString !== 'string') {
      throw new ValidationError(`Version string must be a non-empty string, got ${typeof versionString}`);
    }

    // Validate the version string format
    validateVersionString(versionString);

    if(versionString.startsWith("v")) {
      versionString = versionString.substring(1);
    }

    let versionArray: Array<number> = versionString.split('.').map(function (item) {
      return parseInt(item);
    }); 

    // Additional validation after parsing
    if (versionArray.length !== 3) {
      throw new ValidationError(`Version must have exactly 3 parts (major.minor.patch), got ${versionArray.length} parts`);
    }

    for (let i = 0; i < versionArray.length; i++) {
      if (isNaN(versionArray[i])) {
        throw new ValidationError(`Version part at index ${i} is not a valid number: ${versionString.split('.')[i]}`);
      }
    }

    return new this(versionArray[0], versionArray[1], versionArray[2]);
  }

  toString() {
    return "v" + this.major + "." + this.minor + "." + this.patch
  }
}
