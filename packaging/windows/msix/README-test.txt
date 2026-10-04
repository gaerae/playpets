PlayPets MSIX 검증용 패키지
===========================

이 패키지는 시험용 인증서로 서명되어 있어요. 스토어에 올리는 패키지가 아니라,
패키지로 설치했을 때 앱이 제대로 도는지 확인하는 용도예요.

설치 (관리자 PowerShell에서, 이 폴더에서 실행)

  1. 시험용 인증서를 이 PC가 믿게 하기 (처음 한 번)
       Import-Certificate -FilePath .\PlayPets-test.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople

  2. 패키지 설치
       Add-AppxPackage .\PlayPets_@VERSION@_x64.msix

지우기

       Get-AppxPackage gaerae.PlayPets | Remove-AppxPackage
       Get-ChildItem Cert:\LocalMachine\TrustedPeople | Where-Object Subject -eq '@PUBLISHER@' | Remove-Item

확인할 것

  [ ] 시작 메뉴의 PlayPets로 실행되고 놀이터와 펫이 보인다
  [ ] 트레이 아이콘과 메뉴가 동작한다
  [ ] 바탕화면에 보이기: 펫이 다른 창 위에 뜨고, 끌어서 옮길 수 있다
  [ ] AI 연결 저장 후 대화가 된다 (Claude Code / Codex CLI가 실행되는지)
  [ ] 새 터미널에서  playpets pets  가 친구 목록을 보여 준다 (실행 별칭)
  [ ] 설정 > Claude Code 설정 복사 → 붙여 넣은 뒤 Claude Code를 쓰면 친구가 반응한다
  [ ] 펫 가져오기(주소)로 받은 펫이 다시 켜도 남아 있다
  [ ] 초대 탭 '폴더 열기'가 폴더를 연다  ← 패키지에서는 안 열릴 수 있어요(아래 참고)

알아 둘 점

  - 패키지로 설치한 앱은 %APPDATA%에 쓰는 파일이 실제로는
    %LOCALAPPDATA%\Packages\gaerae.PlayPets_...\LocalCache\Roaming 아래에 저장돼요.
    앱과 playpets 명령은 같은 곳을 보지만, 탐색기는 그렇지 않아요.
  - WebView2 런타임이 필요해요. Windows 11에는 들어 있고, Windows 10에는 없을 수 있어요.
