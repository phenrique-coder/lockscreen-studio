# 🐒 Skill 4: Monkey-Patching Seguro e Extensibilidade

Muitas vezes o GNOME Shell não disponibiliza APIs públicas ou sinais para customizar determinados componentes internos (como a tela de bloqueio ou o menu de status). Nesses casos, a técnica recomendada é o **monkey-patching** (sobrescrever métodos no protótipo de classes nativas).

Como essa técnica altera o comportamento global do shell, ela exige cuidados extremos para evitar falhas catastróficas.

---

## 1. Regras de Ouro do Monkey-Patching

1.  **Faça backup sempre**: Salve a referência do método original em uma variável externa à classe da extensão.
2.  **Restaure no `disable()`**: Sem exceções, devolva o método original ao protótipo quando a extensão for desativada.
3.  **Chame o método original primeiro**: Chame o comportamento padrão usando `.apply(this, arguments)` antes ou depois das suas modificações, garantindo que o ciclo de vida interno do GNOME Shell continue funcionando normalmente.
4.  **Verifique se já foi modificado**: Evite aplicar patches redundantes se a extensão for recarregada.

---

## 2. Exemplo Prático de Patch Seguro

Abaixo está o modelo ideal de patching aplicado ao `UnlockDialog` (tela de bloqueio), simulando o comportamento adotado no Lockscreen Studio:

```javascript
import { UnlockDialog } from 'resource:///org/gnome/shell/ui/unlockDialog.js';

let origInit = null;
let origUpdateBackgroundEffects = null;

export default class MyPatchExtension extends Extension {
    enable() {
        const extension = this;

        // 1. Monkey-Patching do método _init
        if (!origInit) {
            origInit = UnlockDialog.prototype._init;
            
            UnlockDialog.prototype._init = function() {
                // Executa a inicialização original do GNOME
                origInit.apply(this, arguments);
                
                // Aplica as customizações da extensão
                extension._applyCustomBehavior(this);
            };
        }

        // 2. Monkey-Patching de efeitos visuais
        if (!origUpdateBackgroundEffects) {
            origUpdateBackgroundEffects = UnlockDialog.prototype._updateBackgroundEffects;
            
            UnlockDialog.prototype._updateBackgroundEffects = function() {
                // Sempre executa o nativo primeiro
                origUpdateBackgroundEffects.apply(this, arguments);
                
                // Modifica os efeitos de blur/brilho
                extension._modifyBackground(this);
            };
        }
    }

    disable() {
        // 3. Restauração rigorosa dos protótipos originais
        if (origInit) {
            UnlockDialog.prototype._init = origInit;
            origInit = null;
        }

        if (origUpdateBackgroundEffects) {
            UnlockDialog.prototype._updateBackgroundEffects = origUpdateBackgroundEffects;
            origUpdateBackgroundEffects = null;
        }
    }
}
```

---

## 3. Compatibilidade entre Versões do GNOME Shell

Ao fazer monkey-patching, os atributos internos de objetos nativos podem mudar entre as versões do GNOME Shell (46, 47, 48). 

Sempre verifique a existência de chaves ou métodos antes de lê-los ou gravá-los:

```javascript
// ✅ BOA PRÁTICA (Verificação robusta de compatibilidade)
let effect = actor.get_effect('blur');
if (effect) {
    // GNOME Shell 46+ introduziu a propriedade 'radius' (sigma * 2)
    if ('radius' in effect) {
        effect.radius = blurRadius * 2;
    }
    // Versões anteriores usavam apenas 'sigma'
    if ('sigma' in effect) {
        effect.sigma = blurRadius;
    }
}
```
> [!CAUTION]
> Nunca modifique protótipos de objetos nativos sem restaurá-los no `disable()`. Se a extensão for desabilitada ou atualizada pelo usuário e os patches continuarem ativos, o GNOME Shell exibirá erros visuais bizarros ou poderá congelar por completo.
