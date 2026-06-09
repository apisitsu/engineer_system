VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} UserForm2 
   Caption         =   "UserForm2"
   ClientHeight    =   6204
   ClientLeft      =   50
   ClientTop       =   400
   ClientWidth     =   5210
   OleObjectBlob   =   "UserForm2.frx":0000
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "UserForm2"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Dim sName As String, sFirst As String
Dim RowNumberValue As Integer, ColumNumberValue As Integer, CaseColumn As Integer
Private Sub CommandButton1_Click() 'case no drawing

RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide
'--------------------- SQL CONNECTION ------------------
    Dim adoCN As Object, adoRs As Object, output As String, sql As String
    Dim lot As String
    Dim i As Integer
    Dim strDir As String
    strMonth = Format(Date, "yyyy-mm")
    strDate = Format(Date, "yyyy.mm.dd")
   

    strDir = "\\sanlb01\MPA-DIV\08-Engineer\17. MRP engineer\" & strMonth & "\mrp_plan_start_date_list " & strDate & ".xls"
    '---Connecting to the Data Source---
    Set adoCN = CreateObject("ADODB.Connection")
    With adoCN
        .provider = "Microsoft.ACE.OLEDB.12.0"
        .connectionString = "Data Source=" & strDir & ";" & "Extended Properties=""Excel 12.0 Xml;HDR=YES"";"
        .Open
    End With
'--------------------- SQL query -----------------------
    Dim finishDate As Date
    Dim totalProcess As Integer
    lot = Cells(RowNumberValue, 5).Value
    sql = "SELECT * FROM [mrp_plan_start_date_list$A2:BF20000] WHERE [M/O] = '" & lot & "'"
    Set adoRs = adoCN.Execute(sql)
    If adoRs.EOF Then
        sql = "SELECT * FROM [mrp_plan_start_date_list$A2:BF20000] WHERE [M/O] = '" & lot & "01'"
        Set adoRs = adoCN.Execute(sql)
        If adoRs.EOF Then
            MsgBox ("Wrong Lot no. !!")
            adoRs.Close
            Set adoRs = Nothing
            Set adoCN = Nothing
            Exit Sub
        Else
        adoRs.movenext
        StartDate = IIf(IsNull(adoRs(28)), "", adoRs(28))
        End If
    Else
    adoRs.movenext
    StartDate = IIf(IsNull(adoRs(28)), "", adoRs(28))
    End If
Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "PC/MC"
Cells(RowNumberValue, CaseColumn).Value = "Request Drawing"
Cells(RowNumberValue, CaseColumn + 1).Value = "No drawing"
Cells(RowNumberValue, CaseColumn + 2).Value = "Please up Drawing To Innovator"
Cells(RowNumberValue, CaseColumn + 3).Value = "Innovator is no Drawing"
Cells(RowNumberValue, CaseColumn + 5).Value = "?"
On Error GoTo nodata
Cells(RowNumberValue, CaseColumn + 9).Value = Format(DateAdd("d", -3, CDate(StartDate)), "dd-mmm-yy")
If Cells(RowNumberValue, CaseColumn + 9).Value < Date Then
     Cells(RowNumberValue, 19).Value = "ALRD PASS DUE"
End If
Exit Sub
nodata:
Cells(RowNumberValue, CaseColumn + 9).Value = "NO DATA ON MRP"
End Sub

Private Sub CommandButton10_Click() 'revise inner 215
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide
Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "MFG"
Cells(RowNumberValue, CaseColumn).Value = "Special"
Cells(RowNumberValue, CaseColumn + 1).Value = "Production request separate process drawing"
Cells(RowNumberValue, CaseColumn + 2).Value = "Revise lot no. on ME10"
Call UserInfo
End Sub

