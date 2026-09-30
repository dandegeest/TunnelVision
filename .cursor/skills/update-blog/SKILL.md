---
name: update-blog
description: >-
  Adds one newest-first entry to the TunnelVision hackathon live blog, then
  commits and pushes only that entry and its media. Use when the user says
  "Update Blog" followed by the text and optional images/videos. Do not include
  active dev work. No patch file.
---

# Update Blog

Unattended. Do not ask questions. Do not write a desktop patch. Do not commit or push anything except this live entry.

The user says **Update Blog**, then the update text, and optionally one or more images (attached or as file paths).

## Write the entry

Edit only `genesis/live/index.html`. Put images in `genesis/live/images/`
and videos in `genesis/live/videos/`.

Insert a new `<article class="live-update">` immediately after the HTML comment and before every existing article. Newest stays first.

- **Time:** current local time, `h:mm AM/PM`, unless the user gave a time.
- **Title:** a short title they gave, otherwise a few words taken from the text. Do not use the whole paragraph as the title.
- **Text:** their update, lightly cleaned for typos. Do not add commentary, plans, or dev notes they did not write.
- **Media:** copy each file into its matching media directory with a short lowercase name (`1030-desk.jpg`, `1030-demo.mp4`). Keep the original format.
- One video and no other media: render it inline with `<video class="live-inline-video" controls playsinline preload="metadata" src="videos/1030-demo.mp4"></video>`.
- Multiple media items (any mix of photos and videos): put them in one `.live-images` gallery. Use `<img src="images/1030-desk.jpg" alt="Description">` for photos and `<video data-gallery-video muted playsinline preload="metadata" src="videos/1030-demo.mp4" aria-label="Description"></video>` for video thumbnails. Videos play in the lightbox, not in the gallery.
- A single image may use `.live-images` as a one-item lightbox gallery. Omit media markup when there is no media.

```html
<article class="live-update">
  <time>8:15 AM</time>
  <h2>Title</h2>
  <p>Short text.</p>
  <video class="live-inline-video" controls playsinline preload="metadata"
         src="videos/clip.mp4"></video>
  <div class="live-images">
    <img src="images/photo.jpg" alt="Photo description">
    <video data-gallery-video muted playsinline preload="metadata"
           src="videos/clip.mp4" aria-label="Video description"></video>
  </div>
</article>
```

Do not change navigation, deployment, or unrelated files.

## Commit and push only the blog

1. `git fetch origin`
2. `git status` and `git rev-list --count origin/main..HEAD`

**In sync, and the only dirty paths are under `genesis/live/`:**

```bash
git add genesis/live/index.html genesis/live/images genesis/live/videos
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

Copy the updated `genesis/live/index.html` and only this entry's new media files into that worktree. From the worktree, `git add` those paths only, commit with the same message, then `git push origin HEAD:main`. Remove the worktree with `git worktree remove /tmp/tv-live-blog`.

Never `git add -A` or `git add .`. Never stage app code, docs, or unrelated media. Never amend, force-push, skip hooks, or change git config.

After a worktree push, if the current branch can fast-forward to `origin/main`, stash only `genesis/live`, fast-forward, then drop that stash. If it cannot fast-forward, leave the local branch and its other work as they are. The site already has the entry.

## Done

Reply with the entry title, the commit, and that `/live` updates when Pages finishes. Do not mention the patch rule or other dirty files except to confirm they were left out.
