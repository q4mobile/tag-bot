import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  try {
    const token = core.getInput("token");
    const octokit = github.getOctokit(token);
    const repo = github.context.repo;
  

    console.log(repo.owner);
    console.log(repo.repo);

    octokit.rest.repos.listTags({
      owner: repo.owner,
      repo: repo.repo
    })
    .then(({ data } ) => {

      for (const tag in data) {
        console.log(tag);
        core.info(tag);
      }
    });
  
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
