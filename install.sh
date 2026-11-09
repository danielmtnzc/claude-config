#!/usr/bin/env bash
# Instala la configuracion de Claude Code (Mac/Linux): los plugins reparto y
# panel-agentes, y quita lo que instalaban las versiones anteriores en ~/.claude.
# Se puede ejecutar varias veces.
# Uso: bash install.sh
set -euo pipefail
dst="$HOME/.claude"

# 1. Limpieza de la instalacion antigua (ahora todo va en el plugin reparto)
for old in rapido.md normal.md experto.md; do
  if [ -f "$dst/agents/$old" ]; then rm -f "$dst/agents/$old"; echo "Agente antiguo quitado de ~/.claude: $old"; fi
done
if [ -f "$dst/CLAUDE.md" ]; then
python3 - "$dst/CLAUDE.md" <<'PY'
import os, re, shutil, sys
path = sys.argv[1]
start, end = "<!-- claude-config:inicio -->", "<!-- claude-config:fin -->"
cur = open(path, encoding="utf-8").read()
pat = r"\s*" + re.escape(start) + r"[\s\S]*?" + re.escape(end) + r"\s*"
if re.search(pat, cur):
    shutil.copy(path, path + ".bak")
    new = re.sub(pat, "\n\n", cur).strip()
    if new == "":
        os.remove(path)
        print("Reglas antiguas quitadas de ~/.claude/CLAUDE.md (copia en CLAUDE.md.bak).")
    else:
        open(path, "w", encoding="utf-8").write(new + "\n")
        print("Reglas antiguas quitadas de ~/.claude/CLAUDE.md; tu contenido se conserva (copia en CLAUDE.md.bak).")
PY
fi

# 2. Plugins
if command -v claude >/dev/null 2>&1; then
  # Si el marketplace se anadio desde el repositorio antiguo (sin -dev), se cambia por el nuevo.
  if claude plugin marketplace list 2>/dev/null | grep -q 'danielmtnzc/claude-config'; then
    claude plugin marketplace remove claude-config >/dev/null 2>&1 || true
    echo "Marketplace antiguo (danielmtnzc/claude-config) sustituido por danielmtnzc-dev/claude-config."
  fi
  claude plugin marketplace update claude-config >/dev/null 2>&1 || true
  for p in reparto panel-agentes; do
    claude plugin install "$p" --marketplace danielmtnzc-dev/claude-config >/dev/null 2>&1 || true
    claude plugin update "$p@claude-config" >/dev/null 2>&1 || true
    echo "Plugin $p: instalado o actualizado."
  done
else
  echo "No se encuentra el comando claude: instala los plugins reparto y panel-agentes"
  echo "desde la app (+ junto al mensaje -> Plugins -> marketplace danielmtnzc-dev/claude-config)."
fi

echo "Listo. Abre una sesion nueva de Claude Code."
