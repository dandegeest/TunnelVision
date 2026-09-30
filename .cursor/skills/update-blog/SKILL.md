---
name: update-blog
description: >-
  Adds one newest-first entry to the TunnelVision hackathon live blog, then
  commits and pushes only that entry and its images. Use when the user says
  "Update Blog" followed by the text and optional images. Do not include
  active dev work. No patch file.
---

# Update Blog

Unattended. Do not ask questions. Do not write a desktop patch. Do not commit or push anything except this live entry.

The user says **Update Blog**, then the update text, and optionally one or more images (attached or as file paths).

## Write the entry

Edit only `genesis/live/index.html`. Put images only in `genesis/live/images/`.

Insert a new `<article class="live-update">` immediately after the HTML comment and before every existing article. Newest stays first.

- **Time:** current local time, `h:mm AM/PM`, unless the user gave a time.
- **Title:** a short title they gave, otherwise a few words taken from the text. Do not use the whole paragraph as the title.
- **Text:** their update, lightly cleaned for typos. Do not add commentary, plans, or dev notes they did not write.
- **Images:** copy each image into `genesis/live/images/` with a short lowercase name (`0832-desk.jpg`). Keep the original format. One `<img>` per image inside `.live-images`. Omit `.live-images` when there are no images.

```html
<article class="live-update">
  <time>8:15 AM</time>
  <h2>Title</h2>
  <p>Short text.</p>
  <div class="live-images">
    <img src="images/0832-desk.jpg" alt="Title">
  </div>
</article>
```

Do not change CSS, navigation, deployment, or any other file.

## Commit and push only the blog

1. `git fetch origin`
2. `git status` and `git rev-list --count origin/main..HEAD`

**In sync, and the only dirty paths are under `genesis/live/`:**

```bash
git add genesis/live/index.html genesis/live/images
git commit -m "$(cat <<'EOF'
Live: Title here.

EOF
)"
git push origin HEAD
```

**Any other dirty files, or commits already ahead of `origin/main`:** leave them untouched. Publish the blog from a detached worktree so those commits and files are not pushed.

```bash
git worktree add --detach /tmp/tv-live-blog origin/main
```

Copy the updated `genesis/live/index.html` and only this entry's new image files into that worktree. From the worktree, `git add` those paths only, commit with the same message, then `git push origin HEAD:main`. Remove the worktree with `git worktree remove /tmp/tv-live-blog`.

Never `git add -A` or `git add .`. Never stage app code, docs, or unrelated media. Never amend, force-push, skip hooks, or change git config.

After a worktree push, if the current branch can fast-forward to `origin/main`, stash only `genesis/live`, fast-forward, then drop that stash. If it cannot fast-forward, leave the local branch and its other work as they are. The site already has the entry.

## Done

Reply with the entry title, the commit, and that `/live` updates when Pages finishes. Do not mention the patch rule or other dirty files except to confirm they were left out.
