# 📂 Skill 1: Arquitetura e Módulos ES (ESM)

Desde o GNOME 45, o ecossistema do GNOME Shell abandonou o sistema de importação legado do GJS (`const Gio = imports.gi.Gio`) em favor dos **Módulos ES (ESM)** padrões do JavaScript. Como especialista, você deve seguir estritamente este novo padrão.

---

## 1. Importações ESM Modernas

### GJS APIs (GObject Introspection)
Todas as APIs nativas do GNOME (como Gio, GLib, St, Clutter, GObject, GTK) são importadas utilizando o prefixo `gi://`:

```javascript
// ✅ BOA PRÁTICA (Moderno ESM)
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

// ❌ MÁ PRÁTICA (Legado - Não funciona no GNOME 45+)
const { GObject, Gio, GLib, St } = imports.gi;
```

### Importações internas do GNOME Shell
Para importar módulos internos do shell do sistema, utiliza-se a URL especial `resource:///org/gnome/shell/`:

```javascript
// ✅ BOA PRÁTICA
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
```

---

## 2. Estrutura do Ponto de Entrada (`extension.js`)

Toda extensão moderna deve expor uma classe padrão que herda de `Extension` obtida de `resource:///org/gnome/shell/extensions/extension.js`. Os métodos principais de ciclo de vida são `enable()` e `disable()`.

```javascript
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MyExtension extends Extension {
    enable() {
        // Inicialize seus recursos aqui.
        // Acesse configurações da extensão via: this.getSettings()
        this._settings = this.getSettings();
    }

    disable() {
        // Limpe rigorosamente todos os recursos alocados.
        this._settings = null;
    }
}
```

---

## 3. Manifesto da Extensão (`metadata.json`)

O arquivo `metadata.json` define a compatibilidade da extensão e suas informações fundamentais.

```json
{
  "uuid": "lockscreen-studio@pedro.projects",
  "name": "Lockscreen Studio",
  "description": "Customize your GNOME lockscreen with custom fonts, colors, custom text and control background blur settings.",
  "shell-version": [
    "45",
    "46",
    "47",
    "48"
  ],
  "url": "https://github.com/phenrique-coder/lockscreen-studio",
  "session-modes": [
    "user",
    "unlock-dialog"
  ]
}
```

> [!IMPORTANT]
> A propriedade `"session-modes"` deve conter `"unlock-dialog"` se a extensão interagir diretamente ou modificar a tela de bloqueio (como faz o Lockscreen Studio). Sem isso, o GNOME Shell desativa a extensão quando a tela é bloqueada.

---

## 4. GSettings e Esquemas XML (`schemas/`)

GSettings é a forma padrão e persistente de salvar configurações no GNOME.

*   O arquivo XML deve ser definido em `schemas/org.gnome.shell.extensions.lockscreen-studio.gschema.xml`.
*   O ID do esquema deve seguir a convenção `org.gnome.shell.extensions.NOME_DA_EXTENSAO`.

### Exemplo de Definição de Chaves:
```xml
<schemalist>
  <schema id="org.gnome.shell.extensions.lockscreen-studio" path="/org/gnome/shell/extensions/lockscreen-studio/">
    <key name="enable-blur" type="b">
      <default>true</default>
      <summary>Enable Lockscreen Blur</summary>
    </key>
    <key name="blur-radius" type="i">
      <default>30</default>
      <summary>Blur Sigma/Radius</summary>
    </key>
    <key name="clock-color" type="s">
      <default>'#ffffff'</default>
      <summary>Clock Hex Color</summary>
    </key>
  </schema>
</schemalist>
```

### Compilação dos Esquemas:
Para que o sistema reconheça novas chaves durante o desenvolvimento local, compile sempre os arquivos XML:
```bash
glib-compile-schemas schemas/
```
*(Nota: O script `install.sh` do repositório automatiza isso).*
