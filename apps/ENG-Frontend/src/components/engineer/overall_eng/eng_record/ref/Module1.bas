Attribute VB_Name = "Module1"
Sub Finished()
Dim RowNumberValue As Integer, columnNumberValue As Integer, i As Integer, j As Integer
Dim sName As String, sFirst As String
Dim receive_date As Date, mrp_date As Date, finish_date As Date
RowNumberValue = ActiveCell.Row


    sName = Application.UserName
    sFirst = Left(sName, InStr(1, sName, " ", vbTextCompare) - 1)
    Cells(RowNumberValue, 13).Value = sFirst
    Cells(RowNumberValue, 14).Value = Date
For j = 1 To 21
     Cells(RowNumberValue, j).Interior.Color = RGB(191, 191, 191)
Next j

If Cells(RowNumberValue, 9).Value = "Request Drawing" Then
    receive_date = Cells(RowNumberValue, 2).Value
    mrp_date = Cells(RowNumberValue, 18).Value
    finish_date = Cells(RowNumberValue, 14).Value
    If mrp_date < receive_date Then
        Cells(RowNumberValue, 19).Value = "ALRD PASS DUE"
    ElseIf finish_date <= mrp_date Then
        Cells(RowNumberValue, 19).Value = "ON DUE"
    Else
        Cells(RowNumberValue, 19).Value = "PASS DUE"
    End If
    'MsgBox "Please Input Rev. on the Stock File"
ElseIf Left(Cells(RowNumberValue, 12).Value, 4) = "RE41" Then
    ActiveSheet.Range("$A$1:$V$5000").AutoFilter Field:=12
    Range("B2").End(xlDown).Select
ElseIf Cells(RowNumberValue, 10).Value = "Add 0421 Drill hole process" Then
    ActiveSheet.Range("$A$1:$V$5000").AutoFilter Field:=10
    ActiveSheet.Range("$A$1:$V$5000").AutoFilter Field:=6
    Range("B2").End(xlDown).Select
'ElseIf Cells(RowNumberValue, 9).Value = "Judgment Spec" Then
    'receive_date = Cells(RowNumberValue, 2).Value
    'finish_date = Cells(RowNumberValue, 14).Value
    'If finish_date <= receive_date Then
        'Cells(RowNumberValue, 19).Value = "You are so fast!!"
    'ElseIf finish_date > receive_date Then
        'Cells(RowNumberValue, 19).Value = "Too sad :("
    'End If
    
End If

If Cells(RowNumberValue, 9).Value = "Judgment Spec" Then
    receive_date = Cells(RowNumberValue, 2).Value
    finish_date = Cells(RowNumberValue, 14).Value
    If finish_date > receive_date + 1 Then
        Cells(RowNumberValue, 19).Value = "Too sad :("
    Else
        Cells(RowNumberValue, 19).Value = "You're so fast! :D"
    End If
End If
   
    
End Sub


