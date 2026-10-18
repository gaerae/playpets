<script setup>
import { computed, ref } from 'vue';
import catalog from '../../../src/content/catalog.json';
import events from '../../../src/content/events.json';
import { LIMITS } from '../../../src/core/limits.js';
import { strings as en } from '../../../src/core/strings/en.js';
import { strings as ja } from '../../../src/core/strings/ja.js';
import { strings as ko } from '../../../src/core/strings/ko.js';
import { strings as zh } from '../../../src/core/strings/zh-hans.js';
import { eligibleKinds, fishWeight, relativeChances, wildlifeGroup } from '../../../src/yard/catalog.js';

const props = defineProps({ lang: { type: String, default: 'en' } });
const copy = {
  en: {
    digNote:
      'Per completed dig. Repeating the same patch within 24 hours never grants another reward. A full seed pocket gives no seed. These are chances, not a collection schedule.',
    title: 'What could you discover?',
    books: ['Fish', 'Bugs', 'Flowers', 'Gifts'],
    season: ['Spring', 'Summer', 'Autumn', 'Winter'],
    none: 'No event',
    calendar:
      'Event choices preview chances; they do not activate a festival in the app. Dates below use the northern calendar. Southern dates shift six months; New Year keeps its date. The app follows the real date and matching season.',
    event: 'Event',
    item: 'Find',
    when: 'Where to look',
    frequency: 'With these conditions',
    other: 'Other conditions',
    common: 'Often',
    occasional: 'Sometimes',
    rare: 'Rarely',
    details: 'How these numbers work',
    note: 'These are relative chances, not a promise of a catch or a waiting time. Repeat finds are possible.',
    fish: 'Among successfully landed fish under the selected conditions. Reacting to the float is still required; each catch is independent.',
    bugs: 'Within the same bug group, when that group appears. Bugs need a clear outdoor place: butterflies and dragonflies in the morning or midday, fireflies on spring and summer evenings and nights. Rain and snow stop appearances.',
    flowers: 'Per seed planted in this season. Flowers grow by elapsed time, including while the app is closed.',
    gifts:
      'New gifts follow the catalogue order, once per local day; after collecting all ordinary gifts, friends bring decorations missing from the yard. Event gifts take priority the first time. This is not a random loot table; a full yard (12 decorations) pauses gifts.',
    ordered: 'In order',
    seasonal: 'During the event',
    group: 'Same bug group',
    bloom: 'Hours to bloom',
    timing:
      'Finds depend on season and time. Try another season or come back for a different light; there is no completion deadline.',
  },
  ko: {
    digNote:
      '땅파기 한 번을 마쳤을 때의 확률이에요. 24시간 안에 같은 땅을 다시 파도 보상을 더 받지는 않아요. 씨앗 주머니가 가득 차면 씨앗을 더 받지 못해요. 정해진 횟수 안에 모인다는 뜻은 아니에요.',
    title: '어떤 발견을 할 수 있을까요?',
    books: ['물고기', '곤충', '꽃', '선물'],
    season: ['봄', '여름', '가을', '겨울'],
    none: '이벤트 없음',
    calendar:
      '이벤트 선택은 확률 미리보기예요. 앱에서 축제를 켜지는 않아요. 아래 날짜는 북반구 기준이고, 남반구는 6개월 뒤로 옮겨져요. 새해는 같은 날짜예요. 앱에서는 실제 날짜와 계절이 맞을 때 열려요.',
    event: '이벤트',
    item: '발견할 것',
    when: '만나는 조건',
    frequency: '이 조건에서',
    other: '다른 조건',
    common: '자주',
    occasional: '가끔',
    rare: '드물게',
    details: '확률은 어떻게 계산하나요?',
    note: '상대적인 선택 확률이에요. 잡힐 때까지의 시간이나 성공을 보장하지 않으며, 같은 종류를 다시 만날 수 있어요.',
    fish: '선택한 조건에서 낚시에 성공했을 때, 잡힌 물고기가 이 종류일 확률이에요. 찌가 잠길 때 직접 클릭해야 하며 매번 독립적으로 정해져요.',
    bugs: '같은 곤충 무리 안에서의 확률이에요. 맑은 야외에서 나비·잠자리는 아침과 한낮, 반딧불이는 봄·여름의 저녁과 밤에 나타나요. 비나 눈이 오면 나타나지 않아요.',
    flowers: '이 계절에 씨앗 하나를 심었을 때의 확률이에요. 앱을 닫아도 실제 시간이 흐르면 꽃이 자라요.',
    gifts:
      '처음 받는 선물은 하루 하나씩 도감 순서대로 와요. 일반 선물을 모두 받은 뒤에는 마당에 없는 장식이 다시 와요. 이벤트 선물은 처음 받을 때 우선해요. 무작위 뽑기가 아니며, 장식이 12개로 가득 차면 선물이 잠시 멈춰요.',
    ordered: '차례대로 와요',
    seasonal: '이벤트 중에 와요',
    group: '같은 곤충 무리 안에서',
    bloom: '꽃이 피기까지 걸리는 시간',
    timing:
      '계절과 시간에 따라 새로운 발견이 기다려요. 계절을 바꿔 보거나 다른 빛이 드는 시간에 찾아오세요. 모두 모아야 하는 기한은 없어요.',
  },
  ja: {
    digNote:
      '穴掘りを1回終えたときの確率です。24時間以内に同じ場所を掘っても追加の報酬はありません。種の袋がいっぱいなら種は増えません。一定の回数で集まる保証ではありません。',
    title: 'どんな出会いがある？',
    books: ['魚', '虫', '花', '贈り物'],
    season: ['春', '夏', '秋', '冬'],
    none: 'イベントなし',
    calendar:
      'イベントの選択は確率のプレビューです。アプリ内のお祭りは開始しません。日付は北半球の暦で、南半球では6か月ずれます。新年の日付は共通です。アプリでは実際の日付と季節が合うときに開催されます。',
    event: 'イベント',
    item: '見つかるもの',
    when: '出会える条件',
    frequency: 'この条件では',
    other: '別の条件で出会えます',
    common: 'よく',
    occasional: 'ときどき',
    rare: 'まれに',
    details: '確率の計算について',
    note: '相対的な選択確率です。捕獲の成功や待ち時間を保証せず、同じ種類に何度も出会うことがあります。',
    fish: '選択した条件で釣りに成功したとき、その種類が選ばれる確率です。浮きが沈んだらクリックが必要で、毎回独立に決まります。',
    bugs: '同じ虫のグループ内での確率です。晴れた屋外で、蝶とトンボは朝と昼、ホタルは春・夏の夕方と夜に現れます。雨や雪の日には現れません。',
    flowers: 'この季節に種を一つ植えたときの確率です。アプリを閉じても実際の時間で成長します。',
    gifts:
      '初めての贈り物は一日一つ、カタログ順に届きます。通常の贈り物を全部集めた後は庭にない飾りが再び届きます。イベントの初回の贈り物が優先されます。ランダム抽選ではなく、飾りが12個になると届かなくなります。',
    ordered: '順番に届きます',
    seasonal: 'イベント中に届きます',
    group: '同じ虫のグループ内',
    bloom: '開花までの時間',
    timing:
      '季節や時間で出会いが変わります。季節を変えたり、違う光の時間に訪れたりしてみましょう。集め終える期限はありません。',
  },
  'zh-hans': {
    digNote:
      '每完成一次挖土的概率。24小时内重复挖同一块地不会再获得奖励。种子袋满时不会增加种子。概率不代表固定次数就能集齐。',
    title: '会有什么新发现？',
    books: ['鱼', '昆虫', '花', '礼物'],
    season: ['春', '夏', '秋', '冬'],
    none: '无活动',
    calendar:
      '选择活动仅预览概率，不会在应用中开启节日。日期以北半球为准，南半球顺延六个月，新年日期不变。应用按实际日期和对应季节举办活动。',
    event: '活动',
    item: '发现',
    when: '相遇条件',
    frequency: '在这些条件下',
    other: '需要其他条件',
    common: '经常',
    occasional: '偶尔',
    rare: '少见',
    details: '概率如何计算？',
    note: '这些是相对选择概率，不保证捕获成功或等待时间。同一种类可能重复出现。',
    fish: '在所选条件下成功钓到鱼后，该种类被选中的概率。仍需在浮漂下沉时点击，每次独立计算。',
    bugs: '同一昆虫类别内的概率。晴天户外的早晨和中午会有蝴蝶与蜻蜓；春夏傍晚和夜晚会有萤火虫。下雨或下雪时不会出现。',
    flowers: '在本季节种下一粒种子时的概率。关闭应用后，植物仍按实际时间生长。',
    gifts:
      '新礼物每天一件，按图鉴顺序送来。集齐普通礼物后，会再次送来院子里没有摆放的装饰。首次活动礼物优先。这不是随机抽奖；摆满12件装饰后会暂停送礼。',
    ordered: '按顺序到来',
    seasonal: '活动期间到来',
    group: '同一昆虫类别内',
    bloom: '开花所需时间',
    timing: '季节与时间带来不同发现。换个季节，或在不同光线的时刻再来看看。不必赶着集齐。',
  },
};
const text = computed(() => copy[props.lang] || copy.en);
const strings = computed(() => ({ en, ko, ja, 'zh-hans': zh })[props.lang] || en);
const tr = key => strings.value[key] || en[key] || key;
const books = ['fish', 'bugs', 'flowers', 'gifts'];
const seasons = ['spring', 'summer', 'autumn', 'winter'];
const periods = ['morning', 'day', 'evening', 'night'];
const book = ref('fish'),
  season = ref('spring'),
  period = ref('day'),
  weather = ref('clear'),
  event = ref('');
