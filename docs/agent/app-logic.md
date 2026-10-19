# purpleroom app logic

This is the living reference for the app's current product behaviour. It describes what members can do, who can see which data, and how features interact—not an implementation plan or change log.

Update the relevant sections whenever behaviour changes, in the same change as the implementation and tests. Keep one coherent set of rules here rather than adding a second specification that supersedes this one. Record future ideas separately and label them as unimplemented. If code and an agreed privacy rule disagree, report the discrepancy rather than silently redefining the rule.

Development conventions are in [AGENTS.md](../../AGENTS.md). Hosting and upgrade procedures are in [the deployment guide](../deployment.md). Previous product designs remain available in Git history.

## 1. Purpose and concepts

purpleroom helps conference speakers discover opportunities, privately manage proposals, and share experience and plans with accepted friends.

| Concept | Meaning |
| --- | --- |
| Member | An account with a verified email and completed display name. |
| Admin | A member with additional catalog and account-management permissions. |
| Conference | A long-lived event brand, such as JSNation. |
| Edition | A particular event with its own title, dates, location, and CFP information. |
| Talk / proposal | A reusable, privately owned entry in a member's library; called a `paper` internally. |
| Submission | An owned speaking opportunity for an edition, optionally linked to a proposal, with a privately tracked status. |
| Attendance | A manually selected Going or Maybe marker for an edition. |
| Crew | The current member's mutually accepted friends. There are no separate named crews. |
| Speaker review / take | A member's conference-level experience, shared with their friends. |

## 2. Access, signup, and profiles

- All catalog, member, review, proposal, attendance, and social content requires login. “Public” within the app means visible to signed-in members, not the open web.
- Sign-in, email verification, and the minimal application shell/assets must be reachable before login. The health endpoint exposes only service status. First-install setup is separately secret-protected.
- Signup and login use one passwordless email flow. Addresses are trimmed, lowercased, and matched case-insensitively.
- Requesting a code does not create an account. Successful verification creates a member account if the address is new, or signs into the existing account.
- Signup/login sends a six-digit numeric code (including possible leading zeroes), not a link. Codes expire after 15 minutes, can be consumed once, and stop working after five wrong guesses. A newly issued code invalidates previous codes for that address. Verification/consumption and attempt increments are atomic.
- Codes are bound to a high-entropy request ID returned to the requesting browser; only hashes of the request ID and request-ID/code combination are stored. Verification requires both the request ID and code. The code alone cannot be used with a different request. Public request responses have the same shape for valid addresses regardless of signup/account/suspension/throttling/delivery state; only development responses additionally expose the code.
- The login screen provides one paste-friendly text field with a numeric keyboard and one-time-code autofill. Pasted spaces/separators are removed and leading zeroes are preserved. The email/request ID (never the entered code) survive reload in tab-scoped session storage, and are cleared on success or change-email. The intended in-app destination is preserved. Resend is available after a 60-second UI cooldown; server-side limits remain 5 requests/address/hour, 30/IP/hour, and 100 verification attempts/IP/hour.
- Signup/sign-in emails use a lightly branded purple HTML layout with a large selectable code, instructions to paste it into the original browser, expiry/safety text, and a plain-text alternative. No authentication links, remote images, or tracking pixels are included. Already-issued email links and local CLI seed links remain usable through the legacy verification route; new public requests never issue links.
- Production uses authenticated, certificate-verified SMTP when configured, otherwise the host's PHP `mail()` transport. SMTP requires encryption; a failed configured SMTP delivery does not silently fall back to another transport. Development displays the local code without sending email or logging it.
- Delivery failures discard the unusable pending code, log only a safe diagnostic, and retain the same generic public request response. SMTP credentials, production codes, and authentication tokens must never be exposed in responses or logs. This does not introduce crew-request or other social notification emails.
- The normal production request response does not reveal whether an account exists or whether a request was throttled. Suspended accounts cannot sign in.
- New accounts must choose a nonblank display name before appearing in the directory or accessing normal app features. The email address is never used as an automatically public display name.
- Members can edit their own display name, optional profile image, homepage, and social links. Their own settings show their email; member directory and profile responses do not expose email addresses or authentication tokens.
- A profile image is imported from a URL on save, validated like conference logos, and stored locally under private avatar storage. The saved `avatar_url` points to an authenticated API route, not the external source. Existing remote avatars migrate on the next profile save, never on ordinary reads.
- Keeping a stored avatar reuses it without another download. Members can replace or remove it; removal returns to initials without purging retained historical files. Import/validation/storage failure leaves all profile fields unchanged.
- Avatar serving follows member visibility: signed-in members may see active, completed profiles' images unless blocked in either direction. Suspended profiles and stale/removed image URLs are unavailable. Direct filesystem access is denied.
- Optional links are **Homepage, GitHub, LinkedIn, X, Bluesky, Instagram, YouTube, and Mastodon**. They require full HTTP(S) URLs without embedded credentials; Mastodon may use any instance. Empty values clear a link; omitted fields retain their values.
- Saved links appear on member profiles for signed-in viewers, including non-friends; blocked/suspended profile restrictions still apply. These links do not grant access to attendance, reviews, or private submissions. Compact member identity responses need not include the links.
- The current product does not provide self-service email changes, account deletion, or data export.

