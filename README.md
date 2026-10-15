# havelok-ar-treasure-trail
Browser-based AR treasure trail for Havelok's Kingdom using A-Frame and MindAR.

<b>A-Frame</b> is a way to describe a 3D scene in HTML. A box, a model, or a light is an entity in a scene. 

<b>MindAR</b> is the tracker. It watches the camera for a printed picture you compiled ahead of time, then tells A-Frame where to place the treasure.

<b>Vite</b> is the development server. It serves the page on your computer, bundles the JavaScript, and later produces the folder you upload. Phone cameras only work on a secure address (https://), so the first page stays on your computer. The Vast Inside subdomain comes after the page actually runs.

<b>localStorage</b> will remember which treasures were collected, in the browser only. No login and no database.

The live site is <b>https://havelok.vastinside.co.uk</b>. GitHub holds the source. GitHub Pages is only a backup copy of the same built files, not a second version you edit by hand.