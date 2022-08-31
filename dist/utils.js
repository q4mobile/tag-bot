"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNextTag = exports.PartToIncrement = void 0;
const version_1 = require("./version");
var PartToIncrement;
(function (PartToIncrement) {
    PartToIncrement[PartToIncrement["Major"] = 0] = "Major";
    PartToIncrement[PartToIncrement["Minor"] = 1] = "Minor";
    PartToIncrement[PartToIncrement["Patch"] = 2] = "Patch";
})(PartToIncrement = exports.PartToIncrement || (exports.PartToIncrement = {}));
function generateNextTag(lastTag, partToIncrememt) {
    let previousTag = lastTag.split('.').map(function (item) {
        return parseInt(item);
    });
    let newTag = new version_1.Version(previousTag[0], previousTag[1], previousTag[2]);
    switch (partToIncrememt) {
        case PartToIncrement.Major: {
            newTag.major++;
            break;
        }
        case PartToIncrement.Minor: {
            newTag.minor++;
            break;
        }
        case PartToIncrement.Patch: {
            newTag.patch++;
            break;
        }
    }
    return newTag.toString();
}
exports.generateNextTag = generateNextTag;
