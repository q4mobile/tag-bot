export class Version {

  major: string;
  minor: string;
  patch: string;
  
  constructor(newMajor: string, newMinor: string, newPatch: string) {
    this.major = newMajor;
    this.minor = newMinor;
    this.patch = newPatch;
  }

  toString() {
    return "v" + this.major + "." + this.minor + "." + this.patch
  }
}
