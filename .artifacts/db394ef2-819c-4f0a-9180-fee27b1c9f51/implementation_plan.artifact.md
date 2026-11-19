# Fix Onboarding and Navigation

## User Review Required

- Removing the bottom menu: I will update the `showBars` logic in `MainNavigation` to ensure it is hidden during onboarding.
- Fixing the network error: I will investigate the Supabase URL and check if there is an issue with the project setup or emulator/device network.
- Transitioning to SwipeableTileScreen: I will verify the navigation destination after onboarding is complete.

## Open Questions

- Is `SwipeableRoleCardDeck` the `SwipeableTileScreen` requested?
- Should I check for specific network configurations in `JobsSupabase.kt`?

## Proposed Changes

### [Navigation]

#### [MODIFY] [Navigation.kt](file:///C:/Users/Admin/Desktop/iq9 Jobs/brevityjobs/app/src/main/kotlin/com/example/brevityjobs/Navigation.kt)

- Update `showBars` logic.

### [Network]

#### [MODIFY] [JobsSupabase.kt](file:///C:/Users/Admin/Desktop/iq9 Jobs/brevityjobs/app/src/main/kotlin/com/example/brevityjobs/data/remote/JobsSupabase.kt)

- Verify the URL and connectivity configuration.

## Verification Plan

### Manual Verification
- Deploy to the device/emulator.
- Complete the onboarding and observe the UI and network status.
