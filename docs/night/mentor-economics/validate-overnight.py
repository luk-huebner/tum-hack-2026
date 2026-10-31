"""Independent offline checks of the new continuation outputs; no model imports."""
import csv, hashlib, json
from decimal import Decimal as D
from pathlib import Path

p=Path(__file__).resolve().parent
rows=list(csv.DictReader((p/'tranche-economics.csv').open(newline='',encoding='utf-8')))
inputs=json.loads((p/'tranche-inputs.json').read_text())
assert len(rows)==36
for row in rows:
    ps=list(map(D,inputs['distribution_values'][row['distribution']]))
    states=[]
    for k,prob in enumerate(ps):
        bonus=10*D(k)/3 if row['billing_definition']=='proportional' else D(10 if (k>0 if row['billing_definition']=='any_tranche' else k==3) else 0)
        invoice=9+bonus
        platform=invoice*D('.05') if row['channel']=='masumi_absorbed' else D(0)
        cost=D('10.16')+D(k)*D('.3')
        margin=invoice*(1-D('.02'))-D('.2')-platform-cost
        buyer_fee=invoice*D('.05') if row['channel']=='masumi_buyer_surcharge' else D(0)
        payout=D(500)*k/3
        refund_cost=(3-k)*D('.3')
        total_buyer=payout+refund_cost+D('.6')+invoice+buyer_fee
        states.append((prob,margin,invoice,cost,total_buyer))
    for key,column in [('service_contribution_eur',1),('service_revenue_eur',2),('service_variable_cost_eur',3),('expected_buyer_net_outflow_eur',4)]:
        expected=sum(v[0]*v[column] for v in states)
        assert abs(D(row[key])-expected)<D('1e-20'),(row,key,expected)
reserves=list(csv.DictReader((p/'monitoring-reserve-examples.csv').open(newline='',encoding='utf-8')))
assert len(reserves)==3
for r in reserves:
    assert D(r['earned_data_reimbursement_eur'])+D(r['unused_reserve_returned_eur'])==D(r['data_reserve_received_eur'])
    assert D(r['earned_data_reimbursement_eur'])==D(int(r['completed_monitoring_looks'])+int(r['setup_looks']))*D('.01')
sim=list(csv.DictReader((p/'monitoring-simulation.csv').open(newline='',encoding='utf-8')))
assert len(sim)==252
for row in sim:
    attempts=int(row['attempts']);cap=int(row['look_cap']);duration=int(row['watch_minutes'])
    assert attempts<=cap
    assert D(row['last_attempt_minute'])<duration
    assert int(row['responses'])+int(row['failed_attempts'])==attempts
    assert attempts+int(row['unused_look_allowance'])==cap
    assert abs(D(row['hypothetical_max_test_ausd'])-D(attempts)/100)<D('1e-12')
    if row['path']=='never' and row['strategy']=='fixed5': assert attempts==min(cap,(duration+4)//5)
    if row['strategy']=='end_only': assert attempts==1
    if row['path']=='never': assert row['detected_reported_condition']=='false'
    if row['path']=='steady' and row['strategy']=='fixed5' and duration==60 and cap>=9:
        assert attempts==9 and D(row['detection_minute'])==40
receipt=json.loads((p/'monitoring-simulation-receipt.json').read_text())
source=(p/'../../../cardano/src/polling.ts').resolve()
assert hashlib.sha256(source.read_bytes()).hexdigest()==receipt['source_sha256']
print(json.dumps({'partial_tranche_rows_independently_recomputed':len(rows),'reserve_examples_reconciled':len(reserves),
 'synthetic_simulation_rows_checked':len(sim),'pure_module_hash_matches':True,'result':'pass'},indent=2))
