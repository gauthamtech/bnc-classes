# =====================================================================
#  BNC — compress lesson videos to 720p before uploading
#
#  Lives in D:\BNC App. Drop raw recordings into  raw-videos\  then run:
#      .\compress-videos.ps1
#  Finished files land in  ready-to-upload\
#
#  Uses the RTX 5070's hardware encoder, so this runs many times
#  faster than real time. A one hour lesson takes a couple of minutes.
#
#  Why 720p: a whiteboard is almost still, so it compresses very well.
#  The result is sharp on a phone, about a quarter of the storage cost,
#  and a quarter of the mobile data your students pay for.
# =====================================================================

$ErrorActionPreference = "Stop"

$IN  = Join-Path $PSScriptRoot "raw-videos"
$OUT = Join-Path $PSScriptRoot "ready-to-upload"

New-Item -ItemType Directory -Force -Path $IN, $OUT | Out-Null

$files = Get-ChildItem -Path $IN -File | Where-Object { $_.Extension -match '\.(mp4|mov|mkv|avi|m4v|wmv|flv|webm)$' }

if ($files.Count -eq 0) {
    Write-Output ""
    Write-Output "Nothing to do."
    Write-Output "Put the recordings in:  $IN"
    Write-Output "then run this script again."
    exit
}

Write-Output ""
Write-Output "Found $($files.Count) file(s) to compress."
Write-Output ""

$totalBefore = 0
$totalAfter  = 0
$done = 0
$failed = @()

foreach ($f in $files) {
    $target = Join-Path $OUT ($f.BaseName + ".mp4")

    if (Test-Path $target) {
        Write-Output "  skip (already done)  $($f.Name)"
        continue
    }

    $sizeBefore = $f.Length
    Write-Output "  compressing          $($f.Name)  ($([math]::Round($sizeBefore/1MB)) MB)"

    # h264_nvenc  : the graphics card does the work
    # cq 26       : quality target. Lower = better and bigger. 23-28 is sane.
    # maxrate 3M  : keeps board writing crisp without bloating the file
    # -vf scale   : 720p high, width auto, never upscale a smaller source
    # aac 128k    : speech does not need more
    # +faststart  : lets the video start playing before it fully downloads
    $args = @(
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", $f.FullName,
        "-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", "26",
        "-maxrate", "3M", "-bufsize", "6M",
        "-vf", "scale=-2:'min(720,ih)'",
        "-c:a", "aac", "-b:a", "128k", "-ac", "2",
        "-movflags", "+faststart",
        $target
    )

    & ffmpeg @args

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target)) {
        Write-Output "     FAILED - trying without the graphics card"
        $args[6] = "libx264"          # swap encoder
        $args[8] = "medium"           # preset name differs on cpu
        & ffmpeg @args
    }

    if (Test-Path $target) {
        $sizeAfter = (Get-Item $target).Length
        $totalBefore += $sizeBefore
        $totalAfter  += $sizeAfter
        $done++
        $pct = [math]::Round(100 - ($sizeAfter / $sizeBefore * 100))
        Write-Output "     done                 $([math]::Round($sizeAfter/1MB)) MB   ($pct% smaller)"
    } else {
        $failed += $f.Name
        Write-Output "     COULD NOT CONVERT"
    }
}

Write-Output ""
Write-Output "======================================================"
Write-Output " Compressed : $done file(s)"
if ($totalBefore -gt 0) {
    Write-Output " Before     : $([math]::Round($totalBefore/1GB, 2)) GB"
    Write-Output " After      : $([math]::Round($totalAfter/1GB, 2)) GB"
    Write-Output " Saved      : $([math]::Round(100 - ($totalAfter/$totalBefore*100)))%"
}
if ($failed.Count -gt 0) {
    Write-Output ""
    Write-Output " Failed:"
    $failed | ForEach-Object { Write-Output "   $_" }
}
Write-Output "======================================================"
Write-Output ""
Write-Output " Ready to upload from:  $OUT"
Write-Output ""
