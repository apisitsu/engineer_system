Attribute VB_Name = "Module3"
Sub Mail()
Dim ws As Worksheet
Set ws = ThisWorkbook.Sheets("Detail")
ws.Range("A2").AutoFilter Field:=9, Criteria1:="Request Drawing"
ws.Range("A2").AutoFilter Field:=20, Criteria1:=""
ws.Range("A2").AutoFilter Field:=14, Criteria1:="?"
ws.Columns("H:N").EntireColumn.Hidden = True
ws.Columns("P:Q").EntireColumn.Hidden = True
End Sub

