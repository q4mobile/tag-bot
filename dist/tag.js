"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = void 0;
class Tag {
    constructor(tagName) {
        this.name = tagName;
        this.version = this.name.substring(1);
    }
}
exports.Tag = Tag;
