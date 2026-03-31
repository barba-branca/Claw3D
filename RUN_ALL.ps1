# --- RUN_ALL.ps1 ---
# Script Mestre para iniciar o ecossistema Claw3D com um único comando.
# Este script limpa o ambiente, sobe o Gateway e inicia o servidor Next.js.

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host "   CLAW3D MASTER BOOT SEQUENCE (Qwen Edition)" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

# 1. Limpeza Profunda (Locks, Runs e Processos)
Write-Host "Etapa 1: Executando protocolo de limpeza..." -ForegroundColor Yellow
.\clear-system.ps1

# Limpar todos os logs para facilitar debug
Write-Host "Limpando logs antigos..." -ForegroundColor Gray
Remove-Item "..\gateway.log" -Force -ErrorAction SilentlyContinue
Remove-Item "*.log" -Force -ErrorAction SilentlyContinue 2>$null
Remove-Item "gateway-debug.log" -Force -ErrorAction SilentlyContinue 2>$null

$openclawLogs = "$env:USERPROFILE\.openclaw\logs"
if (Test-Path $openclawLogs) {
    Remove-Item "$openclawLogs\*" -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "OK: Logs do OpenClaw limpos." -ForegroundColor Gray
}
Write-Host "OK: Logs locais de debug removidos." -ForegroundColor Gray

# 2. Iniciar o Gateway em uma janela separada
Write-Host "`nEtapa 2: Ativando cérebro da IA (Gateway)..." -ForegroundColor Yellow
.\start-gateway.ps1

# 3. Pequena pausa para garantir que o cérebro está pronto
Write-Host "`nAguardando sincronização do Gateway..." -ForegroundColor Gray
Start-Sleep -s 3

# 3.1 Exibir Token para facilidade de cópia (se necessário)
$tokenLine = Get-Content .env -ErrorAction SilentlyContinue | Select-String "NEXT_PUBLIC_GATEWAY_TOKEN"
$envToken = if ($tokenLine) { $tokenLine.ToString().Split('=')[1].Replace('"', '').Trim() } else { "claw3d_token" }

Write-Host "`n[INFORMAÇÃO DE CONEXÃO]" -ForegroundColor Green
Write-Host "URL: ws://127.0.0.1:18789" -ForegroundColor White
Write-Host "TOKEN: $envToken" -ForegroundColor White
Write-Host "(Dica: Use 127.0.0.1 se localhost falhar)" -ForegroundColor Gray

# 4. Iniciar o servidor de desenvolvimento na janela ATUAL
Write-Host "`nEtapa 3: Iniciando Interface 3D (Next.js)..." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor White
Write-Host "Mantenha este terminal aberto para o servidor UI." -ForegroundColor Green
Write-Host "Pressione CTRL+C para encerrar tudo." -ForegroundColor White
Write-Host "--------------------------------------------------------`n" -ForegroundColor White

npm run dev
