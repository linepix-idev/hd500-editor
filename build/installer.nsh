; Passo extra do instalador Windows: o driver da Line 6 ocupa o pedal inteiro.
; O editor precisa do WinUSB nele; o Zadig (incluso) faz a troca. Só pergunta em instalação interativa.
!macro customInstall
  IfSilent skip_zadig
  IfFileExists "$INSTDIR\resources\zadig.exe" 0 skip_zadig
  MessageBox MB_YESNO|MB_ICONQUESTION "Para o editor falar com o POD HD500, o pedal precisa usar o driver WinUSB.$\r$\n$\r$\nIMPORTANTE: no Windows o pedal ou funciona como placa de som (driver oficial da Line 6) ou é editável por este programa (WinUSB), nunca os dois ao mesmo tempo. Instalar o WinUSB desliga o áudio USB do pedal. Para voltar ao áudio, reinstale o driver da Line 6 (line6.com/software).$\r$\n$\r$\nAbrir o Zadig agora? Nele: Options > List All Devices, escolha 'POD HD500', driver WinUSB, Replace Driver.$\r$\n$\r$\nVocê pode fazer isso depois pelo assistente do app ou em Iniciar > HD500 Editor." IDNO skip_zadig
  ExecShell "open" "$INSTDIR\resources\zadig.exe"
  skip_zadig:
!macroend
