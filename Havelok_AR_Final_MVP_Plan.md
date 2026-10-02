# Havelok's Kingdom AR Treasure Trail
## Final MVP Plan

**Project:** Havelok's Viking Treasure Trail  
**MVP goal:** Deliver a reliable, simple, browser-based AR treasure trail that improves on the previous prototype while reusing the existing Havelok treasure content.

---

## 1. Recommended Build Approach

Use a **data-driven static web app**, not a fully dynamic backend system.

### Recommended stack

- **A-Frame** for the AR scene and 3D entity structure
- **MindAR** for image target tracking
- **JavaScript** for interaction and game logic
- **GLB / GLTF** for 3D treasure models
- **localStorage** for visitor progress
- **Vite** for development and production builds
- **Vast Inside hosting** as the primary production host
- **GitHub Pages** as a backup mirror only
- **Service Worker** for offline caching of critical files

### Why data-driven

The treasure content should be controlled from one configuration file instead of hard-coding each treasure into separate logic.

Example:

```js
export const treasures = [
  {
    id: "axe",
    name: "Viking Axe",
    targetIndex: 0,
    model: "/models/axe.glb",
    fact: "Short approved visitor text.",
    enabled: true
  },
  {
    id: "helmet",
    name: "Viking Helmet",
    targetIndex: 1,
    model: "/models/helmet.glb",
    fact: "Short approved visitor text.",
    enabled: true
  }
];
```

This makes it easier to replace models, change wording, disable a treasure, or add future treasures without rewriting the whole application.

**Important:** adding a completely new AR image target will still require the MindAR target file to be recompiled. The model and text can be changed independently.

---

## 2. MVP Objective

A visitor should be able to:

1. Scan one QR code.
2. Understand the trail without staff explanation.
3. Start the AR camera.
4. Find any of the five Viking treasure targets.
5. See the matching treasure appear in AR.
6. Collect the treasure.
7. Keep progress if the page is refreshed or reopened.
8. Continue even if AR tracking is difficult.
9. Complete all five treasures.
10. Reach a polished final completion screen.

The MVP is successful if the full journey works reliably on common mobile devices without requiring an app installation or account.

---

## 3. Visitor Journey

```text
Physical QR Code
      |
      v
Welcome Screen
      |
      v
How to Play
      |
      v
Start Camera
      |
      v
Find Viking Target
      |
      v
MindAR Detects Artwork
      |
      v
Treasure Appears in AR
      |
      v
Collect Treasure
      |
      v
Progress Saved Locally
      |
      v
Repeat Until 5 / 5
      |
      v
Completion Screen
      |
      v
Technical AR development by Vast Inside Ltd
```

---

## 4. Treasure Content

The MVP will use the five existing Havelok treasure items:

1. Viking Axe
2. Viking Helmet
3. Viking Horn
4. Viking Bowl
5. Viking Spoon

The visitor does **not** need to find them in a fixed order.

Example progress:

```text
Treasures Found

✓ Axe
○ Helmet
✓ Horn
○ Bowl
○ Spoon

2 / 5
```

---

## 5. Welcome Screen

The first screen should be simple and Havelok-focused.

Suggested structure:

```text
HAVELOK'S KINGDOM

Viking Treasure Trail

Five Viking treasures are hidden around the trail.
Find the Viking images, point your camera at them,
and collect all five treasures.

0 / 5 Treasures Found

[ Start the Trail ]

How to Play
Reset Trail
```

Do not place prominent Vast Inside branding on the welcome screen.

---

## 6. How to Play

Keep instructions to three steps:

1. Find a Viking Treasure sign.
2. Point the phone camera at the artwork.
3. Discover and collect the treasure.

Then show:

**[ Start Camera ]**

Camera permission should only be requested after the visitor chooses to begin.

---

## 7. AR Tracking Improvement

### Previous prototype

```text
Pattern Marker (.patt)
        |
        v
AR.js
        |
        v
AR Content
```

### New prototype

```text
Designed Viking Artwork
        |
        v
MindAR Image Tracking
        |
        v
A-Frame AR Content
```

The purpose of the rebuild is not to replace A-Frame. The main improvement is replacing the old pattern-marker tracking approach with image-target tracking and cleaner application logic.

