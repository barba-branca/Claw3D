Write-Host "`n--- Claw3D Gateway Starter ---" -ForegroundColor Cyan

# Verificação inicial: O modelo qwen3.5:0.8b está disponível no Ollama?
Write-Host "-> Verificando se o modelo qwen3.5:0.8b está disponível no Ollama..." -ForegroundColor Yellow
$ollamaList = ollama list
if ($ollamaList -notmatch "qwen3.5:0.8b") {
    Write-Host "`n! AVISO: Modelo qwen3.5:0.8b não encontrado. Baixando agora (0.8b - Super Leve)..." -ForegroundColor Cyan
    ollama pull qwen3.5:0.8b
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n! ERRO FATAL: Falha ao baixar o modelo. Verifique se o Ollama está rodando e se há conexão com a internet." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Modelo baixado com sucesso!" -ForegroundColor Green
}
Write-Host "[OK] Modelo qwen3.5:0.8b detectado!" -ForegroundColor Green
Write-Host "Utilizando cérebro Qwen 3.5 (0.8b) - Super Rápido" -ForegroundColor Green

# 1. Verifica se a porta 18789 já está ocupada
Write-Host "-> Verificando se a porta 18789 já está em uso..." -ForegroundColor Yellow
$occupied = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue

if ($occupied) {
    Write-Host "`n! AVISO: A porta 18789 já está ocupada por outro processo." -ForegroundColor Yellow
    Write-Host "O Gateway pode já estar ativo. Se precisar reiniciar, feche a porta primeiro." -ForegroundColor White
}

# 2. Inicia o Gateway em uma nova janela (com RESET de estado e logs coletados)
$env:OPENCLAW_AUTH_DISABLE = "true"
$env:OPENCLAW_TOKEN = "claw3d_token"
$env:OPENCLAW_PRICING_BOOTSTRAP_DISABLE = "true"
$env:OPENCLAW_CLEAN = "true"

Write-Host "-> Ativando modo Bypass de Segurança ($env:OPENCLAW_AUTH_DISABLE)..." -ForegroundColor Yellow
Write-Host "-> Definindo Token Estático ($env:OPENCLAW_TOKEN)..." -ForegroundColor Yellow
Write-Host "-> Forçando RESET de sessões e execuções anteriores (OpenClaw Clean Mode)..." -ForegroundColor Yellow

# Redirecionamos o output para gateway-debug.log para facilitar o diagnóstico de erro
$gatewayCommand = "`$env:OPENCLAW_AUTH_DISABLE = 'true'; `$env:OPENCLAW_TOKEN = 'claw3d_token'; `$env:OPENCLAW_PRICING_BOOTSTRAP_DISABLE = 'true'; `$env:OPENCLAW_CLEAN = 'true'; npx openclaw gateway --host 127.0.0.1 --port 18789 2>&1 | Tee-Object gateway-debug.log"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $gatewayCommand
Write-Host "OK: Gateway iniciado em nova janela (Monitorando logs em gateway-debug.log)." -ForegroundColor Green

Write-Host "Atenção: Mantenha a nova janela do PowerShell aberta para os agentes de IA funcionarem." -ForegroundColor White
Write-Host "Aguardando 15 segundos para o startup do serviço e warmup do cérebro..." -ForegroundColor Gray
Start-Sleep -s 15

# 3. Teste final de conexão
Write-Host "`n-> Confirmando se o 'cérebro' da IA subiu com sucesso..." -ForegroundColor Cyan
$test = Test-NetConnection -ComputerName 127.0.0.1 -Port 18789 -InformationLevel Quiet

if ($test) {
    Write-Host "`n[SUCESSO] O Gateway está OPERACIONAL e pronto para receber conexões!" -ForegroundColor Green
} else {
    Write-Host "`n[AVISO] Não foi possível confirmar a conexão na porta 18789." -ForegroundColor Yellow
    Write-Host "Confira o arquivo gateway-debug.log para ver o erro retornado." -ForegroundColor Cyan
    Write-Host "Verifique se a nova janela do terminal apresenta algum erro de inicialização." -ForegroundColor White
}

# 4. Auto-aprovação do dispositivo local (com retentativas)
Write-Host "`n-> Solicitando auto-aprovação do dispositivo..." -ForegroundColor Yellow
$success = $false
# Tentamos aprovar 3 vezes aguardando o gateway ficar 'ready'
for ($i=1; $i -le 3; $i++) {
    Write-Host "Tentativa de aprovação $i de 3..." -ForegroundColor Gray
    
    # Captura o output para verificar se o erro é apenas 'sem dispositivos pendentes'
    $approveOutput = npx openclaw devices approve --latest --host 127.0.0.1 2>&1 | Out-String
    $approveCode = $LASTEXITCODE

    if ($approveCode -eq 0 -or $approveOutput -match "No pending device pairing requests") {
        # Se o comando funcionou ou se não havia nada para aprovar, consideramos sucesso operacional
        if ($approveOutput -match "No pending device pairing requests") {
            Write-Host "INFO: Nenhum dispositivo pendente no momento (Pode já estar pareado)." -ForegroundColor Gray
        } else {
            Write-Host "OK: Dispositivo aprovado com sucesso!" -ForegroundColor Green
        }
        $success = $true
        break
    }
    
    Write-Host "Aguardando 5 segundos antes da próxima tentativa..." -ForegroundColor Gray
    Start-Sleep -s 5
}

if ($success) {
    Write-Host "Interface 3D deve conectar automaticamente agora." -ForegroundColor Green
} else {
    Write-Host "AVISO: Falha ao aprovar dispositivo. Tente rodar 'npx openclaw devices approve --latest' manualmente." -ForegroundColor Yellow
}

Write-Host "`nAgora você pode acessar a UI do Claw3D em http://localhost:3000" -ForegroundColor Cyan
