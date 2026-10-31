"""Offline admission/queue and labor sensitivity. No network or application execution.
All queue latencies, demand, prices and EUR costs are illustrative assumptions.
The current source supports one selected release/cycle and45s post-confirmation
cooldown. It is NOT reproduced as a live service benchmark by this model.
"""
import csv
import json
import math
from decimal import Decimal as D
from pathlib import Path

P=Path(__file__).resolve().parent
inputs={
 'classification':'Synthetic cohort/admission and support sensitivity; no observed load, forecast or SLA',
 'checked_date':'2026-10-31',
 'application_base':'82d88dc63341e8498b4728e3bd2f3996aa560a5e',
 'main_observed':'1cb0272d9d31f74ee55cd307e52824c65d9432eb',
 'main_change':'TRUST.md refund-authorization wording only; relevant application source unchanged',
 'source_rules':{'one_selected_release':'cardano/src/autorelease.ts:270-276',
   'confirmation_wait_then_45s_cooldown':'cardano/src/autorelease.ts:299-301',
   'normal_loop_20s_sleep':'cardano/src/autorelease.ts:97,317-330',
   'paid_minimum_fetch_gap_60s':'cardano/src/autorelease.ts:226',
   'fresh_results_local_to_cycle':'cardano/src/autorelease.ts:203-206,228-250',
   'one_validator_input_per_release':'aiken/airnode_spike/validators/pay_on_proof.ak:38-49,77'},
 'cohort_posts':[1,10,25,100], 'tranches_due_together':[1,2,3],
 'usable_release_window_minutes':[10,60,180],
 'submission_spacing_seconds':[60,90],
 'spacing_meaning':{'60':'Idealized zero-latency20s ticks with45s cooldown:ceil(45/20)*20=60. This is a scenario, not a universal lower bound; real RPC work changes tick phase.',
   '90':'Illustrative30s confirmation plus60s tick/cooldown pacing. Not a measured production latency.'},
 'source_and_order_assumptions':['Every post has a distinct paid source; all conditions already hold at start.',
   'All due policies have the same deadline and stable source order; first source finishes its due tranches before next. Actual equal-deadline ordering not guaranteed.',
   'No static-source stop, outages, failed submissions, fresh-policy delay, stale proof or new arrivals.',
   'Each cycle checks every remaining due source once, then releases one policy. No persistent proof reuse is modeled.',
   'Spacing>=60s lets each paid source pass the minimum fetch gap. Real cycles can be slower.',
   'Window is usable time before keeper stop, which itself is3min before contractual deadline. First submission at t=0 is optimistic.',
   'Global budgets compare30 looks (0.3aUSD default magnitude) and60 looks per admitted post. Neither is an implemented per-tenant allocation.',
   'Token costs remain aUSD test magnitudes, not USD or EUR.'],
 'support_assumptions':{'service_hours_month':100,'fixed_overhead_eur':3000,'loaded_eur_hour':35,
   'nonlabor_eur_job':'1.95','success_probability':'.6','collection_percent':'.02',
   'masumi_share_options':['0','.05'],'labor_minutes_job':[5,10,15,30],
   'jobs_month':[50,100,200,350,400,600],
   'pricing':['9EUR+10EUR_success','199EUR_10posts_full_use'],
   'notes':'All-or-none three-tranche base case held fixed. Labor includes allocated onboarding+support; nonlabor includes expected release/data/retry/hosting/treasury. This is not jointly calibrated to queue outcomes.'}}
(P/'cohort-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n',encoding='utf-8')

def queue(n,tranches,window,spacing,budget):
    remaining=[tranches]*n
    submitted=0;looks=0;at=0
    while at<window*60 and remaining and looks<budget:
        paid_this_cycle=min(len(remaining),budget-looks)
        if paid_this_cycle==0:break
        looks+=paid_this_cycle
        # Synthetic stable ordering: one selected policy, despite several ready sources.
        remaining[0]-=1;submitted+=1
        if remaining[0]==0:remaining.pop(0)
        at+=spacing
    ideal_slots=math.ceil(window*60/spacing)
    total=n*tranches
    full_look_count=tranches*n*(n+1)//2
    return dict(posts=n,tranches_due=tranches,usable_window_minutes=window,
      spacing_seconds=spacing,global_look_budget=budget,required_submissions=total,
      time_only_submission_ceiling=ideal_slots,synthetic_submissions=submitted,
      synthetic_fully_processed_posts=n-len(remaining),synthetic_data_looks=looks,
      synthetic_max_test_ausd=D(looks)/100,
      remaining_policies=total-submitted,
      scenario_last_submission_minutes=D((total-1)*spacing)/60,
      normal_no_error_cooldown_only_lower_bound_minutes=D((total-1)*45)/60,
      looks_to_finish_unlimited_window_budget=full_look_count,
      optimistic_cached_one_look_per_post=n,
      outcome='all submitted' if submitted==total else 'budget binds' if looks==budget else 'window binds')

