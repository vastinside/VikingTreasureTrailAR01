# Havelok's Kingdom AR Treasure Trail
## Final MVP Plan

**Project:** Havelok's Viking Treasure Trail  
**MVP goal:** Deliver a reliable, simple, browser-based AR treasure trail that improves on the previous prototype while reusing the existing Havelok treasure content.

---

## 1. Recommended Build Approach

Use a **data-driven static web app**, not a fully dynamic backend system.

### Recommended stack

- **MindAR** to recognise the printed Viking artwork through the camera
- **A-Frame** for the camera scene, and for the 3D viewer inside the discovery panel
- **An HTML discovery panel** for what the visitor actually watches
- **JavaScript** for interaction and game logic
- **GLB / GLTF** for 3D treasure models
- **MP4, WebM, and MOV** for video stops, including transparent video where required
- **WebP** for still-image stops and branding
- **MP3** for optional voice
- **localStorage** for visitor progress
- **Vite** for development and production builds
- **Vast Inside hosting** as the primary production host
- **GitHub Pages** as a backup mirror only
- **A preparing screen plus a Service Worker** so a slow or dropped connection does not stall the trail

### How recognition and display are split

The camera only answers which printed picture is in view. It does not carry the treasure.

```text
Printed artwork
      |
      v
MindAR recognises it
      |
      v
Discovery panel opens on the screen
      |
      v
Video, still image, or 3D model
plus name, short text, and voice if a file exists
```

The video, photo, or 3D model stays on that panel. It is not placed on the printed picture. A 3D stop can be turned with a finger inside the panel. A-Frame draws that viewer. The model is not parented to the MindAR target, so tracking jitter does not shake it.

### Why data-driven

The treasure content should be controlled from one configuration file instead of hard-coding each treasure into separate logic.

Example:

```js
export const treasures = [
  {
    id: "axe",
    name: "Viking Axe",
    targetIndex: 0,
    kind: "model",
    src: "/models/axe.glb",
    fact: "Short approved visitor text.",
    voice: "/audio/axe.mp3",
    enabled: true
  },
  {
    id: "helmet",
    name: "Viking Helmet",
    targetIndex: 1,
    kind: "model",
    src: "/models/helmet.glb",
    fact: "Short approved visitor text.",
    enabled: true
  }
];
```

`kind` is `"model"`, `"image"`, or `"video"`. `voice` is omitted when that stop has no sound. The five Havelok treasures ship as `"model"`. A later stop can be a video or a still image without a second app, and progress saving treats every kind the same way.

A video that must show the camera through empty pixels also supplies the transparent pair:

```js
{
  id: "longship",
  name: "Longship",
  targetIndex: 5,
  kind: "video",
  src: "/videos/longship.mp4",
  srcWebm: "/videos/longship.webm",
  srcMov: "/videos/longship.mov",
  fact: "Short approved visitor text.",
  voice: "/audio/longship.mp3",
  enabled: true
}
```

`src` is the solid H.264 fallback. `srcWebm` is VP9 with alpha for Android and desktop Chrome. `srcMov` is HEVC with alpha for iPhone. Stops that do not need transparency omit `srcWebm` and `srcMov`.

**Important:** adding a completely new printed target still requires the MindAR target file to be recompiled. The panel media, text, and voice can be changed independently.

---

## 2. MVP Objective

A visitor should be able to:

1. Scan one QR code.
2. Understand the trail without staff explanation.
3. Wait on a clear preparing screen while the trail files download.
4. Start the AR camera.
5. Find any of the five Viking treasure targets.
6. See a steady discovery panel with the matching video, image, or 3D model, the name, a short fact, and a voice if that stop has one.
7. Collect the treasure.
8. Keep progress if the page is refreshed or reopened.
9. Continue even if AR tracking is difficult.
10. Complete all five treasures.
11. Reach a polished final completion screen.

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
Start
      |
      v
Preparing Screen (download trail files)
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
Discovery Panel (video, image, or 3D model + text + optional voice)
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

The MVP will use the five existing Havelok treasure items, each as a 3D model on the discovery panel:

1. Viking Axe
2. Viking Helmet
3. Viking Horn
4. Viking Bowl
5. Viking Spoon

The visitor does **not** need to find them in a fixed order.

The same panel must also be able to show a still image or a video when a treasure record uses that `kind`. The five Havelok items do not have to ship as videos. The panel code must not assume every stop is a `.glb`.

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
3. Discover and collect the treasure on the screen.

Then show:

**[ Start Camera ]**

