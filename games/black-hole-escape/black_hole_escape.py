#!/usr/bin/env python3
"""
ПОБЕГ ОТ ЧЁРНОЙ ДЫРЫ — 3D-игра на Python (Ursina / Panda3D).

Ты пилотируешь маленький корабль у чёрной дыры. Гравитация тянет тебя к горизонту событий,
а становится она всё сильнее. Собери все энергоядра, чтобы открыть варп-врата, и улети
через них, пока дыра тебя не поглотила.

Запуск:   pip install ursina     →     python black_hole_escape.py
Управление: см. подсказку на экране (WASD, мышь, пробел, Shift, левая кнопка мыши).
"""
import math
import os
import random
import struct
import sys
import wave
from pathlib import Path

from panda3d.core import ColorBlendAttrib, TransparencyAttrib
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps
from ursina import *
from ursina.lights import AmbientLight, DirectionalLight
from ursina.shaders import basic_lighting_shader, unlit_shader

HERE = Path(__file__).resolve().parent
ASSETS = HERE / 'assets'

# ------------------------------------------------------------------ настройки игры
BH_RADIUS = 4.0          # радиус горизонта событий (коснулся — конец)
GM0 = 1200.0             # сила притяжения в начале (растёт со временем)
GM_GROWTH = 0.008        # +0,8 % притяжения каждую секунду
THRUST = 15.0            # тяга двигателя
BOOST = 2.2              # множитель тяги при ускорении
BRAKE = 2.2              # торможение (Shift)
MAX_SPEED = 55.0
FUEL_MAX = 100.0
FUEL_USE = 6.0           # расход топлива в секунду
CORES_TOTAL = 12
GATE_DIST = 80.0
MOUSE_SENS = 40.0


