# 🎵 SoundBoard com Configuração por Player - Guia de Uso

## 📋 Resumo das Mudanças

Este módulo foi atualizado para suportar **configurações personalizadas de SoundBoard por player**:

- ✅ **GM**: Configuração central e possibilidade de atribuir pastas a cada player
- ✅ **Players**: Podem ter suas próprias pastas de sons (controladas por GM ou personalizadas)
- ✅ **Fallback automático**: Se não configurado, usa a pasta do GM

---

## 👨‍💼 PARA GM

### 1. Configurar Pasta Padrão (Seu Soundboard)
- Vá em: **Module Settings** → **Soundboard-by-Jack**
- Campo: **"Custom SoundBoard Directory (GM)"**
- Aponte para sua pasta, ex: `sounds/gm` ou qualquer outro diretório

### 2. Configurar Pastas dos Players
- Vá em: **Module Settings** → **Player Directories** (novo menu)
- Clique em **[Manage]** para abrir o gerenciador
- Para cada player ativo:
  - Digite a pasta: ex. `sounds/player-1`, `sounds/player-2`, etc.
  - Clique **[Save]** para confirmar
  - Ou **[Clear]** para remover e fazer o player usar as próprias configurações

### 3. Exemplo de Estrutura
```
sounds/
├── gm/              ← Sua pasta (GM vê)
│   ├── boss-music/
│   ├── effects/
│   └── etc...
├── player-1/        ← Pasta do Player 1 (só ele vê)
│   ├── spells/
│   ├── ambience/
│   └── etc...
├── player-2/        ← Pasta do Player 2 (só ele vê)
│   ├── music/
│   └── etc...
└── shared/          ← Compartilhado (todos veem se usar)
    └── levelup/
```

---

## 🎮 PARA PLAYERS

### Opção A: Deixar o GM Gerenciar (Recomendado)
1. **Não faça nada!** O GM vai atribuir sua pasta via "Player Directories"
2. Quando a GU abrir o SoundBoard, você verá apenas seus sons
3. Sua configuração fica: **Module Settings** → **"My SoundBoard Directory"** (em branco)

### Opção B: Gerenciar Sua Própria Pasta
1. Abra: **Module Settings** → **Soundboard-by-Jack**
2. Campo: **"My SoundBoard Directory"**
3. Digite sua pasta, ex: `sounds/my-player-sounds`
4. **Aplica automaticamente** quando você abri o SoundBoard
5. **Aviso**: Se GM atribuiu uma pasta via "Player Directories", a dele tem prioridade

---

## 📱 COMO ABRIR O SOUNDBOARD (Player)

### Opção 1: Via Botão (Simples)
- Abra o SoundBoard normalmente via Menu ou Botão
- A interface pode levar alguns segundos para carregar
- Aguarde até aparecer com todos os sons

### Opção 2: Via Macro (Recomendado para Players)
Crie uma macro com este código:

```javascript
// MACRO: Open Player SoundBoard (with loading wait)
// Use this macro as a PLAYER to open the SoundBoard.
// It automatically waits for sounds to load before opening the interface.

const MAX_WAIT_TIME = 30000; // 30 seconds max wait
const CHECK_INTERVAL = 100; // Check every 100ms

async function waitForSoundsLoaded() {
    return new Promise((resolve) => {
        let elapsedTime = 0;
        const checkInterval = setInterval(() => {
            elapsedTime += CHECK_INTERVAL;
            if (SoundBoard && SoundBoard.soundsLoaded && !SoundBoard.soundsError) {
                clearInterval(checkInterval);
                resolve(true);
                return;
            }
            if (elapsedTime >= MAX_WAIT_TIME) {
                clearInterval(checkInterval);
                console.warn('SoundBoard: Sounds took too long to load. Opening anyway...');
                resolve(false);
                return;
            }
        }, CHECK_INTERVAL);
    });
}

(async () => {
    if (SoundBoard && SoundBoard.soundsLoaded && !SoundBoard.soundsError) {
        console.log('SoundBoard: Sounds already loaded, opening immediately');
        SoundBoard.openSoundBoard();
        return;
    }
    console.log('SoundBoard: Waiting for sounds to load...');
    ui.notifications.notify('Loading SoundBoard...');
    const loaded = await waitForSoundsLoaded();
    if (loaded) {
        console.log('SoundBoard: Sounds loaded successfully!');
        ui.notifications.notify('SoundBoard loaded!', 'info');
        SoundBoard.openSoundBoard();
    } else {
        console.error('SoundBoard: Failed to load sounds');
        ui.notifications.error('SoundBoard failed to load. Check Module Settings.');
    }
})();
```

---

## 🔧 Ordem de Precedência (Como Funciona)

Para cada player, o módulo carrega sons nesta ordem:

1. **GM atribuiu uma pasta** (via Player Directories Manager)
   - ✅ Usa aquela pasta
   
2. **Player tem um diretório configurado** (via "My SoundBoard Directory")
   - ✅ Usa aquele diretório
   
3. **Nenhum dos anteriores**
   - ✅ Usa a pasta padrão do GM

**Resultado:** Cada um vê seus próprios sons!

---

## ❌ Problemas Comuns

### "Sounds are still loading, please try again shortly"
- **Causa**: A interface abriu antes dos sons carregarem
- **Solução**: Use a macro do Player (Opção 2 acima)
- Ou aguarde alguns segundos e tente novamente

### "SoundBoard directory not found: ..."
- **Causa**: A pasta configurada não existe
- **Solução**: Verifique o caminho em Module Settings

### Interface abre mas não mostra sons
- **Causa**: Pasta configurada não tem subpastas com áudio
- **Solução**: Verifique a estrutura de suas pastas

### Menu "Player Directories" abre em branco
- **Causa**: Geralmente quando nenhum player ativo está online
- **Solução**: Conecte alguns players e tente novamente

---

## 📝 Notas Técnicas

- **Configurações são salvas** no banco de dados do Foundry
- **Cada player tem sua configuração isolada** (client-scope)
- **GM pode editar tudo** (world-scope)
- **Sensível a maiúsculas/miúsculas** no caminho das pastas
- **Suporta**: Forge, S3, Data (configurável em "Source Type")

---

## ✨ Exemplo Prático

### Setup:
```
GM: Module Settings → "Custom SoundBoard Directory (GM)" = "data/Soundboards/gm"
Player 1: Module Settings → deixa em branco (vai usar GM)
Player 2: Module Settings → "My SoundBoard Directory" = "data/Soundboards/player2"
```

### Resultado:
- **GM** abre SoundBoard → vê todos os sons de `data/Soundboards/gm`
- **Player 1** abre SoundBoard → vê todos os sons de `data/Soundboards/gm` (padrão GM)
- **Player 2** abre SoundBoard → vê todos os sons de `data/Soundboards/player2`

---

## 🎯 Fluxo de SoundBoard com Players

1. **Player clica em Abrir SoundBoard**
2. **Macro aguarda `soundsLoaded = true`** (se usar macro recomendada)
3. **módulo carrega sons** da pasta configurada (precedência acima)
4. **Interface renderiza** com os sons carregados
5. **Player pode:**
   - Tocar sons (toca globalmente - todos ouvem)
   - Clicar múltiplas vezes no mesmo som
   - Usar botão Stop individual para parar cada som

---

Pronto! 🎵 Agora cada player pode ter seu próprio SoundBoard!
