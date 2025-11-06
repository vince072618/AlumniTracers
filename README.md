**Design and Development of an API and Progressive Web Application for NBSC Alumni Profiling and Tracer**

## Email Validation & Bounce Reduction

Recent update: Implemented stricter email validation to reduce bounced transactional emails (Supabase warning scenario).

### What We Validate Client-Side
1. Structural format `local@domain.tld` (no spaces, no consecutive dots).
2. Domain sanity (must contain a dot, no leading/trailing dot or hyphen, acceptable TLD length, no double dots).
3. Common provider typo correction suggestions (e.g., `gmail.con` -> `gmail.com`).
4. Submit button disabled until email passes validation.

### Defensive Check in AuthContext
`AuthContext.register` now re-validates the email before calling `supabase.auth.signUp` to prevent accidental bypasses (e.g., future form changes or programmatic calls).

### How to Extend
Edit `src/lib/validation.ts`:
- Add domains to `COMMON_DOMAINS`.
- Expand regex or heuristics.
- (Future) Integrate MX lookup or third-party deliverability API (requires backend or external service; not implemented here to keep frontend lightweight).

### Recommended Operational Practices
- Avoid using obviously fake test emails when developing (`test@test.test`, `asdf@gmail.con`). Use plus aliases instead: `yourname+dev1@gmail.com`.
- Periodically export and audit unverified accounts with suspicious domains for cleanup.
- Consider enabling a custom SMTP provider with better deliverability analytics.
- Rate-limit registration attempts to reduce bulk bad submissions (future enhancement).

### Future Placeholder
Code comments include an optional spot to introduce MX record checks (needs server). For now we rely on syntactic + heuristic validation only.

