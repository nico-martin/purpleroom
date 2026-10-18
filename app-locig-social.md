# purpleroom — Social platform specification

Status: implemented locally; deployment and production mail verification remain separate steps.

This document records the social restructure decisions. It supersedes conflicting permission, signup, crew, attendance, submission-sharing, and review-sharing rules in `app-logic.md`. Unrelated existing behaviour remains unchanged unless explicitly noted. Open questions below are not approved implementation decisions.

## 1. Product model

purpleroom is a members-only conference and speaker planning platform with personal, mutually accepted friendships called a **crew**.

- A conference is a shared conference brand.
- An edition is a particular event with its own title, dates, location, and CFP information.
- A talk/proposal is a reusable, privately owned library entry.
- A submission links one owned proposal to an edition and tracks its private status.
- Attendance is a separate, manually chosen edition-level setting.
- A crew is the current member's accepted friends, not a global group.
- A speaker review is a member-owned conference review shared with their friends.
- There are no separate named crews or crew administrators in this scope.

## 2. Authentication and signup

### Confirmed

- No application content is available without login: conferences, editions, members, profiles, reviews, attendance, and social information all require authentication.
- The member directory is “public” only within the authenticated platform.
- Anyone can sign up; invitations are no longer required.
- Signup and login use the same passwordless email flow: enter email, receive an authentication email, verify the link.
- If the address does not belong to an account, signup creates a new member account.
- New accounts are created/activated only after successful email verification, not merely by requesting a link.
- Account existence must not be revealed by the email-request response.
- Email addresses are private and never included in the member directory or friends' profile responses.
- Remove the signup invitation feature from the active product.

### Required design considerations

- Authentication entry points and their minimal static assets must remain reachable without login; this does not make member content public.
- Public signup needs email/IP abuse protection, send throttling, expiring single-use tokens, and safe handling of concurrent verification.
- The current token model requires an existing user; the signup design must accommodate verification before account activation/creation.
- Normalise email consistently and retain case-insensitive uniqueness.
- Require a display name after first verification before listing the account in the member directory. Never derive a public name from the email address.
- Remove the calendar feature for now, including secret subscription access; no calendar exception to login-only access remains.

## 3. Roles and ownership

| Capability | Member | Admin |
| --- | --- | --- |
| Browse active conferences and editions | Yes | Yes |
| Browse member directory | Yes | Yes |
| Edit own profile | Yes | Yes |
| Create/read/update/delete own proposals | Yes | Yes |
| Link/manage own proposals and submission statuses on editions | Yes | Yes |
| Set own manual attendance | Yes | Yes |
| Send/manage crew requests and friendships | Yes | Yes |
| Create/edit/delete own speaker review | Yes | Yes |
| Read friends' reviews and attendance | Yes | Yes, under the same friendship rules |
| Read another member's private proposals or submission statuses | No | No |
| Create/edit/delete conferences and editions | No | Yes |
| View catalog trash and restore conferences/editions | No | Yes |
| Promote/demote admins and suspend accounts | No | Yes |

- Admin means member capabilities plus catalog/account administration, not a privacy bypass.
- Only Nico's existing account becomes the initial admin. Other existing users become members.
- Never grant admin to all existing users or automatically to the first new public signup.
- Before migration, explicitly identify the existing account to promote; do not infer identity from display name alone.
- New signups default to member and cannot choose their own role.
- Prevent demoting or suspending the last active admin.
- Suspension immediately disables account access, including existing sessions and new logins.
- Enforce permissions server-side, including direct API access, metadata imports, deletion, and restoration. Hiding controls alone is insufficient.

## 4. Member directory and profiles

- Authenticated members can browse all active members and send crew requests.
- Directory fields include name and avatar; do not expose email, tokens, private proposals, or submission statuses.
- Members edit their own profiles.
- New members must choose a display name before appearing in the directory.
- Being listed does not grant strangers access to attendance, review content, or submission participation.
- Friend visibility comes from an accepted friendship, not from a pending request or shared friend.
- Member profile pages show basic identity and friend-visible manual conference plans. Expanded profile fields, public friend lists, and mutual-friend counts are deferred.

## 5. Crew relationships

### Confirmed actions

- Send a request to another member.
- Accept or decline an incoming request.
- Cancel an outgoing pending request.
- Unfriend an accepted friend.
- Block another member.
- Crew requests appear in-app only; no request emails.

