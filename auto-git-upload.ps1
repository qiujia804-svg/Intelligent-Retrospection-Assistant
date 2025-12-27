# Auto Git Upload Script
Write-Host "Starting auto Git upload..."
Set-Location D:\Smart-Retro-Assistant
git status
git add .
$msg = "Auto commit - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $msg
git push
if ($LASTEXITCODE -eq 0) {
  Write-Host "Upload successful!"
} else {
  Write-Host "Upload failed, please check network connection."
}
Write-Host "Done!"