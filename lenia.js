// ============================================================
// Lenia — Continuous Cellular Automata
// WebGL2 implementation with FunForrest palette
// ============================================================

// ---- Presets ------------------------------------------------

const PRESETS = {
    orbium: {
        name: 'Orbium',
        desc: 'Classic glider — moves across the field',
        R: 13, T: 10, m: 0.15, s: 0.015, b: [1],
        init(x, y) {
            const d = Math.sqrt((x + 1) * (x + 1) + y * y);
            if (d > 10) return 0;
            const ring = Math.exp(-(d - 4.5) * (d - 4.5) / 2.5);
            const angle = Math.atan2(y, x);
            const asym = 0.5 + 0.5 * Math.cos(angle + 0.4);
            return ring * asym * 0.95;
        },
        seedRadius: 12
    },
    geminium: {
        name: 'Geminium',
        desc: 'Self-replicating twin organism',
        R: 12, T: 10, m: 0.14, s: 0.014, b: [1],
        init(x, y) {
            const d1 = Math.sqrt((x - 5) * (x - 5) + y * y);
            const d2 = Math.sqrt((x + 5) * (x + 5) + y * y);
            const v1 = Math.exp(-d1 * d1 / 8) * 0.85;
            const v2 = Math.exp(-d2 * d2 / 8) * 0.85;
            return Math.max(v1, v2);
        },
        seedRadius: 14
    },
    scutium: {
        name: 'Scutium',
        desc: 'Stable shield-shaped organism',
        R: 13, T: 10, m: 0.21, s: 0.028, b: [1],
        init(x, y) {
            const d = Math.sqrt(x * x + y * y);
            if (d > 8) return 0;
            return Math.exp(-d * d / 10) * 0.85;
        },
        seedRadius: 10
    },
    gyroscutium: {
        name: 'Gyroscutium',
        desc: 'Rotating two-ring pattern',
        R: 13, T: 10, m: 0.20, s: 0.022, b: [1, 0.68],
        init(x, y) {
            const d = Math.sqrt(x * x + y * y);
            if (d > 10) return 0;
            const ring = Math.exp(-(d - 5) * (d - 5) / 3);
            const angle = Math.atan2(y, x);
            const arms = 0.5 + 0.5 * Math.cos(3 * angle);
            return ring * arms * 0.8;
        },
        seedRadius: 12
    },
    pentascutium: {
        name: 'Pentascutium',
        desc: 'Five-fold symmetric organism',
        R: 15, T: 10, m: 0.18, s: 0.020, b: [1, 0.5, 0.25],
        init(x, y) {
            const d = Math.sqrt(x * x + y * y);
            if (d > 12) return 0;
            const ring = Math.exp(-(d - 6) * (d - 6) / 4);
            const angle = Math.atan2(y, x);
            const arms = 0.5 + 0.5 * Math.cos(5 * angle);
            return ring * arms * 0.85;
        },
        seedRadius: 14
    },
    primordia: {
        name: 'Primordia',
        desc: 'Random soup — watch what emerges',
        R: 13, T: 10, m: 0.15, s: 0.017, b: [1],
        init: null, // Special: random blobs
        seedRadius: 10
    }
};

// ---- Shader sources -----------------------------------------

const QUAD_VS = `#version 300 es
in vec2 a_pos;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const SIM_FS = `#version 300 es
precision highp float;

uniform sampler2D u_state;
uniform sampler2D u_kernel;
uniform vec2 u_res;       // grid resolution
uniform int u_R;           // kernel radius
uniform int u_kernelSize;  // 2*R+1
uniform float u_mu;
uniform float u_sigma;
uniform float u_dt;

out vec4 fragColor;

