# skills

[![skills.sh](https://skills.sh/b/1weiho/skills)](https://skills.sh/1weiho/skills)

A collection of Yiwei's agent skills.

## Install

```bash
npx skills add 1weiho/skills
```

## Skills

### cinematic-shot

Shoots software UI like a film: a sequence of steep, oblique close-ups of the interface floating on a dark or light stage, with a razor-thin focal plane, a slow camera drift, and hard cuts on the action, ending on one line of copy and a still logo. It also shoots the same look as single stills for hero images, social cards, and posters. It covers the look and the edit, and leaves the rendering stack to the agent. Watch the [demo video](https://x.com/1weiho/status/2110402425475698707).

Try: "Make a cinematic launch video for our new search feature." or "Shoot a hero image and a social card of our new search feature."

```bash
npx skills add 1weiho/skills --skill cinematic-shot
```

[`skills/cinematic-shot/SKILL.md`](skills/cinematic-shot/SKILL.md)

### clean-ui-shot

Shoots framed, cropped screenshots of a web app's real UI for docs, changelogs, landing pages, and READMEs: the app as a rounded, shadowed window on a stage, padded where the window edge shows and bleeding off the stage where the crop cuts through. It asks which style you want first: **clean**, a soft gray stage, or **glass**, a gradient coloured from the UI itself with a frosted white bezel. It drives the running app with Playwright, so the shots show the current UI, and comes with a shot recipe file, the shoot-and-compose script, and a contact sheet for reviewing a batch.

Try: "Take clean screenshots of the settings page and the export dialog for the docs."

```bash
npx skills add 1weiho/skills --skill clean-ui-shot
```

[`skills/clean-ui-shot/SKILL.md`](skills/clean-ui-shot/SKILL.md)

## Support

If these skills have been useful to you, consider supporting development:

<a href="https://buymeacoffee.com/1weiho"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="40"></a>
