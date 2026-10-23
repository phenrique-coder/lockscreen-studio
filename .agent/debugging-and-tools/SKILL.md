# 🛠️ Skill 5: Depuração, Ferramentas e Ciclo de Desenvolvimento

Como desenvolvedor especialista, você deve conhecer e instruir o agente sobre as ferramentas de depuração do ecossistema GNOME para identificar bugs rapidamente e evitar congelar a máquina principal do usuário.

---

## 1. Monitoramento de Logs (Stdout & Stderr)

O GNOME Shell envia todos os outputs de `console.log()` ou exceções lançadas para o `systemd-journald`.

### Visualizar Logs em Tempo Real:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

### Filtrando Logs da Extensão:
Sempre use mensagens com prefixos claros (ex: `[Lockscreen Studio]`) para facilitar a busca nos logs:
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep "Lockscreen Studio"
```

---

## 2. Ciclo de Testes e Recarregamento

### Sob X11 (Mais simples)
Você pode reiniciar o GNOME Shell sem fechar seus aplicativos abertos:
1.  Pressione `Alt + F2`.
2.  Digite `r` e pressione `Enter`.

Ou envie um sinal DBus via terminal:
```bash
busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s "global.reexec_self()"
```

### Sob Wayland (Default moderno)
No Wayland, o GNOME Shell não pode ser reiniciado sem encerrar a sessão de usuário. Portanto, a prática recomendada para desenvolvimento rápido é usar uma **Sessão Aninhada (Nested Session)**.

#### Executando GNOME Shell Aninhado:
Abra um terminal na pasta do projeto e execute:
```bash
dbus-run-session gnome-shell --nested --wayland
```
Isso abrirá uma janela contendo uma instância limpa e independente do GNOME Shell. Qualquer erro ou travamento nela não afetará seu desktop principal.

---

## 3. Comandos de Empacotamento e Gerenciamento

O utilitário CLI oficial `gnome-extensions` é usado para empacotar, habilitar ou desabilitar extensões.

### Ativando a Extensão Manualmente:
```bash
gnome-extensions enable lockscreen-studio@pedro.projects
```

### Desativando a Extensão:
```bash
gnome-extensions disable lockscreen-studio@pedro.projects
```

### Empacotando para Distribuição (.zip):
Para criar o arquivo compactado pronto para envio ao site [extensions.gnome.org](https://extensions.gnome.org/):
```bash
rm -f lockscreen-studio@pedro.projects.zip
zip -r lockscreen-studio@pedro.projects.zip metadata.json extension.js prefs.js schemas/org.gnome.shell.extensions.lockscreen-studio.gschema.xml
```

---

## 4. Validação Pré-Upload com Shexli

Antes de submeter o pacote para a loja ou criar tags de release, execute a validação estática do **Shexli** para prevenir avisos e rejeições automáticas do EGO:

```bash
python3 -m shexli lockscreen-studio@pedro.projects.zip
```

Para detalhes aprofundados sobre regras como `EGO-L-003`, `EGO-M-008` e ciclo de vida, consulte a skill **[Verificação EGO e Shexli](../ego-review-and-shexli/SKILL.md)**.
