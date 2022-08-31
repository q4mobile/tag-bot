import * as core from "@actions/core";
import * as github from "@actions/github";
import { Tag } from "./tag";
import { compareVersions } from 'compare-versions';
import { generateNextTag, PartToIncrement } from "./utils";
import { cpuUsage } from "process";

const token = core.getInput("token");
const octokit = github.getOctokit(token);
const repo = github.context.repo;

async function run(): Promise<void> {
  try {

    console.log("PR Number: ", github.context.payload.pull_request!.number)

    let partToIncrement = PartToIncrement.Minor; // default
    // check for comments (but you have to use issues!)
    await octokit.rest.issues.listComments({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: github.context.payload.pull_request!.number
    }).then ( async ({ data }) => {
  
      const identifier = "/tag-bot"
      data.forEach(comment => {
        console.log(comment.body);
        if(comment.body!.startsWith(identifier)) {
          console.log("partToIncrememnt: ", comment.body!.substring(identifier.length));
        }
      })
    });
    

    let Tags: Array<Tag> = new Array<Tag>();

    octokit.rest.repos.listTags({
      owner: repo.owner,
      repo: repo.repo
    })
      .then(async ({ data }) => {

        if (data.length === 0) {
          throw Error("No tags found in repository");
        }

        data.forEach(element => {
          const newTag = new Tag(element.name);
          Tags.push(newTag);
        });

        Tags.sort((a, b) => compareVersions(a.version, b.version));

        const lastTag = Tags[Tags.length - 1];
        console.log("The last tag in the repository is:", lastTag.version);
        const newTag = generateNextTag(lastTag.version, PartToIncrement.Minor);

        console.log("Creating new tag in repository:", newTag)
        const tag = await createTag(newTag);
        const ref = await createRef("refs/tags/" + tag.data.tag, tag.data.sha)

        console.log("Created new tag", tag.data.tag);
      });

  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function checkCommentsForCommand() {
  return 
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
