# 🛡️ Skill 6: Verificação EGO (extensions.gnome.org) e Shexli

Esta skill define as diretrizes, regras de linting automatizado e procedimentos de validação com o **Shexli** (analisador estático oficial do GNOME Extensions Org) para garantir que qualquer pacote submetido seja aprovado sem avisos ou rejeições.

---

## 1. O que é o Shexli?

O **Shexli** é o motor de análise estática experimental e automatizado integrado ao portal [extensions.gnome.org (EGO)](https://extensions.gnome.org/). Sempre que uma extensão é enviada para a loja ou atualizada, o Shexli analisa a AST dos arquivos JavaScript (`extension.js`, `prefs.js`) e os metadados (`metadata.json`) em busca de:
* Vazamentos de memória e ciclo de vida inconsistente (`EGO-L-...`).
* Metadados inválidos ou incompatíveis (`EGO-M-...`).
* Más práticas de empacotamento (`EGO-P-...`).
* Riscos de segurança e APIs sensíveis (`EGO-A-...`).

---

## 2. Como Executar o Shexli Localmente

O pacote oficial do Shexli está disponível no PyPI e pode ser executado via CLI:

### Execução no diretório do projeto:
```bash
python3 -m shexli /caminho/absoluto/do/projeto
```

### Execução direta no arquivo `.zip` empacotado:
```bash
python3 -m shexli lockscreen-studio@pedro.projects.zip
```

### Saída estruturada em JSON:
```bash
python3 -m shexli --format json lockscreen-studio@pedro.projects.zip
```

> [!TIP]
> Se o comando não retornar saída e o código de saída for `0`, o pacote está 100% livre de avisos e em conformidade estrita com o Shexli.

---

## 3. Catálogo de Regras EGO Críticas e Como Evitar Violações

### ⚠️ `EGO-L-003` — Sinais sem desconexão correspondente no `disable()`
* **Regra:** *"Signals connected by extension should be disconnected in disable()".*
* **Causa:** Conectar sinais em objetos dentro de `enable()` (ex: `dialog.connect('destroy', ...)` ou `settings.connect('changed', ...)`) sem salvar o handler ID e sem chamar `.disconnect()` no `disable()`.
* **Como fazer corretamente:**
  ```javascript
  // No enable():
  this._dialogDestroyId = dialog.connect('destroy', () => {
      extension._dialogDestroyId = null;
      // ...
  });

  // No disable():
  if (this._dialogDestroyId) {
      if (this._activeDialog) {
          this._activeDialog.disconnect(this._dialogDestroyId);
      }
      this._dialogDestroyId = null;
  }
  ```

---

### ⚠️ `EGO-L-002` — Destruição de Objetos e Atores Clutter/St
* **Regra:** Todo widget ou ator Clutter/St adicionado a containers nativos (como o stage ou `dialog._clock`) deve ser destruído explicitamente.
* **Como fazer corretamente:**
  ```javascript
  if (dialog._customClockContainer) {
      dialog._clock.remove_child(dialog._customClockContainer);
      dialog._customClockContainer.destroy();
      dialog._customClockContainer = null;
  }
  ```

---

### ⚠️ `EGO-L-005` — Remoção de Timers GLib
* **Regra:** Nenhum timer agendado via `GLib.timeout_add` ou `GLib.idle_add` pode continuar rodando após `disable()`.
* **Como fazer corretamente:**
  ```javascript
  if (this._clockTimerId) {
      GLib.source_remove(this._clockTimerId);
      this._clockTimerId = null;
  }
  ```

---

### ⚠️ `EGO-M-008` — Documentação Obrigatória de `unlock-dialog`
* **Regra:** Extensões que usam o modo de sessão `"unlock-dialog"` no `metadata.json` DEVEM documentar explicitamente a razão em comentários dentro da função `disable()`.
* **Como fazer corretamente:**
  ```javascript
  disable() {
      // Session Modes: 'user' and 'unlock-dialog'
      // 'user' allows the extension to remain enabled during the regular user desktop session.
      // 'unlock-dialog' ensures GNOME Shell keeps the extension active when the screen locks.
      // During disable(), we restore all original prototypes and remove all created elements.
      ...
  }
  ```

---

### ⚠️ `EGO-P-006` — Empacotamento de Schemas
* **Regra:** Para o GNOME 44+, o arquivo `.zip` **NÃO DEVE** conter o arquivo binário pré-compilado `schemas/gschemas.compiled`. O GNOME Shell compila o schema automaticamente ao instalar.
* O pacote `.zip` deve conter apenas o XML fonte `schemas/org.gnome.shell.extensions.<nome>.gschema.xml`.

---

### ⚠️ `gi://` Imports Versionados
* Sempre especifique a versão ao importar bibliotecas que possuam mais de uma versão instalada no sistema:
  ```javascript
  import GnomeDesktop from 'gi://GnomeDesktop?version=4.0';
  ```

---

---

## 4. Diretrizes Humanas dos Revisores do EGO (Revisão Manual)

Além do Shexli, os revisores humanos do EGO (como JustPerfection) inspecionam o código-fonte manualmente e exigem conformidade com as seguintes diretrizes:

### 🚫 1. Nunca inclua comentários de correções ou referências a issues no código
* **Regra:** Não escreva comentários no código como `// Fix for Issue #1`, `// Solves Issue #2`, `// Resolves bug...`, `// Workaround para o problema X`.
* **Motivo:** O código submetido ao repositório central do GNOME deve ser limpo e definitivo. Comentários devem descrever o comportamento técnico atual e arquitetural, nunca o histórico de correção de bugs ou números de tickets do GitHub.

### 🚫 2. Nunca inclua comentários numerados ou formatados por IA
* **Regra:** Evite comentários com listas numeradas (`// 1.`, `// 2.`, `// 3.`, `// Group 1:`, `// Passo 1:`).
* **Motivo:** Revisores identificam comentários estruturados artificialmente como lixo de IA e rejeitam versões solicitando sua remoção expressa. Use comentários técnicos concisos e naturais apenas quando estritamente necessários.

### 🚫 3. Nunca use `return` em rotinas de `cleanup()` ou `disable()` (Selective Disable)
* **Regra:** Não use retornos antecipados (`return;`) em funções de limpeza como `cleanup(dialog)`.
* **Motivo:** Se um objeto estiver ausente ou for nulo, um `return` abortará as limpezas subsequentes (remoção de outros widgets, desconexão de sinais e restauração de protótipos), causando **"selective disable"**. Use sempre guards individuais (`if (dialog?._widget) { ... }`) para garantir que todas as instruções de limpeza executem incondicionalmente.

---

## 5. Checklist Pré-Submissão Obrigatório

Antes de gerar a tag e subir qualquer release no GitHub ou no EGO:

*   **Verificação de Comentários:**
    Garantir que não há comentários de "Fix Issue", nem números sequenciais (`// 1.`, `// 2.`).
*   **Verificação de Limpeza:**
    Garantir que nenhuma função `cleanup()` ou `disable()` possui comandos `return`.
*   **Validação de Sintaxe JavaScript:**
    ```bash
    gjs -c "import('./extension.js'); import('./prefs.js');"
    ```
*   **Validação Estrita do GSchema:**
    ```bash
    glib-compile-schemas --strict schemas/
    ```
*   **Geração Limpa do Pacote .zip:**
    ```bash
    gnome-extensions pack --extra-source=src --extra-source=LICENSE --force && mv lockscreen-studio@pedro.projects.shell-extension.zip lockscreen-studio@pedro.projects.zip
    ```
*   **Execução do Shexli:**
    ```bash
    shexli lockscreen-studio@pedro.projects.zip
    ```
    *Se o comando retornar qualquer erro ou aviso, corrija o código antes de subir.*
*   **Versão Única e Incremental:**
    * Certifique-se de que o inteiro `"version"` no `metadata.json` seja estritamente maior que qualquer versão já enviada ao painel do EGO.