Private Sub CommandButton11_Click() 'Accept keyway
Application.ScreenUpdating = False
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide

Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "MFG"
Cells(RowNumberValue, CaseColumn).Value = "Special"
'--------------------- SQL CONNECTION ------------------
   Dim adoCN As Object, adoRs As Object, output As String, sql As String
    Dim lot As String
    Dim i As Integer
    Dim strDir As String
    strDir = "\\sanlb01\MPA-DIV\08-Engineer\01.Engineer Program\Milling\Keyway R problem checking test.xlsm"
    '---Connecting to the Data Source---
    Set adoCN = CreateObject("ADODB.Connection")
    With adoCN
        .provider = "Microsoft.ACE.OLEDB.12.0"
        .connectionString = "Data Source=" & strDir & ";" & "Extended Properties=""Excel 12.0 Xml;HDR=YES"";"
        .Open
    End With
    '--------------------- SQL query -----------------------
    lot = Cells(RowNumberValue, 5).Value
    'MsgBox (lot)
    sql = "SELECT * FROM [Record$B2:Q3000] WHERE Lot = '" & lot & "'"
    'MsgBox (sql)
    Set adoRs = adoCN.Execute(sql)
    If adoRs.EOF Then
    MsgBox ("Wrong Lot no. !!")
    Exit Sub
    Else
    Cells(RowNumberValue, CaseColumn + 1).Value = "Production can't satisfy " + adoRs(3) _
                                                 + Chr(10) + "on keyway process"
                                               
    Cells(RowNumberValue, CaseColumn + 2).Value = "Special Accept " ' + adoRs(9)
    Cells(RowNumberValue, CaseColumn + 3).Value = "Area for inspection R = " + Format(CStr(adoRs(14)), "General Number") _
                                                                            + " " + "Actual spec = " + Format(CStr(adoRs(15)), "General number")
    
    Call UserInfo
    End If
        
    adoRs.Close
    Set adoRs = Nothing
    Set adoCN = Nothing

End Sub


Private Sub CommandButton2_Click() 'change aba
Application.ScreenUpdating = False
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide

Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "MFG"
Cells(RowNumberValue, CaseColumn).Value = "Request change DWG/Traveler"
'--------------------- SQL CONNECTION ------------------
   Dim adoCN As Object, adoRs As Object, output As String, sql As String
    Dim lot As String
    Dim i As Integer
    Dim strDir As String
    'strDir = "\\10.121.34.19\data_rod\08-Engineer\05. Analyze case\A.Request change ARBOR\ARBOR REQUEST.xlsb"
    strDir = "\\sanlb01\MPA-DIV\08-Engineer\05.Analyze case\A.Request change ARBOR\ARBOR REQUEST.xlsb"
    '---Connecting to the Data Source---
    Set adoCN = CreateObject("ADODB.Connection")
    With adoCN
        .provider = "Microsoft.ACE.OLEDB.12.0"
        .connectionString = "Data Source=" & strDir & ";" & "Extended Properties=""Excel 12.0 Xml;HDR=YES"";"
        .Open
    End With
    
'--------------------- SQL query -----------------------
    lot = Cells(RowNumberValue, 5).Value
    sql = "SELECT * FROM [Record$A2:N5000] WHERE Lot = '" & lot & "'"
    Set adoRs = adoCN.Execute(sql)
    If adoRs.EOF Then
    MsgBox ("Wrong Lot no. !!")
    Exit Sub
    Else
    Cells(RowNumberValue, CaseColumn + 1).Value = "Request change from " & adoRs(5) & " : " & adoRs(6) & " to " + Chr(10) & adoRs(8) & " : " & adoRs(9)
    Cells(RowNumberValue, CaseColumn + 2).Value = "Revise by hand"
    Cells(RowNumberValue, CaseColumn + 3).Value = "Production request with test result"
    Call UserInfo
    End If
    adoRs.Close
    Set adoRs = Nothing
    Set adoCN = Nothing


End Sub