## 3. Roles and ownership

| Capability | Member | Admin |
| --- | --- | --- |
| Browse active conferences, editions, and the member directory | Yes | Yes |
| Edit own profile | Yes | Yes |
| Manage own proposal library and submissions | Yes | Yes |
| Manage own manual attendance, reviews, and crew | Yes | Yes |
| Read accepted friends' reviews, plans, and submission participation | Yes | Yes, under the same friendship rules |
| Read another member's private proposal content or submission details | No | No |
| Create/edit/delete conferences and editions, import metadata/logos | No | Yes |
| View catalog trash and restore catalog entries | No | Yes |
| Promote/demote accounts, suspend/restore access | No | Yes |

- Admin is not a privacy bypass. This is an application/API access rule, not a claim that a hosting operator cannot access server storage.
- Normal signup always creates a member; users cannot assign themselves roles through profile updates.
- An admin can manage another admin, but cannot demote or suspend the last active admin. The safeguard applies to self-management too.
- Suspension immediately denies subsequent authenticated requests and new sign-ins. Restoring access does not make old sessions valid again; the member must sign in afresh.
- Suspended accounts are hidden from normal directory, crew, review, attendance, and submitted-friend views. Their data and relationships remain stored for restoration. Account administration still lists them; an owner's blocked list can retain a suspended account.

## 4. Conferences and editions

### Conferences

- Admins maintain the shared catalog. Conference data includes name, optional website, optional logo, and any retained description.
- Conferences also have admin-managed topic tags, separate from the structured tags in speaker reviews. Tags are entered as comma-separated text in the form, normalised to trimmed/lowercase labels with collapsed whitespace, and deduplicated. Each conference supports up to 20 tags of 50 characters each. An empty list clears tags; omitting tags on an API update preserves them. Tags are visible to all signed-in members on conference cards/details.
- The directory is name-first: compact cards, four per row on wide desktop screens and fewer on smaller screens. It shows the next edition and viewer-scoped review count, without logos or placeholder descriptions.
- `/conferences` combines name/context/tag text search, selectable topic tags, and **Have editions with open CFPs**. Multiple selected tags match any selected tag; text/tag/CFP filters combine together. Filter state and sorting are kept in the URL, and Clear filters retains the chosen sort order. Empty results show guidance rather than suggesting the catalog is empty.
- The open-CFP filter matches a conference if **any** active edition has a closing date today or later and an absent/past/today opening date. It does not consider only the next edition. Deleted editions, future opening windows, expired deadlines, and unknown closing dates do not qualify. An undated event can still have an open CFP.
- Directory sorting supports name A–Z/Z–A and next-edition date soonest/latest first. The default is name A–Z; date ties are broken by name. Conferences without a dated next edition stay last in **both** date directions. This sorts event dates, not personal submission dates or CFP deadlines.
- Cards show up to three topic tags with an overflow count and an Open CFP badge when applicable. Detail pages show all topic tags. Review summaries retain their independent friend-scoped visibility.
- Detail and edit views may show logos. An admin can prefill metadata from a website and import a logo by URL; importing never creates conference content without saving.
- Logo imports are validated and stored locally. Existing external logos are migrated on the next conference save, not during ordinary reads. A failed import leaves the conference unchanged.
- The current form omits conference descriptions. Saving unrelated changes must preserve existing descriptions.

### Editions

