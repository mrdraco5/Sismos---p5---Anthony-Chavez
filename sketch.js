// DECLARACIONES

const URL_SISMOS =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/' +
  'summary/2.5_month.geojson';

let crudo;
let sismos = [];
let anillos = [];
let t0, duracion;
let indice = 0;
let ultimoAhora = 0;
let magMin = 5;

// Variables de interfaz y sonido
let botonSonido, osc, env;
let sonidoActivo = false;
let sliderMag;

function preload() {
  crudo = loadJSON(URL_SISMOS);
}

function setup() {
  let ancho = min(windowWidth, 1000);
  createCanvas(ancho, ancho / 2);

  sismos = crudo.features
    .map(f => ({
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      prof: f.geometry.coordinates[2],
      mag: f.properties.mag,
      lugar: f.properties.place,
      t: f.properties.time
    }))
    .filter(s => s.mag !== null)
    .sort((a, b) => a.t - b.t);

  t0 = sismos[0].t;
  duracion = sismos[sismos.length - 1].t - t0;

  botonSonido = createButton('Activar sonido');
  botonSonido.mousePressed(alternarSonido);

  // RETO 1
  sliderMag = createSlider(2.5, 8, magMin, 0.1);
  sliderMag.position(130, height + 10);

  // RETO 3
  osc = new p5.Oscillator('triangle'); 
  env = new p5.Envelope();
  env.setADSR(0.01, 0.15, 0.1, 0.4);
  env.setRange(0.4, 0);
  osc.amp(env);
}

function draw() {
  background(10, 12, 30);
  dibujarCuadricula();

  // RETO 1: Leer el valor del slider en tiempo real
  magMin = sliderMag.value();

  let ahora = t0 + (millis() * duracion / 60000) % duracion;
  if (ahora < ultimoAhora) {
    indice = 0;
    anillos = [];
  }
  ultimoAhora = ahora;

  while (indice < sismos.length && sismos[indice].t <= ahora) {
    let s = sismos[indice];
    indice++;
    if (s.mag >= magMin) {
      anillos.push({ s: s, nacio: millis() });
      sonar(s);
    }
  }

  noStroke();
  for (let i = 0; i < indice; i++) {
    let s = sismos[i];
    if (s.mag < magMin) continue;
    let p = proyectar(s.lon, s.lat);
    let c = colorProfundidad(s.prof);
    c.setAlpha(140);
    fill(c);
    circle(p.x, p.y, 3);
  }

  noFill();
  for (let i = anillos.length - 1; i >= 0; i--) {
    let a = anillos[i];
    let edad = (millis() - a.nacio) / 3000;
    if (edad > 1) {
      anillos.splice(i, 1);
      continue;
    }
    let p = proyectar(a.s.lon, a.s.lat);
    let c = colorProfundidad(a.s.prof);
    c.setAlpha(255 * (1 - edad));
    stroke(c);
    strokeWeight(2);
    circle(p.x, p.y, tamano(a.s.mag) * (0.3 + 2 * edad));
  }

  // Textos de interfaz estáticos
  noStroke();
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text(new Date(ahora).toLocaleDateString('es-CO'), 10, 10);
  text('Filtro de magnitud: ' + magMin, 10, 30);

  // RETO 2: Sismo más cercano al cursor
  let sismoCercano = null;
  let distanciaMinima = Infinity;

  for (let i = 0; i < indice; i++) {
    let s = sismos[i];
    if (s.mag < magMin) continue;
    let p = proyectar(s.lon, s.lat);
    let d = dist(mouseX, mouseY, p.x, p.y); 
    
    if (d < distanciaMinima) {
      distanciaMinima = d;
      sismoCercano = s;
    }
  }

  // Si se encuentra uno y el cursor está relativamente cerca (a menos de 40 píxeles)
  if (sismoCercano && distanciaMinima < 40) {
    fill(255);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    // Se escriben los datos del sismo cerca del cursor
    text(`${sismoCercano.lugar}\nMag: ${sismoCercano.mag}\nProf: ${sismoCercano.prof} km`, mouseX + 15, mouseY - 15);
  }
}

// FUNCIONES AUXILIARES
function proyectar(lon, lat) {
  return {
    x: map(lon, -180, 180, 0, width),
    y: map(lat, 90, -90, 0, height)
  };
}

function tamano(mag) {
  return map(mag, 2.5, 8, 6, 80);
}

function colorProfundidad(prof) {
  let f = constrain(prof / 300, 0, 1);
  return lerpColor(color('#ffd166'), color('#7b2cbf'), f);
}

function dibujarCuadricula() {
  stroke(255, 25);
  strokeWeight(1);
  for (let lon = -180; lon <= 180; lon += 30) {
    let x = proyectar(lon, 0).x;
    line(x, 0, x, height);
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    let y = proyectar(0, lat).y;
    line(0, y, width, y);
  }
}

// SONIDO
function alternarSonido() {
  userStartAudio();
  sonidoActivo = !sonidoActivo;
  if (sonidoActivo) {
    osc.start();
  } else {
    osc.stop();
  }
  botonSonido.html(sonidoActivo ? 'Silenciar' : 'Activar sonido');
}

function sonar(s) {
  if (!sonidoActivo) return;
  osc.freq(map(s.mag, 2.5, 8, 880, 110));
  osc.pan(map(s.lon, -180, 180, -1, 1));
  env.play();
}