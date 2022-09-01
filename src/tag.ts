export class Tag {

  name: string;
  version: string;

  constructor(tagName: string) {
    this.name = tagName;
    this.version = this.name.substring(1);
  }

  toString() {
    return "v" + this.version
  }
}

