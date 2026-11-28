# Auth, V12 changes

V12 changes the route guard and the end-to-end suite only; registration, login, and rate limiting are unchanged.

- `/invite/{token}` is a Protected_Route. A request without a usable Session_Cookie is redirected to `/login?next=/invite/<token>`, and a Safe_Return_Path may start with `/invite/` (Decision T amended; Glossary).
- The Test_Account `member` is a Board_Member of a seeded Board with a Card assigned to it (`flask seed-data`, Requirement 22 criterion 18).

### Requirement 1 criteria with V12 labels

Criteria of Requirement 1 that V12 changed. Each line is the full V1 to V11 criterion followed by its V12 label; the label wins.

31. [AUTH-E2E-SO-03] WHEN a Test_Account has signed out and the visitor opens a Protected_Route, THE Frontend SHALL redirect to `/login` (Decision P). (V12: `/invite/{token}` is a Protected_Route too.)
33. [AUTH-E2E-SO-05] IF a visitor without a Session_Cookie opens a Protected_Route, THEN THE Frontend SHALL redirect to `/login` before the page renders (Decision P). (V12: `/invite/{token}` is a Protected_Route too; the redirect carries the Safe_Return_Path.)
37. THE E2E_Auth_Suite SHALL give every test a title that begins with the stable ID of the criterion it verifies, and SHALL contain exactly one test per ID in criteria 19 to 36, 39 to 42, 55, and 56. (V12: criteria 65 to 71 add tests; see criterion 72.)
59. [TOK-03] WHEN login succeeds, THE Frontend SHALL navigate to the Safe_Return_Path given in `next`, and to `/boards` when `next` is absent or is not a Safe_Return_Path. (V12: a Safe_Return_Path may also start with `/invite/`.) (Default destination superseded by Requirement 73, V18: R8-03.)
64. [USR-14] WHEN the seed commands `flask seed-users` and `flask seed-data` create a user, THE Backend SHALL set `username`, `email`, and `full_name` on it for every seeded user: the Member, Supervisor, Manager, and Admin of `seed-users`, and `member2` and `supervisor2` of `seed-data`, using the Username `<key>`, the Email `<key>@example.com`, and a two-word full name such as "Member One"; the Member `member` is the Test_Account of the E2E_Auth_Suite (`E2E_USER_IDENTIFIER=member`). Running a seed command twice SHALL create no duplicate (Decision V). (V12: `flask seed-data` also seeds the Boards, Board_Members, and Card of Requirement 22, criterion 18.)

### Requirement 1 criteria added (V12 end-to-end additions)

65. [AUTH-E2E-V12-01] IF a visitor without a Session_Cookie opens `/invite/e2e-unknown-token`, THEN THE Frontend SHALL redirect to `/login` and carry `/invite/e2e-unknown-token` in the `next` query parameter (Requirement 24, criterion 22; Decision P as amended in V12).
66. [AUTH-E2E-V12-02] WHEN a visitor arrives on `/login?next=/invite/e2e-unknown-token` and signs in as the Test_Account, THE Frontend SHALL navigate to `/invite/e2e-unknown-token` and show the message that the invite link is not valid (Requirement 24, criteria 22 and 25; this uses an unknown token, so the suite creates no data).
67. [AUTH-E2E-V12-03] WHEN any visitor opens `/shared/e2e-unknown-token`, THE Frontend SHALL show the page that says the link is not valid and offers a Sign in link (Requirement 18, criterion 23, Public_Link of Requirement 23).
68. [AUTH-E2E-V12-04] WHILE a Test_Account is signed in, THE Frontend SHALL show on `/boards` no lock icon and no element whose accessible name contains "private" or "public" (Requirement 22, criterion 14).
69. [AUTH-E2E-V12-05] WHILE a Test_Account (a Member who is a BoardMember of a seeded Board) is on that Board's page, THE Frontend SHALL show no "Invite" button, no "Public link" button, and no add-member button in the Sidebar Team members heading (Requirement 22, criterion 16; Requirement 23, criterion 9; Requirement 24, criterion 19).
70. [AUTH-E2E-V12-06] WHILE a Test_Account has a Card modal open on a seeded Board, THE Frontend SHALL show no button named "Save changes" and, because a Member may not archive or delete a Card, neither Archive nor Delete (Requirement 25, criterion 1; Requirement 4, criterion 7).
71. [AUTH-E2E-V12-07] WHILE the viewport is 1280 pixels wide, THE Frontend SHALL show the Profile_Page avatar card and change-password card side by side (the change-password card's left edge is right of the avatar card's right edge and their tops are within 8 pixels); WHILE the viewport is 360 pixels wide, THE Frontend SHALL stack them (Requirement 29, criteria 1 and 2).
72. [AUTH-E2E-V12-08] THE E2E_Auth_Suite SHALL give each test of criteria 65 to 71 a title that begins with its ID, SHALL contain exactly one test per ID, SHALL create no data and change no account (criterion 15), and SHALL treat criteria 69 and 70 as skipped with a named reason when the Test_Account's Home lists no Board, because `flask seed-data` makes the Test_Account `member` a BoardMember of a seeded Board with a Card (Requirement 22, criterion 18).