That tap is the visitor gesture iPhone requires before sound or video may play. Unlock audio in the click itself, then show the preparing screen, then ask for the camera. Camera permission should only be requested after the visitor chooses to begin.

---

## 7. AR Tracking Improvement

### Previous prototype

```text
Pattern Marker (.patt)
        |
        v
AR.js recognises the pattern
        |
        v
A floating screen panel (video or photo)
```

The old markers were empty. Video and photos were HTML panels, not objects on the paper. Photos and titles disappeared as soon as the pattern flickered. All videos were loaded together. Two clips were WebM, which iPhone does not play, and one page path pointed at a `.webm` while the file on disk was `.mp4`.

### New prototype

```text
Designed Viking Artwork
        |
        v
MindAR recognises the picture
        |
        v
One discovery panel stays on screen
```

MindAR replaces pattern-marker recognition. The panel replaces the old one-off video and photo handlers. Panel content is not parented to the image target.

---

## 8. Discovery Panel

When a target is recognised, open one panel and keep it up. Use the same panel for every treasure.

```text
Target Detected
      |
      v
Panel opens and stays open
      |
      v
model, image, or video
      |
      v
Treasure Name + Short Approved Fact
      |
      v
Voice, if this stop has an audio file
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

Closing the panel without collecting returns the visitor to scanning. The find is not saved.

### Media rules

- One panel. Do not put a separate `<video>` in the page for every stop. Set the file only for the stop just found.
- `kind: "model"` shows the `.glb` in an A-Frame viewer inside the panel.
- `kind: "image"` shows one picture (`.webp`).
- `kind: "video"` shows one `<video>` with `playsinline`. Wait until the clip has buffered before revealing it. Show a spinner while it buffers.
- Solid video is H.264 `.mp4` with AAC audio. Do not use `.webm` for a solid clip. iPhone Safari does not play WebM.
- Voice is optional. If `voice` is missing, the panel still works. Use a short `.mp3`. Play it from the gesture unlocked by **Start Camera**, not as the first `play()` call of the visit.
- Sound must not be required to collect a treasure.

### Transparent video

A normal `.mp4` is a solid rectangle. See-through pixels need a real alpha channel in the file. The old trail clips are `yuv420p` and have no alpha, so they cannot be made transparent later.

When a stop needs the camera to show through the empty pixels, publish both:

| Device | File | Format |
| --- | --- | --- |
| Android and desktop Chrome | `srcWebm` | VP9 with alpha |
| iPhone | `srcMov` | HEVC with alpha |

The panel still has one `<video>`. The WebM source is listed first. Chrome plays it. iPhone skips WebM and plays the MOV. The panel background stays clear. A stop with only `src` is shown as a solid video.

---

## 9. Tracking Loss Behaviour

Before a match, a brief miss stays in the scanning state.

Visitor-friendly guidance:

> Move your camera slowly towards the Viking image.

Do not show technical messages such as "marker lost".

After a match, the panel stays until the visitor collects the treasure or closes the panel. A flicker, a covered corner, or a few seconds away from the picture must not clear the video, image, model, text, or voice. This is the fix for the old trail, which hid photos and titles on every `markerLost`.

```text
Target Found
      |
      v
Panel stays open
      |
      v
Brief or longer tracking loss
      |
      v
Panel stays open
      |
      v
Visitor collects or closes
```

---

## 10. AR Fallback

Tracking failure must not block the visitor.

If the target cannot be recognised after a reasonable attempt, show:

```text
Having trouble finding the treasure?

[ Keep Trying AR ]
[ View Treasure ]
```

**View Treasure** opens the same discovery panel for that stop, without a scan, so the visitor can still watch the model, image, or video and collect it.

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

Progress does not depend on `kind`. A video stop, an image stop, and a model stop are saved the same way.

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
- `kind`: `model`, `image`, or `video`
- media path (`src`)
- optional `srcWebm` and `srcMov` when the video has transparency
- target index
- short visitor text
- enabled / disabled state
- optional voice path
- optional scale inside the 3D viewer
- optional poster image for a video stop

This allows future changes without changing the core tracking or progress code.

### What can be changed easily

- replace a 3D model, image, or video
- add or remove a voice file
- add the transparent WebM and MOV pair
- change treasure name
- change visitor text
- enable or disable a treasure
- change display order
- add another configured treasure of any kind

### What still requires build work

- adding a brand-new image target
- recompiling the MindAR `.mind` target file
- changing core panel or tracking behaviour
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
|   |-- videos/
|   |-- images/
|   |   |-- havelok-logo.webp
|   |   |-- grim.webp
|   |   `-- vast-inside-logo.webp
|   |
|   |-- audio/
|   |
|   `-- targets/
|       `-- havelok-targets.mind
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
        |-- interface.js
        `-- panel.js
```