- Editions belong to a conference but have independent IDs, titles, dates, locations, links, notes, submissions, and attendance.
- Multiple editions may belong to the same conference in the same year.
- An edition title defaults to the conference name. Explicitly blank titles are rejected; custom titles are retained when changing the selected conference. Titles are displayed as entered, without appending a year—for example, **JSNation Berlin 26**.
- When moving an edition between conferences through the API, a title still equal to the previous conference name follows the new name unless a title is supplied explicitly.
- There is no separate Year input. First/last dates determine scheduling; dates may be unknown. End dates cannot precede start dates, including the CFP date range.
- Editions support city, two-letter country code, online flag, event website, CFP link, CFP opening/closing dates, and admin-maintained notes (“Worth knowing”).
- Starting an edition from a conference can reuse the previous edition's location, links, and notes. It does not copy dates or advance a year automatically; the title starts from the conference name.
- Conference detail lists dated editions newest first, then undated editions. The next-edition summary selects the earliest edition starting today or later.
- The internal `year` column is compatibility metadata, not identity or display text. It is derived from the first day, or last day if no first day is known. Undated editions retain supplied/existing metadata or use the current UTC year.

## 5. Private proposal library and submissions

- Members create, edit, and permanently delete their own talks/proposals. Deleting a proposal also deletes its linked submissions and requires confirmation in the UI.
- A proposal can be linked to multiple editions. Multiple different proposals can be linked to one edition, but the same proposal/edition pair cannot be duplicated.
- “Add my talk” offers **From my library**, **New talk**, and **Topic to be agreed**. The third option records a submission without a linked proposal and creates no placeholder in the talk library. It has the same private status and submission-date controls as other submissions.
- Each member can have at most one unassigned opportunity per edition, alongside any submissions with specific talks. Different members can independently have unassigned opportunities for the same edition.
- Owners can later attach a library talk or create a new talk from the opportunity's **Attach a talk** action. This updates the same submission, retaining its ID, status, submission date, creation date, and other details. Attaching a proposal already submitted to that edition is rejected without merging or replacing either submission.
- Submissions track local plans and outcomes. Adding a talk in purpleroom **does not submit it to an external CFP service**.
- Proposal titles, content, private notes, submission IDs, individual submission totals, submission dates, and outcomes are owner-only—even from admins through the app.
- Owners can change submission status/details or remove a submission without deleting the reusable proposal.
- Each submission has optional **private notes**, available in “Add my talk” for all three creation options and editable later in “The details of this submission”. Notes entered in the creation modal are retained when switching between options. These are specific to that edition/opportunity and separate from reusable talk notes. Only the owner can read/edit them, including when the submission has no attached talk; friends and admins have no access through the app. Empty notes clear the field, while status-only changes and attaching a talk preserve it.
- Creating a submission requires an active edition; a proposal, when supplied, must belong to the submission owner. Reassigning a proposal/edition validates the corresponding ownership/active-edition requirement. Owners retain access to existing submissions linked to deleted catalog items, including unassigned opportunities.
- The current talk form has a title and private notes. Abstracts and per-submission abstract overrides remain supported stored data but are omitted from the UI; unrelated edits must not clear them.
- `/talks` presents the private library as cards: three per row on wide desktop screens, two at medium widths, and one on mobile. Each card shows the title, last-updated date, total linked submissions, and a stacked status bar. Each status label sits directly beside its count in a grouped badge so their connection is clear. Empty talks show zero submissions and a route to find a stage.
- Card statistics describe **current statuses**, not a history of transitions. Every linked submission counts once, including `interested` and archived-edition submissions; legacy `attended` is labelled explicitly. These private totals differ from friend-participation counts, which exclude `interested` and deduplicate people.
- Submission controls can be expanded on each card to inspect editions and edit statuses/details or remove submissions. Statistics update after changes; the title opens the full talk page. Charts have text counts and accessible summaries rather than relying on colour alone.
- Unassigned opportunities appear in a separate **Topics to be agreed** section on `/talks`, with edition links, private controls, and the attach action. The reusable cards sit under their own **Talk library** heading and description, separated from opportunities by spacing and a divider when both sections are present. Opportunities also appear under the edition's **My submissions** and in the owner's dashboard data. They do not inflate a talk's card statistics until attached to that talk. Deleting an unrelated library talk does not delete an unassigned opportunity.
- Talk titles are always private. The legacy `hide_title` field is retained but is not a privacy toggle in the current UI.

### Submission statuses