const seasonName = value => text.value.season[seasons.indexOf(value)];
const rows = computed(() => {
  const source = catalog[book.value];
  let chances = [];
  if (book.value === 'fish')
    chances = relativeChances(eligibleKinds(source, season.value, period.value, event.value), f =>
      fishWeight(f, weather.value),
    );
  if (book.value === 'bugs') {
    const group = wildlifeGroup(season.value, period.value, weather.value);
    const eligible = eligibleKinds(source, season.value, period.value, event.value);
    for (const kind of ['butterfly', 'dragonfly', 'firefly']) {
      if (!group || (group === 'firefly') !== (kind === 'firefly')) continue;
      chances.push(
        ...relativeChances(
          eligible.filter(b => b.kind === kind),
          b => b.weight,
        ),
      );
    }
  }
  if (book.value === 'flowers')
    chances = relativeChances(
      source.filter(f => f.season === season.value),
      f => f.weight ?? 1,
    );
  return source.map(item => {
    const chance = chances.find(c => c.id === item.id)?.chance ?? null;
    const prefix = { fish: 'catch.fish_', bugs: 'catch.bug_', flowers: 'garden.kind_', gifts: 'decor.kind_' }[
      book.value
    ];
    const condition =
      book.value === 'gifts'
        ? item.event
          ? tr(`event.${item.event}.name`)
          : text.value.ordered
        : [
            ...(item.seasons || [item.season]).map(seasonName),
            ...(item.periods || [])
              .filter(p => book.value !== 'bugs' || item.kind === 'firefly' || p === 'morning' || p === 'day')
              .map(p => tr(`period.${p}`)),
            ...(item.event ? [tr(`event.${item.event}.name`)] : []),
          ].join(' · ');
    return { id: item.id, name: tr(prefix + item.id), chance, condition, event: item.event };
  });
});
const frequency = chance =>
  chance === null
    ? text.value.other
    : chance >= 0.2
      ? text.value.common
      : chance >= 0.05
        ? text.value.occasional
        : text.value.rare;
