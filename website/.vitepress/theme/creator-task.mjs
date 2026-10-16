// These are generation instructions; runtime counts and timing still come from animation.js.
const sequences = {
  idle: '1 relaxed open eyes; 2 slow blink begins; 3 eyes closed; 4 eyes reopen; 5 subtle breathing up; 6 return to relaxed; 7 relaxed recovery; 8 relaxed recovery',
  right:
    '1 right-facing contact; 2 passing; 3 high point; 4 opposite contact; 5 passing; 6 high point; 7 contact transition; 8 seam returning to frame 1. Move legs and opposite arms while keeping the same right-facing silhouette',
  left: '1 left-facing contact; 2 passing; 3 high point; 4 opposite contact; 5 passing; 6 high point; 7 contact transition; 8 seam returning to frame 1. Preserve anatomical accessory side; do not mirror asymmetric clothing',
  wave: '1 hand/paw raised; 2 wave outward; 3 wave inward; 4 held greeting and loop seam; 5-8 relaxed recovery. Frames 1-4 contain the complete greeting loop',
  jump: '1 crouch; 2 anticipation; 3 airborne ascent; 4 airborne apex; 5 soft landing; 6-8 recovery. Preserve measurable vertical displacement and leave enough canvas above the head',
  error:
    '1 concern begins; 2 brows lower; 3 small worried gesture; 4 sustained concern; 5 concerned glance; 6 return glance; 7 concerned gesture settles; 8 sustained concern matching frame 1',
  waiting:
    '1 thoughtful stance; 2 hand/paw near chin; 3 slight thinking tilt; 4 thoughtful glance; 5 slight return; 6 thinking loop seam; 7-8 recovery',
  working:
    '1 established work gesture begins; 2 gesture down; 3 working contact; 4 gesture up; 5 concentration; 6 work loop seam; 7-8 recovery. Preserve this character’s approved work prop and action',
  done: '1 joyful hands/paws raised; 2 small celebration up; 3 delighted expression; 4 celebration settles; 5 joyful return; 6 loop seam with raised hands/paws; 7-8 recovery',
  look09:
    '1 N; 2 NNE; 3 NE; 4 ENE; 5 E; 6 ESE; 7 SE; 8 SSE. Change only head and eye gaze; keep body orientation stable and eyes open',
  look10:
    '1 S; 2 SSW; 3 SW; 4 WSW; 5 W; 6 WNW; 7 NW; 8 NNW. Change only head and eye gaze; keep body orientation stable and eyes open',
};
export const creatorStates = Object.keys(sequences);
export function creatorTaskPrompt(prompt, { state = 'idle', season = 'summer' } = {}) {
  const selected = creatorStates.includes(state) ? state : 'idle';
  // Creator-supplied names and filenames remain quoted data, even when they resemble tokens.
  return prompt
    .split(/(```json\n[\s\S]*?\n```)/g)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replaceAll('[STATE]', selected)
            .replaceAll('[EIGHT POSES]', sequences[selected])
            .replaceAll('[SEASON: summer or winter]', `SEASON: ${season === 'winter' ? 'winter' : 'summer'}`),
    )
    .join('');
}
