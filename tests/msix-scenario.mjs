// The same assertions run against fakes in Node and the packaged app's real bridge.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function probeMsix({ api, document, renderUpdate, checkForUpdates, storeNote, phase }) {
  const boot = await api.bootstrap();
  if (!boot.ok || boot.data.updateChannel !== 'store') throw new Error('Missing package identity');
  const checked = await api.checkUpdate();
  if (!checked.ok || checked.data.channel !== 'store') throw new Error('Incorrect updater channel');
  const installed = await api.installUpdate();
  if (installed.ok || !installed.error?.includes('Microsoft Store')) throw new Error('GitHub installer guard failed');
  renderUpdate();
  await checkForUpdates();
  if (!document.getElementById('update-button').hidden || !document.getElementById('update-pill').hidden)
    throw new Error('GitHub installer controls are visible');
  if (document.getElementById('update-note').textContent !== storeNote) throw new Error('Missing Store explanation');
  if (phase === 'upgrade' && (boot.data.sound.on !== false || boot.data.sound.volume !== 37))
    throw new Error('Settings were not retained across package upgrade');
  if (phase === 'prepare' && !(await api.setSound(false, 37)).ok) throw new Error('Could not save settings');
  return { channel: 'store', installerBlocked: true, controlsHidden: true, retained: phase === 'upgrade' };
}

export function scenario(phase) {
  if (!['prepare', 'upgrade'].includes(phase)) throw new Error('Invalid MSIX phase');
  return `(async()=>{
    const log=value=>window.__TAURI__.core.invoke('call',{name:'e2eLog',args:['MSIX_RESULT '+JSON.stringify(value)]});
    try {
      const settings=await import('./panel/settings.js');
      const {t}=await import('./core/i18n.js');
      const result=await (${probeMsix.toString()})({api:playPets,document,...settings,storeNote:t('settings.update_store'),phase:${JSON.stringify(phase)}});
      await log({ok:true,...result});
    } catch(error) { await log({ok:false,error:String(error)}); }
  })()`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  writeFileSync(process.argv[2], scenario(process.argv[3]));
