# 🎨 Skill 2: Interface de Usuário (Clutter/St vs. GTK4/Libadwaita)

O desenvolvimento de interfaces de usuário em extensões do GNOME Shell é dividido em dois mundos isolados que rodam em processos diferentes:

1.  **O Processo do Compositor (GNOME Shell)**: Código em `extension.js`. Utiliza **Clutter** (motor gráfico) e **St** (Shell Toolkit).
2.  **O Processo de Preferências (`gnome-extensions-app`)**: Código em `prefs.js`. Utiliza **GTK4** e **Libadwaita**.

---

## 1. Interface no Compositor (`extension.js`)

O shell do GNOME não usa GTK. Ele renderiza sua própria UI usando Clutter e widgets baseados em **St**.

### Principais Widgets St:
*   `St.Widget`: Container ou elemento básico.
*   `St.BoxLayout`: Layout linear (horizontal ou vertical).
*   `St.Label`: Renderização de textos simples ou estilizados.
*   `St.Button`: Botão clicável.
*   `St.Icon`: Renderização de ícones simbólicos ou temáticos.

### Boas Práticas de Layout e Estilização:
*   **Use classes CSS**: Prefira adicionar classes CSS aos elementos (`style_class`) em vez de injetar inline para manter a compatibilidade com temas do shell.
*   **Ajuste proporcional**: Ao criar elementos para a tela de bloqueio (Lockscreen), lembre-se de que telas HiDPI aplicam um fator de escala. Obtenha-o a partir de `St.ThemeContext`:
    ```javascript
    const themeContext = St.ThemeContext.get_for_stage(global.stage);
    const scaleFactor = themeContext ? themeContext.scale_factor : 1;
    ```
*   **Posicionamento dinâmico**: Use alinhamentos nativos (`x_align`, `y_align` usando `Clutter.ActorAlign`) em vez de margens fixas absolutas de pixel.

---

## 2. Interface de Configurações (`prefs.js`)

O utilitário de preferências usa **GTK4** e as folhas de estilo nativas do **Libadwaita** para garantir um visual moderno e integrado às configurações do sistema.

### Herança Obrigatória (GNOME 45+)
O ponto de entrada em `prefs.js` deve exportar por padrão uma classe que estende `ExtensionPreferences`:

```javascript
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';

export default class MyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Crie páginas, grupos e linhas de preferência nativas
        const page = new Adw.PreferencesPage({
            title: 'Minhas Configurações',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);
    }
}
```

### Principais Componentes Libadwaita Recomendados:
*   `Adw.PreferencesPage`: Representa uma aba/página vertical na janela.
*   `Adw.PreferencesGroup`: Agrupa campos correlacionados com um título opcional.
*   `Adw.ActionRow`: Linha básica com título, legenda e widgets à direita.
*   `Adw.SwitchRow`: Linha contendo um interruptor liga/desliga integrado.
*   `Adw.SpinRow`: Linha contendo um seletor numérico (incremental).
*   `Adw.ComboRow`: Seletor de opções em formato de menu suspenso.

### Vinculação Direta de Estado (Settings Binding)
Em vez de escutar eventos manuais de alteração e salvar no GSettings, faça o bind direto de propriedades. O GTK4 se encarrega de sincronizar os estados automaticamente em ambas as direções:

```javascript
// ✅ BOA PRÁTICA (Sincronização bidirecional automática)
const switchRow = new Adw.SwitchRow({
    title: 'Habilitar Efeito',
});
settings.bind(
    'my-settings-key',       // Chave do GSettings
    switchRow,               // Objeto GTK
    'active',                // Propriedade a monitorar no objeto GTK
    Gio.SettingsBindFlags.DEFAULT
);
```

### Estendendo GTK4 para Desenho Customizado (Avançado)
Se precisar customizar renderização física (como efeito blur na janela de preview), sobrescreva a função `vfunc_snapshot` de um widget GTK:

```javascript
const CustomBox = GObject.registerClass({
    GTypeName: 'CustomBox',
}, class CustomBox extends Gtk.Box {
    _init(params = {}) {
        super._init(params);
        this._blurValue = 10.0;
    }

    vfunc_snapshot(snapshot) {
        if (this._blurValue > 0) {
            snapshot.push_blur(this._blurValue);
            super.vfunc_snapshot(snapshot);
            snapshot.pop();
        } else {
            super.vfunc_snapshot(snapshot);
        }
    }
});
```
> [!WARNING]
> Tenha cuidado ao gerenciar timers em widgets GTK4. Se criar timers assíncronos (`GLib.timeout_add`), certifique-se de removê-los no sinal `'destroy'` do widget para evitar vazamento de memória e chamadas a widgets que já foram destruídos.
