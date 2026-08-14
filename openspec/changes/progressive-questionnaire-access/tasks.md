## 1. Questionnaire contract and research content

- [x] 1.1 Add questionnaire-plan metadata for total instrument count and estimated total duration
- [x] 1.2 Add validated instrument instructions and response legend fields
- [x] 1.3 Audit all prompts and options against the original instruments
- [x] 1.4 Correct ambiguous duration ranges in backend seed/admin data
- [ ] 1.5 Define server-side per-questionnaire draft or partial submission semantics

## 2. Progressive questionnaire runner

- [x] 2.1 Replace the scrolling 119-item form with one-item-at-a-time presentation
- [x] 2.2 Add previous/next navigation and current-question progress
- [x] 2.3 Render exact backend response instructions and numeric legend
- [x] 2.4 Add first-unanswered navigation and remaining-answer feedback

## 3. Draft persistence and failure recovery

- [x] 3.1 Add versioned local questionnaire draft storage
- [x] 3.2 Save after each answer and restore the current item after reload
- [x] 3.3 Preserve drafts on timeout or submission error
- [x] 3.4 Clear drafts only after confirmed backend submission

## 4. Study introduction and instrument progression

- [x] 4.1 Show questionnaire count and estimated total time without exposing total item count
- [ ] 4.2 Show benefits and privacy/research-purpose copy approved by the study owner
- [x] 4.3 Advance to the next questionnaire after confirmed submission
- [x] 4.4 Show overall instrument progress separately from per-question progress

## 5. Browse-preview access

- [x] 5.1 Extend bootstrap state to distinguish browse access from training execution access
- [x] 5.2 Allow incomplete students to browse home, training catalog, and growth education
- [ ] 5.3 Disable all training launch actions and protected personal-result actions
- [x] 5.4 Add a consistent unlock notice linking back to the current questionnaire
- [x] 5.5 Guard direct session routes against preview-only users

## 6. Verification

- [x] 6.1 Test draft restore, missing-answer navigation, retry, and successful clear
- [x] 6.2 Test preview browsing and deep-link execution blocking
- [x] 6.3 Run `pnpm test`
- [x] 6.4 Run `pnpm exec vue-tsc --noEmit`
- [ ] 6.5 Build and verify `dist/build/mp-weixin` in WeChat DevTools
