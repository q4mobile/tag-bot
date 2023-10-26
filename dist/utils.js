"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineLastTag = exports.parseCommentBody = exports.generateNextTag = exports.PartToIncrement = void 0;
const compare_versions_1 = require("compare-versions");
const config_1 = __importDefault(require("./config"));
const tag_1 = require("./tag");
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
            newTag.minor = 0;
            newTag.patch = 0;
            break;
        }
        case PartToIncrement.Minor: {
            newTag.minor++;
            newTag.patch = 0;
            break;
        }
        case PartToIncrement.Patch: {
            newTag.patch++;
            break;
        }
    }
    return newTag;
}
exports.generateNextTag = generateNextTag;
function parseCommentBody(body) {
    let extractedPart = body.substring(config_1.default.commentIdentifier.length + 1);
    extractedPart = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);
    let partToIncrement = PartToIncrement[extractedPart];
    return partToIncrement;
}
exports.parseCommentBody = parseCommentBody;
function determineLastTag(tags) {
    let Tags = new Array();
    tags.forEach(element => {
        const newTag = new tag_1.Tag(element.name);
        Tags.push(newTag);
    });
    Tags.sort((a, b) => (0, compare_versions_1.compareVersions)(a.version, b.version));
    return Tags[Tags.length - 1];
}
exports.determineLastTag = determineLastTag;