void main() {
    ivec2 pos = ivec2(gl_FragCoord.xy);
    ivec2 gridSize = ivec2(u_res);

    float potential = 0.0;

    const int MAX_R = 25;
    for (int dy = -MAX_R; dy <= MAX_R; dy++) {
        if (dy < -u_R || dy > u_R) continue;
        for (int dx = -MAX_R; dx <= MAX_R; dx++) {
            if (dx < -u_R || dx > u_R) continue;

            // Sample kernel
            ivec2 kCoord = ivec2(dx + u_R, dy + u_R);
            float kw = texelFetch(u_kernel, kCoord, 0).r;
            if (kw < 1e-6) continue;

            // Sample state with wrapping
            ivec2 sCoord = (pos + ivec2(dx, dy) + gridSize) % gridSize;
            float s = texelFetch(u_state, sCoord, 0).r;

            potential += kw * s;
        }
    }

    // Growth function: Gaussian bump centered at mu, width sigma
    float g = 2.0 * exp(-0.5 * pow((potential - u_mu) / u_sigma, 2.0)) - 1.0;

    float current = texelFetch(u_state, pos, 0).r;
    float next = clamp(current + u_dt * g, 0.0, 1.0);

    fragColor = vec4(next, 0.0, 0.0, 1.0);
}`;

const VIS_FS = `#version 300 es
precision highp float;

uniform sampler2D u_state;
uniform vec2 u_stateRes;  // state texture resolution
uniform vec2 u_canvasRes; // canvas resolution

out vec4 fragColor;

vec3 palette(float t) {
    // FunForrest: dark brown -> burnt orange -> gold -> bright gold
    vec3 c0 = vec3(0.102, 0.051, 0.0);    // #1A0D00 bg
    vec3 c1 = vec3(0.60, 0.15, 0.02);     // deep ember
    vec3 c2 = vec3(0.898, 0.349, 0.110);  // #E5591C burnt orange
    vec3 c3 = vec3(0.867, 0.757, 0.396);  // #DDC165 gold
    vec3 c4 = vec3(1.0, 0.914, 0.639);    // #FFE9A3 bright gold

    if (t < 0.05) return mix(c0, c1, t / 0.05);
    if (t < 0.25) return mix(c1, c2, (t - 0.05) / 0.20);
    if (t < 0.55) return mix(c2, c3, (t - 0.25) / 0.30);
    return mix(c3, c4, clamp((t - 0.55) / 0.45, 0.0, 1.0));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_canvasRes;
    // Flip Y so origin is top-left visually matching canvas
    uv.y = 1.0 - uv.y;

    // Sample state with linear filtering
    float state = texture(u_state, uv).r;

    // Glow: sample neighborhood for bloom effect
    float glow = 0.0;
    float totalW = 0.0;
    for (int dy = -3; dy <= 3; dy++) {
        for (int dx = -3; dx <= 3; dx++) {
            vec2 off = vec2(float(dx), float(dy)) * 2.5 / u_canvasRes;
            float s = texture(u_state, uv + off).r;
            float w = exp(-float(dx * dx + dy * dy) / 4.0);
            glow += max(s - 0.15, 0.0) * w;
            totalW += w;
        }
    }
    glow /= totalW;

    vec3 color = palette(state);

    // Add golden glow
    vec3 glowColor = vec3(1.0, 0.85, 0.5) * glow * 1.2;
    color += glowColor;

    // Subtle vignette
    vec2 vc = uv - 0.5;
    float vignette = 1.0 - dot(vc, vc) * 0.3;
    color *= vignette;

    fragColor = vec4(color, 1.0);
}`;

const SEED_FS = `#version 300 es
precision highp float;

uniform sampler2D u_state;
uniform vec2 u_res;
uniform vec2 u_seedPos;
uniform float u_seedRadius;
uniform float u_seedStrength;

out vec4 fragColor;

