#!/usr/bin/env bash
# Instala esta configuracion en ~/.claude (Mac/Linux).
# Se puede ejecutar varias veces: actualiza lo instalado sin borrar lo demas.
# Uso: bash install.sh
set -euo pipefail
src="$(cd "$(dirname "$0")" && pwd)"
dst="$HOME/.claude"
mkdir -p "$dst/agents"

cp "$src"/agents/*.md "$dst/agents/"
echo "Agentes copiados."

python3 - "$src" "$dst" <<'PY'
import json, os, re, shutil, sys
src, dst = sys.argv[1], sys.argv[2]
start, end = "<!-- claude-config:inicio -->", "<!-- claude-config:fin -->"
rules = open(os.path.join(src, "CLAUDE.md"), encoding="utf-8").read().strip()
block = f"{start}\n{rules}\n{end}"
path = os.path.join(dst, "CLAUDE.md")
if os.path.exists(path):
    shutil.copy(path, path + ".bak")
    cur = open(path, encoding="utf-8").read()
    pat = re.escape(start) + r"[\s\S]*?" + re.escape(end)
    new = re.sub(pat, lambda m: block, cur) if re.search(pat, cur) else cur.rstrip() + "\n\n" + block + "\n"
    print("CLAUDE.md actualizado (copia anterior en CLAUDE.md.bak).")
else:
    new = block + "\n"
    print("CLAUDE.md creado.")
open(path, "w", encoding="utf-8").write(new)

sp = os.path.join(dst, "settings.json")
data = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else {}
if "model" in data:
    print(f"settings.json: ya tenias un modelo ({data['model']}), no se cambia.")
else:
    if os.path.exists(sp):
        shutil.copy(sp, sp + ".bak")
    data["model"] = "sonnet"
    json.dump(data, open(sp, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("settings.json: modelo por defecto -> sonnet.")
PY

echo "Listo. Instalado en $dst. Abre una sesion nueva de Claude Code."