Private Sub CommandButton3_Click() 'no cut off spec
Application.ScreenUpdating = False
RowNumberValue = ActiveCell.Row
CaseColumn = 9
    UserForm2.Hide
    Cells(RowNumberValue, 2).Value = Date
    Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
    Cells(RowNumberValue, 4).Value = "PC/MC"
    Cells(RowNumberValue, CaseColumn).Value = "DWG/Traveler Problem"
    Cells(RowNumberValue, CaseColumn + 1).Value = "No cut off spec"
    head_dia = InputBox("Give me head Dia of Body !!!")
    total_length = InputBox("Give me total Lenght !!!")
    If (CInt(head_dia) * 3) > total_length Then
    output_text = "Revise by hand on D1 L=" & CStr(total_length + 0.5)
    Else
    output_text = "Revise by hand on D1 L=" & CStr(total_length + 2)
    End If
    MsgBox output_text
    Cells(RowNumberValue, CaseColumn + 2).Value = output_text
    Cells(RowNumberValue, CaseColumn + 3).Value = "RM21101"
    Call UserInfo

End Sub

Private Sub CommandButton4_Click() 'hardness reject
Application.ScreenUpdating = False
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide

Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "QA"
Cells(RowNumberValue, CaseColumn).Value = "Judgment Spec"
'--------------------- SQL CONNECTION ------------------
   Dim adoCN As Object, adoRs As Object, output As String, sql As String
    Dim lot As String
    Dim i As Integer
    Dim strDir As String
    strDir = "\\sanlb01\MPA-DIV\07-Quality Assurance\QA Report\12. Inspection Result\3. Hardness Output Report\REJECT\REJECT HEAT TREATMENT.xlsm"
    '---Connecting to the Data Source---
    Set adoCN = CreateObject("ADODB.Connection")
    With adoCN
        .provider = "Microsoft.ACE.OLEDB.12.0"
        .connectionString = "Data Source=" & strDir & ";" & "Extended Properties=""Excel 12.0 Xml;HDR=YES"";"
        .Open
    End With
    '--------------------- SQL query -----------------------
    lot = Cells(RowNumberValue, 5).Value
    sql = "SELECT * FROM [REJECT$A2:N4000] WHERE Lot = '" & lot & "'"
    Set adoRs = adoCN.Execute(sql)
    If adoRs.EOF Then
    MsgBox ("Wrong Lot no. !!")
    Exit Sub
    Else
    Cells(RowNumberValue, CaseColumn + 1).Value = adoRs(5) + " : " + adoRs(8) _
                                                 + Chr(10) + "Act : " + adoRs(9) _
                                                 + Chr(10) + "Material : " + adoRs(13)
    Cells(RowNumberValue, CaseColumn + 3).Value = adoRs(6)
    ActiveSheet.Range("$A$1:$V$5000").AutoFilter Field:=12, Criteria1:=Left(Cells(RowNumberValue, CaseColumn + 3).Value, 7) & "*"
    End If
    'If CInt(Left(adoRs(8), 2)) > 50 Then
    'MsgBox "Ask KZW Engineer(Heya san)"
    'Else
    'MsgBox "Ask KZW Engineer If 1st time or Rev. changed"
    'End If
        
    adoRs.Close
    Set adoRs = Nothing
    Set adoCN = Nothing
End Sub

Private Sub CommandButton5_Click() 'leser marking
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide
Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "MFG"
Cells(RowNumberValue, CaseColumn).Value = "Request change DWG/Traveler"
Cells(RowNumberValue, CaseColumn + 1).Value = "Marking"
Cells(RowNumberValue, CaseColumn + 2).Value = "Revise by hand"
Cells(RowNumberValue, CaseColumn + 3).Value = "MFG need to change Electro marking to Laser marking"

Call UserInfo

End Sub

