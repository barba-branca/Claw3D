# Fluxo Diário de Desenvolvimento (Claw3D)

Siga estes passos para iniciar o ambiente do escritório 3D com agentes de IA.

## 1. Iniciar o Gateway (Backend de IA)
Abra um terminal na raiz do projeto e execute o script de automação:
```powershell
.\start-gateway.ps1
```
*   **Atenção:** Mantenha a nova janela do PowerShell que abrirá sempre em execução. Ela é o "cérebro" da aplicação.

## 2. Iniciar a UI (Frontend Next.js)
Em outro terminal (livre), inicie o servidor de desenvolvimento:
```powershell
npm run dev
```

## 3. Acessar o Escritório
Abra seu navegador em: [http://localhost:3000](http://localhost:3000)

---
*Configurações automáticas aplicadas em `C:\Users\Kaue_Martins\.openclaw\openclaw.json` (mode: api_key).*
