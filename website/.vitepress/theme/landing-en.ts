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
  start: 'Find your little world',
  meet: 'Meet the friends',
  finalTitle: 'A little company for your everyday.',
  developerTitle: 'For people who make things',
  developerBody:
    'Open source, with optional coding-agent connections. Friends can react when work starts, needs your attention or finishes.',
  developerLink: 'Read the developer guide',
  privacyTitle: 'What stays on my computer?',
  privacyBody:
    'Friends and settings are saved on your computer. Conversations go to the AI you connect, whose own data policy applies. PlayPets does not save chat history to a file.',
  releaseLabel: 'Version and release notes',
  releaseTitle: (v: string) => `PlayPets ${v}`,
  releaseLink: (v: string) => `${v}`,
};
export const worldCopy = {
  title: ['A little world', 'to come home to.'],
  lead: 'A walk, a game, a quiet moment together. Make room for a few little friends in your day.',
  worldsTitle: 'What does a good day look like?',
  worldsLead: 'Choose a season. Or settle in above the city lights.',
  sceneLabel: 'Choose a place and season',
  scenes: [
    {
      shot: 'yard-spring',
      label: 'Spring',
      caption: 'A little sunshine, a few petals, and nowhere to rush.',
    },
    {
      shot: 'yard-summer',
      label: 'Summer',
      caption: 'Green grass and a whole afternoon to play.',
    },
    {
      shot: 'yard-talk',
      label: 'Autumn',
      caption: 'Warm leaves and familiar company.',
    },
    {
      shot: 'yard-winter',
      label: 'Winter',
      caption: 'Watch the snow fall together.',
    },
    {
      shot: 'studio-day',
      label: 'City day',
      caption: 'A quiet corner above the busy city.',
    },
    {
      shot: 'studio-night',
      label: 'City night',
      caption: 'The lights come on. Stay a little longer.',
    },
  ],
  pause: 'Pause animations',
  resume: 'Play animations',
  creatorTitle: 'There’s room for your imagination.',
  creatorBody:
    'Bring a pet you love, or make a new one. Reference sheets and ready-to-use prompts help keep their look consistent.',
  creatorLink: 'Make your own companion',
  discovery: 'Already have a Codex pet?',
  sceneCaption: (v: string) => `Actual app captures · PlayPets ${v}`,
};
