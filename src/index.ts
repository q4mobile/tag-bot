import * as core from "@actions/core";
import * as github from "@actions/github";
import { Tag } from "./tag";

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

      
      console.log(data);
      const tags = JSON.parse(data.toString());

      for (const tag in tags) {

        const newTag = new Tag(tags.name);
        Tags.push(newTag);
        console.log(newTag);
      }
    });
  
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
