"""Independent closed-form checks of cohort outputs; no simulation imports."""
import csv, json, math
from decimal import Decimal as D
from pathlib import Path
P=Path(__file__).resolve().parent
queue_rows=list(csv.DictReader((P/'cohort-capacity.csv').open(newline='',encoding='utf-8')))
assert len(queue_rows)==144
for row in queue_rows:
 n=int(row['posts']);t=int(row['tranches_due']);w=int(row['usable_window_minutes']);s=int(row['spacing_seconds']);b=int(row['global_look_budget'])
 def prefix_looks(k):
  q,r=divmod(k,t)
  return t*(q*n-q*(q-1)//2)+r*(n-q)
 # A partial final source sweep still releases its first ready policy. Therefore
 # the last release needs at least one remaining look, not a whole final sweep.
 limit=min(n*t,math.ceil(w*60/s))
 feasible=[k for k in range(1,limit+1) if prefix_looks(k-1)<b]
 k=max(feasible,default=0)
 assert int(row['synthetic_submissions'])==k,row
 assert int(row['synthetic_data_looks'])==min(b,prefix_looks(k)),row
 assert int(row['synthetic_fully_processed_posts'])==k//t
 assert int(row['remaining_policies'])==n*t-k
 assert int(row['looks_to_finish_unlimited_window_budget'])==t*n*(n+1)//2
 assert D(row['synthetic_max_test_ausd'])==D(min(b,prefix_looks(k)))/100
 assert D(row['normal_no_error_cooldown_only_lower_bound_minutes'])==D((n*t-1)*45)/60
support=list(csv.DictReader((P/'support-sensitivity.csv').open(newline='',encoding='utf-8')))
assert len(support)==96
for row in support:
 m=int(row['labor_minutes_per_job']);n=int(row['jobs_month']);share=D(row['platform_share'])
 gross=D(15) if row['price_model'].startswith('9EUR') else D('19.9')
 # Independently calculate the whole month, then compare per-job output.
 commission=gross*n*(share+D('.02'))
 invoice_fee=(D('.2') if row['price_model'].startswith('9EUR') else D('.02'))*n
 costs=D('1.95')*n+D(n*m)*35/60
 surplus=gross*n-commission-invoice_fee-costs-3000
 assert abs(surplus-D(row['operating_surplus_eur']))<D('1e-18')
 assert (n*m<=6000)==(row['within_100_service_hours']=='True')
 assert int(row['labor_capacity_jobs'])==6000//m
 if D(row['contribution_per_job_eur'])>0:
  assert int(row['break_even_jobs'])==math.ceil(D(3000)/D(row['contribution_per_job_eur']))
print(json.dumps({'cohort_rows_checked_by_closed_form':len(queue_rows),'monthly_support_rows_independently_recomputed':len(support),'result':'pass'},indent=2))
