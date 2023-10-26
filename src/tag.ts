export class Tag {

  name: string;
  version: string;

  constructor(tagName: string) {
    this.name = tagName;

    if(this.name.startsWith("v")) {
      this.version = this.name.substring(1);
    } else {
      this.version = this.name;
    }
  }

  toString() {
    return "v" + this.version
  }
}

