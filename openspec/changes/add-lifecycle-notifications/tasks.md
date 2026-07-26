# Tasks

## 1. Bell wiring

- [ ] 1.1 Wire the bell to the member's unread notifications with a live count
- [ ] 1.2 Let the member open the bell and mark notifications read (set `read_at`)

## 2. Lifecycle / nudge mail system

- [ ] 2.1 Add a scheduled sender that delivers lifecycle emails via Resend
- [ ] 2.2 Define nudge eligibility so a member is not re-sent the same nudge repeatedly

## 3. Onboarding nudges

- [ ] 3.1 Track onboarding completion state per member
- [ ] 3.2 Send an onboarding-completion nudge to members who have not finished; stop once complete

## 4. Verification

- [ ] 4.1 Test: the bell reflects unread count and marking read clears it
- [ ] 4.2 Test: a due lifecycle mail is sent once, not repeatedly
- [ ] 4.3 Test: a member who completes onboarding receives no further completion nudge
