"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = void 0;
class Tag {
    constructor(tagName) {
        this.name = tagName;
        this.version = this.name.substring(1);
    }
    toString() {
        return "v" + this.version;
    }
}
exports.Tag = Tag;
