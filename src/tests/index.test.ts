import { generateNextTag } from "../index"
import * as core from "@actions/core";
import { getOctokit } from "@actions/github";


jest.mock("@actions/github",
  () => {
    return {
      getOctokit: jest.fn(),
      context: jest.fn()
    }
  });

test("1: [Given] I want a tag created with the minor version incrememented [Then] generateNextTag returns the next tag with only the minor part of the version incremented.", () => {
  const lastTag = "1.0.0"
  const expected = "v1.1.0"
  const actual = generateNextTag(lastTag, "minor");

  expect(actual).toEqual(expected);
});