The selectable statuses are `interested`, `submitted`, `accepted`, `rejected`, `waitlisted`, `confirmed`, and `declined`. Historical `attended` values remain readable and are shown as a disabled legacy choice, not offered as a new choice. The API retains compatibility with that stored status.

Statuses are owner-managed, not a mandatory linear workflow. A newly linked proposal defaults to `interested`. Setting `submitted` fills an absent submission date with today's UTC date; owners can edit submission dates separately.

### Friends who submitted

- An edition may reveal **which accepted friends have submitted** and their combined count.
- A member qualifies if they currently have at least one submission whose status is not `interested`. All other supported statuses qualify, including `declined` and legacy `attended`; no submitted date or history is required.
- Topic-to-be-agreed submissions qualify on the same basis, without revealing that their topic is unassigned. A member with an unassigned opportunity and several linked proposals still counts once.
- Each friend counts once, regardless of proposal count. The viewer never counts as their own friend.
- Status changes between qualifying statuses do not reveal a changed outcome. Moving the last qualifying submission to `interested`, or deleting it, removes that friend from the list/count.
- Non-friends, pending requests, blocked relationships, and suspended accounts do not qualify.
- Participation responses contain only member identity, never proposal titles, submission IDs, per-person totals, or statuses.
- A count of one may identify the participating friend. This is allowed because participation itself is intentionally shared with friends.

## 6. Manual attendance

- Members explicitly select **Going**, **Maybe**, or no marker (“Not going” in the control) on an edition page.
- A member can choose either attendance state without owning or submitting a talk, or after a rejected/declined submission.
- **Submission status has no influence on attendance.** No outcome, status change, proposal deletion, or submission deletion creates, modifies, or removes an attendance marker.
- The owner and accepted friends can see Going/Maybe markers. Non-friends cannot see a member's itinerary.
- Edition and dashboard participant lists include the viewer's own plans and eligible friends' plans. Member profiles show plans only to the owner and accepted friends.
- There is no submission-derived “speaking” group in shared views. No marker does not distinguish an explicit refusal from a member who has not made plans.

## 7. Crew and member discovery

The crew screen provides **My crew**, **All members**, **Requests**, and **Blocked**, with name search. The directory includes completed, active profiles and excludes members blocked in either direction. Directory membership alone grants no access to private plans or reviews.

### Requests and friendships

| Current relationship | Action | Result |
| --- | --- | --- |
| None | A requests B | One pending request, outgoing for A and incoming for B. |
| Pending A → B | A requests B again | Same pending request; no duplicate. |
| Pending A → B | B requests A or accepts | One mutual friendship; no second pending request. |
| Pending A → B | A cancels or B declines | No relationship. |
| Friends | Either participant unfriends | No relationship; friendship-based access ends in both directions. |
| Any | Either participant blocks | Pending request/friendship removed; blocking rules apply. |

- Self-requests and duplicate friendships are prohibited. Shared friends do not grant transitive access.
- Only the recipient accepts an incoming request. Either participant can remove their own pair relationship to cancel, decline, or unfriend as appropriate.
- Requests appear in-app, with an incoming count. There are no request, acceptance, or unfriend emails, and no separate notification inbox.
- Members may request again after cancel/decline/unfriend, subject to request rate limits. There is no additional per-pair cooldown.
- Friendship grants access to existing as well as future reviews, participation, and plans. Unfriending revokes it on subsequent reads; previously seen information cannot be recalled.

### Blocking

- Blocking removes pending requests and friendships, prevents requests in both directions, and removes friendship-based visibility.
- The pair cannot browse each other through the ordinary member directory/profile views. Blocking does not remove shared catalog entries.
- Owners can view their own blocked list and unblock members. Blocking sends no notification.
- Unblocking removes only that member's block, not a reverse block. It never restores a friendship or pending request automatically.

## 8. Speaker reviews

- Each member can maintain one review per conference, shared across all its editions.
- A review contains recognised structured tags, optional free text, and an optional yes/no “would submit again” recommendation. Repeated tags are deduplicated.
- Authors can create, edit, and delete their own reviews. Admin status does not grant editing or private viewing of others' reviews.
- Reviews are visible only to their author and accepted friends. This applies to historical reviews too.
- Counts, tag totals, return recommendations, card summaries, edition-side speaker intel, and review activity use the same viewer-specific scope. Non-friends' review aggregates must not leak through summaries.
- Review tags cover speaker support, audience, CFP process, personal experience, and organisational concerns; available keys are defined in the frontend/backend constants.