void main() {
    ivec2 pos = ivec2(gl_FragCoord.xy);
    float current = texelFetch(u_state, pos, 0).r;

    vec2 diff = gl_FragCoord.xy - u_seedPos;
    float d = length(diff);
    float r = d / u_seedRadius;

    float seed = 0.0;
    if (r < 1.0) {
        seed = u_seedStrength * exp(-r * r * 3.0);
    }

    fragColor = vec4(max(current, seed), 0.0, 0.0, 1.0);
}`;

// ---- Lenia engine -------------------------------------------

class Lenia {
    constructor(canvas) {
        this.canvas = canvas;
        this.gridSize = 512;
        this.playing = true;
        this.speed = 1;
        this.brushRadius = 8;
        this.painting = false;
        this.currentPreset = 'orbium';
        this.frameCount = 0;
        this.lastFpsTime = performance.now();
        this.fps = 0;
        this.currentFBO = 0;

        // Current params
        this.R = 13;
        this.T = 10;
        this.mu = 0.15;
        this.sigma = 0.015;
        this.beta = [1];
        this.dt = 0.1;

        this.initGL();
        this.initShaders();
        this.initBuffers();
        this.initFBOs();
        this.buildKernel();
        this.loadPreset('orbium');
        this.setupInput();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    // ---- WebGL setup ----

    initGL() {
        const gl = this.canvas.getContext('webgl2', {
            preserveDrawingBuffer: true,
            alpha: false,
            antialias: false,
            premultipliedAlpha: false
        });
        if (!gl) throw new Error('WebGL2 not supported');

        const ext = gl.getExtension('EXT_color_buffer_float');
        if (!ext) throw new Error('EXT_color_buffer_float not supported');

        // Also enable float linear filtering
        gl.getExtension('OES_texture_float_linear');

        this.gl = gl;
    }

    compile(type, src) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    link(vsSrc, fsSrc) {
        const gl = this.gl;
        const vs = this.compile(gl.VERTEX_SHADER, vsSrc);
        const fs = this.compile(gl.FRAGMENT_SHADER, fsSrc);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(prog));
            return null;
        }
        return prog;
    }

    initShaders() {
        this.simProg = this.link(QUAD_VS, SIM_FS);
        this.visProg = this.link(QUAD_VS, VIS_FS);
        this.seedProg = this.link(QUAD_VS, SEED_FS);

        // Cache uniform locations
        const gl = this.gl;
        this.simLoc = {
            state: gl.getUniformLocation(this.simProg, 'u_state'),
            kernel: gl.getUniformLocation(this.simProg, 'u_kernel'),
            res: gl.getUniformLocation(this.simProg, 'u_res'),
            R: gl.getUniformLocation(this.simProg, 'u_R'),
            kernelSize: gl.getUniformLocation(this.simProg, 'u_kernelSize'),
            mu: gl.getUniformLocation(this.simProg, 'u_mu'),
            sigma: gl.getUniformLocation(this.simProg, 'u_sigma'),
            dt: gl.getUniformLocation(this.simProg, 'u_dt'),
        };
        this.visLoc = {
            state: gl.getUniformLocation(this.visProg, 'u_state'),
            stateRes: gl.getUniformLocation(this.visProg, 'u_stateRes'),
            canvasRes: gl.getUniformLocation(this.visProg, 'u_canvasRes'),
        };
        this.seedLoc = {
            state: gl.getUniformLocation(this.seedProg, 'u_state'),
            res: gl.getUniformLocation(this.seedProg, 'u_res'),
            seedPos: gl.getUniformLocation(this.seedProg, 'u_seedPos'),
            seedRadius: gl.getUniformLocation(this.seedProg, 'u_seedRadius'),
            seedStrength: gl.getUniformLocation(this.seedProg, 'u_seedStrength'),
        };
    }

    initBuffers() {
        const gl = this.gl;
        this.quadBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  1, -1,  -1, 1,  1, 1
        ]), gl.STATIC_DRAW);

        // Create VAO for each program
        this.simVAO = this.createVAO(this.simProg);
        this.visVAO = this.createVAO(this.visProg);
        this.seedVAO = this.createVAO(this.seedProg);
    }

    createVAO(prog) {
        const gl = this.gl;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        const loc = gl.getAttribLocation(prog, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        return vao;
    }

    createFBO(w, h) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('FBO incomplete:', status);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return { fb, tex, w, h };
    }

    initFBOs() {
        const s = this.gridSize;
        this.stateFBOs = [this.createFBO(s, s), this.createFBO(s, s)];
        this.currentFBO = 0;
    }

    // ---- Kernel ----

    buildKernel() {
        const R = this.R;
        const beta = this.beta;
        const size = 2 * R + 1;
        const data = new Float32Array(size * size);
        let sum = 0;

        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const d = Math.sqrt(dx * dx + dy * dy);
                const r = d / R;
                if (r <= 0 || r >= 1) continue;

                const B = beta.length;
                const br = r * B;
                const i = Math.min(Math.floor(br), B - 1);
                const x = br - i;

                // Smooth bump function on (0, 1)
                let bump = 0;
                if (x > 0 && x < 1) {
                    bump = Math.exp(4 - 4 / (4 * x * (1 - x)));
                }
                const val = beta[i] * bump;
                data[(dy + R) * size + (dx + R)] = val;
                sum += val;
            }
        }

        // Normalize
        if (sum > 0) {
            for (let i = 0; i < data.length; i++) {
                data[i] /= sum;
            }
        }

        const gl = this.gl;
        if (this.kernelTex) gl.deleteTexture(this.kernelTex);

        this.kernelTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.kernelTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, size, size, 0, gl.RED, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // ---- State management ----

    clearState() {
        const gl = this.gl;
        const s = this.gridSize;
        const zeros = new Float32Array(s * s * 4);
        for (let i = 0; i < 2; i++) {
            gl.bindTexture(gl.TEXTURE_2D, this.stateFBOs[i].tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, s, s, 0, gl.RGBA, gl.FLOAT, zeros);
        }
        this.currentFBO = 0;
    }

    uploadState(values) {
        const gl = this.gl;
        const s = this.gridSize;
        const data = new Float32Array(s * s * 4);
        for (let i = 0; i < s * s; i++) {
            data[i * 4] = values[i];
            data[i * 4 + 3] = 1;
        }
        gl.bindTexture(gl.TEXTURE_2D, this.stateFBOs[this.currentFBO].tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, s, s, 0, gl.RGBA, gl.FLOAT, data);
    }

    loadPreset(name) {
        const p = PRESETS[name];
        if (!p) return;
        this.currentPreset = name;
        this.R = p.R;
        this.T = p.T;
        this.mu = p.m;
        this.sigma = p.s;
        this.beta = [...p.b];
        this.dt = 1 / p.T;
        this.buildKernel();

        const s = this.gridSize;
        const values = new Float32Array(s * s);

        if (p.init) {
            // Seed single creature at center
            const cx = Math.floor(s / 2);
            const cy = Math.floor(s / 2);
            const r = p.seedRadius || 15;
            for (let dy = -r - 5; dy <= r + 5; dy++) {
                for (let dx = -r - 5; dx <= r + 5; dx++) {
                    let v = p.init(dx, dy);
                    // Add small noise for symmetry breaking
                    v += (Math.random() - 0.5) * 0.08;
                    v = Math.max(0, Math.min(1, v));
                    const x = ((cx + dx) % s + s) % s;
                    const y = ((cy + dy) % s + s) % s;
                    values[y * s + x] = Math.max(values[y * s + x], v);
                }
            }
        } else {
            // Primordia: random blobs
            this.seedRandomBlobs(values, 15);
        }

        this.uploadState(values);
        this.updateUI();
    }

    seedRandomBlobs(values, count) {
        const s = this.gridSize;
        for (let n = 0; n < count; n++) {
            const cx = Math.floor(Math.random() * s);
            const cy = Math.floor(Math.random() * s);
            const r = 3 + Math.random() * 8;
            const strength = 0.3 + Math.random() * 0.7;
            for (let dy = -Math.ceil(r) - 2; dy <= Math.ceil(r) + 2; dy++) {
                for (let dx = -Math.ceil(r) - 2; dx <= Math.ceil(r) + 2; dx++) {
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d > r + 2) continue;
                    const v = strength * Math.exp(-d * d / (r * r * 0.5));
                    const x = ((cx + dx) % s + s) % s;
                    const y = ((cy + dy) % s + s) % s;
                    values[y * s + x] = Math.max(values[y * s + x], v);
                }
            }
        }
    }

    randomize() {
        const s = this.gridSize;
        const values = new Float32Array(s * s);
        this.seedRandomBlobs(values, 20 + Math.floor(Math.random() * 15));
        this.uploadState(values);
    }

    // ---- Seed blob at position (for mouse interaction) ----

    seedAt(canvasX, canvasY) {
        const gl = this.gl;
        const s = this.gridSize;

        // Convert canvas coords to grid coords
        const rect = this.canvas.getBoundingClientRect();
        const gx = (canvasX / rect.width) * s;
        const gy = (canvasY / rect.height) * s;

        const src = this.currentFBO;
        const dst = 1 - src;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.stateFBOs[dst].fb);
        gl.viewport(0, 0, s, s);

        gl.useProgram(this.seedProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.stateFBOs[src].tex);
        gl.uniform1i(this.seedLoc.state, 0);
        gl.uniform2f(this.seedLoc.res, s, s);
        gl.uniform2f(this.seedLoc.seedPos, gx, gy);
        gl.uniform1f(this.seedLoc.seedRadius, this.brushRadius);
        gl.uniform1f(this.seedLoc.seedStrength, 0.85);

        gl.bindVertexArray(this.seedVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.currentFBO = dst;
    }

    // ---- Seed creature at position (for click) ----

    seedCreatureAt(canvasX, canvasY) {
        const s = this.gridSize;
        const rect = this.canvas.getBoundingClientRect();
        const cx = Math.floor((canvasX / rect.width) * s);
        const cy = Math.floor((canvasY / rect.height) * s);

        const p = PRESETS[this.currentPreset];
        if (!p || !p.init) {
            // Just seed a blob
            this.seedAt(canvasX, canvasY);
            return;
        }

        // Read current state, add creature, upload
        const gl = this.gl;
        const pixels = new Float32Array(s * s * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.stateFBOs[this.currentFBO].fb);
        gl.readPixels(0, 0, s, s, gl.RGBA, gl.FLOAT, pixels);

        const r = p.seedRadius || 15;
        for (let dy = -r - 5; dy <= r + 5; dy++) {
            for (let dx = -r - 5; dx <= r + 5; dx++) {
                let v = p.init(dx, dy);
                v += (Math.random() - 0.5) * 0.08;
                v = Math.max(0, Math.min(1, v));
                if (v <= 0) continue;
                const x = ((cx + dx) % s + s) % s;
                const y = ((cy + dy) % s + s) % s;
                const idx = (y * s + x) * 4;
                pixels[idx] = Math.max(pixels[idx], v);
            }
        }

        gl.bindTexture(gl.TEXTURE_2D, this.stateFBOs[this.currentFBO].tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, s, s, 0, gl.RGBA, gl.FLOAT, pixels);
    }

    // ---- Simulation step ----

    step() {
        const gl = this.gl;
        const s = this.gridSize;
        const src = this.currentFBO;
        const dst = 1 - src;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.stateFBOs[dst].fb);
        gl.viewport(0, 0, s, s);

        gl.useProgram(this.simProg);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.stateFBOs[src].tex);
        gl.uniform1i(this.simLoc.state, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.kernelTex);
        gl.uniform1i(this.simLoc.kernel, 1);

        gl.uniform2f(this.simLoc.res, s, s);
        gl.uniform1i(this.simLoc.R, this.R);
        gl.uniform1i(this.simLoc.kernelSize, 2 * this.R + 1);
        gl.uniform1f(this.simLoc.mu, this.mu);
        gl.uniform1f(this.simLoc.sigma, this.sigma);
        gl.uniform1f(this.simLoc.dt, this.dt);

        gl.bindVertexArray(this.simVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.currentFBO = dst;
    }

    // ---- Render visualization ----

    render() {
        const gl = this.gl;
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cw, ch);

        gl.useProgram(this.visProg);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.stateFBOs[this.currentFBO].tex);
        gl.uniform1i(this.visLoc.state, 0);

        gl.uniform2f(this.visLoc.stateRes, this.gridSize, this.gridSize);
        gl.uniform2f(this.visLoc.canvasRes, cw, ch);

        gl.bindVertexArray(this.visVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ---- Animation loop ----

    animate(t) {
        if (this.playing) {
            for (let i = 0; i < this.speed; i++) {
                this.step();
            }
        }
        this.render();

        // FPS counter
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsTime >= 500) {
            this.fps = Math.round(this.frameCount / ((now - this.lastFpsTime) / 1000));
            this.frameCount = 0;
            this.lastFpsTime = now;
            document.getElementById('fps').textContent = this.fps + ' fps';
        }

        this._raf = requestAnimationFrame((t) => this.animate(t));
    }

    start() {
        if (!this._raf) {
            this._raf = requestAnimationFrame((t) => this.animate(t));
        }
    }

    stop() {
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
    }

    // ---- Resize ----

    resize() {
        const wrap = document.getElementById('canvas-wrap');
        const maxW = wrap.clientWidth - 20;
        const maxH = wrap.clientHeight - 20;
        const size = Math.min(maxW, maxH, 1024);

        this.canvas.width = size;
        this.canvas.height = size;
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
    }

    // ---- Export ----

    exportPNG() {
        this.render();
        const link = document.createElement('a');
        link.download = `lenia-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    // ---- Input ----

    setupInput() {
        const c = this.canvas;

        const getPos = (e) => {
            const rect = c.getBoundingClientRect();
            const x = (e.clientX - rect.left);
            const y = (e.clientY - rect.top);
            return { x, y };
        };

        c.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.painting = true;
            const { x, y } = getPos(e);
            if (e.shiftKey) {
                this.seedAt(x, y);
            } else {
                this.seedCreatureAt(x, y);
            }
        });

        c.addEventListener('mousemove', (e) => {
            if (!this.painting) return;
            const { x, y } = getPos(e);
            this.seedAt(x, y);
        });

        c.addEventListener('mouseup', () => { this.painting = false; });
        c.addEventListener('mouseleave', () => { this.painting = false; });

        // Touch
        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.painting = true;
            const t = e.touches[0];
            const rect = c.getBoundingClientRect();
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            this.seedCreatureAt(x, y);
        }, { passive: false });

        c.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.painting) return;
            const t = e.touches[0];
            const rect = c.getBoundingClientRect();
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            this.seedAt(x, y);
        }, { passive: false });

        c.addEventListener('touchend', () => { this.painting = false; });

        // Scroll to adjust brush
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.brushRadius = Math.max(3, Math.min(30, this.brushRadius - Math.sign(e.deltaY)));
        }, { passive: false });
    }

    // ---- UI sync ----

    updateUI() {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = typeof val === 'number' ? val : val;
        };
        const setV = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        set('radius', this.R);
        setV('v-radius', this.R);
        set('mu', this.mu);
        setV('v-mu', this.mu.toFixed(3));
        set('sigma', this.sigma);
        setV('v-sigma', this.sigma.toFixed(3));
        set('dt', this.dt);
        setV('v-dt', this.dt.toFixed(3));
        set('preset', this.currentPreset);
    }
}

