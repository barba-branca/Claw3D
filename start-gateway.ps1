Write-Host "`n--- Claw3D Gateway Starter ---" -ForegroundColor Cyan

# Carregar variáveis de ambiente do .env se existir
if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $name, $value = $_.Split('=', 2)
        [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim().Trim('"').Trim("'"), "Process")
    }
    Write-Host "-> Variáveis de ambiente carregadas do .env" -ForegroundColor Gray
}


# Verificação inicial: O modelo configurado está disponível?
# Para modelos de nuvem (ex: /kimi-k2.5:cloud), pulamos a verificação do Ollama local.
$currentModel = $env:OLLAMA_MODEL
if ($null -eq $currentModel) { $currentModel = "qwen3.5:1.5b" } # fallback se não definido

if ($currentModel -match "^/" -or $currentModel -match "^moonshot/" -or $currentModel -match ":cloud$") {
    Write-Host "-> Utilizando modelo em nuvem: $currentModel" -ForegroundColor Cyan
} else {
    Write-Host "-> Verificando se o modelo $currentModel está disponível no Ollama..." -ForegroundColor Yellow
    $ollamaList = ollama list 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "! AVISO: Ollama não detectado ou não está no PATH." -ForegroundColor Yellow
        Write-Host "O Gateway tentará usar provedores remotos se configurados." -ForegroundColor Gray
    } elseif ($ollamaList -notmatch [regex]::Escape($currentModel)) {
        Write-Host "`n! AVISO: Modelo $currentModel não encontrado no Ollama." -ForegroundColor Yellow
        Write-Host "Tentando baixar modelo $currentModel..." -ForegroundColor Gray
        ollama pull $currentModel
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Aguardando inicialização manual ou uso de API remota..." -ForegroundColor Cyan
        } else {
            Write-Host "[OK] Modelo baixado com sucesso!" -ForegroundColor Green
        }
    } else {
        Write-Host "[OK] Modelo $currentModel detectado localmente!" -ForegroundColor Green
    }
}


# 1. Verifica e limpa a porta 18789 se já estiver ocupada
Write-Host "-> Verificando se a porta 18789 já está em uso..." -ForegroundColor Yellow
$occupied = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue

if ($occupied) {
    Write-Host "`n! AVISO: A porta 18789 já está ocupada. Encerrando processos antigos..." -ForegroundColor Yellow

    # Obter PIDs dos processos na porta 18789
    $processes = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    foreach ($procId in $processes) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "Processo $procId encerrado com sucesso." -ForegroundColor Gray
        } catch {
            Write-Host "Falha ao encerrar processo $procId - pode estar em uso pelo sistema." -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

# 2. Inicia o Gateway em uma nova janela
Write-Host "-> Configurando modelo padrão para $currentModel..." -ForegroundColor Yellow
npx openclaw models set "$currentModel"

Write-Host "-> Iniciando o Gateway através da configuração estável..." -ForegroundColor Yellow

# Comando com melhor logging: captura erros do Python e redirecionamentos
$gatewayCommand = @"
`$ErrorActionPreference = 'Continue'
`$envToken = if (`$env:NEXT_PUBLIC_GATEWAY_TOKEN) { `$env:NEXT_PUBLIC_GATEWAY_TOKEN } else { "claw3d_token" }
npx openclaw gateway --port 18789 --token "`$envToken" 2>&1 | Tee-Object -FilePath gateway-ps.log
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $gatewayCommand
Write-Host "OK: Gateway iniciado em nova janela com logging ativado." -ForegroundColor Green

Write-Host "Atenção: Mantenha a nova janela do PowerShell aberta para os agentes de IA funcionarem." -ForegroundColor White
Write-Host "Aguardando o startup do serviço e warmup do cérebro..." -ForegroundColor Gray

# Loop de espera por conexão
$maxRetries = 20
$retryCount = 0
$operational = $false

while ($retryCount -lt $maxRetries) {
    $retryCount++
    Write-Host "Aguardando Gateway (Tentativa $retryCount/$maxRetries)..." -ForegroundColor Gray
    if (Test-NetConnection -ComputerName 127.0.0.1 -Port 18789 -InformationLevel Quiet) {
        $operational = $true
        break
    }
    Start-Sleep -s 2
}

if ($operational) {
    Write-Host "`n[SUCESSO] O Gateway está OPERACIONAL e pronto para receber conexões!" -ForegroundColor Green
} else {
    Write-Host "`n[AVISO] Não foi possível confirmar a conexão na porta 18789." -ForegroundColor Yellow
    Write-Host "Confira o arquivo gateway-debug.log para ver o erro retornado." -ForegroundColor Cyan
}

# 4. Auto-aprovação do dispositivo local (com retentativas)
Write-Host "`n-> Solicitando auto-aprovação do dispositivo..." -ForegroundColor Yellow
$success = $false
# Tentamos aprovar 3 vezes aguardando o gateway ficar 'ready'
for ($i=1; $i -le 3; $i++) {
    Write-Host "Tentativa de aprovação $i de 3..." -ForegroundColor Gray
    
    # Captura o output para verificar se o erro é apenas 'sem dispositivos pendentes'
    $envToken = if ($env:NEXT_PUBLIC_GATEWAY_TOKEN) { $env:NEXT_PUBLIC_GATEWAY_TOKEN } else { "claw3d_token" }
    $approveOutput = npx openclaw devices approve --latest --token "$envToken" 2>&1 | Out-String
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
