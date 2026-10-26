export const copy = {
  sceneNote: 'Bring compatible Codex pet files into your yard. Find community pets at:',
  communities: [
    'OpenPets Registry',
    'Petdex',
    'Codex PokéPets',
    'Awesome Codex Pet',
    'Codex Pets',
    'a GitHub folder',
    'a folder on your disk',
  ],
  whyThanks: 'Thank you to everyone who drew these pets. PlayPets exists so they can move on more desks.',
  diffNote:
    'Codex pets are a feature of OpenAI Codex. PlayPets is a separate open-source app that follows that pet file format, and it works without Codex.',
  chatAlt: 'A conversation with a companion',
  github: 'View on GitHub',
  guide: 'Read the guide',
  more: 'How it works',
  eyebrow: 'Little companions for your desktop',
  download: 'Download PlayPets',
  meet: 'Meet the friends',
  finalTitle: 'A little company for your everyday.',
  developerTitle: 'For people who make things',
  developerBody: 'PlayPets is open source under the MIT license. Read how it is built, or help make it.',
  developerLink: 'Read the developer guide',
  privacyTitle: 'What stays on my computer?',
  privacyBody:
    'Friends and settings are saved on your computer. Conversations go to the AI you connect, whose own data policy applies. PlayPets does not save chat history to a file.',
  releaseLabel: 'Version and release notes',
  releaseTitle: (v: string) => `PlayPets ${v}`,
  releaseLink: (v: string) => `${v}`,
};
export const worldCopy = {
  places: ['Hill garden', 'Stone courtyard', 'Lakeside cottage', 'Cozy living room'],
  seasons: ['Spring', 'Summer', 'Autumn', 'Winter'],
  greetings: {
    daisy: 'There might be something lovely just around the corner.',
    clover: 'Let’s see what has grown today.',
    pip: 'You’re here! Shall we play for a little while?',
    miso: 'There’s room here for a quiet moment together.',
  },
  seasonLabel: 'Choose a season',
  previewNote:
    'An interactive scene sample with the app’s artwork. Select a friend to wave; games and weather live in the app.',
  greet: 'Say hello',
  title: ['A little world', 'to come home to.'],
  lead: 'Little friends play in their yard, talk with you and with each other through the AI you choose, and keep you company while you work.',
  worldsTitle: 'What does a good day look like?',
  worldsLead: 'Find a favourite corner. Change the season and say hello.',
  sceneLabel: 'Choose a place and season',
  pause: 'Pause animations',
  resume: 'Play animations',
  creatorTitle: 'There’s room for your imagination.',
  creatorBody:
    'Bring a pet you love, or make a new one. Reference sheets and ready-to-use prompts help keep their look consistent.',
  creatorLink: 'Make your own companion',
  discovery: 'Already have a Codex pet?',
  sceneCaption: (v: string) => `Actual app captures, PlayPets ${v}`,
};
export const sections = {
  discoveryGuide: 'See what you can discover',
  galleryCreate: 'Create with this friend',
  petNotes: {
    daisy: 'A curious explorer who notices little things.',
    clover: 'A gentle kitten gardener who shares small discoveries.',
    pip: 'A cheerful puppy in indigo denim and ivory shorts, with the friends’ white-and-gold flower.',
    miso: 'A gentle otter who reads by the pond in a lavender knit vest.',
  },
  galleryTitle: 'Someone you’ll be glad to see.',
  galleryLead: 'Daisy, Clover, Pip and Miso. Four little personalities, with a place beside you.',
  galleryLabel: 'Choose a companion',
  posesLabel: 'Preview a pose',
  poses: ['Rest', 'Wave', 'Jump'],
  selectedLead:
    'Invite this companion with Invite a friend in Friends & settings. Make their name, personality and relationship your own.',
  galleryGuide: 'Read their stories',
  connectionsTitle: 'Play a little. Talk a little.',
  connectionsLead:
    'Games and gardening work without an AI account. Connect an AI for conversations; its limits and charges apply.',
  connections: [
    [
      'Play offline',
      'Share a picnic, dig for little finds, plant trees, catch bugs and fish. No AI account is needed.',
      '/guide/play',
    ],
    [
      'Talk your way',
      'Give each friend a name and a personality. Connect an AI when you want to talk, or let your friends chat together.',
      '/guide/chat',
    ],
  ],
  miniTitle: 'A small corner of your day.',
  miniBody:
    'Keep the yard small beside your work, with only scenery and friends at rest. Open brief play actions from a friend when you feel like it. Always on top is a separate switch.',
  miniLink: 'Make room for your yard',
  agentGuide: 'Connect a coding agent',
  connectionDetails: 'Conversation setup and costs',
  connectionSetup:
    'Use local Ollama, your signed-in Claude Code or Codex CLI, or an OpenAI-compatible server. CLI use stays within subscription limits; API servers may charge separately.',
  heroFacts: ['Free and open source (MIT)', 'macOS, Windows, Linux', 'In 4 languages'],
  miniDesktop: 'Let them out on the desktop',
  togetherTitle: 'They talk among themselves, too.',
  togetherBody:
    'Bring a friend into your conversation, or press Let them chat and listen in. Speech bubbles fill the yard while you get on with your day.',
  togetherLink: 'How chatting together works',
  togetherAlt: 'Friends talking in the yard, with speech bubbles and their coding agents beside their names',
  workTitle: 'Company while you code.',
  workBody:
    'A friend reacts as your coding agent reports in: Claude Code and Gemini CLI at every step, Cursor on edits and completion, Codex when a turn ends. Ask “What were you doing?” for a short recap.',
  workNote:
    'The connection stays on this computer. Hooks leave out your prompts and tool inputs; short status reports can still mention your work.',
  workAlt: 'Coding tools settings, with a friend for each agent',
  brewLabel: 'macOS with Homebrew',
};