// ---- UI setup -----------------------------------------------

function setupUI(lenia) {
    // Populate preset selector
    const sel = document.getElementById('preset');
    for (const [key, p] of Object.entries(PRESETS)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = p.name + ' — ' + p.desc;
        sel.appendChild(opt);
    }
    sel.value = 'orbium';

    sel.addEventListener('change', () => {
        lenia.clearState();
        lenia.loadPreset(sel.value);
    });

    // Sliders
    const bindSlider = (id, valueId, setter, fmt) => {
        const slider = document.getElementById(id);
        const display = document.getElementById(valueId);
        slider.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            display.textContent = fmt ? fmt(val) : val;
            setter(val);
        });
    };

    bindSlider('radius', 'v-radius', (v) => {
        lenia.R = Math.round(v);
        lenia.buildKernel();
    }, (v) => Math.round(v));

    bindSlider('mu', 'v-mu', (v) => { lenia.mu = v; }, (v) => v.toFixed(3));
    bindSlider('sigma', 'v-sigma', (v) => { lenia.sigma = v; }, (v) => v.toFixed(3));
    bindSlider('dt', 'v-dt', (v) => { lenia.dt = v; }, (v) => v.toFixed(3));

    bindSlider('speed', 'v-speed', (v) => { lenia.speed = Math.round(v); }, (v) => Math.round(v));

    // Buttons
    const pauseBtn = document.getElementById('btn-pause');
    pauseBtn.addEventListener('click', () => {
        lenia.playing = !lenia.playing;
        pauseBtn.textContent = lenia.playing ? 'Pause' : 'Play';
        pauseBtn.classList.toggle('active', !lenia.playing);
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        lenia.clearState();
        lenia.loadPreset(lenia.currentPreset);
    });

    document.getElementById('btn-random').addEventListener('click', () => {
        lenia.randomize();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        lenia.exportPNG();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            lenia.playing = !lenia.playing;
            pauseBtn.textContent = lenia.playing ? 'Pause' : 'Play';
            pauseBtn.classList.toggle('active', !lenia.playing);
        }
        if (e.key === 'r') {
            lenia.clearState();
            lenia.loadPreset(lenia.currentPreset);
        }
        if (e.key === 'e') {
            lenia.exportPNG();
        }
    });
}

// ---- Init ---------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');

    try {
        const lenia = new Lenia(canvas);
        setupUI(lenia);
        lenia.start();
    } catch (e) {
        document.body.innerHTML = `
            <div style="color:#E5591C;padding:40px;font-family:monospace;">
                <h2>Lenia requires WebGL2</h2>
                <p>${e.message}</p>
                <p>Please use a modern browser with GPU acceleration enabled.</p>
            </div>
        `;
    }
});