Private Sub CommandButton6_Click() 'milling problem
Application.ScreenUpdating = False
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide

Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "MFG"
Cells(RowNumberValue, CaseColumn).Value = "Request change DWG/Traveler"
'--------------------- SQL CONNECTION ------------------
   Dim adoCN As Object, adoRs As Object, output As String, sql As String
    Dim lot As String
    Dim i As Integer
    Dim strDir As String
    strDir = "\\sanlb01\MPA-DIV\08-Engineer\01.Engineer Program\Milling\Milling problem checking.xlsm"
    'MsgBox (strDir)
    '---Connecting to the Data Source---
    Set adoCN = CreateObject("ADODB.Connection")
    With adoCN
        .provider = "Microsoft.ACE.OLEDB.12.0"
        .connectionString = "Data Source=" & strDir & ";" & "Extended Properties=""Excel 12.0 Xml;HDR=YES"";"
        .Open
    End With
    '--------------------- SQL query -----------------------
    lot = Cells(RowNumberValue, 5).Value
    sql = "SELECT * FROM [RECORD$A2:J3000] WHERE Lot = '" & lot & "'"
    'MsgBox (sql)
    Set adoRs = adoCN.Execute(sql)
    'MsgBox (sql)
    If adoRs.EOF Then
    MsgBox ("Wrong Lot no. !!")
    Exit Sub
    Else
    Cells(RowNumberValue, CaseColumn + 1).Value = "Production can't satisfy " + adoRs(4) _
                                                 + Chr(10) + "on Milling process"
                                               
    Cells(RowNumberValue, CaseColumn + 2).Value = "Revise by hand to " + adoRs(9)
    Cells(RowNumberValue, CaseColumn + 3).Value = "Shoulder Thickness is " + Format(CStr(adoRs(7)), "General Number")
    Call UserInfo
    End If
        
    adoRs.Close
    Set adoRs = Nothing
    Set adoCN = Nothing

End Sub

Private Sub CommandButton7_Click() 'add drill hole
RowNumberValue = ActiveCell.Row
Item_no = Cells(RowNumberValue, 6).Value
CaseColumn = 9
UserForm2.Hide
Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "PC/MC"
Cells(RowNumberValue, CaseColumn).Value = "Request change DWG/Traveler"
Cells(RowNumberValue, CaseColumn + 1).Value = "Add 0421 Drill hole process"
Cells(RowNumberValue, CaseColumn + 2).Value = "Revise by hand"
Cells(RowNumberValue, CaseColumn + 3).Value = "No tube material available"
ActiveSheet.Range("$A$1:$V$5000").AutoFilter Field:=10, Criteria1:="Add 0421 Drill hole process" & "*"
ActiveSheet.Range("$A$1:$V$5000").AutoFilter Field:=6, Criteria1:=Item_no

End Sub

Private Sub CommandButton8_Click() 'remove drill hole
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide
Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "PC/MC"
Cells(RowNumberValue, CaseColumn).Value = "Request change DWG/Traveler"
Cells(RowNumberValue, CaseColumn + 1).Value = "Remove Drill hole process"
Cells(RowNumberValue, CaseColumn + 2).Value = "Revise by hand"
Cells(RowNumberValue, CaseColumn + 3).Value = "Tube material"

Call UserInfo

End Sub

Private Sub CommandButton9_Click() 'revise inner 205
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide
Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "MFG"
Cells(RowNumberValue, CaseColumn).Value = "Special"
Cells(RowNumberValue, CaseColumn + 1).Value = "Mat'l problem can't control total width by bolt M/C"
Cells(RowNumberValue, CaseColumn + 2).Value = "Revise dimension to 17.00(+0.05/-0.05)"
Cells(RowNumberValue, CaseColumn + 3).Value = "Bolt M/C chuck at neck area"
Call UserInfo
End Sub
Private Sub CommandButton12_Click() 'PART REJECT
Application.ScreenUpdating = False
RowNumberValue = ActiveCell.Row
CaseColumn = 9
UserForm2.Hide

Cells(RowNumberValue, 2).Value = Date
Cells(RowNumberValue, 3).Value = MonthName(Month(Date), True)
Cells(RowNumberValue, 4).Value = "QC"
Cells(RowNumberValue, CaseColumn).Value = "Judgment Spec"

End Sub
Sub UserInfo()
sName = Application.UserName
    sFirst = Left(sName, InStr(1, sName, " ", vbTextCompare) - 1)
    Cells(RowNumberValue, 13).Value = sFirst
    Cells(RowNumberValue, 14).Value = Date
For j = 1 To 21
     Cells(RowNumberValue, j).Interior.Color = RGB(191, 191, 191)
Next j
Application.ScreenUpdating = True
End Sub

