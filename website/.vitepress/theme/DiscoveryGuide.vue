<script setup>
import { computed, ref } from 'vue';
import catalog from '../../../src/content/catalog.json';
import events from '../../../src/content/events.json';
import { LIMITS } from '../../../src/core/limits.js';
import { strings as en } from '../../../src/core/strings/en.js';
import { strings as ja } from '../../../src/core/strings/ja.js';
import { strings as ko } from '../../../src/core/strings/ko.js';
import { strings as zh } from '../../../src/core/strings/zh-hans.js';
import { eligibleKinds, fishWeight, relativeChances } from '../../../src/yard/catalog.js';
import { discoveryBugChances, discoveryFindChances } from './discovery-odds.js';

const props = defineProps({ lang: { type: String, default: 'en' } });
const copy = {
  en: {
    digNote:
      'Digging may uncover seeds, saplings or keepsakes, or nothing. Matching season, weather and place favor some finds. Full storage adds no item and does not convert a reward. The same patch gives no further reward for 24 hours.',
    digCooldown:
      'This is a preview, not your saved state. After an uncommon find, all friends and places wait 24 hours for another. Repeats are possible and completion time is not guaranteed.',
    place: 'Outdoor place',
    customPlace: 'Custom outdoor background',
    affinity: 'More likely with',
    baseline: 'No preferred conditions',
    title: 'What could you discover?',
    books: ['Aquatic life', 'Bugs', 'Flowers', 'Gifts'],
    season: ['Spring', 'Summer', 'Autumn', 'Winter'],
    none: 'No event',
    calendar:
      'Event choices preview what you can find during an active event; they do not activate a festival in the app. Dates below use the northern calendar. Southern dates shift six months; New Year keeps its date. The app follows the real date and matching season.',
    event: 'Event',
    item: 'Find',
    when: 'Where to look',
    frequency: 'With these conditions',
    other: 'Other conditions',
    common: 'Often',
    occasional: 'Sometimes',
    rare: 'Rarely',
    fish: 'Click the water and react to the float, or choose Fish in Play for an independent trip. A trip can end without a catch.',
    bugs: 'Bugs appear in clear outdoor places. Butterflies and dragonflies fly, ladybugs crawl and field crickets hop in the morning and day; fireflies on spring and summer evenings and nights. Rain and snow stop appearances.',
    flowers:
      'Flower seeds and saplings come from digging. Flowers bloom after four hours and trees mature after twelve, including time with the app closed.',
    gifts:
      'The whole yard receives at most one gift per local calendar day, shared by all friends. A scheduled delivery time survives closing the app, and closed time counts. New gifts follow catalogue order; after all ordinary gifts, friends bring decorations missing from the yard. Event gifts take priority the first time. This is not a random loot table. Twelve decorations pause delivery; putting one away retains its album entry. The four event gifts follow real calendar dates, so collecting them all can take months, not a guaranteed week.',
    ordered: 'In order',
    seasonal: 'During the event',
    bloom: 'Hours to bloom',
    timing:
      'Finds depend on season and time. Try another season or come back for a different light; there is no completion deadline.',
  },
  ko: {
    digNote:
      '땅을 파면 꽃씨, 묘목, 작은 발견을 얻거나 아무것도 나오지 않을 수 있어요. 계절, 날씨, 장소에 따라 더 찾기 쉬운 것이 달라져요. 보관함이 가득 차면 더 받지 못하고 다른 보상으로 바뀌지 않아요. 같은 땅은 24시간 동안 추가 보상이 없어요.',
    digCooldown:
      '이 페이지는 미리보기이며 앱의 저장 상태를 읽지 않아요. 드문 발견을 얻으면 모든 친구와 장소에서 다음 드문 발견까지 24시간을 기다려요. 중복이 나올 수 있고 완료 시점은 보장하지 않아요.',
    place: '야외 장소',
    customPlace: '직접 추가한 야외 배경',
    affinity: '더 잘 나오는 조건',
    baseline: '선호 조건 없음',
    title: '어떤 발견을 할 수 있을까요?',
    books: ['물속 생물', '곤충', '꽃', '선물'],
    season: ['봄', '여름', '가을', '겨울'],
    none: '이벤트 없음',
    calendar:
      '이벤트를 고르면 축제 중에 만날 수 있는 종류를 미리 볼 수 있어요. 앱에서 축제를 켜는 기능은 아니에요. 아래 날짜는 북반구 기준이고, 남반구는 6개월 뒤로 옮겨져요. 새해는 같은 날짜예요. 앱에서는 실제 날짜와 계절이 맞을 때 열려요.',
    event: '이벤트',
    item: '발견할 것',
    when: '만나는 조건',
    frequency: '이 조건에서',
    other: '다른 조건',
    common: '자주',
    occasional: '가끔',
    rare: '드물게',
    fish: '물을 눌러 찌에 반응하거나 놀기의 낚시로 친구에게 맡겨요. 잡지 못하고 돌아올 수도 있어요.',
    bugs: '곤충은 맑은 야외에 나타나요. 아침과 한낮에는 나비와 잠자리가 날고 무당벌레가 기어 다니며 들귀뚜라미가 뛰어요. 반딧불이는 봄과 여름의 저녁과 밤에 나타나요. 비나 눈이 오면 나타나지 않아요.',
    flowers: '꽃씨와 묘목은 땅파기로 찾아요. 꽃은 4시간 뒤 피고 나무는 12시간 뒤 자라요. 앱을 꺼 둔 시간도 포함해요.',
    gifts:
      '선물은 현지 날짜 기준으로 놀이터 전체에서 하루 최대 하나이며 모든 친구가 횟수를 공유해요. 정해진 도착 시각은 앱을 닫아도 저장되고, 꺼 둔 시간도 포함해요. 새 선물은 도감 순서로 오고, 일반 선물을 다 받은 뒤에는 마당에 없는 장식이 다시 와요. 이벤트 선물은 처음 받을 때 우선하며 무작위 뽑기는 아니에요. 장식이 12개면 배달이 멈추고 하나를 치워도 도감 기록은 남아요. 이벤트 선물 네 종류는 실제 달력을 따라, 모두 모으려면 몇 달이 걸릴 수 있어요. 일주일 안에 모인다는 보장은 없어요.',
    ordered: '차례대로 와요',
    seasonal: '이벤트 중에 와요',
    bloom: '꽃이 피기까지 걸리는 시간',
    timing:
      '계절과 시간에 따라 새로운 발견이 기다려요. 계절을 바꿔 보거나 다른 빛이 드는 시간에 찾아오세요. 모두 모아야 하는 기한은 없어요.',
  },
  ja: {
    digNote:
      '土を掘ると種、苗木、小さな発見が出ることも、何も出ないこともあります。季節、天気、場所によって見つけやすさが変わります。収納が満杯でも別の報酬には変わりません。同じ場所は24時間追加の報酬がありません。',
    digCooldown:
      'これはプレビューで、保存状態は読みません。珍しい発見の後は全員と全場所で次の珍しい発見まで24時間待ちます。重複があり、完了時期は保証されません。',
    place: '屋外の場所',
    customPlace: '追加した屋外背景',
    affinity: '出やすい条件',
    baseline: '優先条件なし',
    title: 'どんな出会いがある？',
    books: ['水中の生きもの', '虫', '花', '贈り物'],
    season: ['春', '夏', '秋', '冬'],
    none: 'イベントなし',
    calendar:
      'イベントを選ぶと、開催中に出会える種類を確認できます。アプリ内のお祭りを開始する機能ではありません。日付は北半球の暦で、南半球では6か月ずれます。新年の日付は共通です。アプリでは実際の日付と季節が合うときに開催されます。',
    event: 'イベント',
    item: '見つかるもの',
    when: '出会える条件',
    frequency: 'この条件では',
    other: '別の条件で出会えます',
    common: 'よく',
    occasional: 'ときどき',
    rare: 'まれに',
    fish: '水面を押して浮きに反応するか、遊ぶの釣りで友だちに任せます。釣れないこともあります。',
    bugs: '虫は晴れた屋外に現れます。朝と昼はチョウやトンボが飛び、テントウムシが歩き、コオロギが跳ねます。ホタルは春と夏の夕方と夜です。雨や雪では現れません。',
    flowers: '花の種と苗木は土を掘って見つけます。花は4時間、木は12時間で育ちます。アプリを閉じた時間も含みます。',
    gifts:
      '贈り物は現地の日付で庭全体に一日最大一つ、全員で回数を共有します。決まった配達時刻は保存され、アプリを閉じた時間も数えます。新しい贈り物はカタログ順で、通常分を集めた後は庭にない飾りが届きます。イベントの初回分が優先され、ランダム抽選ではありません。飾りが12個なら配達は止まり、片付けても図鑑の記録は残ります。イベント限定4種類は実際の暦に従うため、集めるには数か月かかる場合があり、一週間の完成は保証されません。',
    ordered: '順番に届きます',
    seasonal: 'イベント中に届きます',
    bloom: '開花までの時間',
    timing:
      '季節や時間で出会いが変わります。季節を変えたり、違う光の時間に訪れたりしてみましょう。集め終える期限はありません。',
  },
  'zh-hans': {
    digNote:
      '挖土可能找到花种、树苗、小小发现，也可能没有收获。季节、天气和地点影响哪些物品更容易找到。库存满时不会改发其他奖励。同一地块24小时内不再给奖励。',
    digCooldown:
      '本页为预览，不读取存档。获得稀有发现后，所有伙伴和地点需等待24小时才能再次找到稀有物品。可能重复，不保证完成时间。',
    place: '室外地点',
    customPlace: '自定义室外背景',
    affinity: '更容易出现的条件',
    baseline: '无偏好条件',
    title: '会有什么新发现？',
    books: ['水中生物', '昆虫', '花', '礼物'],
    season: ['春', '夏', '秋', '冬'],
    none: '无活动',
    calendar:
      '选择活动可以预览活动期间会遇到的物种，不会在应用中开启节日。日期以北半球为准，南半球顺延六个月，新年日期不变。应用按实际日期和对应季节举办活动。',
    event: '活动',
    item: '发现',
    when: '相遇条件',
    frequency: '在这些条件下',
    other: '需要其他条件',
    common: '经常',
    occasional: '偶尔',
    rare: '少见',
    fish: '点击水面并回应浮漂，或在玩耍中选择钓鱼交给伙伴。也可能空手而归。',
    bugs: '昆虫出现在晴朗的室外。早晨和白天有蝴蝶和蜻蜓飞舞，瓢虫爬行，田野蟋蟀跳跃；萤火虫在春夏的傍晚和夜间出现。雨雪天不会出现。',
    flowers: '花种和树苗都来自挖土。花在4小时后开放，树木在12小时后长成，包括关闭应用的时间。',
    gifts:
      '按本地日历，整个庭院每天最多收到一件礼物，所有伙伴共享次数。安排的送达时间会保存，关闭应用的时间也计入。新礼物按图鉴顺序到来，收齐普通礼物后会送来庭院缺少的装饰，首次活动礼物优先，并非随机抽奖。12件装饰会暂停送礼，收起后仍保留图鉴记录。4种活动礼物遵循真实日历，收齐可能需要数月，不保证一周完成。',
    ordered: '按顺序到来',
    seasonal: '活动期间到来',
    bloom: '开花所需时间',
    timing: '季节与时间带来不同发现。换个季节，或在不同光线的时刻再来看看。不必赶着集齐。',
  },
};
const digFinds = computed(() =>
  discoveryFindChances(catalog, LIMITS.digOdds, {
    season: season.value,
    weather: weather.value,
    place: place.value,
    rareReady: true,
  }),
);
const digName = item =>
  catalog.trees.some(tree => tree.id === item.id) ? tr(`tree.${item.id}`) : tr(`treasure.${item.id}`);
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
  place = ref('woodland'),
  event = ref('');
