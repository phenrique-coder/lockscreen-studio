# Diretrizes e Regras de Desenvolvimento (GNOME Shell & EGO)

Este repositório segue padrões estritos para aprovação no portal oficial **extensions.gnome.org (EGO)**. Qualquer agente trabalhando neste código deve obedecer rigorosamente às seguintes regras:

## 1. Proibição de Comentários de Correção ou Issues
* **NUNCA** inclua comentários no código que façam referência a correções, bugs, workarounds ou números de issues (ex.: `// Fix for Issue #1`, `// Solves Issue #2`, `// Correção do bug X`, `// Resolves Issue...`).
* O código submetido ao EGO deve ser limpo e definitivo. Comentários devem explicar apenas a função técnica atual do código, sem carregar histórico de rastreamento de tickets do GitHub.

## 2. Proibição de Comentários Numerados / Estilo IA
* **NUNCA** use listas numeradas em comentários de código (`// 1.`, `// 2.`, `// 3.`, `// Passo 1:`, `// Group 1:`).
* Revisores do EGO reprovam explicitamente comentários estruturados artificialmente por ferramentas de IA. Mantenha comentários naturais, concisos e estritamente técnicos.

## 3. Proibição de `return` em `cleanup()` e `disable()` (Selective Disable)
* **NUNCA** utilize comandos `return` dentro de rotinas de `cleanup()` ou no corpo da função `disable()`.
* Retornos antecipados (como `if (!dialog) return;`) causam **"selective disable"** caso um único objeto seja nulo ou já tenha sido destruído, impedindo a limpeza do restante dos elementos, desconexão de sinais e restauração de protótipos nativos.
* Toda limpeza deve ser incondicional, utilizando verificações diretas e *optional chaining* (ex.: `if (dialog?._widget) { ... }`).

## 4. Validação Pré-Empacotamento
Antes de qualquer release ou tag:
1. Validar sintaxe GJS: `gjs -c "import('./extension.js'); import('./prefs.js');"`
2. Validar GSchema estritamente: `glib-compile-schemas --strict schemas/`
3. Empacotar: `gnome-extensions pack --extra-source=src --extra-source=LICENSE --force && mv lockscreen-studio@pedro.projects.shell-extension.zip lockscreen-studio@pedro.projects.zip`
4. Validar com Shexli: `shexli lockscreen-studio@pedro.projects.zip` (deve retornar 0 erros e 0 warnings)
5. Incrementar sempre o inteiro `"version"` em `metadata.json` a cada nova submissão ao EGO.
