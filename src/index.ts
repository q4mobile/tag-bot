import * as core from "@actions/core";
import * as github from "@actions/github";
import { Tag } from "./tag";
import { determineLastTag, generateNextTag, parseCommentBody, PartToIncrement } from "./utils";
import config from "./config";

const token = core.getInput("token");
const octokit = github.getOctokit(token);
const repo = github.context.repo;

async function run(): Promise<void> {
  try {

    console.log("Checking comments to see if there are comments indicating if we should incrememnt something other than the minor portion of the previous version: ")
    let partToIncrement: PartToIncrement = PartToIncrement.Minor; // default
    // check for comments (but you have to use issues!)
    await octokit.rest.issues.listComments({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: github.context.payload.pull_request!.number
    }).then(async ({ data }) => {

      data.forEach(comment => {
        if (comment.body!.startsWith(config.commentIdentifier)) {
          partToIncrement = parseCommentBody(comment.body!);
        }
      })
    });

    console.log("Figuring out what the last tag was and creating the new tag based off that: ")

    octokit.rest.repos.listTags({
      owner: repo.owner,
      repo: repo.repo
    })
      .then(async ({ data }) => {

        let lastTag:Tag = new Tag("v0.0.0");
        if (data.length > 0) {
          lastTag = determineLastTag(data);
        }

        console.log("The last tag in the repository is:", lastTag.version);
        const newTag = generateNextTag(lastTag.version, partToIncrement);

        console.log("Creating new tag in repository:", newTag.toString())
        const tag = await createTag(newTag.toString());
        const ref = await createRef("refs/tags/" + tag.data.tag, tag.data.sha)

        console.log("Created new tag", tag.data.tag);
      });

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function createRef(ref: string, sha: string) {
  return await octokit.rest.git.createRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: ref,
    sha: sha
  });
}

async function createTag(newTag: string) {
  return await octokit.rest.git.createTag({
    owner: repo.owner,
    repo: repo.repo,
    tag: newTag,
    message: "Created by Tag Bot",
    object: github.context.sha,
    type: "commit",
    tagger: { name: "Tag Bot", email: "tagbot@q4inc.com" }
  });
}

run()
