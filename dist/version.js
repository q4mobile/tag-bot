"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Version = void 0;
class Version {
    constructor(newMajor, newMinor, newPatch) {
        this.major = newMajor;
        this.minor = newMinor;
        this.patch = newPatch;
    }
    toString() {
        return "v" + this.major + "." + this.minor + "." + this.patch;
    }
}
exports.Version = Version;
