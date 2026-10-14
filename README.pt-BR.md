# HD500 Editor

**Um editor livre e aberto para o Line 6 POD HD500.** Como o software oficial não é mais mantido, a comunidade pode manter este pedal vivo.
Funciona em Linux, Windows e macOS, fala com o pedal direto por USB e vai além do editor original.

![HD500 Editor](docs/img/editor.png)

## O que dá para fazer

- **Cadeia de sinal** estilo Helix: arraste efeitos entre *antes/depois do amp* e os caminhos **A / B**; veja qual entrada alimenta qual caminho.
- **Edição ao vivo de tudo**: todos os modelos de amp, cab e efeito (92 amps com os pacotes de modelos · 22 cabs · 115 efeitos, cada um com sua ilustração), todos os parâmetros, bypass, footswitch de cada bloco e pedal de expressão (EXP 1/2) com faixa calcanhar/ponta.
- **Painel do Mixer**: nível (Mute … +12 dB) e pan dos caminhos A e B com faders ao vivo, mais o Trails — espelhado em tempo real quando você gira os knobs no pedal.
- **Roteamento de entrada**: Guitar, Mic, Aux, Variax e combinações nas Inputs 1 e 2, impedância, tempo e Dynamic Tone.
- **Painel de footswitches** virtual, espelhando o pedal em tempo real: pisou no FS5, o bloco acende na tela.
- **Gerenciador da biblioteca** (8 sets × 64 presets): renomear sets, copiar, trocar, limpar, arrastar entre slots, **exportar/importar a biblioteca inteira**, importar/exportar presets **`.h5e`** do editor oficial e **backup** automático antes de cada gravação.
- **Desfazer/refazer**, aviso de alterações não salvas, tema claro e escuro.
- **Avançado**: todos os ajustes do preset por id, bytes do preset, registros MIDI, ajustes globais e o modo **Aprender**, que mostra qual ajuste você mexeu no pedal — ajude a dar nome aos que faltam!

## Situação

| | Linux | Windows | macOS |
|---|---|---|---|
| Editor testado em hardware | ✅ | ✅ (VM Windows 10, USB repassado) | ✅ |

## Instalar

**Linux** — baixe o `.AppImage` ou `.deb` em Releases (o `.deb` já instala a regra udev). Para AppImage/código-fonte, instale a regra uma vez:

```sh
sudo cp 99-line6-hd500.rules /etc/udev/rules.d/ && sudo udevadm control --reload
# desplugue e plugue o pedal de novo
```

**Windows** — o driver da Line 6 ocupa a interface de controle do pedal; use o [Zadig](https://zadig.akeo.ie) para associar a *Interface 1* do POD HD500 ao **WinUSB**. *Não testado.*

**A partir do código** (Node.js ≥ 22): `npm install` e depois `npm run app` (janela) ou `npm start` (http://127.0.0.1:5230).

## Segurança

- As edições vão só para o **buffer de edição**; nada é gravado até você clicar em **Salvar no pedal**.
- Antes de qualquer gravação o conteúdo anterior vai para `backups/` (`node tools/restore.mjs arquivo.bin set preset` regrava).
- Trocar de preset descarta o que não foi salvo — o editor pergunta antes.
- Sem vínculo com a Line 6 / Yamaha Guitar Group — veja o [DISCLAIMER](DISCLAIMER.md).

## Documentação

[`docs/protocol.md`](docs/protocol.md) · [`docs/preset-format.md`](docs/preset-format.md) · [`docs/reverse-engineering.md`](docs/reverse-engineering.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md)

Licença MIT.
