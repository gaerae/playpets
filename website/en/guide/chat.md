---
description: Kinds of AI connections and how to make one, setting a personality, chatting with several friends at once
---

# Chat with a friend

To chat with a friend, you need to connect one AI. Inviting and playing work without one, but the chat only shows "Connect an AI to start chatting."

<Shot name="friend-chat" caption="Pick an AI and chat in the Friend tab. You also pick friends to chat with here." />

## Kinds of AI connections <Since v="0.1.0" />

| Kind | How it chats | Cost and data |
|---|---|---|
| Claude Code (chat on my subscription) | Uses the Claude Code signed in on this computer | No separate API fees |
| Codex CLI (chat on my subscription) | Uses the Codex CLI (ChatGPT plan) signed in on this computer | No separate API fees |
| Ollama (runs on my computer) | Uses a model installed in Ollama at `http://127.0.0.1:11434` | Conversations stay on this computer |
| OpenAI API | Connects to OpenAI with an API key | Conversations are sent to OpenAI, and API fees may apply |
| OpenAI-compatible server | You enter the server address and API key yourself | Conversations are sent to that server, and fees may apply |

If Claude Code, Codex CLI or Ollama is installed on this computer, it is detected automatically and listed above the connection window under "Installed on this computer". Click a detected name to switch to that kind right away.

API keys are kept only in this computer's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service). They never go into the settings file.

## Making a connection <Since v="0.1.0" />

1. Open the **Friend** tab and pick the friend to chat with. If you have several friends, the name turns into a list.
2. Click the **Connect an AI** button in the chat, or choose **＋ Connect a new AI…** from the AI list under the name.
3. Choose the **Kind of AI** and, depending on the kind, enter the server address or API key.
4. Pick or type the **Model name**. Click the field and the list of models that AI offers appears. For Claude Code and Codex CLI, leave it empty to use the default model; a short name like `sonnet` always gets the latest version. Ollama and API connections need a model name.
5. Click **Save and connect**. If other friends still have no AI, the "Also use this AI for the other friends" switch is on, so everyone can talk at once.

On a first start with Claude Code or Codex CLI on this computer, the yard's starting card names it and **Connect now** attaches it to every friend in one step, with no key. With two or more friends, they start talking among themselves right after.

Once you have made a connection, other friends can use it too. Pick a different connection from each friend's AI list and each friend chats with a different AI. To edit or delete a connection, click the gear button next to the AI list. Deleting a connection deletes its saved key too, and friends who were chatting through it play without an AI.

## Chatting <Since v="0.1.0" />

- Type in the field at the bottom and press Enter. Shift+Enter makes a new line.
- While you wait for an answer, a "Thinking" bubble appears, and the ■ button stops it.
- The answer also floats as a speech bubble above the friend in the yard.
- Click **Clear chat** to delete the whole conversation with this friend. The name and personality stay.

The chat history lives only in memory. It is gone when you quit the app, and it is not saved to a file.

## Setting a personality <Since v="0.1.0" />

The personality is the tone and attitude your friend answers with. There are two ways to set it.

- **Write it in Friend settings.** Something like "Acts tough but melts at a compliment. Keeps answers short." is enough. Once saved, it applies from the next chat.
- **Say it in the chat.** Say something like "be more casual from now on" and your friend saves it as the personality. A "Saved your friend's personality" notice appears, and you can see it in Friend settings.

## Setting a relationship <Since v="0.1.0" />

**Relationship** in Friend settings says what this friend is to you: a friend (the default), a partner, a reliable senior or a playful younger sibling. It shapes how the friend talks to you, what it calls you and how it asks about your day, and friends chatting together know each other's relationship. Write "honey" or your name under **What it calls you** and it will. Many Codex pets are human-shaped, which suits a partner or a senior well. What is said within the relationship follows the policy of the AI you connected, not the app.

## Chatting together <Since v="0.1.0" />

When two or more friends have an AI connected, **Pick friends to chat with** appears above the chat.

1. Open it and click the friends you want to chat with. You can pick up to 3.
2. Send a message and the current friend answers first, then the friends you picked answer one after another. Each speaks with their own AI and personality.
3. To let the friends carry on without a new message, press **Let them chat** in the yard toolbar. The friends with an AI talk for a round about the time and the weather, and it shows as speech bubbles in the yard.

The small chip under the AI picker shows which coding agents report to this friend (Reports from · Claude Code).

In the yard you can see the friends talking to each other in speech bubbles.

## "What were you doing?" <Since v="0.1.0" />

With [Coding agent hooks](./agents.md) set up, your friend remembers what the agent did recently. Ask "what were you doing?" in the chat and they tell you about that work in their own words. The hooks work separately from the AI connection used for chatting.
