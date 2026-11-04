Instructions for a coding agent: write the GitHub Release notes for svgreel {{tag}}, check that
the release is ready to publish, and report the result to the maintainer.

## Release state

The Release workflow ran on commit {{commit}} on `main`. It has completed these steps:

1. It ran `check`, `test`, `build` and `examples`, and packed svgreel.
2. It uploaded svgreel {{version}} to the npm staging area. npm serves a staged version only after
   a maintainer approves it with 2FA, and the maintainer might not have approved it yet.
3. It created this draft.

The tag {{tag}} does not exist yet. GitHub creates it on commit {{commit}} when the maintainer
publishes the draft. A missing tag and a draft URL that starts with `untagged` are expected.

Publishing the draft starts the Sync template workflow, which copies `template/` to
svgreel-template once npm serves svgreel {{version}}. After the npm approval, the maintainer also
fast-forwards the `stable` branch to the release commit. That push deploys the website and the
localize Worker, and syncs the template again. The maintainer might do it before or after the
publication of the draft.

## Tasks

1. Write the release notes as described in "Release notes", and replace the body of the draft.
2. Check the release state as described in "Release checks".
3. Report to the maintainer as described in "Report". Do not publish the draft until the
   maintainer tells you to.

## Release notes

{{range}}

Changelog sections:

{{changelogs}}

The links point to commit {{commit}}. Read every linked section before you write.

Follow these rules:

- Write in English for people who write svgreel compositions. The changelog entries are written
  for them too: keep their terms and the names of exports, props and CLI options.
- Use only facts from the changelog sections. Do not add internal refactoring, tests, CI, or
  changes to the template, the website, or the localize Worker.
- Read the code at commit {{commit}}, and the user docs in `packages/core/docs/`. Run examples
  or tests in the checkout when they help you confirm an entry. When the checkout does not
  contain the commit, fetch it from `origin`. Do not switch branches, and restore every file that
  you change for this check.
- When the code, the docs, or a check disagrees with a changelog entry, do not correct the entry
  from your own conclusion. Describe the difference in your report to the maintainer.
- Merge entries that describe the same change in several versions.
- A minor version before 1.0 can break existing compositions. List an entry under "Breaking
  changes" when it tells users to change their compositions, options, or build setup. Keep its
  migration step, with a short code example when the entry has one.
- Omit a heading that has no entries.
- Keep the "Changelogs" section and its links unchanged at the end.
- The notes replace the whole body, including the request above this comment and the comment
  itself.

Start each entry with a scope label that names the part of svgreel where users see the change.
Use these labels, in this order, when they fit:

1. `API`: exports of `svgreel`, such as `defineComposition`, hooks, animation helpers, and their
   options.
2. `Components`: `<Text>`, `<SlotCounter>`, `<CodeBlock>`, and the other components.
3. `Output`: the generated SVG files, such as keyframes, file names, size, and browser support.
4. `CLI`: `svgreel build`, its options, and its messages.
5. `Preview`: the preview page.

When no label above fits a change, use a short label that names the part users see, and place it
after the labels above. When an entry changes several scopes in different ways, join their labels
in the order above, such as `**API, Preview:**`, and write the entry once. Within each heading,
order entries by their first label in the order above.

Use this structure:

```md
<One or two sentences that summarize the release for users.>

## Breaking changes

- **<Scope>:** <Change, followed by the migration step>

## Features

- **<Scope>:** <New capability>

## Fixes

- **<Scope>:** <Corrected behavior>

## Changelogs

<The existing list of links>
```

## Release checks

Check these conditions:

- npm serves svgreel {{version}}. Use `vp exec pnpm view svgreel@{{version}} version`.
- The `stable` branch on `origin` points to commit {{commit}}.

## Report

Report these items to the maintainer:

- The differences between the code or docs and the changelog entries, if any.
- The result of each release check.
- The next action:
  - When npm does not serve svgreel {{version}}, stop and ask the maintainer to approve the
    staged version with `vp exec pnpm stage approve`.
  - Otherwise, propose that the maintainer let you publish the draft. When `stable` does not
    point to the release commit, add a reminder to fast-forward it. This step does not block the
    publication.

Do not report an expected state, such as the missing tag, as a problem.