## 9. Dashboard and appearance

- The brand tagline is **{ where speakers swap notes }**, including braces, used in the sign-in screen, desktop app header, page metadata, and sign-in emails.
- The login/verification screen displays a **v0 / early beta** notice warning about bugs and rough edges and welcoming feedback; it remains visible during code entry. The README carries the same warning.
- App branding uses the supplied SVG assets in `visuals/logo/`: full light/dark logos for navigation and sign-in/setup/onboarding, the small mark for the mobile header and dashboard callout, and the simplified favicon for browser tabs. Logo variants follow the app's selected appearance, not just the OS setting. Email branding remains text-based without remote images.
- The footer shows the app version on signed-in and login/verification pages. Development and local builds without version metadata display `version: dev-local`; GitHub Actions builds display `version: dev-HASH`, where HASH is the short commit hash being deployed.
- Login/verification and signed-in pages share footer credits: “A project by Nico Martin · Open source on GitHub”, linking to `https://nico.dev` and `https://github.com/nico-martin/purpleroom/` respectively.
- Open CFPs are active editions whose closing date is today or later and whose opening date is absent or today/past, ordered by deadline. Unknown deadlines are not included.
- CFP rows show edition information, deadline, the viewer's own submissions, and qualifying submitted friends.
- Upcoming plans include up to 20 active editions with the viewer's or eligible friends' manual attendance. The last event day (or first if no last day exists) must be today or later. Entries are ordered by start date.
- “Around the room” shows at most the latest ten catalog additions and viewer-visible review updates, newest first. Catalog-addition activity excludes suspended/blocked authors; the shared catalog itself remains available.
- Activity never exposes submission outcomes, proposal titles, per-member proposal totals, or retired comments.
- Light, Dark, and System appearance modes are browser-specific. The preference survives reload/sign-out in a cookie, not in the member account or local storage. System mode follows OS appearance, and the preference is applied before the app renders.

## 10. Deletion, restoration, and retained data

- Conferences and editions are soft-deleted, not permanently erased through the app. Only admins can delete or restore them.
- A deleted conference makes all its editions unavailable in the ordinary catalog without rewriting their individual deletion markers.
- Restoring a conference reveals its editions except those independently deleted. Restore a parent conference before restoring an edition under it.
- Trash lists entries deleted in the last 90 days. That window is a listing filter, not a scheduled permanent-deletion policy.
- Personal proposals/submissions, reviews, attendance, stored logos, and relationships retain their IDs and links across catalog soft deletion/restoration.
- Existing users receive no automatic friendships during upgrades. Explicit attendance is preserved; submission-derived attendance is not materialised.
- Calendar subscriptions, signup invitations, and conference/edition comments (“Notes from the crew”) are not active features. Their former routes/controls are absent, including old secret calendar feeds and invite acceptance.
- Historical comments, invitation rows/encrypted storage, calendar tokens, abstracts, and compatibility fields remain stored. Removing a UI feature is not permission to erase its underlying data.
- Private proposal notes and admin edition notes remain active; they are not the removed crew-comments feature.

## 11. Essential invariants for future changes

1. Anonymous visitors cannot retrieve member or catalog content.
2. Profile completion precedes member discovery and normal app access.
3. Catalog/account administration is authorised server-side; UI guards alone are insufficient.
4. Admins do not bypass ownership or friendship privacy.
5. Pending, blocked, or suspended relationships grant no friendship-based access.
6. Submission participation counts distinct friends with any non-`interested` submission, never proposals.
7. Attendance remains entirely independent of CFP outcomes.
8. Review aggregates and activity follow the same privacy rules as their source data.
9. Unfriend/block/suspension revoke applicable access, including nested API responses and summaries.
10. The last active admin remains protected; restored accounts cannot reuse sessions invalidated by suspension.
11. Upgrades and feature removals preserve unrelated stored data and identifiers.

Keep these covered by regression tests when changing affected features. They are behavioural contracts, not permission to broaden scope or change policy silently.

## 12. Not currently provided

Calendar subscriptions, signup invitations, crew comments, anonymous browsing, named groups, generic social posts, likes, direct messages, public friend lists, mutual-friend counts, profile fields beyond the current identity/links, an independent notifications system, self-service email/account deletion/export, and abuse-reporting workflows are outside the current product. Adding any requires an explicit product decision and an update here; residual schema/helpers do not imply an active feature.
