# --- Claw3D Deep Cleanup (Qwen Edition) ---
# Este script realiza uma limpeza profunda para destravar a interface 3D.

Write-Host "`n--- Claw3D Deep Cleanup (Qwen Edition) ---" -ForegroundColor Cyan

# 1. Limpar pastas de dados e execução do OpenClaw na HOME do usuário
Write-Host "-> Limpando Histórico, Cache e Storage (OpenClaw)..." -ForegroundColor Yellow
$openclawHome = "$env:USERPROFILE\.openclaw"
$dirsToClear = "runs", "storage", "cache", "locks"

foreach ($dir in $dirsToClear) {
    $targetPath = Join-Path $openclawHome $dir
    if (Test-Path $targetPath) {
        Remove-Item -Recurse -Force "$targetPath\*" -ErrorAction SilentlyContinue 2>$null
        Write-Host "OK: Pasta $dir limpa." -ForegroundColor Green
    }
}

# 2. Garantir a exclusão do lock do Next.js no projeto local
Write-Host "`n-> Removendo Trava do Next.js (.next\dev\lock)..." -ForegroundColor Yellow
$lockPath = Join-Path $PSScriptRoot ".next\dev\lock"
if (Test-Path $lockPath) {
    Remove-Item -Force $lockPath -ErrorAction SilentlyContinue
    Write-Host "OK: Lock do Next.js removido." -ForegroundColor Green
}

# 3. Encerrar processos zumbis nas portas 3000 e 18789
Write-Host "`n-> Encerrando processos zumbis (Portas 3000, 18789)..." -ForegroundColor Yellow
$ports = 3000, 18789
foreach ($port in $ports) {
    # Usando $procId para evitar colisão com a variável reservada $pid do sistema
    $processIds = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($processIds) {
        foreach ($procId in $processIds) {
            Write-Host "Finalizando processo $procId na porta $port..." -ForegroundColor White
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "OK: Processo $procId finalizado." -ForegroundColor Green
        }
    } else {
        Write-Host "INFO: Nenhuma atividade detectada na porta $port." -ForegroundColor Gray
    }
}

# 4. Encerramento forçado de qualquer processo "node" remanescente
Write-Host "`n-> Finalizando instâncias residuais do Node.js..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

Write-Host "`n[LIMPEZA PROFUNDA CONCLUÍDA]" -ForegroundColor Green
Write-Host "Sugestão: Agora você pode rodar .\RUN_ALL.ps1 para um arranque limpo." -ForegroundColor Cyan