const percent = chance =>
  new Intl.NumberFormat(props.lang, { style: 'percent', maximumFractionDigits: 1 }).format(chance);
</script>

<template>
  <section class="discovery-guide" :aria-label="text.title">
    <p>{{ text.timing }}</p>
    <details class="discovery-dig">
      <summary>{{ tr('discovery.dig') }} · {{ text.details }}</summary>
      <p>{{ text.digNote }}</p>
      <ul><li v-for="(chance, outcome) in LIMITS.digOdds" :key="outcome">{{ tr(`discovery.odds_${outcome}`) }}: {{ percent(chance / 100) }}</li></ul>
      <ul><li v-for="item in catalog.treasures" :key="item.id">{{ tr(`treasure.${item.id}`) }}: {{ percent(LIMITS.digOdds[item.rarity] / catalog.treasures.filter(k => k.rarity === item.rarity).length / 100) }}</li></ul>
      <p>{{ tr('tree.young') }}: {{ LIMITS.treeYoungMs / 3600000 }} h · {{ tr('tree.mature') }}: {{ LIMITS.treeMatureMs / 3600000 }} h</p>
    </details>
    <div class="discovery-books" :aria-label="text.title">
      <button v-for="(id, index) in books" :key="id" type="button" :aria-pressed="book === id" @click="book = id">{{ text.books[index] }}</button>
    </div>
    <div v-if="book !== 'gifts'" class="discovery-filters">
      <label>{{ tr('settings.season') }}<select v-model="season"><option v-for="s in seasons" :key="s" :value="s">{{ seasonName(s) }}</option></select></label>
      <label v-if="book !== 'flowers'">{{ tr('period.label') }}<select v-model="period"><option v-for="p in periods" :key="p" :value="p">{{ tr(`period.${p}`) }}</option></select></label>
      <label v-if="book !== 'flowers'">{{ tr('weather.label') }}<select v-model="weather"><option v-for="w in ['clear', 'rain', 'snow']" :key="w" :value="w">{{ tr(`weather.${w}`) }}</option></select></label>
      <label v-if="book !== 'flowers'">{{ text.event }}<select v-model="event"><option value="">{{ text.none }}</option><option v-for="e in events.events" :key="e.id" :value="e.id">{{ tr(`event.${e.id}.name`) }} · {{ e.from }}–{{ e.to }}</option></select></label>
    </div>
    <p v-if="book === 'fish' || book === 'bugs'" class="discovery-calendar">{{ text.calendar }}</p>
    <p>{{ text[book] }}</p>
    <div class="discovery-table"><table>
      <thead><tr><th scope="col">{{ text.item }}</th><th scope="col">{{ text.when }}</th><th scope="col">{{ text.frequency }}</th></tr></thead>
      <tbody><tr v-for="row in rows" :key="row.id"><th scope="row">{{ row.name }}</th><td>{{ row.condition }}</td><td>{{ book === 'gifts' ? (row.event ? text.seasonal : text.ordered) : frequency(row.chance) }}</td></tr></tbody>
    </table></div>
    <details v-if="book !== 'gifts'">
      <summary>{{ text.details }}</summary>
      <p>{{ text.note }} <span v-if="book === 'bugs'">{{ text.group }}.</span></p>
      <ul><li v-for="row in rows.filter(r => r.chance !== null)" :key="row.id">{{ row.name }}: {{ percent(row.chance) }}</li></ul>
      <p v-if="book === 'flowers'">{{ text.bloom }}: {{ catalog.garden.stages.at(-1).minutes / 60 }} h</p>
    </details>
  </section>
