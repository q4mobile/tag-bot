import { takeRight } from "lodash";
import { generateNextTag, parseCommentBody, PartToIncrement } from "../utils"
import { Version } from "../version";
import {Tag} from "../tag"

describe("Utility Tests", () => {

  test("1: [Given] I want to create a tag object [When] I call new Tag [Then] I get a Tag object back.", () => {
    const actual = new Tag("v1.0.0");

    expect(actual.name).toEqual("v1.0.0");
    expect(actual.version).toEqual("1.0.0");
  });
  test("2: [Given] I want to create a tag object [When] I call new Tag with a string that doesn't start with v [Then] I get a Tag object back.", () => {
    const actual = new Tag("1.0.0");

    expect(actual.name).toEqual("1.0.0");
    expect(actual.version).toEqual("1.0.0");
  });


});
