# 🧹 Skill 3: Gerenciamento de Memória e Prevenção de Leaks

Diferente de aplicativos normais que terminam seus processos ao serem fechados, as extensões do GNOME Shell rodam **dentro da mesma thread do processo principal do compositor do sistema**. Um vazamento de memória (memory leak) em uma extensão acumula lixo no GNOME Shell, resultando em lentidão e, eventualmente, no travamento do ambiente desktop inteiro.

---

## 1. Conexão e Desconexão de Sinais

Sempre que escutar um evento usando `.connect()`, você deve salvar o ID retornado e desconectá-lo explicitamente no `disable()`.

```javascript
// ✅ BOA PRÁTICA
export default class MyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        
        // Salva o ID da conexão
        this._settingsChangedId = this._settings.connect('changed::some-key', () => {
            this._updateUI();
        });
    }

    disable() {
        // Desconecta o sinal salvando o ID
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        
        this._settings = null;
    }
}
```

```javascript
// ❌ MÁ PRÁTICA (O sinal continuará ativo mesmo após desativar a extensão!)
export default class MyExtension extends Extension {
    enable() {
        this.getSettings().connect('changed::some-key', () => {
            this._updateUI();
        });
    }

    disable() {
        // Nada limpo. Vazamento crítico de sinal.
    }
}
```

---

## 2. Destruição de Elementos Visuais (Actors/Widgets)

Se você adicionou elementos visuais a layouts nativos do shell (como a área do relógio, painel de status ou barra superior), deve removê-los e destruí-los apropriadamente no `disable()`.

```javascript
// ✅ BOA PRÁTICA
enable() {
    this._customLabel = new St.Label({ text: 'Olá!' });
    Main.layoutManager.panelBox.add_child(this._customLabel);
}

disable() {
    if (this._customLabel) {
        // Remove do container pai
        Main.layoutManager.panelBox.remove_child(this._customLabel);
        // Destrói o objeto e libera sua memória vinculada
        this._customLabel.destroy();
        // Anula a referência em JavaScript
        this._customLabel = null;
    }
}
```

---

## 3. Limpeza de Fontes do GLib (Timers e Loops)

Se você usar temporizadores, loops ou processos secundários via GLib/Gio, salve sempre o ID e remova a fonte no `disable()`.

```javascript
// ✅ BOA PRÁTICA
enable() {
    // Atualiza a cada 5 segundos
    this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
        this._tick();
        return GLib.SOURCE_CONTINUE; // Continua repetindo
    });
}

disable() {
    if (this._timerId) {
        GLib.source_remove(this._timerId);
        this._timerId = null;
    }
}
```
*   **Retorno do callback**: Retorne sempre `GLib.SOURCE_CONTINUE` para manter o timer rodando ou `GLib.SOURCE_REMOVE` para execução de disparo único.

---

## 4. Referências a Objetos Globais

Mantenha referências mínimas a objetos globais como `Main.panel`, `Main.screenShield` ou instâncias ativas do shell. Se precisar rastrear uma instância de diálogo ativa (por exemplo, `UnlockDialog` na tela de bloqueio), certifique-se de escutar o evento `'destroy'` dela para limpar sua referência:

```javascript
// Monitora a destruição natural do diálogo para não reter a referência na memória
dialog.connect('destroy', () => {
    if (this._activeDialog === dialog) {
        this._activeDialog = null;
    }
});
```

---

## 5. Proibição de `return` em `cleanup()` e `disable()` (Prevenção de "Selective Disable")

**Nunca utilize declarações `return` dentro de métodos de `cleanup()` ou no corpo do `disable()`.**

### Por que os revisores do EGO rejeitam isso?
O uso de retornos antecipados (como `if (!dialog) return;` ou `if (!dialog._clock) return;`) faz com que, caso um único objeto esteja nulo ou já destruído, todas as etapas de limpeza posteriores sejam sumariamente ignoradas. Isso causa o chamado **"selective disable"**, deixando sinais conectados, timers rodando ou protótipos modificados no GNOME Shell.

```javascript
// ❌ MÁ PRÁTICA: Return antecipado bloqueia limpezas posteriores
static cleanup(dialog) {
    if (!dialog) {
        return; // PROIBIDO: Se dialog for nulo, aborta a limpeza restante
    }

    if (dialog._overlay) {
        dialog._overlay.destroy();
        dialog._overlay = null;
    }
}

// ✅ BOA PRÁTICA: Execução incondicional com optional chaining e guards individuais
static cleanup(dialog) {
    if (dialog?._overlay) {
        dialog._overlay.destroy();
        dialog._overlay = null;
    }
}
```

