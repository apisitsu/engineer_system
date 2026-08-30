<#
  dump_tooling_calc_blocks.ps1  (Phase A of the formula-vs-workbook check)
  ------------------------------------------------------------------------
  For every Tooling-Select `rule`-state family, open its per-machine tooling-list
  workbook (named in 20260202_Tooling_Excel_List.xlsm col A) via Excel COM and
  extract, into api/engineer/mtc/doc/tooling_calc_blocks/<family>/:

    <sheet>.tsv   UsedRange cell text            (EVERY sheet - cheap)
    <sheet>.pdf   fit-to-width PDF of the sheet  (ONLY sheets that carry a
                  pasted-picture formula, or whose name matches a tooling /
                  設計|標準|加工対象|DIMENSION|計算式)
    source.xlsx   an .xlsx copy of the workbook  (vendored off G:)
  plus api/engineer/mtc/doc/tooling_calc_blocks/manifest.json.

  The calc block is frequently a PASTED IMAGE, not cell text - that is why this
  goes through Excel and exports PDFs rather than just reading cells with SheetJS.

  Excel must be installed and this must run in an interactive login session with
  the G: Drive-for-Desktop mount visible (service accounts cannot see it). This
  is a one-off analysis artifact, not a runtime dependency.

  USAGE (from apps/ENG-Backend/):
    powershell -NoProfile -File scripts/dump_tooling_calc_blocks.ps1 `
      -FamiliesJson <path to calcblock_rule_families.json> `
      [-GRoot "G:\Shared drives\RD Development Technology Review Request\Tooling Select\DesignStandards_Dimensions_InventoryData"] `
      [-OutDir <repo>\apps\ENG-Backend\api\engineer\mtc\doc\tooling_calc_blocks]
#>
param(
  [Parameter(Mandatory = $true)] [string] $FamiliesJson,
  [string] $GRoot = "G:\Shared drives\RD Development Technology Review Request\Tooling Select\DesignStandards_Dimensions_InventoryData",
  [string] $OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "api\engineer\mtc\doc\tooling_calc_blocks")
)

$ErrorActionPreference = "Stop"
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# PS 5.1 Get-Content defaults to ANSI; the JSON is UTF-8 (no BOM) and full of CJK
# filenames, so read the bytes and decode UTF-8 explicitly or every 図番/machine name mojibakes.
$families = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($FamiliesJson)) | ConvertFrom-Json
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "[calcblocks] $($families.Count) rule families -> $OutDir"

# msoShapeType: 13 = Picture, 11 = OLEControlObject, 7 = EmbeddedOLEObject, 1 = AutoShape
$PICTURE_TYPES = @(13, 11, 7)
$SHEET_HINT = '設計|標準|加工対象|加工情報|DIMENSION|計算|CALC|寸法記入'

function Safe([string]$s) {
  if (-not $s) { return "_" }
  ($s -replace '[^\w\.\-]', '_')
}

# Resolve the workbook file from the index's bare name (which may carry no extension).
function Resolve-Workbook([string]$name) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
  $cands = Get-ChildItem -LiteralPath $GRoot -Recurse -File -Include *.xls, *.xlsx, *.xlsm -ErrorAction SilentlyContinue |
    Where-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq $base }
  if (-not $cands) {
    # looser: contains
    $cands = Get-ChildItem -LiteralPath $GRoot -Recurse -File -Include *.xls, *.xlsx, *.xlsm -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "*$base*" }
  }
  if ($cands) { return ($cands | Sort-Object Length -Descending | Select-Object -First 1).FullName }
  return $null
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

$manifest = @()
$doneByPath = @{}   # resolved path -> family folder already produced

try {
  foreach ($f in $families) {
    $fam = $f.family
    $famDir = Join-Path $OutDir $fam
    Write-Host "`n[calcblocks] $fam  ($($f.machine))  <- $($f.workbook)"

    $wbPath = Resolve-Workbook $f.workbook
    if (-not $wbPath) {
      Write-Host "  !! workbook not found under G: - name it by hand"
      $manifest += [ordered]@{ family = $fam; machine = $f.machine; workbookName = $f.workbook; resolved = $null; sheets = @() }
      continue
    }
    Write-Host "  found: $wbPath"

    if ($doneByPath.ContainsKey($wbPath)) {
      $src = $doneByPath[$wbPath]
      Copy-Item -Recurse -Force -LiteralPath $src -Destination $famDir
      Write-Host "  (shared workbook - copied from $([System.IO.Path]::GetFileName($src)))"
      $manifest += [ordered]@{ family = $fam; machine = $f.machine; workbookName = $f.workbook; resolved = $wbPath; sharedWith = [System.IO.Path]::GetFileName($src); sheets = @() }
      continue
    }

    New-Item -ItemType Directory -Force -Path $famDir | Out-Null
    $wb = $excel.Workbooks.Open($wbPath, 0, $true)   # UpdateLinks=0, ReadOnly=$true
    $sheetInfo = @()
    try {
      foreach ($ws in $wb.Worksheets) {
        $sName = [string]$ws.Name
        $safe = Safe $sName
        $ur = $ws.UsedRange
        $rows = [int]$ur.Rows.Count
        $cols = [int]$ur.Columns.Count

        # ---- TSV dump (every sheet) ----
        $tsvPath = Join-Path $famDir "$safe.tsv"
        $sb = New-Object System.Text.StringBuilder
        if ($rows -gt 0 -and $cols -gt 0 -and $rows -le 20000) {
          $vals = $ur.Value2
          if ($rows -eq 1 -and $cols -eq 1) {
            [void]$sb.AppendLine([string]$vals)
          } else {
            for ($r = 1; $r -le $rows; $r++) {
              $line = for ($c = 1; $c -le $cols; $c++) { ([string]$vals.GetValue($r, $c)) -replace "[`t`r`n]", ' ' }
              [void]$sb.AppendLine(($line -join "`t"))
            }
          }
        }
        [System.IO.File]::WriteAllText($tsvPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

        # ---- picture-shape detection ----
        $pics = @()
        foreach ($sh in $ws.Shapes) {
          if ($PICTURE_TYPES -contains [int]$sh.Type) {
            $pics += [ordered]@{ name = [string]$sh.Name; type = [int]$sh.Type;
              cell = ("R{0}C{1}" -f [int]$sh.TopLeftCell.Row, [int]$sh.TopLeftCell.Column) }
          }
        }

        $nameHitsTool = $false
        foreach ($t in $f.formulaToolings) {
          if ($t -and ($sName -like "*$t*" -or $t -like "*$sName*")) { $nameHitsTool = $true }
        }
        $nameHint = ($sName -match $SHEET_HINT)
        $wantPdf = ($pics.Count -gt 0) -or $nameHitsTool -or $nameHint

        $pdfPath = $null
        if ($wantPdf -and $rows -gt 0) {
          $pdfPath = Join-Path $famDir "$safe.pdf"
          try {
            $ps = $ws.PageSetup
            $ps.Zoom = $false
            $ps.FitToPagesWide = 1
            $ps.FitToPagesTall = $false
            $ps.Orientation = 2   # landscape
            $ws.ExportAsFixedFormat(0, $pdfPath)   # xlTypePDF
          } catch {
            Write-Host "    pdf export failed on '$sName': $($_.Exception.Message)"
            $pdfPath = "FAILED"
          }
        }

        $sheetInfo += [ordered]@{
          sheet = $sName; rows = $rows; cols = $cols;
          shapeCount = [int]$ws.Shapes.Count; pictureShapes = $pics;
          pdf = if ($pdfPath -eq "FAILED") { $null } elseif ($pdfPath) { [System.IO.Path]::GetFileName($pdfPath) } else { $null };
          pdfReason = if (-not $wantPdf) { $null } elseif ($pics.Count) { "picture" } elseif ($nameHitsTool) { "tooling-name" } else { "name-hint" };
          tsv = "$safe.tsv"
        }
        $picNote = if ($pics.Count) { "  [$($pics.Count) PIC]" } else { "" }
        $pdfNote = if ($pdfPath -and $pdfPath -ne "FAILED") { " -> pdf" } else { "" }
        Write-Host ("    {0,-28} {1,4}x{2,-3} shapes={3}{4}{5}" -f $sName, $rows, $cols, [int]$ws.Shapes.Count, $picNote, $pdfNote)
      }

      # ---- .xlsx copy ----
      try {
        $xlsxCopy = Join-Path $famDir "source.xlsx"
        $wb.SaveAs($xlsxCopy, 51)   # xlOpenXMLWorkbook
      } catch { Write-Host "    (xlsx copy failed: $($_.Exception.Message))" }
    }
    finally { $wb.Close($false) }

    $doneByPath[$wbPath] = $famDir
    $manifest += [ordered]@{ family = $fam; machine = $f.machine; machineLabel = $f.machineLabel;
      detail = $f.detail; process = $f.process; workbookName = $f.workbook; resolved = $wbPath;
      formulaToolings = $f.formulaToolings; sheets = $sheetInfo }
  }
}
finally {
  $excel.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()
}

$manifestPath = Join-Path $OutDir "manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "`n[calcblocks] manifest -> $manifestPath"
Write-Host "[calcblocks] done. Next: read each <family>/*.pdf and transcribe the calc block into api/engineer/mtc/doc/tooling_calc_blocks/<family>.md"
