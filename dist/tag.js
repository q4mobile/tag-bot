"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = void 0;
class Tag {
    constructor(tagName) {
        this.name = tagName;
        if (this.name.startsWith("v")) {
            this.version = this.name.substring(1);
        }
        else {
            this.version = this.name;
        }
    }
    toString() {
        return "v" + this.version;
    }
}
exports.Tag = Tag;
