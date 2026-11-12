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
      'This is a preview, not your saved state. After a rare find, all friends and places wait 24 hours for another. Repeats are possible and completion time is not guaranteed.',
    place: 'Outdoor place',
    customPlace: 'Custom outdoor background',
    affinity: 'More likely with',
    baseline: 'No preferred conditions',
    title: 'What could you discover?',
    books: ['Aquatic life', 'Bugs', 'Flowers', 'Gifts', 'Spring shoots'],
    season: ['Spring', 'Summer', 'Autumn', 'Winter'],
    none: 'No event',
    calendar:
      'Choosing an event here only previews what it brings. In the app an event comes on its own on its dates (north of the equator; six months later in the south, except the winter lights and New Year), or on any day you pick its season by hand with the time of day and weather it asks for.',
    event: 'Event',
    item: 'Find',
    when: 'Where to look',
    frequency: 'With these conditions',
    other: 'Other conditions',
    common: 'Often',
    occasional: 'Sometimes',
    rare: 'Rarely',
    fish: 'Click the water and react to the float, or choose Fish in Play for an independent trip. A trip can end without a catch.',
    bugs: 'Bugs appear in clear outdoor places. Butterflies, moths and dragonflies fly, beetles and mantises crawl and grasshoppers and crickets hop in the morning and day; fireflies come on spring and summer evenings and nights, and crickets on autumn ones. Rain and snow stop appearances.',
    flowers:
      'Flower seeds and saplings come from digging. Flowers bloom after four hours and trees mature after twelve, including time with the app closed.',
    shoots: 'In spring, a few shoots poke up after rain, and one comes up on fair mornings, outdoors only. Click one and a friend digs it up for the album.',
    gifts:
      'Gifts come from friends, not from the clock: on a day you pat, feed, talk to or fish with a friend, it may bring one 10 to 20 minutes later. The whole yard gets at most one every other day, and time alone in the yard brings none. The wait is saved, and time with the app closed counts. Friends also bring one for each new closeness level from At ease on, and at Very close it is their memento. New gifts follow catalogue order; after all ordinary gifts, friends bring decorations missing from the yard. Event gifts take priority when one is due during their event. This is not a random loot table. With 12 decorations out, new gifts wait in the gift box; putting one away keeps its album entry. Event gifts follow real calendar dates, so collecting them all can take months.',
    ordered: 'In order',
    seasonal: 'During the event',
    built: 'Built with friends in the snow',
    bloom: 'Hours to bloom',
    timing:
      'Finds depend on season and time. Try another season or come back for a different light; there is no completion deadline.',
  },
  ko: {
    digNote:
      '땅을 파면 꽃씨, 묘목, 작은 발견을 얻거나 아무것도 나오지 않을 수 있어요. 계절, 날씨, 장소에 따라 더 찾기 쉬운 것이 달라져요. 보관함이 가득 차면 더 받지 못하고 다른 보상으로 바뀌지 않아요. 같은 땅은 24시간 동안 추가 보상이 없어요.',
    digCooldown:
      '이 페이지는 미리보기이며 앱의 저장 상태를 읽지 않아요. 희귀한 발견을 얻으면 모든 친구와 장소에서 다음 희귀한 발견까지 24시간을 기다려요. 중복이 나올 수 있고 완료 시점은 보장하지 않아요.',
    place: '야외 장소',
    customPlace: '직접 추가한 야외 배경',
    affinity: '더 잘 나오는 조건',
    baseline: '선호 조건 없음',
    title: '어떤 발견을 할 수 있을까요?',
    books: ['물속 생물', '곤충', '꽃', '선물', '봄 새싹'],
    season: ['봄', '여름', '가을', '겨울'],
    none: '이벤트 없음',
    calendar:
      '여기서 이벤트를 고르면 무엇이 나오는지 미리 보기만 해요. 앱에서는 날짜가 되면 저절로 열리고(북반구 기준, 남반구는 여섯 달 뒤. 겨울 별빛과 새해는 같은 날짜), 다른 날에도 계절을 직접 고르고 이벤트에 맞는 시간대와 날씨로 맞추면 열려요.',
    event: '이벤트',
    item: '발견할 것',
    when: '만나는 조건',
    frequency: '이 조건에서',
    other: '다른 조건',
    common: '자주',
    occasional: '가끔',
    rare: '드물게',
    fish: '물을 눌러 찌에 반응하거나 놀기의 낚시로 친구에게 맡겨요. 잡지 못하고 돌아올 수도 있어요.',
    bugs: '곤충은 맑은 야외에 나타나요. 아침과 한낮에는 나비, 나방, 잠자리가 날고 딱정벌레와 사마귀가 기어 다니며 메뚜기와 귀뚜라미가 뛰어요. 반딧불이는 봄과 여름의 저녁과 밤에, 귀뚜라미는 가을의 저녁과 밤에도 나타나요. 비나 눈이 오면 나타나지 않아요.',
    flowers: '꽃씨와 묘목은 땅파기로 찾아요. 꽃은 4시간 뒤 피고 나무는 12시간 뒤 자라요. 앱을 꺼 둔 시간도 포함해요.',
    shoots: '봄에는 비 온 뒤에 새싹이 몇 개 올라오고, 맑은 아침에는 하나가 올라와요. 야외에서만 볼 수 있어요. 새싹을 누르면 친구가 캐서 도감에 넣어 줘요.',
    gifts:
      '선물은 시간이 아니라 친구가 가져와요. 쓰다듬거나 간식을 주거나 대화하고 함께 낚시한 날, 그 친구가 10~20분 뒤에 선물을 가져올 수 있어요. 놀이터 전체에 이틀에 한 번까지 오고, 켜 두기만 해서는 오지 않아요. 기다리는 시간은 저장되고 앱을 꺼 둔 시간도 포함해요. 편한 사이부터 단계가 오를 때마다 하나씩 더 오고, 각별한 사이가 되면 그 친구만의 추억의 선물이 와요. 새 선물은 도감 순서로 오고, 일반 선물을 다 받은 뒤에는 마당에 없는 장식이 다시 와요. 이벤트 선물은 이벤트 중 선물이 올 차례에 우선하며 무작위 뽑기는 아니에요. 장식이 12개면 새 선물은 선물 상자에서 기다리고, 하나를 치워도 도감 기록은 남아요. 이벤트 선물은 실제 달력을 따라, 모두 모으려면 몇 달이 걸릴 수 있어요.',
    ordered: '차례대로 와요',
    seasonal: '이벤트 중에 와요',
    built: '친구들과 눈밭에서 만들어요',
    bloom: '꽃이 피기까지 걸리는 시간',
    timing:
      '계절과 시간에 따라 새로운 발견이 기다려요. 계절을 바꿔 보거나 다른 빛이 드는 시간에 찾아오세요. 모두 모아야 하는 기한은 없어요.',
  },
  ja: {
    digNote:
      '土を掘ると種、苗木、小さな発見が出ることも、何も出ないこともあります。季節、天気、場所によって見つけやすさが変わります。収納が満杯でも別の報酬には変わりません。同じ場所は24時間追加の報酬がありません。',
    digCooldown:
      'これはプレビューで、保存状態は読みません。レアな発見の後は全員と全場所で次のレアな発見まで24時間待ちます。重複があり、完了時期は保証されません。',
    place: '屋外の場所',
    customPlace: '追加した屋外背景',
    affinity: '出やすい条件',
    baseline: '優先条件なし',
    title: 'どんな出会いがある？',
    books: ['水中の生きもの', '虫', '花', '贈り物', '春の芽'],
    season: ['春', '夏', '秋', '冬'],
    none: 'イベントなし',
    calendar:
      'ここでイベントを選ぶと、出会えるものを確認できるだけです。アプリでは日付が来ると自然に始まり（北半球の暦。南半球では6か月遅れ、冬のイルミネーションとお正月は同じ日付）、ほかの日でも季節を自分で選び、イベントに合う時間帯と天気にすると始まります。',
    event: 'イベント',
    item: '見つかるもの',
    when: '出会える条件',
    frequency: 'この条件では',
    other: '別の条件で出会えます',
    common: 'よく',
    occasional: 'ときどき',
    rare: 'まれに',
    fish: '水面を押して浮きに反応するか、遊ぶの釣りで友だちに任せます。釣れないこともあります。',
    bugs: '虫は晴れた屋外に現れます。朝と昼はチョウやガ、トンボが飛び、甲虫やカマキリが歩き、バッタやコオロギが跳ねます。ホタルは春と夏の夕方と夜、コオロギは秋の夕方と夜にも出ます。雨や雪では現れません。',
    flowers: '花の種と苗木は土を掘って見つけます。花は4時間、木は12時間で育ちます。アプリを閉じた時間も含みます。',
    shoots: '春は雨のあとに芽がいくつか顔を出し、晴れた朝にもひとつ出ます。屋外だけです。芽をクリックすると、友だちが掘って図鑑に入れてくれます。',
    gifts:
      'プレゼントは時計ではなく友だちが持ってきます。なでる、おやつ、会話、一緒の釣りなどをした日に、その友だちが10〜20分後に持ってくることがあります。庭全体で2日に1回までで、開いておくだけでは届きません。待ち時間は保存され、アプリを閉じた時間も数えます。うちとけた仲から段階が上がるたびに1つずつ届き、特別な仲になるとその友だちの思い出のプレゼントが届きます。新しいプレゼントはカタログ順で、通常分を集めた後は庭にない飾りが届きます。イベント中に届く番のときはイベント分が優先され、ランダム抽選ではありません。飾りが12個なら新しいプレゼントはプレゼント箱で待ち、片付けても図鑑の記録は残ります。イベント限定のプレゼントは実際の暦に従うため、集めるには数か月かかる場合があります。',
    ordered: '順番に届きます',
    seasonal: 'イベント中に届きます',
    built: '友だちと雪の中で作ります',
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
    books: ['水中生物', '昆虫', '花', '礼物', '春日嫩芽'],
    season: ['春', '夏', '秋', '冬'],
    none: '无活动',
    calendar:
      '在这里选择活动只是预览会遇到什么。应用里，活动到了日期会自己开始（以北半球为准，南半球晚六个月，冬日灯光和新年日期不变）；在别的日子手动选择季节，再选好活动需要的时段和天气，也会开始。',
    event: '活动',
    item: '发现',
    when: '相遇条件',
    frequency: '在这些条件下',
    other: '需要其他条件',
    common: '经常',
    occasional: '偶尔',
    rare: '少见',
    fish: '点击水面并回应浮漂，或在玩耍中选择钓鱼交给伙伴。也可能空手而归。',
    bugs: '昆虫出现在晴朗的室外。早晨和白天有蝴蝶、蛾子和蜻蜓飞舞，甲虫和螳螂爬行，蝗虫和蟋蟀跳跃；萤火虫在春夏的傍晚和夜间出现，蟋蟀在秋天的傍晚和夜间也会出现。雨雪天不会出现。',
    flowers: '花种和树苗都来自挖土。花在4小时后开放，树木在12小时后长成，包括关闭应用的时间。',
    shoots: '春天雨后会冒出几株嫩芽，晴朗的早晨还会冒出一株，只在户外出现。点一下嫩芽，伙伴就会去挖出来，收进图鉴。',
    gifts:
      '礼物不是按时间来的，而是伙伴带来的：在你抚摸、喂零食、聊天或一起钓鱼的那天，那位伙伴可能在10到20分钟后带来礼物。整个乐园最多两天一件，只开着乐园不会收到。等待时间会保存，关闭应用的时间也计入。从熟络起每升一级会多带来一件，到特别要好时会送来它的纪念礼物。新礼物按图鉴顺序到来，收齐普通礼物后会送来乐园缺少的装饰，活动期间轮到送礼时活动礼物优先，并非随机抽奖。摆满12件装饰时，新礼物会在礼物盒里等着，收起装饰后仍保留图鉴记录。活动礼物遵循真实日历，收齐可能需要数月。',
    ordered: '按顺序到来',
    seasonal: '活动期间到来',
    built: '和伙伴们在雪地里堆',
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
const books = ['fish', 'bugs', 'flowers', 'gifts', 'shoots'];
// Books whose finds do not depend on the time of day, the weather or an event.
const plain = () => book.value === 'flowers' || book.value === 'shoots';
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
  if (book.value === 'shoots')
    chances = relativeChances(
      source.filter(s => s.season === season.value),
      () => 1,
    );
  return source.map(item => {
    const chance = chances.find(c => c.id === item.id)?.chance ?? null;
    const prefix = { fish: 'catch.fish_', bugs: 'catch.bug_', flowers: 'garden.kind_', gifts: 'decor.kind_', shoots: 'shoot.' }[
      book.value
    ];
    const condition =
      book.value === 'gifts'
        ? item.event
          ? `${tr(`event.${item.event}.name`)} (${events.events.find(event => event.id === item.event)?.from}–${events.events.find(event => event.id === item.event)?.to})`
          : item.built
            ? text.value.built
            : text.value.ordered
        : [
            ...(item.seasons || [item.season]).map(seasonName),
            ...(item.periods || []).map(p => tr(`period.${p}`)),
            ...(item.event ? [tr(`event.${item.event}.name`)] : []),
            ...(book.value === 'bugs' ? [tr('weather.clear')] : []),
          ].join(', ');
    return { id: item.id, name: tr(prefix + item.id), chance, condition, event: item.event, built: item.built };
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
      <label v-if="!plain()">{{ tr('period.label') }}<select v-model="period"><option v-for="p in periods" :key="p" :value="p">{{ tr(`period.${p}`) }}</option></select></label>
      <label v-if="!plain()">{{ tr('weather.label') }}<select v-model="weather"><option v-for="w in ['clear', 'rain', 'snow']" :key="w" :value="w">{{ tr(`weather.${w}`) }}</option></select></label>
      <label v-if="!plain()">{{ text.event }}<select v-model="event"><option value="">{{ text.none }}</option><option v-for="e in events.events" :key="e.id" :value="e.id">{{ tr(`event.${e.id}.name`) }}, {{ e.from }}–{{ e.to }}</option></select></label>
    </div>
    <p v-if="book === 'fish' || book === 'bugs'" class="discovery-calendar">{{ text.calendar }}</p>
    <p>{{ text[book] }}</p>
    <div class="discovery-table"><table>
      <thead><tr><th scope="col">{{ text.item }}</th><th scope="col">{{ text.when }}</th><th scope="col">{{ text.frequency }}</th></tr></thead>
      <tbody><tr v-for="row in rows" :key="row.id"><th scope="row">{{ row.name }}</th><td>{{ row.condition }}</td><td>{{ book === 'gifts' ? (row.event ? text.seasonal : row.built ? text.built : text.ordered) : frequency(row.chance) }}</td></tr></tbody>
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
