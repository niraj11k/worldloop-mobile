An uninstall usually cannot be detected reliably, so WordLoop should not depend on detecting the uninstall event. Instead, treat guest data according to where it is stored: local-only guest data disappears with the app, while server-side guest data requires an expiry and deletion process. Supabase currently does not automatically clean up anonymous users, so you must implement cleanup yourself.[1][2]

## Recommended policy

Use this model:

| Data type | Storage | What happens on uninstall |
|---|---|---|
| Current unfinished game | Device only | Deleted when app data is removed |
| Local settings | Device only | Deleted with app data |
| Guest scores | Optional server record | Deleted after an inactivity period |
| Guest discovered words | Optional server record | Deleted with guest profile |
| Linked account data | Server | Retained until account deletion is requested |
| Anonymous analytics | Analytics system | Retained only according to your privacy policy |

## Best v1 approach

For the initial version, keep most guest data local:

```text
Guest user
   ↓
Local device storage
   ├── Game history
   ├── Scores
   ├── Settings
   └── Discovered words
```

This means WordLoop does not need to identify an uninstall, and there is little server-side personal data to clean up.

When the user creates an account, migrate the local data to the account:

```text
Local guest data
       ↓
User taps Save Progress
       ↓
Account created
       ↓
Guest data linked to account
       ↓
Local temporary data removed or marked as migrated
```

This is the most privacy-preserving design for a casual game.

## If guest data is stored server-side

If you want server-side analytics, cross-device recovery, or cloud backup before account creation, create an anonymous guest record with:

```text
GuestProfile
------------
guest_id
created_at
last_seen_at
last_game_at
data_expiry_at
is_linked
linked_user_id
```

Set a retention period, such as:

```text
Delete anonymous guest data after 90 days of inactivity.
```

The 90-day period is a product policy suggestion, not a universal legal requirement. Choose and document a period based on the purpose of the data and applicable privacy obligations.

A scheduled cleanup job should delete:

1. Anonymous authentication users that have expired.
2. Guest game sessions.
3. Guest scores.
4. Guest vocabulary records.
5. Guest analytics records where deletion is appropriate.

Supabase documents that anonymous users currently require your own deletion process, including scheduled SQL cleanup.[1]

## Supabase cleanup example

A simplified database cleanup process could look like:

```sql
delete from guest_game_moves
where guest_id in (
  select guest_id
  from guest_profiles
  where is_linked = false
    and last_seen_at < now() - interval '90 days'
);

delete from guest_game_sessions
where guest_id in (
  select guest_id
  from guest_profiles
  where is_linked = false
    and last_seen_at < now() - interval '90 days'
);

delete from guest_profiles
where is_linked = false
  and last_seen_at < now() - interval '90 days';
```

If you use Supabase Auth anonymous users, also clean up the corresponding authentication records through a secure server-side process. Do not expose service-role credentials in the mobile app.[1]

## Do not promise deletion on uninstall

Your privacy policy should say something like:

> WordLoop does not receive a reliable uninstall notification. Guest data stored only on your device is removed when the app’s data is removed. Anonymous server-side data may be retained for up to 90 days after inactivity and then automatically deleted. Account-linked data remains until the user requests account deletion, subject to legally required retention.

This is more accurate than saying “all data is deleted when you uninstall.”

## Account deletion

Once a guest converts to an account, uninstalling the app should not delete the account automatically. The user may reinstall the app and expect their progress to remain.

Provide:

```text
Settings
  → Account
  → Delete account and data
```

If WordLoop supports account creation, Apple requires users to be able to initiate deletion of the account and associated data within the app, including automatically generated guest accounts.[3][4]

Google Play requires an in-app account-deletion path and a web resource where users can request account and associated-data deletion.[5]

Account deletion should remove:

- User profile.
- Saved words.
- Scores and game history.
- Preferences associated with the account.
- Guest data that was linked to it.
- Authentication record.
- Personal identifiers not legally required to retain.

The app should explain what will be deleted and require confirmation.

## Account deletion wireframe

```text
┌────────────────────────────────┐
│        Delete your account     │
│                                │
│ This will permanently delete:  │
│ • Scores and game history      │
│ • Saved vocabulary words       │
│ • Account settings             │
│ • Your WordLoop account        │
│                                │
│ This action cannot be undone.  │
│                                │
│     [ Cancel ] [ Delete ]      │
└────────────────────────────────┘
```

After confirmation:

```text
Your deletion request has been received.

Your account and associated data will be deleted.
You have been signed out.

[ Return to WordLoop ]
```

If deletion is asynchronous, show the expected processing time and send confirmation through the available contact method. Apple specifically advises informing users when deletion takes additional time.[3]

## Guest deletion controls

Although guest data may expire automatically, provide a manual option:

```text
Settings
  → Privacy
  → Delete guest data
```

Display:

```text
Delete guest data?

This removes local scores, game history,
settings, and discovered words from this device.

[ Cancel ] [ Delete Guest Data ]
```

If server-side guest data exists, the action should also request deletion of that record.

## Reinstallation behaviour

### Local-only guest data

```text
Uninstall
   ↓
App data removed
   ↓
Reinstall
   ↓
New guest profile
```

The user should not expect old local progress to return.

### Server-side anonymous guest data

```text
Uninstall
   ↓
No reliable uninstall event
   ↓
Guest record remains temporarily
   ↓
Cleanup job checks inactivity
   ↓
Expired guest data deleted
```

### Linked account

```text
Uninstall
   ↓
Account remains
   ↓
Reinstall and sign in
   ↓
Progress restored
```

This distinction should appear in your privacy policy and, where relevant, in the account-conversion screen.

## Recommended WordLoop decision

For v1, I recommend:

- Keep guest gameplay data local by default.
- Store only minimal anonymous analytics server-side.
- Do not create a server-side anonymous account unless a feature requires it.
- Offer account creation after the first completed game to save progress.
- Delete unlinked server-side guest data after a documented inactivity period.
- Provide “Delete guest data” in Settings.
- Provide in-app account deletion for registered users.
- Provide a web deletion request page for Google Play compliance.
- Do not claim that uninstall itself deletes all cloud data.

This keeps WordLoop technically simple, reduces privacy risk, and avoids storing unnecessary guest information.

Sources
[1] Anonymous Sign-Ins | Supabase Docs https://supabase.com/docs/guides/auth/auth-anonymous
[2] 在Supabase中使用UUID跟踪免费未认证用户的最佳实践咨询 https://www.volcengine.com/article/48038
[3] Offering account deletion in your app - Support https://developer.apple.com/support/offering-account-deletion-in-your-app/
[4] Account deletion within apps required starting January 31 https://developer.apple.com/news/?id=mdkbobfo
[5] Understanding Google Play's app account deletion ... https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
[6] Account deletion within apps - Upcoming Requirements https://developer.apple.com/news/upcoming-requirements/?id=06302022b
[7] Apple's Requirement for In-App Deletion of Accounts https://www.termsfeed.com/blog/apple-requirement-in-app-deletion-accounts/
[8] Understand and control the personal information that you ... https://support.apple.com/en-nz/102283
[9] Apple's Requirement for In-App Account Deletion - Privacy Policies https://www.privacypolicies.com/blog/apple-requirement-in-app-account-deletion/
[10] Apple requires account deletion within apps in AppStore starting ... https://news.ycombinator.com/item?id=28776960
