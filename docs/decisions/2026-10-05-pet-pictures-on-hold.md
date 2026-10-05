# Decision: Pet pictures in chat (images that fit the moment) are on hold

## Context
There was a request (2026-10-05): chat alone gets stale, so relationship mode would be much more fun if, now and then, a friend sent **a picture with the pet in it** that fits the conversation (expressions and situations such as sulking or beaming). We looked at two ways.

- **AI image generation**: Generate a scene using one frame of the pet's sprite as the reference image. Of the connections the app supports today, only the OpenAI image API can generate images. Claude Code and Codex subscriptions and Ollama cannot. It is billed per image, and the character changes a little with every generation, so it sometimes does not look like "our pet".
- **The app composes it**: The AI picks the yard background, the pet's pose and props, and the app puts them together. This works free and instantly with every connection, but what it can show is tied to the fixed animation rows of the sprite sheet (resting, walking, working, sleeping, jumping, waving…). No pet has expressions like a sulking face or a beaming face. And every pet has a different sheet, so shared scenes cannot be drawn in advance.

Replacing pictures with letters (text) was not what the request meant. That implementation (a mailbox in the yard, postcards in the chat) was removed.

## Decision
We **will not build** sending pet pictures for now. Neither way meets the condition of "showing expressions and situations for many different pets". Relationship mode goes ahead with tone of voice, forms of address, and friends talking among themselves.

## Consequences
- Positive: We do not leave behind something half-built that does not work. There are no traces of letters or pictures in the code or the docs.
- Negative: For now, the visual fun of partner mode is only sprite animations and speech bubbles.

## Conditions to reopen
- When image generation that keeps a character consistent becomes available through a subscription CLI or locally (a local model that supports editing from a reference image, or image generation included in a Claude or Codex subscription).
- Or when the pet file format gets expression rows (happy, sulking, surprised and so on), so that composition alone can show expressions. At that point "the app composes it" is the cheapest and most consistent way.

## Alternatives considered
- **Offer it only to people with an OpenAI key**: It would be a missing feature for most users (subscription CLIs, Ollama), and even with a key the character drifts. Deferred.
- **Letters (text)**: Not what was asked for. Removed.
