import * as core from "@actions/core";
import * as github from "@actions/github";
import { Tag } from "./tag";
import { Version } from "./version";
import { compareVersions } from 'compare-versions';

const token = core.getInput("token");
const octokit = github.getOctokit(token);
const repo = github.context.repo;



async function run(): Promise<void> {
  try {
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
        const newTag = generateNextTag(lastTag.version, "minor");

        console.log("Creating new tag in repository:", newTag)
        const tag = await createTag(newTag);
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

export function generateNextTag(lastTag: string, partToIncrememt: string) {
  let previousTag: Array<number> = lastTag.split('.').map(function (item) {
    return parseInt(item);
  });

  let newTag = new Version(previousTag[0], previousTag[1], previousTag[2]);
  switch (partToIncrememt)
  {
    case "major": {
      newTag.major++;
      break;
    }
    case "minor": {
      newTag.minor++;
      break;
    }
    case "patch": {
      newTag.patch++;
      break;
    }
  }

  return newTag.toString();
}

run()