</template>

<style scoped>
.discovery-guide { margin: 1.5rem 0; }
.discovery-books { display: flex; flex-wrap: wrap; gap: .4rem; padding-block: .5rem; border-bottom: 1px solid var(--vp-c-divider); }
.discovery-books button { padding: .55rem 1rem; border-radius: .5rem; font-weight: 600; color: var(--vp-c-text-2); }
.discovery-books button[aria-pressed="true"] { color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.discovery-books button:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.discovery-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; margin-block: 1rem; }
.discovery-filters label { display: grid; gap: .35rem; font-size: .8rem; color: var(--vp-c-text-2); }
.discovery-filters select { width: 100%; border: 1px solid var(--vp-c-divider); border-radius: .5rem; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; font-size: .95rem; padding: .55rem; }
.discovery-calendar { font-size: .8rem; color: var(--vp-c-text-2); }
.discovery-guide:lang(ko) { word-break: keep-all; overflow-wrap: break-word; }
.discovery-table { overflow-x: auto; }
.discovery-table table { width: 100%; font-size: .85rem; }
.discovery-table th:first-child { white-space: nowrap; }
.discovery-guide summary { cursor: pointer; font-weight: 600; padding-block: .75rem; }
@media (max-width: 480px) { .discovery-filters { grid-template-columns: 1fr; } }
</style>