const seasonName = value => text.value.season[seasons.indexOf(value)];
const places = ['woodland', 'courtyard', 'lakeside', 'custom'];
const placeName = value => (value === 'custom' ? text.value.customPlace : tr(`world.${value}`));
const affinityHint = item => {
  const conditions = [
    ...(item.affinity?.seasons || []).map(seasonName),
    ...(item.affinity?.weather || []).map(value => tr(`weather.${value}`)),
    ...(item.affinity?.places || []).map(placeName),
  ];
  return conditions.length ? `${text.value.affinity}: ${conditions.join(', ')}` : text.value.baseline;
};
const rows = computed(() => {
  const source = catalog[book.value];
  let chances = [];
  if (book.value === 'fish')
    chances = relativeChances(eligibleKinds(source, season.value, period.value, event.value), f =>
      fishWeight(f, weather.value),
    );
  if (book.value === 'bugs')
    chances = discoveryBugChances(catalog, season.value, period.value, weather.value, event.value);
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
          ? `${tr(`event.${item.event}.name`)} (${events.events.find(event => event.id === item.event)?.from}–${events.events.find(event => event.id === item.event)?.to})`
          : text.value.ordered
        : [
            ...(item.seasons || [item.season]).map(seasonName),
            ...(item.periods || [])
              .filter(p => book.value !== 'bugs' || item.kind === 'firefly' || p === 'morning' || p === 'day')
              .map(p => tr(`period.${p}`)),
            ...(item.event ? [tr(`event.${item.event}.name`)] : []),
            ...(book.value === 'bugs' ? [tr('weather.clear')] : []),
          ].join(', ');
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
</script>

<template>
  <section class="discovery-guide" :aria-label="text.title">
    <p>{{ text.timing }}</p>
    <details class="discovery-dig">
      <summary>{{ tr('discovery.dig') }}</summary>
      <p>{{ text.digNote }}</p>
      <div class="discovery-filters">
        <label>{{ tr('settings.season') }}<select v-model="season"><option v-for="s in seasons" :key="s" :value="s">{{ seasonName(s) }}</option></select></label>
        <label>{{ tr('weather.label') }}<select v-model="weather"><option v-for="w in ['clear', 'rain', 'snow']" :key="w" :value="w">{{ tr(`weather.${w}`) }}</option></select></label>
        <label>{{ text.place }}<select v-model="place"><option v-for="p in places" :key="p" :value="p">{{ placeName(p) }}</option></select></label>
      </div>
      <p>{{ text.digCooldown }}</p>
      <ul><li v-for="item in digFinds" :key="item.id">{{ digName(item) }}<small class="discovery-affinity">{{ affinityHint(item) }}</small></li></ul>
      <p>{{ tr('tree.young') }}: {{ LIMITS.treeYoungMs / 3600000 }} h, {{ tr('tree.mature') }}: {{ LIMITS.treeMatureMs / 3600000 }} h</p>
    </details>
    <div class="discovery-books" :aria-label="text.title">
      <button v-for="(id, index) in books" :key="id" type="button" :aria-pressed="book === id" @click="book = id">{{ text.books[index] }}</button>
    </div>
    <div v-if="book !== 'gifts'" class="discovery-filters">
      <label>{{ tr('settings.season') }}<select v-model="season"><option v-for="s in seasons" :key="s" :value="s">{{ seasonName(s) }}</option></select></label>
      <label v-if="book !== 'flowers'">{{ tr('period.label') }}<select v-model="period"><option v-for="p in periods" :key="p" :value="p">{{ tr(`period.${p}`) }}</option></select></label>
      <label v-if="book !== 'flowers'">{{ tr('weather.label') }}<select v-model="weather"><option v-for="w in ['clear', 'rain', 'snow']" :key="w" :value="w">{{ tr(`weather.${w}`) }}</option></select></label>
      <label v-if="book !== 'flowers'">{{ text.event }}<select v-model="event"><option value="">{{ text.none }}</option><option v-for="e in events.events" :key="e.id" :value="e.id">{{ tr(`event.${e.id}.name`) }}, {{ e.from }}–{{ e.to }}</option></select></label>
    </div>
    <p v-if="book === 'fish' || book === 'bugs'" class="discovery-calendar">{{ text.calendar }}</p>
    <p>{{ text[book] }}</p>
    <div class="discovery-table"><table>
      <thead><tr><th scope="col">{{ text.item }}</th><th scope="col">{{ text.when }}</th><th scope="col">{{ text.frequency }}</th></tr></thead>
      <tbody><tr v-for="row in rows" :key="row.id"><th scope="row">{{ row.name }}</th><td>{{ row.condition }}</td><td>{{ book === 'gifts' ? (row.event ? text.seasonal : text.ordered) : frequency(row.chance) }}</td></tr></tbody>
    </table></div>
    <p v-if="book === 'flowers'">{{ text.bloom }}: {{ catalog.garden.stages.at(-1).minutes / 60 }} h</p>
  </section>
</template>

<style scoped>
.discovery-affinity { display: block; color: var(--vp-c-text-2); font-size: .8rem; }
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
