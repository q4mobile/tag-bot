import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  try {
    const token = core.getInput("token");
    const octokit = github.getOctokit(token);
    const repo = github.context.repo;
  

    console.log(repo.owner);
    console.log(repo.repo);

    const tags = await octokit.rest.repos.listTags({
      owner: repo.owner,
      repo: repo.repo
    });
  
    for (const tag in tags) {
      console.log(tag);
      core.info(tag);
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
