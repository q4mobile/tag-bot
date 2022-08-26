import * as core from "@actions/core";
import * as github from "@actions/github";
import { Tag } from "./tag";
import { compareVersions } from 'compare-versions';
import { Version } from "./version";

async function run(): Promise<void> {
  try {
    const token = core.getInput("token");
    const octokit = github.getOctokit(token);
    const repo = github.context.repo;

    let Tags: Array<Tag> = new Array<Tag>();

    octokit.rest.repos.listTags({
      owner: repo.owner,
      repo: repo.repo
    })
    .then(({ data } ) => {

      if(data.length === 0) {
        throw Error("No tags found in repository");
      }

      
      data.forEach(element => {
        const newTag = new Tag(element.name);
        Tags.push(newTag);
      });

      Tags.sort((a,b) => compareVersions(a.version, b.version));

      const lastTag = Tags[Tags.length - 1];
      console.log("Last tag is: ", lastTag.name);
      const newTag = GenerateNextTag(lastTag.version);
      console.log("New tag is", newTag);


    });
  
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function GenerateNextTag(lastTag: string) {

  let previousTag: Array<number> = lastTag.split('.').map(function(item) {
    return parseInt(item);
  });

  console.log(previousTag[0]);

  const newTag = new Version(previousTag[0], previousTag[1] + 1, previousTag[1]);

  return newTag.toString();
}

run()
