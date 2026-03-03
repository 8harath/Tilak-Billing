# UAT Checklist (School Staff)

## A) Login and Access
- Staff can sign in with valid credentials
- Inactive users are blocked with clear error
- Role badge is visible in dashboard

## B) Student Search and Selection
- Search by student name returns expected records
- Search by roll number returns expected records
- Class filter limits results correctly (Pre-Nursery to 10th)

## C) Fee Collection
- Fee structures for selected class are shown
- Custom fee item can be added when needed
- Total amount updates correctly after fee edits
- Payment date and notes are stored

## D) Receipt and Printing
- Receipt number is generated
- A4 receipt has two sections:
  - Management copy (top)
  - Parent copy (bottom)
- Printed output is legible and properly aligned

## E) Offline Mode
- When internet is off, receipt is queued offline
- Pending offline count is visible
- On reconnect, pending items sync successfully

## F) Reports
- Admin/accountant can access collection summary endpoint
- Summary shows totals by fee type, class, and date

## G) Sign-off
- Accountant sign-off
- School admin sign-off
- Date of acceptance
