# Lenia — Continuous Cellular Automata

WebGL2 implementation of [Lenia](https://chakazul.github.io/lenia.html), a continuous generalization of Conway's Game of Life that produces lifelike, self-organizing organisms.

## Running

```bash
cd lenia && python3 -m http.server 8090
```

Open `http://localhost:8090` in a modern browser.

## Features

- Real-time continuous convolution with configurable kernel and growth function
- Dual framebuffer ping-pong simulation at 512x512
- 6 creature presets: Orbium, Geminium, Scutium, Gyroscutium, Pentascutium, Primordia
- Parameter explorer with live sliders (R, μ, σ, dt, speed)
- FunForrest palette with golden glow on active regions
- Click to seed organisms, drag to paint, scroll to resize brush
- Touch support
- PNG export
