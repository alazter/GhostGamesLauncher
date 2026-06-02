# PowerShell Backup Script for Heroic Games Launcher
# Date format: DD-MM-YYYY
# Mode: Maximum Security (Local Snapshot + Git WIP Branch Push)

$sourceDir = "C:\Users\alazt\Documents\GitHub\Projetos\HeroicGamesLauncher"
$backupBaseDir = "C:\Users\alazt\Documents\GitHub\Backup"
$currentDate = Get-Date -Format "dd-MM-yyyy"
$backupName = "Heroic_launcher_$currentDate"
$targetDir = Join-Path $backupBaseDir $backupName
$gitBranchName = "heroic_launcher_WIP/$currentDate"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "INICIANDO BACKUP DE SEGURANÇA MÁXIMA" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# ----------------- PARTE 1: BACKUP LOCAL -----------------
Write-Host "`n[1/2] Criando Snapshot Local..." -ForegroundColor Yellow
if (-not (Test-Path $sourceDir)) {
    Write-Error "Diretório de origem não encontrado!"
    exit 1
}

if (-not (Test-Path $backupBaseDir)) {
    New-Item -ItemType Directory -Force -Path $backupBaseDir | Out-Null
}

if (Test-Path $targetDir) {
    Write-Host "O backup local '$backupName' já existe. Sobrescrevendo..." -ForegroundColor Gray
    Remove-Item -Recurse -Force $targetDir
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$excludeList = @("node_modules", "build", ".eslintcache", ".git")
Get-ChildItem -Path $sourceDir -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring($sourceDir.Length + 1)
    
    $shouldExclude = $false
    foreach ($exclude in $excludeList) {
        if ($relativePath -eq $exclude -or $relativePath.StartsWith("$exclude\")) {
            $shouldExclude = $true
            break
        }
    }
    
    if (-not $shouldExclude) {
        $targetPath = Join-Path $targetDir $relativePath
        if ($_.PSIsContainer) {
            if (-not (Test-Path $targetPath)) {
                New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
            }
        } else {
            $parentDir = Split-Path $targetPath -Parent
            if (-not (Test-Path $parentDir)) {
                New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
            }
            Copy-Item -Path $_.FullName -Destination $targetPath -Force
        }
    }
}
Write-Host "Snapshot local salvo com sucesso em: $targetDir" -ForegroundColor Green

# ----------------- PARTE 2: BACKUP NO GIT -----------------
Write-Host "`n[2/2] Realizando Backup no Git (Nuvem)..." -ForegroundColor Yellow

# Salvar a branch ativa atual
Set-Location -Path $sourceDir
$originalBranch = (git branch --show-current).Trim()
Write-Host "Branch de trabalho atual: $originalBranch" -ForegroundColor Gray

# Verificar se existem alterações pendentes
$gitStatus = (git status --porcelain)
if ($null -ne $gitStatus -and $gitStatus.Length -gt 0) {
    Write-Host "Alterações locais detectadas. Criando branch de WIP e realizando commit..." -ForegroundColor Gray
    
    # Criar ou fazer checkout da branch WIP
    git checkout -b $gitBranchName 2>$null
    if ($LASTEXITCODE -ne 0) {
         # Se a branch já existir, apenas faz o checkout
         git checkout $gitBranchName
    }
    
    # Adicionar e commitar
    git add .
    git commit -m "wip: backup automático de fim de expediente ($currentDate)"
    
    # Push para a origem remota
    Write-Host "Enviando branch '$gitBranchName' para o GitHub..." -ForegroundColor Gray
    git push -u origin $gitBranchName --force
    
    # Retornar para a branch original
    Write-Host "Retornando para a sua branch de trabalho original: $originalBranch" -ForegroundColor Gray
    git checkout $originalBranch
} else {
    Write-Host "Nenhuma alteração pendente detectada no repositório local do Git. Backup na nuvem ignorado ou já atualizado." -ForegroundColor Green
}

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host "PROCESSO DE SEGURANÇA MÁXIMA CONCLUÍDO!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
