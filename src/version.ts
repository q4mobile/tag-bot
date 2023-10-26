export class Version {

  major: number;
  minor: number;
  patch: number;
  
  constructor(newMajor: number, newMinor: number, newPatch: number) {
    this.major = newMajor;
    this.minor = newMinor;
    this.patch = newPatch;
  }

  static fromString(versionString: string) {
    if(versionString.startsWith("v")) {
      versionString = versionString.substring(1);
    }

    let versionArray: Array<number> = versionString.split('.').map(function (item) {
      return parseInt(item);
    }); 

    return new this(versionArray[0],versionArray[1], versionArray[2])
  }

  toString() {
    return "v" + this.major + "." + this.minor + "." + this.patch
  }
}
