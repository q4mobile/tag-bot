import { validateVersionString, ValidationError } from "./validation";

export class Tag {

  name: string;
  version: string;

  constructor(tagName: string) {
    if (!tagName || typeof tagName !== 'string') {
      throw new ValidationError(`Tag name must be a non-empty string, got ${typeof tagName}`);
    }

    this.name = tagName;

    if(this.name.startsWith("v")) {
      this.version = this.name.substring(1);
    } else {
      this.version = this.name;
    }

    // Validate the version format
    try {
      validateVersionString(this.version);
    } catch (error) {
      throw new ValidationError(`Invalid tag format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  toString() {
    return "v" + this.version
  }
}

