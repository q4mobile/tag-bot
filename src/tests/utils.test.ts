import { generateNextTag, PartToIncrement } from "../utils"

test("1: [Given] I want a tag created with the minor version incrememented [Then] generateNextTag returns the next tag with only the minor part of the version incremented.", () => {
  const lastTag = "1.0.0"
  const expected = "v1.1.0"
  const actual = generateNextTag(lastTag, PartToIncrement.Minor);

  expect(actual).toEqual(expected);
});

test("2: [Given] I want a tag created with the major version incrememented [Then] generateNextTag returns the next tag with only the major part of the version incremented.", () => {
  const lastTag = "1.0.0"
  const expected = "v2.0.0"
  const actual = generateNextTag(lastTag, PartToIncrement.Major);

  expect(actual).toEqual(expected);
});

test("3: [Given] I want a tag created with the patch version incrememented [Then] generateNextTag returns the next tag with only the patch part of the version incremented.", () => {
  const lastTag = "1.0.0"
  const expected = "v1.0.1"
  const actual = generateNextTag(lastTag, PartToIncrement.Patch);

  expect(actual).toEqual(expected);
});
