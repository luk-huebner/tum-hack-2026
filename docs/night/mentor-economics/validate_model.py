import csv, json, re
from decimal import Decimal as D, ROUND_CEILING
from pathlib import Path

p=Path(__file__).resolve().parent
inp=json.loads((p/'model-inputs.json').read_text())
scenarios={s['name']:s for s in inp['scenarios']}
checked=0
for name in ['scenario-results.csv','success-sensitivity.csv']:
    for row in csv.DictReader((p/name).open(newline='',encoding='utf-8')):
        s=scenarios[row['scenario']]
        d=lambda x:D(str(x))
        q=d(row['success_probability']); share=d(row['platform_share'])
        # Independent Decimal recomputation; does not import the model or use its helpers.
        data=d(s['monitoring_looks']+s['setup_looks'])*d(s['assumed_eur_per_look'])
        release=(q*d(s['tranches'])+d(s['expected_extra_submitted_tx']))*d(s['assumed_eur_per_release'])
        labor=d(s['onboarding_minutes_per_job']+s['support_minutes_per_job'])*d(s['loaded_eur_per_hour'])/60
        total=data+release+labor+d(s['variable_hosting_eur'])+d(s['treasury_fx_eur'])
        if row['model']=='success_only':
            gross=q*29; fixed=q*d('.2')
        elif row['model']=='base_plus_success':
            gross=9+q*10; fixed=d('.2')
        else:
            gross=d('19.9'); fixed=d('.02')
        net=gross*(d('.98')-share)-fixed
        cm=net-total
        for key,val in [('expected_variable_cost_eur',total),('gross_service_revenue_eur',gross),('net_after_collection_eur',net),('contribution_eur',cm)]:
            assert abs(d(row[key])-val)<d('.00000001'),(name,row['scenario'],key,row[key],val)
        be=str(int((3000/cm).to_integral_value(rounding=ROUND_CEILING))) if cm>0 else ''
        assert row['jobs_to_cover_fixed_overhead']==be
        capacity=6000//(s['onboarding_minutes_per_job']+s['support_minutes_per_job'])
        assert int(row['labor_capacity_jobs_per_month'])==capacity
        assert abs(d(row['operating_surplus_at_capacity_eur'])-(capacity*cm-3000))<d('.00000001')
        checked+=1
assert checked==72
assert D('8.782')*350-3000==D('73.700')
assert D('8.782')*400-3000==D('512.800')
assert (89-49-10)*D(35)/60==D('17.5')
summary=json.loads((p/'model-summary.json').read_text())
for key,val in {
    'success_only_fee_floor_at_q_0_6_eur':(D('10.7')/D('.6')+D('.2'))/D('.98'),
    'flat_all_job_fee_floor_eur':D('10.9')/D('.98'),
    'hybrid_base_floor_with_10_success_eur':D('10.9')/D('.98')-6,
    'agency_monthly_floor_10_jobs_eur':D('107.2')/D('.98'),
    'success_only_q_floor_at_29':D('10.16')/(29*D('.98')-D('.2')-D('.9')),
    'hybrid_q_floor_at_9_plus_10':(D('10.16')-9*D('.98')+D('.2'))/(10*D('.98')-D('.9')),
    'flat_fee_floor_including_fixed_at_capacity_eur':D('18.4')/D('.98'),
}.items(): assert abs(D(str(summary[key]))-val)<D('.00000001'),key
for file in p.glob('*.json'): json.loads(file.read_text(encoding='utf-8'))
with (p/'requirements-ledger.csv').open(newline='',encoding='utf-8') as f:
    rows=list(csv.DictReader(f))
assert len(rows)==21
assert all(None not in x and all(v is not None for v in x.values()) for x in rows)
assert len({x['id'] for x in rows})==21
assert all(x['status'] in ['met','partial','unverified','absent','ambiguous'] for x in rows)
text=(p/'REPORT.md').read_text(encoding='utf-8')
missing=[]
for link in re.findall(r'\]\(([^)]+)\)',text):
    if link.startswith(('http:','https:','#')): continue
    if link=='VALIDATION.md' and not (p/link).exists(): continue # permits initial authoring check
    if not (p/link.split('#')[0]).resolve().exists(): missing.append(link)
assert not missing, missing
for forbidden in ['BEGIN ' + 'PRIVATE KEY','BEGIN OPENSSH ' + 'PRIVATE KEY','sk-' + 'proj-']:
    assert all(forbidden not in x.read_text(encoding='utf-8') for x in p.iterdir() if x.suffix in ['.md','.json','.csv','.py'])
print(json.dumps({'arithmetic_rows_independently_recomputed':checked,'summary_formulas_checked':7,'requirements':len(rows),'local_report_links_missing':missing,'json_parse':'pass','sensitive_marker_check':'no matches; not a secret audit'},indent=2))
