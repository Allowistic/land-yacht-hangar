# Land Yacht Bay 04

WebXR observation bay inside a land yacht rolling across an alien desert at sunset.

Live: https://cd8522d0ff60.cookiejar.lol/

The cabin stays still. Outside the window, the scenery is painted in flat layers like an old cartoon background: a sunset sky and sun, far mountains, a nearer range, mesas, dunes, a foreground ridge and sand streaks. The layers slide sideways past the window at different speeds (far ones crawl, near ones race) and never change height, so nothing comes up through the floor.

## Controls

- **Phone / tablet:** left stick walks, right stick looks, or drag anywhere else on the screen to look. Tap anywhere (or the music button) to start the lofi.
- **Desktop:** WASD walks, drag with the mouse or use the arrow keys to look. Click for lofi.
- **Quest:** ENTER VR, then pull a trigger to start the lofi. The touch controls switch off in VR.

The music is generated in the browser (keys, bass, a swung beat, vinyl hiss), so there are no audio files. Phones only allow sound after a tap, so it starts on your first tap or when you press the music button, which also turns it off and on.

## Run locally

```bash
npm install
npm run dev
```

Quest on the same LAN: `https://YOUR_IP:5173`, accept the certificate, **ENTER VR**.

```bash
npm run build
npm run preview
```

## Code

- `src/main.js`: the cabin, hull, screens, music button and the render loop
- `src/scenery.js`: the sky, sun and sliding parallax layers outside the window
- `src/controls.js`: touch sticks, drag-to-look and keyboard movement
- `src/lofi.js`: the generated lofi track

## Hosting

Hosted on Cookiejar as a static build of `dist`. `.sites/site` holds only the site ID.

Repo: https://github.com/Allowistic/land-yacht-hangar
