export const copy = {
  sceneNote: '호환되는 Codex 펫 파일을 가져와요. 커뮤니티 펫을 만날 수 있는 곳:',
  communities: [
    'OpenPets Registry',
    'Petdex',
    'Codex PokéPets',
    'Awesome Codex Pet',
    'Codex Pets',
    'GitHub 폴더',
    '내 컴퓨터 폴더',
  ],
  whyThanks: '펫을 그린 분들께 고마워요. 이 앱은 그 펫들이 더 많은 책상 위에서 움직이게 하려고 만들었어요.',
  diffNote:
    'Codex 펫은 OpenAI Codex의 기능이에요. PlayPets는 그 펫 파일 형식을 따르는 별도의 오픈소스 앱이고, Codex가 없어도 돼요.',
  chatAlt: '친구와 나눈 대화',
  github: 'GitHub에서 보기',
  guide: '사용 안내 읽기',
  more: '자세히',
  eyebrow: '내 책상 위의 작은 친구들',
  start: '내 컴퓨터에서 만나기',
  meet: '친구 먼저 만나기',
  finalTitle: '내일도, 여기서 만나요.',
  developerTitle: '직접 만들어 보고 싶다면',
  developerBody:
    '소스 코드를 공개하고 있어요. 코딩 도구를 연결하면 작업을 시작하거나, 내 확인이 필요하거나, 끝났을 때 친구가 반응해요.',
  developerLink: '개발 문서 읽기',
  privacyTitle: '내 정보는 어디에 저장되나요?',
  privacyBody:
    '친구와 설정은 내 컴퓨터에 저장해요. 대화 내용은 내가 연결한 AI로 보내며, 그 서비스의 데이터 정책이 적용돼요. PlayPets는 대화 기록을 파일로 저장하지 않아요.',
  releaseLabel: '버전과 변경 사항',
  releaseTitle: (v: string) => `PlayPets ${v}`,
  releaseLink: (v: string) => `${v}`,
};
export const worldCopy = {
  title: ['돌아오고 싶은', '작은 세계.'],
  lead: '함께 걷고, 꽃을 키우고, 잠깐 이야기를 나눠요. 바쁜 하루 한쪽에 작은 친구들을 위한 자리를 내어 주세요.',
  worldsTitle: '오늘은 어디서 쉴까요?',
  worldsLead: '좋아하는 계절을 골라요. 도시의 불빛이 보이는 방도 있어요.',
  sceneLabel: '장소와 계절 고르기',
  scenes: [
    {
      shot: 'yard-spring',
      label: '봄',
      caption: '햇볕과 꽃잎 사이, 서두르지 않아도 되는 시간.',
    },
    {
      shot: 'yard-summer',
      label: '여름',
      caption: '푸른 잔디 위에서 보내는 느긋한 오후.',
    },
    {
      shot: 'yard-talk',
      label: '가을',
      caption: '따뜻한 낙엽빛과 익숙한 친구들.',
    },
    {
      shot: 'yard-winter',
      label: '겨울',
      caption: '같이 바라보면 눈 내리는 날도 포근해요.',
    },
    {
      shot: 'studio-day',
      label: '도시의 낮',
      caption: '분주한 도시 위, 우리만의 조용한 자리.',
    },
    {
      shot: 'studio-night',
      label: '도시의 밤',
      caption: '창밖에 불이 켜지면 조금 더 머물러요.',
    },
  ],
  pause: '움직임 멈추기',
  resume: '움직임 재생하기',
  creatorTitle: '내가 상상한 친구도 함께.',
  creatorBody:
    '좋아하는 펫을 데려오거나 새로운 친구를 만들어요. 모습이 달라지지 않도록 참고 시트와 바로 쓸 수 있는 프롬프트를 준비했어요.',
  creatorLink: '나만의 친구 만들기',
  discovery: '이미 Codex 펫이 있나요?',
  sceneCaption: (v: string) => `실제 앱 화면 · PlayPets ${v}`,
};
