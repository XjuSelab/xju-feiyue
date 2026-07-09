$ErrorActionPreference = 'Stop'

$repoGit = 'https://github.com/winbeau/claude-vps-skills.git'
$zipUrls = @(
  'https://github.com/winbeau/claude-vps-skills/archive/refs/heads/main.zip',
  'https://github.com/winbeau/claude-vps-skills/archive/refs/heads/master.zip'
)

$skillsRoot = Join-Path $HOME '.codex\skills'
$dest = Join-Path $skillsRoot 'xju-docx'
$tmpRoot = Join-Path $env:TEMP ('claude-vps-skills-' + [guid]::NewGuid().ToString('N'))

New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null
New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null

try {
  $repoDir = Join-Path $tmpRoot 'repo'
  $git = Get-Command git -ErrorAction SilentlyContinue

  if ($git) {
    Write-Output "使用 git clone 获取 skill 仓库..."
    git clone --depth 1 $repoGit $repoDir
    if ($LASTEXITCODE -ne 0) {
      throw "git clone 失败，退出码: $LASTEXITCODE"
    }
  } else {
    $downloaded = $false
    foreach ($zipUrl in $zipUrls) {
      try {
        Write-Output "未检测到 git，尝试下载 ZIP: $zipUrl"
        $zipPath = Join-Path $tmpRoot 'repo.zip'
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
        Expand-Archive -Path $zipPath -DestinationPath $tmpRoot -Force
        $repoDir = Get-ChildItem -Path $tmpRoot -Directory |
          Where-Object { $_.Name -like 'claude-vps-skills-*' } |
          Select-Object -First 1 -ExpandProperty FullName
        if ($repoDir) {
          $downloaded = $true
          break
        }
      } catch {
        Write-Output "ZIP 下载/解压失败: $($_.Exception.Message)"
      }
    }

    if (-not $downloaded) {
      throw '无法获取仓库：git 不可用且 ZIP 下载失败'
    }
  }

  $src = Get-ChildItem -Path $repoDir -Directory -Recurse -Filter 'xju-docx' |
    Select-Object -First 1

  if (-not $src) {
    throw '未在仓库中找到 xju-docx 目录'
  }

  if (Test-Path $dest) {
    Write-Output "目标目录已存在，先删除旧版本: $dest"
    Remove-Item -Recurse -Force $dest
  }

  Copy-Item -Recurse -Force $src.FullName $dest

  if (Test-Path $dest) {
    Write-Output "REGISTERED_OK: $dest"
    Write-Output "已安装内容预览:"
    Get-ChildItem -Force $dest | Select-Object -First 20 | ForEach-Object {
      Write-Output (" - " + $_.Name)
    }
  } else {
    throw "安装后未找到目标目录: $dest"
  }
}
finally {
  if (Test-Path $tmpRoot) {
    Remove-Item -Recurse -Force $tmpRoot -ErrorAction SilentlyContinue
  }
}