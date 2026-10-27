---
description: Kinds of AI connections and how to make one, setting a personality, chatting with several friends at once
---

# Chat with a friend

- Chatting needs one connected AI.
- Inviting and playing work without one. The chat then says "Ready to play! Connect an AI whenever you want to chat." with a **Connect an AI** button.

<Shot name="friend-chat" caption="Chat with a friend (click its name tag). The AI and the friends who join in are at the bottom of the message box." />

## Kinds of AI connections <Since v="0.1.0" />

| Kind | How it chats | Cost and data |
|---|---|---|
| Claude Code | Uses the Claude Code signed in on this computer | Subscription sign-in uses your plan allowance; API-key sign-in uses API billing |
| Codex CLI | Uses the Codex CLI signed in on this computer | ChatGPT sign-in uses your plan allowance; API-key sign-in uses API billing |
| Ollama | Uses a model through Ollama at `http://127.0.0.1:11434` | Local models keep conversations on this computer without hosted inference fees; cloud models use their service's terms |
| OpenAI API | Connects to OpenAI with an API key | Conversations are sent to OpenAI, and API fees may apply |
| OpenAI-compatible server | You enter the server address and API key yourself | Conversations are sent to that server, and fees may apply |

- The connection window shows each kind as a card that says what it needs.
- A kind found on this computer (Claude Code, Codex CLI or Ollama) is marked **Installed** and picked for you.
- None found: nothing is picked. The fields appear once you pick a card.
- API keys stay only in this computer's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service). They never go into the settings file.
- Subscription sign-in:
  - CLI chat has no separate API bill, but uses the same allowance as your other CLI work.
  - Plan limits apply; optional purchased credits can cost extra.
- Offline chat: choose a downloaded local Ollama model. An Ollama cloud model still sends the conversation to its service.

## Making a connection <Since v="0.1.0" />

1. Open the **Friend** panel (**Friends & settings → Friends & chat**) and pick the friend. With several friends, the name turns into a list.
2. Click **Connect an AI** in the chat, or choose **＋ Connect a new AI…** from the AI list at the bottom left of the message box.
3. Pick a card under **Kind of AI**. Depending on the kind, enter the server address or API key.
4. Pick or type the **Model name**.
   - Click the field to list the models that AI offers (for a kind that needs a key or an address, after you enter it).
   - Claude Code and Codex CLI: leave it empty for the default model. A short name like `sonnet` always gets the latest version.
   - Ollama and API connections need a model name.
5. Click **Save and connect**. If other friends still have no AI, the "Also use this AI for other friends without one" switch is on, so everyone can talk at once.

- You can write to a friend before it has an AI: sending opens the connection window, and the message goes once connected.
- First start with Claude Code or Codex CLI on this computer:
  - The yard's starting card names it.
  - **Connect now** attaches it to every friend in one step, with no key.
  - With two or more friends, they start talking among themselves right after.

**Sharing and editing connections**
- Other friends can use a connection you made.
- Pick a different connection from each friend's AI list to give each friend a different AI.
- Edit or delete a connection:
  - **AI connection settings** in the **⋯** menu by the friend's name, or
  - **Edit** beside it in **Friends & settings → Settings → Friends & AI**. That list shows every connection and has **Connect an AI** for a new one.
- In Settings the form opens in place in that section. Editing there moves no friend to the connection.
- A connection opened from a friend's menu goes to that friend.
- Deleting a connection asks first and deletes its saved key too. Friends who chatted through it play without an AI.

## Chatting <Since v="0.1.0" />

- Type in the field at the bottom and press Enter. Shift+Enter makes a new line.
- With an AI, a conversation not yet started offers a few first lines (such as "What did you do today?"). Pick one to send it in one click.
- Each friend's turn opens with its picture, as in a messenger.
- While you wait, a "Thinking" bubble appears. The ■ button stops it.
- The answer also floats as a speech bubble above the friend in the yard.
- **Clear chat** in the **⋯** menu by the friend's name deletes the whole conversation with this friend. Name and personality stay.
- Chat history lives only in memory. It is gone when you quit the app and is not saved to a file.

## Setting a personality <Since v="0.1.0" />

- The personality is the tone and attitude your friend answers with. Two ways to set it:

| Way | How |
|---|---|
| **Write it in Friend settings** | Something like "Acts tough but melts at a compliment. Keeps answers short." is enough. Applies from the next chat once saved |
| **Say it in the chat** | Say something like "be more casual from now on". Your friend saves it as the personality, a "Saved your friend's personality" notice appears, and it shows in Friend settings |

## Setting a relationship <Since v="0.1.0" />

- **Relationship** in Friend settings: what this friend is to you.
- A row of relationship cards, each saying the voice it brings:
  - Friend (the default)
  - Partner
  - Dependable mentor
  - Playful younger sibling
- One-click change: the relationship chip beside the friend's name in the Friend panel opens these cards.
- It shapes how the friend talks to you, what it calls you and how it asks about your day.
- Friends chatting together know each other's relationship.
- A partner, a mentor and a younger sibling have voices of their own even without an AI: when they welcome you back, grow closer or say what you mean to them.
- **What it calls you**: write "honey" or your name and it will. The example in the box follows the relationship.
- Many Codex pets are human-shaped, which suits a partner or a mentor.
- What is said within the relationship follows the policy of the AI you connected, not the app.

## Chatting together <Since v="0.1.0" />

- **Bring friends in** appears at the bottom of the message box when two or more friends have an AI.

1. Click it, then click the friends to chat with. Up to 3.
2. Send a message. The current friend answers first, then the picked friends one after another, each with their own AI and personality.
3. To let them carry on without a new message, press **Let them chat** in **Play → Group games**. Friends with an AI talk for a round about the time and the weather, shown as speech bubbles in the yard.

- The small chip under the friend's name shows which coding agents report to this friend (Reports from, Claude Code).
- In the yard, friends talking to each other show in speech bubbles.

## "What were you doing?" <Since v="0.1.0" />

- With [Coding agent hooks](./agents.md) set up, your friend remembers what the agent did recently.
- Ask "what were you doing?" in the chat; they tell you about that work in their own words.
- The hooks work separately from the AI connection used for chatting.
