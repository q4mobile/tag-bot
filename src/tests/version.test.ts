import { Version } from "../version";

describe("Version Tests", () => {

  test("1: [Given] I want to generate a version from a string [Then] fromString will create a new instance of Version.", () => {
    const versionString = "v1.0.0"
    const expected = new Version(1, 0, 0);
    const actual = Version.fromString(versionString);

    expect(actual).toEqual(expected);
  });
});
