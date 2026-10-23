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

## 4. Checklist Pré-Submissão Obrigatório

Antes de gerar a tag e subir qualquer release no GitHub ou no EGO:

1. **Validação de Sintaxe JavaScript:**
   ```bash
   node -c extension.js && node -c prefs.js
   ```
2. **Validação Estrita do GSchema:**
   ```bash
   glib-compile-schemas --strict schemas/
   ```
3. **Geração Limpa do Pacote .zip:**
   ```bash
   rm -f lockscreen-studio@pedro.projects.zip
   zip -r lockscreen-studio@pedro.projects.zip metadata.json extension.js prefs.js schemas/org.gnome.shell.extensions.lockscreen-studio.gschema.xml
   ```
4. **Execução do Shexli:**
   ```bash
   python3 -m shexli lockscreen-studio@pedro.projects.zip
   ```
   *Se o comando retornar qualquer erro ou aviso, corrija o código antes de subir.*
5. **Versão Única e Incremental:**
   * Certifique-se de que o inteiro `"version"` no `metadata.json` seja estritamente maior que qualquer versão já enviada ao painel do EGO.
