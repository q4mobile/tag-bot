import * as core from "@actions/core";
import github from "@actions/github";

async function run() {

  const context = github.context;
  const token = core.getInput("token");
  const octokit = github.getOctokit(token);
  console.debug(token);
  const repo = context.repo;

  const tags = await octokit.rest.repos.listTags({
    owner: repo.owner,
    repo: repo.repo
  });

  for (var tag in tags) {
    core.info(tag);
  }
}