### Relationship rules

- Friendships are mutual and grant access in both directions.
- A member cannot send a request to themselves.
- Duplicate requests and duplicate friendships are not allowed.
- If A has requested B and B sends a request to A, treat B's action as acceptance of A's request. Do not create a second pending request.
- Concurrent sends/acceptances must still produce only one relationship.
- Only the recipient can accept/decline a pending request; only the sender can cancel it.
- Unfriending immediately removes friendship-based access in both directions, including reviews, attendance, and submitted-friend information.
- Crew counts and lists must be computed for the current viewer, not cached globally.
- Blocking removes any friendship and pending requests. It denies new requests and friendship-based access in both directions; unblocking does not automatically restore friendship.
- Additional block/unblock details and re-request limits follow the implementation defaults in section 12.

## 6. Proposals and submissions

- Retain the reusable talk/proposal library and separate edition submissions.
- A proposal can be submitted to multiple editions.
- A member can submit multiple different proposals to one edition.
- Proposal content and per-submission details are owner-only, including for admins.
- Other members cannot inspect titles, abstracts, notes, submission IDs, proposal IDs, outcomes, or per-person submission totals through shared views.
- Keep existing status tracking for the owner. Do not broaden the status workflow as part of the social restructure without a separate decision.
- Existing legacy fields and values remain preserved even when absent from the UI.
- CFP tracking is local to purpleroom; linking a proposal does not submit it to an external conference system.

### Friends who submitted

- For an edition, a member may know **which accepted friends have submitted**.
- Show a count such as “4 friends have submitted a CFP”; a friend with three submissions counts once.
- The viewer is not included in their own friends count.
- `interested` drafts do not count.
- Every other current submission status counts: `submitted`, `accepted`, `rejected`, `waitlisted`, `confirmed`, `declined`, and legacy `attended`. No submitted date or status history is required to qualify.
- Qualification follows the current status: moving the last qualifying submission back to `interested` removes that friend from the count/list.
- Submission participation may remain visible after an accepted/rejected outcome, without disclosing that outcome.
- Do not reveal the number of submissions made by an individual friend.
- Do not reveal any friend's submission status.
- Non-friends do not appear in the viewer's submitted-friend list or count.
- Deleting a member's last qualifying submission removes them from that edition's submitted-friend count/list.
- A single submitted-friend count can reveal that friend's participation; this is intentional and allowed.

## 7. Attendance

- Attendance is manually set on the edition page: **Going**, **Maybe**, or no attendance marker.
- A member may mark Going or Maybe without ever creating or submitting a proposal.
- A member may mark Going even if a submission was rejected/declined.
- Submission statuses have **no influence** on attendance.
- Acceptance, confirmation, rejection, deletion, and changes to a submission must not create/change/remove attendance.
- Do not infer attendance or a “speaking” group from submission status in shared views.
- Accepted friends can see each other's Going/Maybe markers and relevant editions.
- Non-friends cannot see those markers or a member's edition itinerary.
- A member can always see and manage their own attendance.
- Dashboard, edition page, and profile views must respect this separation.

## 8. Speaker reviews and removal of crew notes

### Speaker reviews remain

- Keep conference-level speaker reviews: structured tags, return recommendation, and review text.
- Members own and manage their own reviews.
- Reviews are visible to the author and their accepted friends, not to all members.
- Admins do not bypass review visibility through their role.
- Review counts, tag totals, recommendations, previews, and related activity must use the same viewer-specific visibility scope; global aggregates could expose non-friends' reviews.
- This applies to conference cards, conference detail, edition-side summaries, and any dashboard entry.

### “Notes from the crew” is removed

- Remove the comments/discussion feature from both conferences and editions, not just its heading.
- Stop returning those comments in normal API responses and remove comment activity from the dashboard.
- Disable the corresponding comment creation/deletion API surface in the restructured product.
- Preserve existing comment records; do not delete historical data as part of this change.
- This removal is separate from private proposal notes and admin-editable edition notes (“Worth knowing”); those are not removed by this decision.

## 9. Dashboard, calendar removal, and catalog

