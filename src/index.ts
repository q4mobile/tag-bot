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

      
      let tags: any = data;

      data.forEach(element => {
        const newTag = new Tag(element.name);
        Tags.push(newTag);
      });

      Tags.forEach( tag => {
        console.log(tag.name);
      });

    });
  
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