# ------------------------------------------------------------------ процедурная графика и звук
def starfield_texture(w=4096, h=2048):
    rnd = random.Random(7)
    stars = Image.new('RGB', (w, h), (0, 0, 0))
    d = ImageDraw.Draw(stars)
    for _ in range(9000):
        x, y = rnd.randrange(w), rnd.randrange(h)
        b = int(90 + 165 * rnd.random() ** 2)
        tint = rnd.choice([(1, 1, 1), (1, .85, .7), (.75, .85, 1)])
        c = tuple(int(b * k) for k in tint)
        if rnd.random() < 0.05:
            d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=c)
        else:
            d.point((x, y), fill=c)

    def seamless(img):                     # без шва по горизонтали: смешиваем со сдвинутой копией
        shifted = ImageChops.offset(img, img.width // 2, 0)
        up = Image.linear_gradient('L').rotate(90).resize((img.width // 2, img.height))   # 0 → 255 слева направо
        mask = Image.new('L', img.size)
        mask.paste(up, (0, 0))
        mask.paste(ImageOps.mirror(up), (img.width // 2, 0))                              # в центре 255, по краям 0
        return Image.composite(img, shifted, mask)

    neb = []
    for seed, col in ((1, (90, 45, 130)), (2, (25, 75, 140))):
        n = Image.effect_noise((w // 8, h // 8), 70 + seed * 10).filter(ImageFilter.GaussianBlur(8))
        n = ImageOps.autocontrast(n, cutoff=3).resize((w, h), Image.BICUBIC)
        n = seamless(n.point(lambda p: int(max(0, p - 120) * 0.85)))
        neb.append(ImageOps.colorize(n, black=(0, 0, 0), white=col).filter(ImageFilter.GaussianBlur(5)))
    tex = Texture(ImageChops.add(ImageChops.add(stars, neb[0]), neb[1]))
    tex.filtering = 'bilinear'
    return tex


def glow_texture(rgb, size=128, power=2.2):
    img = Image.new('RGBA', (size, size))
    px = img.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            a = max(0.0, 1 - math.hypot(x - c, y - c) / c) ** power
            px[x, y] = (*rgb, int(255 * a))
    tex = Texture(img)
    tex.filtering = 'bilinear'
    return tex


def additive(e, order=40):
    e.setAttrib(ColorBlendAttrib.make(ColorBlendAttrib.MAdd, ColorBlendAttrib.OIncomingAlpha, ColorBlendAttrib.OOne))
    e.setTransparency(TransparencyAttrib.MAlpha)
    e.setDepthWrite(False)
    e.setBin('fixed', order)
    return e


def ring_mesh(r0, r1, seg=96, rings=7, hot=True):
    """Плоское кольцо с цветом от белого к красному и затухающей прозрачностью."""
    verts, cols, tris = [], [], []
    for i in range(rings + 1):
        t = i / rings
        r = r0 + (r1 - r0) * t
        if hot:
            c = (1.0, 0.95 - 0.5 * t, 0.75 - 0.7 * t)
            a = (1 - t) ** 0.9 * min(1, t * 9 + 0.15)
        else:
            c, a = (0.3, 1.0, 0.6), 0.9 * math.sin(math.pi * t)
        for j in range(seg + 1):
            ang = 2 * math.pi * j / seg
            verts.append(Vec3(math.cos(ang) * r, 0, math.sin(ang) * r))
            cols.append(color.rgba(c[0], c[1], c[2], a))
    for i in range(rings):
        for j in range(seg):
            a, b = i * (seg + 1) + j, (i + 1) * (seg + 1) + j
            tris += [(a, b, a + 1), (a + 1, b, b + 1)]
    return Mesh(vertices=verts, triangles=tris, colors=cols)


def disk_points(n=3500):
    rnd = random.Random(3)
    verts, cols = [], []
    for _ in range(n):
        r = BH_RADIUS * 1.5 + (BH_RADIUS * 6.5) * rnd.random() ** 1.7
        a = rnd.random() * math.tau
        verts.append(Vec3(math.cos(a) * r, rnd.gauss(0, 0.12 + r * 0.01), math.sin(a) * r))
        t = (r - BH_RADIUS * 1.5) / (BH_RADIUS * 6.5)
        cols.append(color.rgba(1, 0.9 - 0.55 * t, 0.65 - 0.6 * t, 0.9 - 0.5 * t))
    return Mesh(vertices=verts, mode='point', thickness=3, colors=cols)


def _wav(name, samples, sr=44100):
    ASSETS.mkdir(exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    with wave.open(str(ASSETS / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(b''.join(struct.pack('<h', int(32000 * s / peak)) for s in samples))


def make_sounds():
    """Все звуки генерируются кодом — внешние файлы не нужны."""
    sr = 44100
    if (ASSETS / 'thrust.wav').exists():
        return
    rnd = random.Random(5)
    n = lambda d: range(int(d * sr))
    def tone(f, d, dec=6):
        return [math.sin(2 * math.pi * f * i / sr) * math.exp(-dec * i / sr) for i in n(d)]
    _wav('pickup', tone(880, .12) + tone(1320, .25, 5))
    _wav('hit', [math.sin(2 * math.pi * 90 * i / sr) * math.exp(-9 * i / sr) + (rnd.random() * 2 - 1) * math.exp(-25 * i / sr) * .6 for i in n(.45)])
    win = []
    for f in (523, 659, 784, 1046):
        win += tone(f, .16, 3)
    _wav('win', win + tone(1046, .6, 2.5))
    _wav('die', [math.sin(2 * math.pi * (400 * math.exp(-3 * i / sr) + 30) * i / sr) * (1 - i / (1.3 * sr)) + (rnd.random() * 2 - 1) * .15 for i in n(1.3)])
    _wav('warn', tone(620, .1, 8) + [0] * int(.06 * sr) + tone(620, .1, 8))
    raw = [rnd.random() * 2 - 1 for _ in n(1.0)]
    sm, acc = [], 0.0
    for i, v in enumerate(raw):           # мягкий шум двигателя (скользящее среднее)
        acc += v - (raw[i - 24] if i >= 24 else 0)
        sm.append(acc / 24)
    _wav('thrust', sm)


# ------------------------------------------------------------------ объекты мира
class Core(Entity):
    """Энергоядро на своей орбите вокруг чёрной дыры."""
    def __init__(self, glow, rnd):
        self.r = rnd.uniform(22, 62)
        self.incl = rnd.uniform(-1.0, 1.0)
        self.ang = rnd.uniform(0, math.tau)
        self.w = rnd.choice((-1, 1)) * rnd.uniform(0.07, 0.13) * (40 / self.r) ** 0.5
        super().__init__(model='sphere', color=color.rgb32(120, 255, 240), scale=1.5)
        self.halo = additive(Entity(parent=self, model='quad', texture=glow, billboard=True, scale=6.0, double_sided=True))
        self.place()

    def place(self):
        a = self.ang
        self.position = Vec3(self.r * math.cos(a), self.r * math.sin(a) * math.sin(self.incl), self.r * math.sin(a) * math.cos(self.incl))

    def update(self):
        self.ang += self.w * time.dt
        self.place()
        s = 1.5 + 0.18 * math.sin(time.time() * 4 + self.r)
        self.scale = s
        self.rotation_y += 60 * time.dt


class Asteroid(Entity):
    def __init__(self, rnd):
        self.rnd = rnd
        size = rnd.uniform(1.4, 3.6)
        g = rnd.uniform(0.35, 0.55)
        super().__init__(model='sphere', color=color.rgb(g, g * 0.92, g * 0.85), shader=basic_lighting_shader,
                         scale=(size * rnd.uniform(.7, 1.3), size * rnd.uniform(.7, 1.3), size * rnd.uniform(.7, 1.3)))
        self.size = size
        self.spin = Vec3(rnd.uniform(-40, 40), rnd.uniform(-40, 40), rnd.uniform(-40, 40))
        self.respawn(first=True)

    def respawn(self, first=False):
        rnd = self.rnd
        r = rnd.uniform(26, 90) if first else rnd.uniform(70, 100)
        d = Vec3(rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)).normalized()
        self.position = d * r
        tang = d.cross(Vec3(rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))).normalized()
        self.vel = tang * rnd.uniform(3, 9)
        self.cd = 0.0


class Gate(Entity):
    """Варп-врата: влети в кольцо, чтобы сбежать."""
    RADIUS = 6.5

    def __init__(self, pos, glow):
        super().__init__(position=pos)
        self.ring = Entity(parent=self, model=ring_mesh(self.RADIUS * 0.55, self.RADIUS * 1.25, seg=72, rings=4, hot=False),
                           double_sided=True, shader=unlit_shader, rotation_x=90)
        additive(self.ring)
        self.halo = additive(Entity(parent=self, model='quad', texture=glow, billboard=True, scale=self.RADIUS * 4, double_sided=True))
        self.look_at(Vec3(0, 0, 0))

    def update(self):
        self.ring.rotation_y += 40 * time.dt


# ------------------------------------------------------------------ сама игра
class Game(Entity):
    def __init__(self):
        super().__init__()
        window.title = 'Побег от чёрной дыры'
        window.color = color.black
        window.fps_counter.enabled = False
        window.exit_button.visible = False
        make_sounds()
        self.rnd = random.Random()
        self.sky = Sky(texture=starfield_texture())
        self.amb = AmbientLight(color=color.rgba32(70, 70, 95, 255))
        self.sun = DirectionalLight(shadows=False)
        self.sun.look_at(Vec3(1, -0.5, 1))
        self.glow_orange = glow_texture((255, 150, 60))
        self.glow_cyan = glow_texture((90, 255, 235), power=1.8)
        self.glow_green = glow_texture((80, 255, 150), power=1.4)

        # чёрная дыра: тень, светящийся диск, частицы, ореол
        self.hole = Entity(position=(0, 0, 0))
        self.shadow = Entity(parent=self.hole, model='sphere', color=color.black, scale=BH_RADIUS * 2, shader=unlit_shader)
        self.disk = Entity(parent=self.hole, rotation_x=0)
        self.disk_ring = additive(Entity(parent=self.disk, model=ring_mesh(BH_RADIUS * 1.15, BH_RADIUS * 8.5),
                                         double_sided=True, shader=unlit_shader), 41)
        self.disk_pts = Entity(parent=self.disk, model=disk_points(), shader=unlit_shader)
        self.halo = additive(Entity(parent=self.hole, model='quad', texture=self.glow_orange, billboard=True,
                                    scale=BH_RADIUS * 6.2, double_sided=True, color=color.rgba32(255, 190, 120, 200)), 39)
        self.disk.rotation_x = 12

        self.ship = Entity()
        camera.parent = self.ship
        camera.position = (0, 0, 0)
        camera.rotation = (0, 0, 0)
        camera.fov = 85
        camera.clip_plane_far = 1500
        mouse.locked = True

        self.sfx = {n: Audio(n, autoplay=False) for n in ('pickup', 'hit', 'win', 'die', 'warn')}
        self.engine = Audio('thrust', loop=True, autoplay=False, volume=0)
        self.engine.play()
        self.build_hud()
        self.cores, self.asteroids, self.gate = [], [], None
        self.reset()

    # ---- интерфейс
    def build_hud(self):
        ui = camera.ui
        self.t_cores = Text('', parent=ui, position=(-0.86, 0.46), scale=1.5, color=color.rgb32(120, 255, 240))
        self.t_time = Text('', parent=ui, position=(0.62, 0.46), scale=1.5, color=color.white)
        self.t_dist = Text('', parent=ui, position=(-0.86, 0.40), scale=1.0, color=color.rgb32(200, 200, 220))
        self.t_speed = Text('', parent=ui, position=(-0.86, 0.36), scale=1.0, color=color.rgb32(200, 200, 220))
        self.t_warn = Text('', parent=ui, origin=(0, 0), position=(0, 0.33), scale=2.0, color=color.rgb32(255, 90, 60))
        self.t_msg = Text('', parent=ui, origin=(0, 0), position=(0, 0.21), scale=3.0, color=color.white)
        self.t_sub = Text('', parent=ui, origin=(0, 0.5), position=(0, 0.15), scale=1.4, color=color.rgb32(210, 210, 230))
        self.t_help = Text('WASD — полёт   Пробел/C — вверх/вниз   ЛКМ — ускорение   Shift — тормоз   Мышь — обзор   P — пауза   R — заново',
                           parent=ui, origin=(0, 0), position=(0, -0.47), scale=0.9, color=color.rgb32(150, 150, 175))
        self.bars = {}
        for i, (name, col) in enumerate((('fuel', color.rgb32(255, 190, 70)), ('shield', color.rgb32(100, 170, 255)))):
            y = -0.40 + i * 0.035
            Text('ТОПЛИВО' if name == 'fuel' else 'ЩИТ', parent=ui, origin=(-.5, 0), position=(-0.86, y), scale=0.8, color=color.rgb32(170, 170, 190))
            Entity(parent=ui, model='quad', color=color.rgba32(255, 255, 255, 40), scale=(0.4, 0.016), origin=(-.5, 0), position=(-0.74, y))
            self.bars[name] = Entity(parent=ui, model='quad', color=col, scale=(0.4, 0.016), origin=(-.5, 0), position=(-0.74, y))
        self.cross = Text('+', parent=ui, origin=(0, 0), scale=1.6, color=color.rgba32(255, 255, 255, 140))
        self.vignette = Entity(parent=ui, model='quad', scale=(4, 2), color=color.rgba32(120, 0, 0, 0), z=1)
        self.marker = Entity(parent=ui, model='quad', color=color.rgb32(120, 255, 240), scale=0.022, rotation_z=45, z=-1)
        self.marker_txt = Text('', parent=ui, origin=(0, -1.2), scale=0.9, color=color.rgb32(120, 255, 240), z=-1)

    # ---- новая игра
    def reset(self):
        for e in self.cores + self.asteroids + ([self.gate] if self.gate else []):
            destroy(e)
        self.cores = [Core(self.glow_cyan, self.rnd) for _ in range(CORES_TOTAL)]
        self.asteroids = [Asteroid(self.rnd) for _ in range(26)]
        self.gate = None
        self.pos = Vec3(0, 6, -58)
        self.vel = Vec3(4.5, 0, 0)
        self.yaw, self.pitch = 0.0, 0.0
        self.fuel, self.shield = FUEL_MAX, 100.0
        self.collected = 0
        self.t = 0.0
        self.hit_cd = 0.0
        self.warn_t = 0.0
        self.msg_left = None
        self.paused = False
        self.state = 'play'
        self.show('ПОБЕГ ОТ ЧЁРНОЙ ДЫРЫ', f'Собери {CORES_TOTAL} энергоядер — откроются варп-врата.\nГравитация растёт с каждой секундой!\nТопливо кончится — тебя утянет.', color.white, 7.0, scale=2.2)
        self.vignette.color = color.rgba32(120, 0, 0, 0)
        self.ship.position, self.ship.rotation = self.pos, (0, 0, 0)

    # ---- вспомогательное
    def gm(self):
        return GM0 * (1 + GM_GROWTH * self.t)

    def gravity(self, p):
        r2 = p.x * p.x + p.y * p.y + p.z * p.z
        r = math.sqrt(r2)
        return -p / max(r, 1e-6) * self.gm() / (r2 + 4.0)

    def play(self, name):
        try:
            self.sfx[name].play()
        except Exception:
            pass

    def show(self, title, sub, col, seconds=None, scale=3.0):
        self.t_msg.text, self.t_sub.text = title, sub
        self.t_msg.color, self.t_msg.scale = col, scale
        self.msg_left = seconds

    def end(self, state, title, sub, sound):
        self.state = state
        self.show(title, sub + '\n\nR — играть снова', color.rgb32(255, 90, 70) if state == 'dead' else color.rgb32(120, 255, 170), None)
        if state == 'won' and self.gate:
            self.gate.enabled = False
        self.t_warn.text = ''
        self.engine.volume = 0
        self.play(sound)

    # ---- кадр
    def update(self):
        dt = min(time.dt, 1 / 20)
        self.disk.rotation_y += 14 * dt
        if self.state == 'play' and not self.paused:
            self.step(dt)
        else:
            self.engine.volume = 0
        self.ship.position = self.pos
        self.ship.rotation = (self.pitch, self.yaw, 0)
        self.update_hud()

    def step(self, dt):
        self.t += dt
        if self.msg_left is not None:
            self.msg_left -= dt
            if self.msg_left <= 0:
                self.t_msg.text = self.t_sub.text = ''
                self.msg_left = None
        if mouse.locked:
            self.yaw += mouse.velocity[0] * MOUSE_SENS
            self.pitch -= mouse.velocity[1] * MOUSE_SENS
        self.yaw += (held_keys['right arrow'] - held_keys['left arrow']) * 90 * dt
        self.pitch += (held_keys['down arrow'] - held_keys['up arrow']) * 90 * dt
        self.pitch = max(-89, min(89, self.pitch))
        self.ship.rotation = (self.pitch, self.yaw, 0)

        move = (self.ship.forward * (held_keys['w'] - held_keys['s']) + self.ship.right * (held_keys['d'] - held_keys['a'])
                + self.ship.up * (held_keys['space'] - held_keys['c']))
        boost = held_keys['left mouse'] and self.fuel > 0
        acc = Vec3(0, 0, 0)
        thrusting = move.length() > 0.01 and self.fuel > 0
        if thrusting:
            acc += move.normalized() * THRUST * (BOOST if boost else 1)
            self.fuel = max(0, self.fuel - FUEL_USE * (2.4 if boost else 1) * dt)
        g = self.gravity(self.pos)
        acc += g
        self.vel += acc * dt
        if held_keys['left shift']:
            self.vel *= math.exp(-BRAKE * dt)
        sp = self.vel.length()
        if sp > MAX_SPEED:
            self.vel *= MAX_SPEED / sp
        self.pos += self.vel * dt
        self.engine.volume = 0.5 if thrusting else 0.0

        r = self.pos.length()
        near = max(0.0, min(1.0, (16 - r) / 12))
        if near > 0:                                       # тряска у горизонта
            s = 0.06 * near
            self.ship.position = self.pos + Vec3(random.uniform(-s, s), random.uniform(-s, s), random.uniform(-s, s)) * 6
        if r < BH_RADIUS + 0.3:
            return self.end('dead', 'ПОГЛОЩЁН', f'Ты пересёк горизонт событий. Выжил {self.t:0.1f} с, ядер: {self.collected}/{CORES_TOTAL}', 'die')

        # ядра
        for c in self.cores[:]:
            if (c.position - self.pos).length() < 3.8:
                self.cores.remove(c); destroy(c)
                self.collected += 1
                self.fuel = min(FUEL_MAX, self.fuel + 30)
                self.shield = min(100, self.shield + 10)
                self.play('pickup')
                if self.collected == CORES_TOTAL:
                    d = Vec3(self.rnd.gauss(0, 1), self.rnd.gauss(0, .5), self.rnd.gauss(0, 1)).normalized()
                    self.gate = Gate(d * GATE_DIST, self.glow_green)
                    self.show('ВРАТА ОТКРЫТЫ', 'Лети к зелёному кольцу!', color.rgb32(120, 255, 170), 3.0)

        # астероиды
        for a in self.asteroids:
            a.vel += self.gravity(a.position) * dt
            a.position += a.vel * dt
            a.rotation += a.spin * dt
            a.cd = max(0, a.cd - dt)
            ar = a.position.length()
            if ar < BH_RADIUS + 1 or ar > 160:
                a.respawn()
                continue
            delta = self.pos - a.position
            dist = delta.length()
            if dist < a.size * 0.6 + 1.1 and a.cd == 0:
                n = delta.normalized()
                self.vel = self.vel - n * (2 * self.vel.dot(n) * 0.9) + n * 6
                a.vel -= n * 4
                a.cd = 1.0
                if self.hit_cd <= 0:
                    self.shield -= 22
                    self.hit_cd = 0.8
                    self.play('hit')
                    try:
                        camera.shake(duration=0.3, magnitude=1.2)
                    except Exception:
                        pass
        self.hit_cd = max(0, self.hit_cd - dt)
        if self.shield <= 0:
            return self.end('dead', 'КОРАБЛЬ РАЗРУШЕН', f'Астероиды оказались сильнее. Ядер: {self.collected}/{CORES_TOTAL}', 'die')

        # врата
        if self.gate and (self.gate.position - self.pos).length() < Gate.RADIUS:
            score = int(max(0, 5000 - self.t * 20) + self.shield * 10 + self.fuel * 5)
            return self.end('won', 'ТЫ СБЕЖАЛ!', f'Время: {self.t:0.1f} с   Счёт: {score}', 'win')

        # предупреждения о гравитации
        gacc = g.length()
        self.warn_t -= dt
        if gacc > THRUST * 0.9:
            self.t_warn.text = 'ТОЧКА НЕВОЗВРАТА!'
            if self.warn_t <= 0:
                self.play('warn'); self.warn_t = 0.9
        elif r < 24:
            self.t_warn.text = 'Сильная гравитация'
        elif self.fuel <= 0:
            self.t_warn.text = 'Топливо кончилось'
        else:
            self.t_warn.text = ''

    # ---- HUD
    def project(self, target):
        """Положение точки на экране (в координатах camera.ui) и признак «позади»."""
        v = target - self.ship.world_position
        fwd, right, up = self.ship.forward, self.ship.right, self.ship.up
        z = v.dot(fwd)
        k = math.tan(math.radians(camera.fov) / 2)
        asp = window.aspect_ratio
        if z <= 0.01:
            x, y = v.dot(right), v.dot(up)
            m = max(abs(x), abs(y), 1e-6)
            return Vec2(x / m * 0.42 * asp, y / m * 0.42), True
        sx = v.dot(right) / z / k * 0.5 * asp
        sy = v.dot(up) / z / k * 0.5 * asp
        behind = abs(sx) > 0.46 * asp or abs(sy) > 0.46
        sx = max(-0.46 * asp, min(0.46 * asp, sx))
        sy = max(-0.46, min(0.46, sy))
        return Vec2(sx, sy), behind

    def update_hud(self):
        r = self.pos.length()
        self.t_cores.text = f'ЯДРА  {self.collected}/{CORES_TOTAL}'
        self.t_time.text = f'{int(self.t // 60):02d}:{int(self.t % 60):02d}'
        self.t_dist.text = f'До горизонта: {max(0, r - BH_RADIUS):5.1f}'
        self.t_speed.text = f'Скорость: {self.vel.length():5.1f}   Притяжение: {self.gravity(self.pos).length():4.1f}'
        self.bars['fuel'].scale_x = 0.4 * max(0.001, self.fuel / FUEL_MAX)
        self.bars['shield'].scale_x = 0.4 * max(0.001, self.shield / 100)
        near = max(0.0, min(0.75, (14 - r) / 12)) if self.state == 'play' else 0.7
        self.vignette.color = color.rgba32(110, 0, 0, int(255 * near)) if self.state != 'won' else color.rgba32(0, 30, 15, int(255 * near))
        tgt = None
        if self.state == 'play':
            if self.gate:
                tgt = self.gate.position
            elif self.cores:
                tgt = min(self.cores, key=lambda c: (c.position - self.pos).length()).position
        self.marker.enabled = self.marker_txt.enabled = tgt is not None
        if tgt is not None:
            p, edge = self.project(tgt)
            self.marker.position = Vec3(p.x, p.y, -1)
            self.marker_txt.position = Vec3(p.x, p.y - 0.025, -1)
            self.marker_txt.text = f'{(tgt - self.pos).length():.0f}'
            col = color.rgb32(120, 255, 170) if self.gate else color.rgb32(120, 255, 240)
            self.marker.color = col if not edge else color.rgba(col.r, col.g, col.b, 0.6)

    # ---- ввод
    def input(self, key):
        if key == 'r':
            self.reset()
        elif key in ('p', 'escape') and self.state == 'play':
            self.paused = not self.paused
            mouse.locked = not self.paused
            mouse.visible = self.paused
            if self.paused:
                self.show('ПАУЗА', 'P — продолжить   R — заново', color.white, None, scale=3.0)
            else:
                self.show('', '', color.white, None)
        elif key == 'left mouse down' and self.paused:
            self.input('p')


def make_game(**kwargs):
    kwargs.setdefault('development_mode', False)
    app = Ursina(title='Побег от чёрной дыры', **kwargs)
    game = Game()
    return app, game


if __name__ == '__main__':
    app, game = make_game()
    app.run()
