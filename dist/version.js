"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Version = void 0;
class Version {
    constructor(newMajor, newMinor, newPatch) {
        this.major = newMajor;
        this.minor = newMinor;
        this.patch = newPatch;
    }
    static fromString(versionString) {
        if (versionString.startsWith("v")) {
            versionString = versionString.substring(1);
        }
        let versionArray = versionString.split('.').map(function (item) {
            return parseInt(item);
        });
        return new this(versionArray[0], versionArray[1], versionArray[2]);
    }
    toString() {
        return "v" + this.major + "." + this.minor + "." + this.patch;
    }
}
exports.Version = Version;
