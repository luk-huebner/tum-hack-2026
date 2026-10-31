# Morning decision: charge for delivered monitoring, and cap the load before promising settlement

**Recommendation:** continue with a supervised agency monitoring/evidence pilot, not a claim that Pay-on-Proof is already a profitable creator-payment company. Preserve the working verifier. Define and measure the service before extending the validator or scaling the keeper.

The overnight review produced real additional analysis, but no customer/mainnet validation:252 synthetic monitoring cases using the actual pure scheduler,36 partial-tranche billing/channel scenarios, three reconciled reserve examples,144 cohort/admission scenarios and96 support/volume scenarios. Calculations are inspectable, with independent checks. They are not sampled agency histories, demand forecasts, production benchmarks or passing full-service tests.

## Should the requesting company pay even if the campaign fails?

**Yes, provisionally: it should pay the agreed fee for monitoring actually delivered.** It should not pay a success fee for a tranche that did not succeed, and our own undelivered service should be refunded or credited. Keep these amounts separate:

1. Fixed monitoring/setup fee: earned for the agreed work/capacity, according to clear terms, even when the target is missed.
2. Metered data reserve, if used: unused balance returns. A reserve is not all earned revenue when received. This is an alternative to a data-inclusive flat price, not a hidden extra charge.
3. Success fee: trigger defined upfront, ideally unambiguous per tranche. “Any tranche,” “all tranches” and “proportional share” have materially different economics.
4. Creator payout principal: campaign money, never our revenue. Refunds follow the policy; the refund party authorizes the transaction and can choose its destination. Refund/network costs must be disclosed.

None of this commercial billing is implemented. The prototype's buyer/keeper/refund wallet fee responsibilities and possible agency reimbursement are mapped in [the initial report](REPORT.md#who-pays-each-cost).

## What changed overnight

**Masumi fee verified:** current [official documentation](https://www.masumi.network/dev/masumi/core-concepts/transaction-fees), checked31October2026, states5% of selling price, separately from Cardano fees. Actual adapter receipt, refund treatment and chosen fee incidence remain unverified. If our entire service invoice incurs that fee and we absorb it, the first illustrative€9+€10 model's contribution drops from€3.80 to€3.05/job. The direct route remains a different scenario.

**Success must be defined:** in a synthetic40%/20%/20%/20% distribution across0/1/2/3 successful tranches, the same€9 base/€10 maximum bonus produces€3.23,€1.37 or−€0.49 contribution after the assumed collection costs and5% absorbed network fee, depending on the bonus definition. Pick the rule with the customer, not after observing the outcome. [Pass1](OVERNIGHT_PASS_1.md).

**Data sharing is narrower than a full campaign proof cache:** the current watcher checks several policies from a source in one cycle but submits one policy, waits, and later fetches again. Same-post tranches do not automatically all settle from one paid fetch. Deadline cohorts can therefore be constrained by both repeat looks and sequential release slots. The queue figures are source-informed scenarios, not observed failures. [Pass2](OVERNIGHT_PASS_2.md).

**Monthly volume is insufficient by itself:** with15 allocated labor minutes/job,350 posts/month,€3,000 assumed fixed overhead and an absorbed5% fee, the€199/ten-post subscription case is−€274.55/month; at400 posts/100 service hours it is only+€114.80. Ten labor minutes instead gives+€746.28 at350 posts, but buyer demand, feasibility and actual costs remain unknown. Admission capacity must fit tranche windows as well as monthly support hours. [Support scenarios](support-sensitivity.csv).

**No production signed-data quote:** public Twitter Airnode metadata still declares BaseSepolia/aUSD despite its USD price label. Direct upstream cash prices are not equivalent to this trusted signed input. No euro/mainnet conversion was made. Test-token data and chain receipts cannot establish launch margins.

## The five decisions worth making next

1. **Before submission:** repository remains private at03:55CET. Owner reviews publication risk and makes it public if submitting; confirm actual Devfolio/video and use current-validator receipts. This review changes no visibility or submission.
2. **Choose the first sellable promise:** capped monitoring/evidence with human approval where quality is subjective; agree outage treatment, refund owner, fee trigger and snapshot/retention semantics. Start with a tiny admitted cohort.
3. **Reserve capacity before accepting work:** prototype per-job source budgets and tranche-window slots; test response reuse/earliest-source selection offline. Avoid selling every job the single-demo payout speed. No production code was changed here.
4. **Measure an agency pilot/time diary:** net buyer work removed, added crypto administration, creator acceptance, all-job support time, failed targets and partial tranches. The€9+€10 and€199 prices remain discovery tests, not validated launch prices.
5. **Obtain missing operational evidence:** commercial authenticated-data quote/quotas and source refresh/rotation terms; actual payment-service compatibility/receipt if claiming Masumi; focused fixes for the prior polling/nonce findings and appropriate security/operations review before real funds.

The original report and all application/demo files remain unchanged by this work. Remote main advanced only with a TRUST.md refund-authorization clarification; relevant code is unchanged. All deliverables remain in draft PR12 on `night/mentor-economics`, with no merge, transactions, purchases, deployments or outreach.

The bounded offline review is complete. Further useful validation requires agency participation, provider terms or separately authorized live integration resources; additional synthetic grids would not establish a profitable service. The overnight heartbeat is being removed on completion rather than continuing routine checks until07:00. Timing, shared-credit observations and the final publication check are recorded in [state](OVERNIGHT_STATE.md).
