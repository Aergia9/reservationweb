# Children Pricing Implementation Summary

## Overview
Added support for different pricing for children in the event booking system. This feature allows events and packages to have separate pricing for adults and children.

## Changes Made

### 1. Type Definitions

#### Files Updated:
- `reservationweb/lib/types.ts`
- `clientside/lib/types.ts`

#### Changes:
Added optional children pricing fields to:
- `EventPackage` interface
- `SpecialEvent` interface  
- `FirebaseEvent` interface

```typescript
hasChildrenPrice?: boolean;
childrenPrice?: number;
```

### 2. Admin Event Management (`reservationweb/app/event/page.tsx`)

#### State Management:
- Updated `formData` state to include `hasChildrenPrice` and `childrenPrice` fields
- Updated package array to include children pricing fields per package

#### UI Components:
- Added checkbox "Different Price for Children" for regular events (non-package)
- When checked, shows input field for children price
- Changed "Price per Person" label to "Price per Adult"
- Added children pricing checkbox and input for each package

#### Form Functions:
- `addPackage()`: Initializes new packages with `hasChildrenPrice: false` and `childrenPrice: ""`
- `updatePackage()`: Updated to accept `boolean` values for checkbox fields
- `handleCreate()`: Saves children pricing fields to Firestore for both events and packages
- `handleUpdate()`: Updates children pricing fields in Firestore
- `startEdit()`: Loads children pricing data when editing existing events
- `cancelEdit()`: Resets children pricing fields when canceling

### 3. Client Booking Popup (`clientside/components/event-booking-popup.tsx`)

#### Price Calculation:
- `calculateTotalPrice()`: Updated to calculate prices based on adult/children breakdown
  - For events with children pricing: `(adults × adultPrice) + (children × childrenPrice)`
  - For packages: Returns fixed package price (regardless of adult/child split)
  - For events without children pricing: Uses original calculation

#### Price Display:
- Event details section now shows:
  - If `hasChildrenPrice` is true: Shows "Price per Adult" and "Price per Child" separately
  - If false: Shows "Price: Rp X/person" (original behavior)
- Package details: Shows note "(includes adults & children)" when package has children pricing

#### Button Text:
- `getBookingButtonText()`: Now shows guest breakdown when children pricing is enabled
  - Example: "Pay Now - Rp500,000 (2 adults, 3 children)"

### 4. Client Room Booking Popup (`clientside/components/room-booking-popup.tsx`)

Applied the same changes as `event-booking-popup.tsx`:
- Updated `calculateTotalPrice()` function
- Updated `getBookingButtonText()` function
- Updated price display sections
- Updated selected package details display

## How It Works

### For Administrators:

1. **Creating/Editing Events:**
   - Check "Different Price for Children" checkbox if you want separate children pricing
   - Enter adult price in "Price per Adult" field
   - Enter children price in "Price per Child" field that appears

2. **Creating/Editing Packages:**
   - Each package has its own "Different Price for Children" checkbox
   - When checked, enter the children price for that specific package
   - Package price is the total price for the group (fixed regardless of adult/child split)

### For Customers:

1. **Viewing Event Details:**
   - If children pricing is enabled: See both "Price per Adult" and "Price per Child"
   - If not enabled: See standard "Price: Rp X/person"

2. **Booking Events:**
   - Enter number of adults and children
   - Total price calculated automatically:
     - Events: (adults × adult price) + (children × children price)
     - Packages: Fixed package price
   - Payment button shows breakdown: "Pay Now - Rp X (Y adults, Z children)"

## Database Schema

Events in Firestore now have these additional optional fields:

```javascript
{
  hasChildrenPrice: boolean,
  childrenPrice: number,
  packages: [
    {
      id: string,
      name: string,
      description: string,
      price: number,
      peopleCount: number,
      includes: string[],
      hasChildrenPrice: boolean,
      childrenPrice: number
    }
  ]
}
```

## Backward Compatibility

- All fields are optional, so existing events without children pricing continue to work
- Default behavior (single price for all guests) is preserved when `hasChildrenPrice` is false or undefined
- UI dynamically shows/hides children pricing based on the `hasChildrenPrice` flag

## Testing Checklist

### Admin Side:
- [ ] Create new event with children pricing
- [ ] Create new event without children pricing (checkbox unchecked)
- [ ] Edit existing event to add children pricing
- [ ] Edit existing event to remove children pricing
- [ ] Create package with children pricing
- [ ] Create package without children pricing
- [ ] Verify data saves correctly to Firestore

### Client Side:
- [ ] View event with children pricing - verify both prices display
- [ ] View event without children pricing - verify single price displays
- [ ] Book event with children pricing - verify calculation is correct
- [ ] Book event without children pricing - verify calculation is correct
- [ ] Book package with children pricing - verify fixed price applies
- [ ] Book package without children pricing - verify fixed price applies
- [ ] Verify payment button shows correct breakdown

### Edge Cases:
- [ ] Event with 0 children - should work normally
- [ ] Event with 0 adults - should work normally
- [ ] Package selection with different pricing options
- [ ] Form validation with children pricing enabled
