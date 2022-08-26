import * as core from "@actions/core";
import github from "@actions/github";
import { formatWithOptions } from "util";
const context = github.context;

async function run() {

  const token = core.getInput("token");
  const octokit = github.getOctokit(token);
  const repo = context.repo;

  const tags = await octokit.repos.listTags({
    owner: repo.owner,
    repo: repo
  });

  core.debug(tags);
}