---

## 8. Treasure Interaction

When a target is recognised:

```text
Target Detected
      |
      v
Treasure Model Appears
      |
      v
Small Rotation / Animation
      |
      v
Treasure Name + Short Approved Fact
      |
      v
[ Collect Treasure ]
```

On collection:

```text
Treasure Found!
      |
      v
Progress Updated
      |
      v
1 / 5
```

Sound may be used as a small enhancement, but it must not be required for the experience.

---

## 9. Tracking Loss Behaviour

The treasure should not instantly disappear because the camera briefly loses the target.

Expected behaviour:

```text
Target Found
      |
      v
Show Treasure
      |
      v
Brief Tracking Loss
      |
      v
Keep Treasure Visible
      |
      v
Target Returns
```

If the target is genuinely lost for longer, the experience should smoothly return to the scanning state.

Do not show technical messages such as "marker lost".

Use visitor-friendly guidance such as:

> Move your camera slowly towards the Viking image.

---

## 10. AR Fallback

Tracking failure must not block the visitor.

If the target cannot be recognised after a reasonable attempt, show:

```text
Having trouble finding the treasure?

[ Keep Trying AR ]
[ View Treasure ]
```

**View Treasure** should open the same 3D model in a normal interactive viewer so the visitor can still collect it.

This ensures the trail remains usable on older devices or in difficult lighting.

---

## 11. Progress Saving

Use **localStorage** only.

Store whether each treasure has been collected.

Example:

```json
{
  "axe": true,
  "helmet": false,
  "horn": true,
  "bowl": false,
  "spoon": false
}
```

Benefits:

- no account
- no database
- no login
- no personal data collection
- progress survives refresh
- progress can survive reopening the page on the same browser

Include a **Reset Trail** option.

---

## 12. Completion Screen

When all five treasures are collected:

```text
TREASURE TRAIL COMPLETE!

You found all five of Havelok's lost Viking treasures.

✓ Axe
✓ Helmet
✓ Horn
✓ Bowl
✓ Spoon

Well done, Viking Explorer!
```

Use approved Havelok or Grim artwork.

At the bottom only:

```text
Technical AR development by

[Vast Inside Logo]

Vast Inside Ltd
```

The credit should remain secondary to Havelok branding.

---

## 13. Dynamic Content Design

The app should be designed so content can be changed from one configuration file.

Each treasure record should contain:

- unique ID
- display name
- model path
- target index
- short visitor text
- enabled / disabled state
- optional scale and position
- optional animation
- optional fallback image

This allows future changes without changing the core tracking or progress code.

### What can be changed easily

- replace a 3D model
- change treasure name
- change visitor text
- enable or disable a treasure
- change model scale or position
- change display order
- add another configured treasure

### What still requires build work

- adding a brand-new image target
- recompiling the MindAR `.mind` target file
- changing core AR behaviour
- adding a new interaction type

This is the right level of flexibility for the MVP. A database or CMS is not required.

---

## 14. Suggested Project Structure

```text
havelok-ar/
|
|-- index.html
|-- package.json
|-- vite.config.js
|
|-- public/
|   |-- models/
|   |   |-- axe.glb
|   |   |-- helmet.glb
|   |   |-- horn.glb
|   |   |-- bowl.glb
|   |   `-- spoon.glb
|   |
|   |-- targets/
|   |   `-- havelok-targets.mind
|   |
|   |-- images/
|   |   |-- havelok-logo.webp
|   |   |-- grim.webp
|   |   `-- vast-inside-logo.webp
|   |
|   `-- audio/
|
`-- src/
    |-- main.js
    |-- styles.css
    |
    |-- config/
    |   `-- treasures.js
    |
    |-- ar/
    |   `-- tracker.js
    |
    |-- game/
    |   |-- progress.js
    |   `-- treasure-manager.js
    |
    `-- ui/
        `-- interface.js
```

---

## 15. Hosting and Resilience

### Primary

```text
https://havelok.vastinside.co.uk
```

### Backup

A mirrored GitHub Pages deployment.

Visitors should use the Vast Inside URL. GitHub exists only as a backup copy.

### Deployment principle

