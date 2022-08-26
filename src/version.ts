export class Version {

  major: number;
  minor: number;
  patch: number;
  
  constructor(newMajor: number, newMinor: number, newPatch: number) {
    this.major = newMajor;
    this.minor = newMinor;
    this.patch = newPatch;
  }

  toString() {
    return "v" + this.major + "." + this.minor + "." + this.patch
  }
}
