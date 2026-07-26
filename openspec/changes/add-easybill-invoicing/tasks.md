# Tasks

## 1. EasyBill integration

- [ ] 1.1 Add EasyBill API client + credentials (env only, no secrets in repo)
- [ ] 1.2 On confirmed upgrade payment, generate an invoice and store its reference
- [ ] 1.3 Make invoice generation retryable on failure without affecting the applied upgrade

## 2. Proration

- [ ] 2.1 Compute proration credit for the unused remainder of the current period
- [ ] 2.2 Apply the prorated amount at checkout for mid-cycle upgrades

## 3. Verification

- [ ] 3.1 Test: successful upgrade yields a stored invoice reference
- [ ] 3.2 Test: mid-cycle upgrade charge reflects proration
