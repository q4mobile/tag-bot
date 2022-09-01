import { determineLastTag, generateNextTag, parseCommentBody, PartToIncrement } from "../utils"
import { Version } from "../version";

describe("Utility Tests: generateNextTag", () => {

  test("1: [Given] I want a tag created with the minor version incrememented [Then] generateNextTag returns the next tag with only the minor part of the version incremented.", () => {
    const lastTag = "1.0.0"
    const expected = new Version(1, 1, 0);
    const actual = generateNextTag(lastTag, PartToIncrement.Minor);

    expect(actual).toEqual(expected);
    expect(actual.patch).toEqual(0);
  });

  test("2: [Given] I want a tag created with the major version incrememented [Then] generateNextTag returns the next tag with only the major part of the version incremented.", () => {
    const lastTag = "1.0.0"
    const expected = new Version(2, 0, 0);
    const actual = generateNextTag(lastTag, PartToIncrement.Major);

    expect(actual).toEqual(expected);
    expect(actual.minor).toEqual(0);
    expect(actual.patch).toEqual(0);
  });

  test("3: [Given] I want a tag created with the patch version incrememented [Then] generateNextTag returns the next tag with only the patch part of the version incremented.", () => {
    const lastTag = "1.0.0"
    const expected = new Version(1, 0, 1);
    const actual = generateNextTag(lastTag, PartToIncrement.Patch);

    expect(actual).toEqual(expected);
  });

});

describe("Utility Tests: parseCommentBody", () => {

  test("1: [Given] I want to increment by major [And] the pull request contains a comment with major [Then] parseCommentBody should return PartToIncrement.Major .", () => {

    const expected = PartToIncrement.Major;
    const actual = parseCommentBody("/tag-bot major");

    expect(actual).toEqual(expected);
  });

  test("2: [Given] I want to increment by minor [And] the pull request contains a comment with minor [Then] parseCommentBody should return PartToIncrement.Minor.", () => {

    const expected = PartToIncrement.Minor;
    const actual = parseCommentBody("/tag-bot minor");

    expect(actual).toEqual(expected);
  });

  test("3: [Given] I want to increment by patch [And] the pull request contains a comment with patch [Then] parseCommentBody should return PartToIncrement.Patch.", () => {

    const expected = PartToIncrement.Patch;
    const actual = parseCommentBody("/tag-bot patch");

    expect(actual).toEqual(expected);
  });

});


describe("Utility Tests: determineLastTag", () => {

  const tagData = [
    {
      name:"v1.0.0"
    },
    {
      name:"v1.1.0"
    }
  ]

  test("1: [Given] I have a collection of tagData [When] I call detemineLastTag [Then] it should return the most recent tag.", () => {

    const expected = "1.1.0";
    const actual = determineLastTag(tagData);

    expect(actual.version).toEqual(expected);
  });
});
