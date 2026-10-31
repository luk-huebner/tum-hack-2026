"""Offline extension: partial-tranche billing, network-fee incidence and fee reserves.
Run python tranche-economics.py. All EUR values are commercial scenarios, not quotes.
No application imports, environment/wallet reads or network.
"""
import csv
import json
from decimal import Decimal as D
from pathlib import Path

P = Path(__file__).resolve().parent
distributions = {
    'all_or_none': ['.4', '0', '0', '.6'],
    'partial_mix': ['.4', '.2', '.2', '.2'],
    'weak_retention': ['.1', '.6', '.2', '.1'],
    'strong_retention': ['.1', '.1', '.2', '.6'],
}
inputs = {
    'classification': 'Illustrative EUR scenarios, not observed fees, demand or forecasts',
    'three_equal_tranches_principal_eur': '500',
    'base_monitoring_fee_eur': '9', 'maximum_success_fee_eur': '10',
    'all_job_cost_before_release_eur': '10.16',
    'assumed_release_fee_per_tranche_eur': '.30',
    'assumed_buyer_funding_fee_per_tranche_eur': '.20',
    'assumed_refund_fee_per_unreleased_tranche_eur': '.30',
    'collection_percent': '.02', 'collection_fixed_per_job_invoice_eur': '.20',
    'masumi_network_fee_percent': '.05',
    'fee_source': 'https://www.masumi.network/dev/masumi/core-concepts/transaction-fees',
    'fee_checked_date': '2026-10-31',
    'fee_scope': 'Official page states5% of selling price, separate ADA fees. Exact payer/incidence/refund semantics not verified by a payment receipt. Alternatives below are hypothetical commercial allocations.',
    'distribution_values': distributions,
    'outcome_definition': 'Probability mass at0,1,2,3 tranches released. Each remaining tranche refunded; no simulation of disputes, chain failure or actual invoice collection.',
    'success_fee_definitions': {'any_tranche':'Full10EUR if at least one tranche released', 'proportional':'10EUR times released fraction', 'all_tranches':'Full10EUR only if all three release'},
    'channels': {'direct':'No external platform fee assumed', 'masumi_absorbed':'Service bears5% of its service selling price', 'masumi_buyer_surcharge':'Agency reimburses5% of service selling price outside our revenue; confirm actual platform terms before quoting'},
    'limitations': ['Variable500EUR principal is a hypothetical deal, not supported by current fixed5tADA public offer.',
      'Do not charge Masumi fees on creator principal merely because keeper service uses Masumi.',
      '10.16EUR includes setup/data/labor/hosting/treasury/retry assumptions inherited from first base case, before expected successful releases.',
      'Funding/refund fees are agency costs outside service contribution. Release fees are absorbed by service once, not also passed through.',
      'No taxes, principal collection/payment fee, FX conversion, customer acquisition forecast, refunds of platform fees or independent audit costs quoted.'],
}
(P/'tranche-inputs.json').write_text(json.dumps(inputs, indent=2)+'\n',encoding='utf-8')
rows=[]
for name, masses in distributions.items():
    probs=list(map(D,masses)); assert sum(probs)==1
    ek=sum(D(k)*p for k,p in enumerate(probs))
    for definition in ['any_tranche','proportional','all_tranches']:
        factor=1-probs[0] if definition=='any_tranche' else ek/3 if definition=='proportional' else probs[3]
        for channel in ['direct','masumi_absorbed','masumi_buyer_surcharge']:
            revenue=9+10*factor
            external=revenue*D('.05') if channel!='direct' else D(0)
            absorbed=external if channel=='masumi_absorbed' else D(0)
            buyer_extra=external if channel=='masumi_buyer_surcharge' else D(0)
            collector=revenue*D('.02')+D('.20')
            operating=D('10.16')+ek*D('.30')
            principal_to_creator=500*ek/3
            refund_fees=(3-ek)*D('.30')
            buyer_return=500-principal_to_creator-refund_fees
            buyer_funding=D('.60')
            # Reconcile the buyer's full cash outflow and returned principal independently of our service margin.
            buyer_gross=500+buyer_funding+revenue+buyer_extra
            buyer_net=buyer_gross-buyer_return
            assert abs(buyer_net-(principal_to_creator+refund_fees+buyer_funding+revenue+buyer_extra))<D('1e-20')
            rows.append(dict(distribution=name,billing_definition=definition,channel=channel,
                probability_any_release=1-probs[0],probability_full_release=probs[3],expected_released_tranches=ek,
                service_revenue_eur=revenue,service_collection_eur=collector,
                platform_fee_absorbed_eur=absorbed,platform_fee_buyer_extra_eur=buyer_extra,
                service_variable_cost_eur=operating,service_contribution_eur=revenue-collector-absorbed-operating,
                expected_creator_principal_eur=principal_to_creator,
                expected_buyer_refund_fee_eur=refund_fees,expected_principal_return_net_refund_fee_eur=buyer_return,
                buyer_funding_fees_eur=buyer_funding,expected_buyer_net_outflow_eur=buyer_net))
with (P/'tranche-economics.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

# A separate pass-through budget illustration; NOT added on top of the first model's data-inclusive9EUR fee.
reserves=[]
for completed_looks in [0,14,60]:
    setup_looks=3 if completed_looks else 0
    used=D(completed_looks+setup_looks)*D('.01')
    deposit=D('.63')
    assert used<=deposit
    reserves.append(dict(completed_monitoring_looks=completed_looks,setup_looks=setup_looks,
        data_reserve_received_eur=deposit,earned_data_reimbursement_eur=used,
        unused_reserve_returned_eur=deposit-used,
        separate_fixed_service_fee_eur=D('8.37') if completed_looks else D(0),
        note='Illustrative metered alternative to9EUR data-inclusive flat fee; not an extra charge'))
with (P/'monitoring-reserve-examples.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(reserves[0]));w.writeheader();w.writerows(reserves)
print('36 tranche/channel/billing combinations and3 separate reserve examples written.')
for r in rows:
    if r['distribution']=='partial_mix' and r['channel'] in ['direct','masumi_absorbed']:
        print(r['billing_definition'],r['channel'],'revenue',r['service_revenue_eur'],'contribution',r['service_contribution_eur'])

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
except ImportError:
    print('CSV complete; chart unavailable without matplotlib.')
else:
    labels=['Full fee after any tranche','Fee proportional to released share','Fee only after all three tranches']
    fig,ax=plt.subplots(figsize=(9,4.7),layout='constrained')
    for channel,offset,color,label in [('direct',-.17,'#0072B2','Direct service sale'),('masumi_absorbed',.17,'#D55E00','Service absorbs 5% on whole invoice')]:
        values=[float(next(r['service_contribution_eur'] for r in rows if r['distribution']=='partial_mix' and r['billing_definition']==definition and r['channel']==channel)) for definition in ['any_tranche','proportional','all_tranches']]
        bars=ax.barh([i+offset for i in range(3)],values,height=.30,color=color,label=label)
        ax.bar_label(bars,labels=[f'EUR {v:.2f}' for v in values],padding=4,fontsize=10)
    ax.set_yticks(range(3),labels)
    ax.invert_yaxis()
    ax.axvline(0,color='#444444',linewidth=1)
    ax.set(xlim=(-1,4.8),xlabel='EUR contribution per accepted job, before fixed overhead',title='Illustrative partial-tranche scenario: the fee trigger changes the margin')
    ax.legend(loc='lower right',fontsize=9)
    ax.grid(axis='x',alpha=.18)
    ax.set_axisbelow(True)
    fig.savefig(P/'partial-tranche-margin.png',dpi=170)
    plt.close(fig)