```text
Source Code
    |
    v
Production Build
    |
    +----> Vast Inside
    |
    `----> GitHub Backup
```

Both hosts must receive the **same build**.

Do not manually maintain two different versions.

---

## 16. Offline Support

Use a Service Worker to cache critical production assets after first load:

- HTML
- CSS
- JavaScript
- A-Frame
- MindAR
- compiled target file
- five treasure models
- essential images
- essential audio

This reduces the impact of temporary Wi-Fi or mobile-network problems during the event.

---

## 17. Development Plan

### Phase 1: Foundation

Set up:

- Vite
- A-Frame
- MindAR
- project structure
- Vast Inside test hosting
- HTTPS
- basic landing page

**Pass condition:** the test page loads and camera access works from the hosted URL.

### Phase 2: Axe Vertical Slice

Build only the Viking Axe experience:

```text
Welcome
  |
  v
Instructions
  |
  v
Camera
  |
  v
Axe Target
  |
  v
Axe AR Model
  |
  v
Collect
  |
  v
1 / 5
```

Do not build the remaining four treasures until this works well.

### Phase 3: Tracking Validation

Test the Axe target on:

- modern iPhone
- older iPhone if available
- Samsung Android
- lower-cost Android
- bright light
- normal indoor light
- lower light
- straight-on target
- angled target
- partially covered target
- multiple viewing distances

Check:

- recognition speed
- tracking stability
- target reacquisition
- visible jitter
- UI behaviour
- progress saving
- fallback behaviour

### Phase 4: Add Remaining Treasures

After the Axe prototype passes:

- Helmet
- Horn
- Bowl
- Spoon

Use the same reusable treasure system rather than separate custom code for each item.

### Phase 5: Complete Visitor Flow

Connect:

```text
Welcome
  |
  v
AR Trail
  |
  v
Collect Any Treasure
  |
  v
Progress
  |
  v
5 / 5
  |
  v
Completion Screen
```

### Phase 6: Failure Testing

Test deliberately:

- internet disconnected after first load
- camera permission denied
- target not recognised
- target partly covered
- refresh after collection
- duplicate collection
- browser closed and reopened
- fallback used instead of AR
- reset trail

The visitor must never become permanently stuck.

### Phase 7: Julia Preview

Deploy a test version such as:

```text
https://havelok-test.vastinside.co.uk
```

Provide a printable target and ask Julia to test the experience as a visitor.

Approval should cover:

- Havelok branding
- treasure artwork
- short visitor text
- final completion wording
- Grim / Havelok imagery
- Vast Inside technical credit

### Phase 8: Production Freeze

After approval:

- create production version `v1.0.0`
- deploy the same build to Vast Inside and GitHub backup
- stop adding features
- only fix bugs, tracking, compatibility, content errors, or critical usability issues

---

## 18. MVP Acceptance Criteria

The MVP is ready when:

- the main QR opens the production experience
- camera permission works on supported browsers
- all five targets can be recognised
- treasure models load correctly
- brief tracking loss does not cause obvious flickering
- each treasure can only be collected once
- progress persists after refresh
- treasures can be collected in any order
- the non-AR fallback works
- reset works
- 5 / 5 opens the completion screen
- Vast Inside credit appears only on the final page
- the production build works from Vast Inside hosting
- the same build exists on the backup host
- no serious JavaScript errors remain during normal use

---

## 19. Out of Scope for MVP

Do not include:

- user accounts
- login
- backend database
- CMS
- leaderboard
- multiplayer
- GPS tracking
- native Android or iOS app
- App Store or Play Store release
- advanced analytics dashboard
- AI character
- social sharing
- photo capture
- complicated mini-games
- admin portal

These can be considered later if separately requested.

---

## 20. Final MVP Definition

The final MVP is:

> A browser-based Havelok Viking Treasure Trail using A-Frame and MindAR, with five reusable treasure experiences, image-target tracking, 3D Viking objects, collection progress saved locally, graceful tracking-loss behaviour, a non-AR fallback, Vast Inside primary hosting, backup deployment, offline caching, and a polished final Havelok completion page carrying a small Vast Inside technical-development credit.

The MVP should improve reliability and maintainability without turning the project into a large software platform.
