# --- OpenClaw Gateway Automator ---
# Este script automatiza o processo de verificação e inicialização do Gateway localmente.

Write-Host "`n--- OpenClaw Gateway Automator ---" -ForegroundColor Cyan
Write-Host "Etapa 1: Verificando a instalação local do OpenClaw via npx..." -ForegroundColor Yellow

# Executa o help para validar se o binário local está acessível
npx openclaw --help

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nErro: O comando 'npx openclaw' falhou. Certifique-se de que os pacotes estão instalados (npm install)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nEtapa 2: Ação Manual Necessária" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------" -ForegroundColor White
Write-Host "Por favor, edite manualmente o arquivo de configuração abaixo:" -ForegroundColor Green
Write-Host "CAMINHO: C:\Users\Kaue_Martins\.openclaw\openclaw.json" -ForegroundColor Yellow
Write-Host "AÇÃO: Localize 'ollama.default.mode' e altere o valor para 'api_key'" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor White

# Aguarda a confirmação do usuário
Read-Host "`nApós salvar as alterações no arquivo JSON, pressione ENTER para iniciar o Gateway..."

Write-Host "`nEtapa 3: Iniciando o OpenClaw Gateway na porta 18789 em um novo terminal..." -ForegroundColor Cyan

# Inicia o gateway em uma nova janela de terminal para monitoramento
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx openclaw gateway --port 18789"

Write-Host "`nComando de inicialização enviado. Verifique a nova janela aberta para logs do Gateway." -ForegroundColor Green
Write-Host "A UI 3D (porta 3000) agora deve conseguir se conectar." -ForegroundColor Green
