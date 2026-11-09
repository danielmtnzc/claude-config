# Instala la configuracion de Claude Code (Windows): los plugins reparto y
# panel-agentes, y quita lo que instalaban las versiones anteriores en .claude.
# Se puede ejecutar varias veces.
# Uso: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = 'Stop'
$dst = Join-Path $HOME '.claude'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$start = '<!-- claude-config:inicio -->'
$end = '<!-- claude-config:fin -->'

# 1. Limpieza de la instalacion antigua (ahora todo va en el plugin reparto)
foreach ($old in @('rapido.md', 'normal.md', 'experto.md')) {
    $f = Join-Path $dst "agents\$old"
    if (Test-Path $f) { Remove-Item $f -Force; Write-Host "Agente antiguo quitado de .claude: $old" }
}
$claudeMd = Join-Path $dst 'CLAUDE.md'
if (Test-Path $claudeMd) {
    $current = [IO.File]::ReadAllText($claudeMd, $utf8)
    $pattern = '\s*' + [regex]::Escape($start) + '[\s\S]*?' + [regex]::Escape($end) + '\s*'
    if ($current -match $pattern) {
        Copy-Item $claudeMd "$claudeMd.bak" -Force
        $new = [regex]::Replace($current, $pattern, "`r`n`r`n").Trim()
        if ($new -eq '') {
            Remove-Item $claudeMd -Force
            Write-Host 'Reglas antiguas quitadas de .claude\CLAUDE.md (copia en CLAUDE.md.bak).'
        } else {
            [IO.File]::WriteAllText($claudeMd, $new + "`r`n", $utf8)
            Write-Host 'Reglas antiguas quitadas de .claude\CLAUDE.md; tu contenido se conserva (copia en CLAUDE.md.bak).'
        }
    }
}

# 2. Plugins
$plugins = @('reparto', 'panel-agentes')
if (Get-Command claude -ErrorAction SilentlyContinue) {
    # En PowerShell 5.1, la salida de error de un programa con 'Stop' corta el script.
    $ErrorActionPreference = 'Continue'
    # Si el marketplace se anadio desde el repositorio antiguo (sin -dev), se cambia por el nuevo.
    $lista = (& claude plugin marketplace list 2>$null | Out-String)
    if ($lista -match 'danielmtnzc/claude-config') {
        & claude plugin marketplace remove claude-config 2>$null | Out-Null
        Write-Host 'Marketplace antiguo (danielmtnzc/claude-config) sustituido por danielmtnzc-dev/claude-config.'
    }
    & claude plugin marketplace update claude-config 2>$null | Out-Null
    foreach ($p in $plugins) {
        & claude plugin install $p --marketplace danielmtnzc-dev/claude-config 2>$null | Out-Null
        & claude plugin update "$p@claude-config" 2>$null | Out-Null
        Write-Host "Plugin ${p}: instalado o actualizado."
    }
} else {
    Write-Host 'No se encuentra el comando claude: instala los plugins reparto y panel-agentes'
    Write-Host 'desde la app (+ junto al mensaje -> Plugins -> marketplace danielmtnzc-dev/claude-config).'
}

Write-Host 'Listo. Abre una sesion nueva de Claude Code.'
