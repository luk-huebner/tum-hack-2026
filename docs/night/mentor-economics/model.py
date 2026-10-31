"""Offline scenario calculator. Run: python model.py. No network or project imports.

Writes only beside this file. All EUR inputs are assumptions in model-inputs.json.
The optional chart requires matplotlib; CSV calculation uses the standard library.
"""
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = json.loads((ROOT / 'model-inputs.json').read_text(encoding='utf-8'))


def cost(s, q=None):
    q = s['success_probability'] if q is None else q
    data = (s['monitoring_looks'] + s['setup_looks']) * s['assumed_eur_per_look']
    chain = (q * s['tranches'] + s['expected_extra_submitted_tx']) * s['assumed_eur_per_release']
    labor = (s['onboarding_minutes_per_job'] + s['support_minutes_per_job']) * s['loaded_eur_per_hour'] / 60
    return data + chain + labor + s['variable_hosting_eur'] + s['treasury_fx_eur']


def economics(s, model, q=None, platform_share=0.0):
    q = s['success_probability'] if q is None else q
    p = INPUT['prices']
    if model == 'success_only':
        gross, invoices = q * p['success_only_eur'], q
    elif model == 'base_plus_success':
        gross, invoices = p['base_eur'] + q * p['optional_success_eur'], 1
    else:
        gross, invoices = p['agency_monthly_eur'] / p['agency_included_jobs'], 1 / p['agency_included_jobs']
    net = gross * (1 - INPUT['service_collection_percent'] - platform_share) - invoices * INPUT['service_collection_fixed_eur_per_invoice']
    c = cost(s, q)
    cm = net - c
    minutes = s['onboarding_minutes_per_job'] + s['support_minutes_per_job']
    capacity = math.floor(INPUT['service_hours_per_month'] * 60 / minutes)
    be = math.ceil(INPUT['fixed_monthly_overhead_eur'] / cm) if cm > 0 else None
    # For a subscription, whole agency-months consume ten jobs at full included use.
    agency_be = math.ceil(INPUT['fixed_monthly_overhead_eur'] / (cm * p['agency_included_jobs'])) if model == 'agency_subscription_full_use' and cm > 0 else None
    return dict(scenario=s['name'], model=model, success_probability=q, platform_share=platform_share,
                gross_service_revenue_eur=gross, net_after_collection_eur=net,
                expected_variable_cost_eur=c, contribution_eur=cm,
                contribution_margin_pct=100 * cm / gross if gross else None,
                jobs_to_cover_fixed_overhead=be, agencies_to_cover_fixed_overhead=agency_be,
                labor_capacity_jobs_per_month=capacity,
                operating_surplus_at_capacity_eur=capacity * cm - INPUT['fixed_monthly_overhead_eur'])


def write_csv(name, rows):
    with (ROOT / name).open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main():
    models = ['success_only', 'base_plus_success', 'agency_subscription_full_use']
    rows = [economics(s, m) for s in INPUT['scenarios'] for m in models]
    write_csv('scenario-results.csv', rows)
    base = INPUT['scenarios'][1]
    sensitivity = [economics(base, m, q / 100, share)
                   for share in [0, 0.05, 0.10]
                   for q in [0, 20, 35, 40, 60, 80, 100] for m in models]
    write_csv('success-sensitivity.csv', sensitivity)
    # Net break-even fees before fixed overhead, with aligned job/invoice units.
    q, c, a, b = base['success_probability'], cost(base), 1 - INPUT['service_collection_percent'], INPUT['service_collection_fixed_eur_per_invoice']
    floors = {
        'base_variable_cost_eur': c,
        'success_only_fee_floor_at_q_0_6_eur': (c / q + b) / a,
        'flat_all_job_fee_floor_eur': (c + b) / a,
        'hybrid_base_floor_with_10_success_eur': (c + b) / a - q * 10,
        'agency_monthly_floor_10_jobs_eur': (10 * c + b) / a,
        'success_only_q_floor_at_29': (c - q * base['tranches'] * base['assumed_eur_per_release']) / (29 * a - b - base['tranches'] * base['assumed_eur_per_release']),
        'hybrid_q_floor_at_9_plus_10': (c - q * base['tranches'] * base['assumed_eur_per_release'] - 9 * a + b) / (10 * a - base['tranches'] * base['assumed_eur_per_release']),
        'base_fixed_overhead_eur_per_job_at_capacity': 3000 / 400,
        'flat_fee_floor_including_fixed_at_capacity_eur': (c + 3000 / 400 + b) / a,
        'manual_example_minutes_before': 89, 'manual_example_minutes_after': 49,
        'manual_example_added_crypto_minutes': 10,
        'manual_example_net_time_value_eur': (89 - 49 - 10) * 35 / 60,
    }
    (ROOT / 'model-summary.json').write_text(json.dumps(floors, indent=2) + '\n', encoding='utf-8')
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError:
        print('CSV/JSON complete; matplotlib unavailable, chart not generated.')
        return
    fig, ax = plt.subplots(figsize=(9, 5.3), layout='constrained')
    colors = ['#0072B2', '#D55E00', '#009E73']
    labels = ['EUR29 only on success', 'EUR9 + EUR10 on success', 'EUR199 / 10 jobs (full use)']
    for model, color, label in zip(models, colors, labels):
        qs = list(range(0, 101))
        values = [economics(base, model, q / 100)['contribution_eur'] for q in qs]
        ax.plot(qs, values, color=color, linewidth=2.5, label=label)
    ax.axhline(0, color='#444444', linewidth=1)
    ax.axhline(7.5, color='#777777', linestyle='--', linewidth=1.2, label='EUR7.50/job to cover fixed overhead at 400 jobs')
    ax.set(xlim=(0, 100), ylim=(-12, 19), xlabel='Share of accepted jobs achieving the payout condition (%)', ylabel='EUR contribution per accepted job', title='Success-only pricing carries unsuccessful-job costs')
    ax.grid(axis='y', alpha=0.2)
    ax.legend(loc='upper left', fontsize=8.5)
    fig.savefig(ROOT / 'contribution-sensitivity.png', dpi=170)
    plt.close(fig)
    for row in rows:
        print(f"{row['scenario']} {row['model']}: cost={row['expected_variable_cost_eur']:.3f}, contribution={row['contribution_eur']:.3f}, break-even jobs={row['jobs_to_cover_fixed_overhead']}, capacity={row['labor_capacity_jobs_per_month']}")
    print(json.dumps(floors, indent=2))


if __name__ == '__main__':
    main()
