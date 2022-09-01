# Tag Bot

## Overview

Tag bot is a github action that will create tags after you have merged into a specific branch. This action was initially built to help with Studio releases (Studio is released from tags, not main), but can be used by any team that wishes to generate tags when merging into main.

## Usage

Below is a simple implementation of this action, it will generate a new tag when a pull request that is meant to be merged into main is closed.

```
name: "Create Tags"
on:
  pull_request:
    types: [closed]
  branches:    
    - main

jobs:
  create_tags:
    name: 'Create release tags'
    runs-on: ubuntu-latest
    steps:
      - uses: q4chrisj/tag-bot@develop
        with: 
          token: ${{ github.token }}
```

If you just merge your changes into main, this action will find the most recent tag in your repository and then increment the minor part of the tag, for example:

If the last tag in the repository is ```v1.0.0``` after the merge is done, a new tag ```v1.1.0``` will be created.

### Additional Use Cases

By default the action will increment the minor part of the version when creating a new tag, but what if I want to increment the major part of the version or the patch?

You are in luck

If you wish to bump the next tag to a major version, include the following comment on the pull request

```/tag-bot major```

When the pull request is closed, the next tag will be bumped to a new major version

```v1.1.0``` would generate ```v2.0.0``` as the next tag

If you want create a hotfix, include the following comment on the pull request

```/tag-bot patch```

When the pull request is closed, the patch portion will be incremented

```v1.1.0``` would generate ```v1.1.1``` as the next tag
