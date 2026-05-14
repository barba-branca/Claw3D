# Script to setup Gemma 4 for OpenClaw
Write-Host "Configurando Gemma 4 no Ollama..." -ForegroundColor Cyan

if (Test-Path openclaw.Modelfile) {
    ollama create gemma4:26b -f openclaw.Modelfile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Modelo gemma4:26b criado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] Falha ao criar o modelo. Verifique se o Ollama está rodando." -ForegroundColor Red
    }
} else {
    Write-Host "[ERRO] openclaw.Modelfile não encontrado!" -ForegroundColor Red
}
