"""Read the RECORD(comp) / RECORD(assy) sheets of the "NEW MODEL (Detail-…)" workbooks into JSON.

    python -I parse_new_model_workbook.py <workbook.xlsx> <sheet> <out.json>

Each sheet is a grid of "RECORD FOR NEW MODEL / ITEM" forms — up to four side by side (title cells
in columns B, R, AH, AX) repeated down ~13,000 rows. Every form is located by its title cell and
read at fixed offsets from it (the same geometry as `form(RECORD)`). Only raw cell values are
extracted; merging, normalising and the database write are in import_record_forms.js.
The sheets are 16–19 MB of XML, so this needs read_only mode and takes about a minute.
"""
import openpyxl,sys,json,re,datetime
f,sheet,out=sys.argv[1:4]
wb=openpyxl.load_workbook(f,read_only=True,data_only=True)
rows={}
for i,r in enumerate(wb[sheet].iter_rows(values_only=True),1):
    if any(v not in (None,'') for v in r): rows[i]=list(r)
TITLE='RECORD FOR NEW MODEL / ITEM'
def g(r,c):
    row=rows.get(r)
    return row[c] if row and c<len(row) else None
def s(v):
    if v is None: return None
    if isinstance(v,float) and v.is_integer(): v=int(v)
    if isinstance(v,(datetime.datetime,datetime.date)): return v.strftime('%Y-%m-%d')
    v=str(v).strip(); return v or None
forms=[]
for r0,row in sorted(rows.items()):
    for c,v in enumerate(row):
        if isinstance(v,str) and v.strip()==TITLE:
            steps=[]
            # data rows: NO. at col c, process at c+1, remark at c+7; header row is r0+6
            r=r0+7
            while True:
                no=g(r,c); 
                if not isinstance(no,(int,float)) or int(no)!=len(steps)+1: break
                p=s(g(r,c+1)); rem=s(g(r,c+7))
                if p or rem: steps.append({'no':int(no),'text':p,'remark':rem})
                else: steps.append({'no':int(no),'text':None,'remark':None})
                r+=1
            while steps and not steps[-1]['text'] and not steps[-1]['remark']: steps.pop()
            forms.append({
              'row':r0,'col':c,'lot_no':s(g(r0+2,c+1)),'control_no':s(g(r0+2,c+4)),'parts_no':s(g(r0+2,c+6)),
              'drawing_rev':s(g(r0+2,c+9)),'process_code':s(g(r0+3,c+2)),'established_date':s(g(r0+3,c+7)),
              'record_rev':s(g(r0+3,c+10)),'revised_date':s(g(r0+3,c+12)),'ref_pn':s(g(r0+4,c+1)),
              'customer_pn':s(g(r0+1,c+13)),'final_decided':s(g(r0+1,c+14)),'engineer_stamp':s(g(r0+1,c+15)),
              'steps':steps})
json.dump(forms,open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=0)
used=[x for x in forms if x['lot_no'] or x['control_no']]
print(sheet,'titles',len(forms),'with lot/cn',len(used))
