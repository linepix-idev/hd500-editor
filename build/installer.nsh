; Passo extra do instalador Windows: o driver da Line 6 ocupa a interface de controle do pedal.
; O editor precisa do WinUSB nela; o Zadig (incluso) faz a troca. Só pergunta em instalação interativa.
!macro customInstall
  IfSilent skip_zadig
  IfFileExists "$INSTDIR\resources\zadig.exe" 0 skip_zadig
  MessageBox MB_YESNO|MB_ICONQUESTION "Para o editor falar com o POD HD500, a interface de controle do pedal precisa usar o driver WinUSB (isto desativa o áudio USB do pedal nessa interface).$\r$\n$\r$\nAbrir o Zadig agora? Nele: Options > List All Devices, escolha 'POD HD500 (Interface 1)', driver WinUSB, Replace Driver.$\r$\n$\r$\nPode fazer depois pela Iniciar > HD500 Editor, ou pelo assistente do app." IDNO skip_zadig
  ExecShell "open" "$INSTDIR\resources\zadig.exe"
  skip_zadig:
!macroend