`public/videos/` holds `.mp4`, and the `.webm` / `.mov` pair when a clip is transparent. `panel.js` is the one screen that shows a model, an image, or a video.

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

## 16. Preparing the Trail and Offline Support

The first visit must not start downloading a large file at the moment of a scan.

After the visitor taps start:

```text
Unlock audio from that tap
      |
      v
Preparing the trail…  (progress line)
      |
      v
Download the MindAR target and each enabled stop's media
      |
      v
Open the camera
```

Keep files small enough to finish on venue Wi-Fi:

- solid video: short H.264 `.mp4`, about a few megabytes, 720p, AAC audio
- transparent video: the WebM and MOV pair, still kept as short as the artwork allows
- photos: `.webp`
- voice: short `.mp3`, not `.wav`
- models: compressed `.glb`

Then use a Service Worker to keep that copy for the next open and for a Wi-Fi drop during the event:

- HTML
- CSS
- JavaScript
- A-Frame
- MindAR
- compiled target file
- each enabled stop's model, image, or video
- essential branding images
- essential audio

The preparing screen covers the first download. The service worker covers every visit after that.

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
Preparing screen
  |
  v
Camera
  |
  v
Axe Target recognised
  |
  v
Panel shows the axe model, name, and fact
  |
  v
Collect
  |
  v
1 / 5
```

The panel stays up if tracking drops. Do not build the remaining four treasures until this works well. The panel should already accept `kind`, even though this slice only uses `model`.

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
- the panel stays up across tracking loss
- target reacquisition does not open a second panel
- UI behaviour
- progress saving
- preparing screen on a slow connection
- fallback behaviour

### Phase 4: Add Remaining Treasures

After the Axe prototype passes:

- Helmet
- Horn
- Bowl
- Spoon

Use the same panel and the same treasure record. Add an image stop and a video stop only when those assets exist, including a transparent pair if that video needs alpha. Prove video on an iPhone with an H.264 `.mp4` before relying on it, and prove transparent playback with the WebM and MOV pair on Android and iPhone.

### Phase 5: Complete Visitor Flow

Connect:

```text
Welcome
  |
  v
Preparing
  |
  v
Camera
  |
  v
Panel for any treasure
  |
  v
Collect
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

- internet disconnected after the preparing screen has finished
- slow network during the preparing screen
- camera permission denied
- target not recognised
- target partly covered after the panel is open
- refresh after collection
- duplicate collection
- browser closed and reopened
- fallback used instead of AR
- a video stop on iPhone
- a transparent video on iPhone and on Android
- a stop with no voice file
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
- the preparing screen finishes before the camera opens, and shows progress
- camera permission works on supported browsers
- all five targets can be recognised
- each match opens one discovery panel and does not attach the media to the printed picture
- the five Havelok models load in that panel
- the same panel can show an image stop and a video stop from the treasure config
- a solid video is H.264 `.mp4` and plays on iPhone after the start tap, once buffered
- a transparent stop plays alpha WebM on Android and alpha HEVC MOV on iPhone
- a missing voice file does not block the stop
- brief or longer tracking loss does not close the panel
- each treasure can only be collected once
- progress persists after refresh
- treasures can be collected in any order
- the non-AR fallback opens the same panel
- reset works
- 5 / 5 opens the completion screen
- Vast Inside credit appears only on the final page
- the production build works from Vast Inside hosting
- the same build exists on the backup host
- a second visit uses the cached files
- no serious JavaScript errors remain during normal use

---

## 19. Out of Scope for MVP

Do not include:

- placing the video, image, or 3D model onto the printed picture
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

> A browser-based Havelok Viking Treasure Trail. MindAR recognises the printed artwork. A steady on-screen panel then shows a 3D model, a still image, or a video, with the treasure name, a short fact, and a voice when a sound file exists. Transparent video uses a WebM alpha file and an iPhone HEVC alpha file. The five Havelok treasures are 3D models on that panel. Progress is saved locally. A preparing screen and a service worker cover slow and dropped connections. Vast Inside hosts the primary build, a backup host receives the same build, and the final Havelok completion page carries a small Vast Inside technical-development credit.

The MVP should improve reliability and maintainability without turning the project into a large software platform.
