# Instala esta configuracion en la carpeta .claude del usuario (Windows).
# Se puede ejecutar varias veces: actualiza lo instalado sin borrar lo demas.
# Uso: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $HOME '.claude'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$start = '<!-- claude-config:inicio -->'
$end = '<!-- claude-config:fin -->'

New-Item -ItemType Directory -Force -Path (Join-Path $dst 'agents') | Out-Null

# 1. Agentes
Copy-Item -Path (Join-Path $src 'agents\*.md') -Destination (Join-Path $dst 'agents') -Force
Write-Host 'Agentes copiados.'

# 2. CLAUDE.md: se mete entre marcadores para poder actualizarlo sin tocar lo tuyo
$rules = [IO.File]::ReadAllText((Join-Path $src 'CLAUDE.md'), $utf8).Trim()
$block = "$start`r`n$rules`r`n$end"
$claudeMd = Join-Path $dst 'CLAUDE.md'
if (Test-Path $claudeMd) {
    Copy-Item $claudeMd "$claudeMd.bak" -Force
    $current = [IO.File]::ReadAllText($claudeMd, $utf8)
    $pattern = [regex]::Escape($start) + '[\s\S]*?' + [regex]::Escape($end)
    if ($current -match $pattern) {
        $new = [regex]::Replace($current, $pattern, { param($m) $block })
    } else {
        $new = $current.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
    }
    [IO.File]::WriteAllText($claudeMd, $new, $utf8)
    Write-Host 'CLAUDE.md actualizado (copia anterior en CLAUDE.md.bak).'
} else {
    [IO.File]::WriteAllText($claudeMd, $block + "`r`n", $utf8)
    Write-Host 'CLAUDE.md creado.'
}

# 3. settings.json: Sonnet como modelo por defecto, solo si no tienes uno elegido
$settings = Join-Path $dst 'settings.json'
if (Test-Path $settings) {
    $json = [IO.File]::ReadAllText($settings, $utf8) | ConvertFrom-Json
    if (-not ($json.PSObject.Properties.Name -contains 'model')) {
        Copy-Item $settings "$settings.bak" -Force
        $json | Add-Member -NotePropertyName 'model' -NotePropertyValue 'sonnet'
        [IO.File]::WriteAllText($settings, ($json | ConvertTo-Json -Depth 50), $utf8)
        Write-Host 'settings.json: modelo por defecto -> sonnet.'
    } else {
        Write-Host "settings.json: ya tenias un modelo ($($json.model)), no se cambia."
    }
} else {
    [IO.File]::WriteAllText($settings, "{`r`n  `"model`": `"sonnet`"`r`n}`r`n", $utf8)
    Write-Host 'settings.json creado con modelo sonnet.'
}

Write-Host "Listo. Instalado en $dst. Abre una sesion nueva de Claude Code."