- Focus the dashboard on the member's own plans, CFP deadlines, and friends' manual attendance.
- Shared activity must never reveal private submission statuses, talk titles, or per-person submission totals.
- No comment activity remains.
- Remove the calendar feature for now: no subscription controls, calendar links in API responses, token-regeneration actions, or served `.ics` feeds.
- Existing secret feed URLs must stop serving calendar content, not merely disappear from the UI.
- Retain stored calendar tokens and historical UID conventions for possible future restoration; do not delete existing data.
- Catalog trash and restoration become admin-only.
- Preserve edition titles verbatim, same-year editions, existing IDs, and stable calendar event UIDs.
- The retained dashboard activity types are recorded in section 12; private submission and retired comment activity are excluded.

## 10. Migration and preservation

- Preserve all existing user accounts and data: proposals, submissions, statuses, attendance rows, reviews, comments, conferences, editions, and legacy fields.
- Existing users receive no automatic friendships. Access requires new explicit acceptance.
- Do not convert submission-derived attendance into manual attendance without a separate decision; preserve existing explicit attendance rows.
- Review visibility becomes friends-only even for historical reviews.
- Comments and invitation records can remain stored while their active features are retired.
- Preserve database relationships, logo files, sessions, protected invitation storage, and calendar tokens/UIDs unless a separately approved security decision requires invalidation.
- Retain compatibility identifiers where renaming would invalidate saved data or links.
- Use numbered migrations, not edits to the immutable version-1 schema.
- Keep FTP-only deployment and automatic migrations practical; no server CLI requirement.
- Back up the live database and protected runtime storage before the restructure is deployed.

## 11. Implementation verification requirements

Before considering the restructure complete, verify:

- Anonymous requests cannot read application/member content.
- A new email can verify and create exactly one member account, including concurrent requests.
- Members cannot mutate catalog content or administer accounts through direct requests.
- Admins cannot read private proposals/statuses belonging to other users through app endpoints.
- Pending requests grant no friendship access; crossed requests result in one accepted friendship.
- Multiple qualifying proposals from one friend count once; interested-only friends count zero.
- Submission counts/lists reveal no individual submission totals or outcomes.
- Changing any submission status leaves manual attendance unchanged.
- Every non-`interested` status qualifies for submitted-friend counts; multiple qualifying submissions still count once.
- New accounts cannot appear in the directory before choosing a display name.
- Existing calendar URLs no longer serve feeds, and calendar management actions are disabled.
- The last active admin cannot be demoted or suspended; suspended accounts cannot reuse existing sessions or sign in again.
- Non-friends' attendance and reviews do not leak via aggregates, activity, nested API fields, or cached responses.
- Unfriending, blocking, and suspension revoke applicable access according to the final rules.
- Comments cannot be read/written through retired endpoints or appear in activity.
- Existing data remains intact and migrations are repeat-safe.

## 12. Implementation defaults and deferred scope

Implementation defaults, disclosed when implementation started:

- Initial existing admin is the account with email `mail@nico.dev`; verify this account exists before production deployment. Other users remain members. Protected first-install setup creates its initial admin directly.
- Manage members provides promotion/demotion and suspension/restoration, including for admins except when it would remove the last active admin.
- Suspended accounts disappear from member/social views. Friendships and all stored content remain for reactivation. Session-version changes permanently invalidate prior sessions even after restoration.
- Blocking hides both participants from each other's directory and denies friendship access; no block notification is sent. An owner can see and unblock their own blocked list.
- Re-requests are possible after decline/cancel/unfriend, subject to 30 request actions per member/hour. No separate per-pair cooldown in this release.
- Owners retain read access to their submissions linked to deleted catalog items. Catalog pages remain unavailable until an admin restores them.
- The dashboard shows current open CFPs, upcoming editions with the viewer's/friends' manual plans, and the latest ten catalog-addition or visible-review activity entries. No submission-status or comment activity is emitted.
- Incoming/outgoing requests have an in-app Requests view and incoming count. No acceptance/unfriend emails or separate notification system in this release.

Deferred scope: self-service account deletion, email changes, data export, abuse reports, expanded profiles, generic posts, likes, direct messages, and a general social timeline.

## 13. Next step

Implementation was explicitly requested after the decision review. Migration `003_social.sql`, role/privacy-aware APIs, email onboarding, crew/member/admin views, and regression tests implement this specification. Back up live storage before deployment; verify production mail and the initial admin account on the host.