queues=[]
for n in inputs['cohort_posts']:
 for t in inputs['tranches_due_together']:
  for w in inputs['usable_release_window_minutes']:
   for spacing in inputs['submission_spacing_seconds']:
    for budget_name,budget in [('default_global_30looks',30),('60looks_per_post_pooled',60*n)]:
     row=queue(n,t,w,spacing,budget);row['budget_policy']=budget_name;queues.append(row)

support=[]
for minutes in [5,10,15,30]:
 for jobs in [50,100,200,350,400,600]:
  for share in [D(0),D('.05')]:
   for model in inputs['support_assumptions']['pricing']:
    gross=D(15) if model.startswith('9EUR') else D('19.9')
    fixed_collection=D('.2') if model.startswith('9EUR') else D('.02')
    net=gross*(1-D('.02')-share)-fixed_collection
    variable=D('1.95')+D(minutes)*35/60
    cm=net-variable
    hours=D(minutes)*jobs/60
    support.append(dict(labor_minutes_per_job=minutes,jobs_month=jobs,platform_share=share,
      price_model=model,service_revenue_per_job_eur=gross,net_per_job_eur=net,
      expected_variable_cost_per_job_eur=variable,contribution_per_job_eur=cm,
      required_service_hours=hours,within_100_service_hours=hours<=100,
      operating_surplus_eur=jobs*cm-3000,
      break_even_jobs=math.ceil(D(3000)/cm) if cm>0 else '',
      labor_capacity_jobs=6000//minutes))

def output(name,rows):
 with (P/name).open('w',newline='',encoding='utf-8') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
output('cohort-capacity.csv',queues)
output('support-sensitivity.csv',support)
assert len(queues)==144 and len(support)==96
print(json.dumps({'cohort_rows':len(queues),'support_rows':len(support),
 'examples':[q for q in queues if (q['posts'],q['tranches_due'],q['usable_window_minutes'],q['spacing_seconds'],q['budget_policy']) in [(10,3,60,90,'60looks_per_post_pooled'),(25,3,60,90,'60looks_per_post_pooled'),(100,3,180,60,'60looks_per_post_pooled'),(10,3,60,60,'default_global_30looks')]]},default=str,indent=2))

try:
 import matplotlib
 matplotlib.use('Agg')
 import matplotlib.pyplot as plt
except ImportError:pass
else:
 fig,ax=plt.subplots(figsize=(9,5),layout='constrained')
 xs=[5,10,15,30]
 for model,color,label in [('9EUR+10EUR_success','#0072B2','EUR9 + EUR10 on success'),('199EUR_10posts_full_use','#D55E00','EUR199 / 10 fully used posts')]:
  vals=[float(next(r['operating_surplus_eur'] for r in support if r['labor_minutes_per_job']==x and r['jobs_month']==350 and r['platform_share']==D('.05') and r['price_model']==model)) for x in xs]
  ax.plot(xs,vals,marker='o',linewidth=2.3,color=color,label=label)
  for x,y in zip(xs,vals):ax.annotate(f'{y:,.0f}',(x,y),xytext=(0,8),textcoords='offset points',ha='center',fontsize=9)
 ax.axvspan(6000/350,30,color='#777777',alpha=.12,label='Beyond assumed 100 service hours/month')
 ax.axhline(0,color='#444444',linewidth=1)
 ax.set(xlim=(4,31),xlabel='Onboarding and support minutes per accepted post',ylabel='Illustrative EUR monthly operating surplus',title='350 posts/month: labor time can erase the service margin')
 ax.legend(fontsize=9);ax.grid(axis='y',alpha=.2)
 fig.savefig(P/'support-capacity.png',dpi=170);plt.close(fig)
