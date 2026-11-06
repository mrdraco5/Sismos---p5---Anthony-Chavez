// DECLARACIONES

// Dirección de los datos (sismos del último mes, M 2.5 o más)
const URL_SISMOS =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/' +
  'summary/2.5_month.geojson';

// Respuesta completa del servidor (GeoJSON)
let crudo;
// Lista limpia: un objeto sencillo por cada sismo
let sismos = [];
// Ondas que se están animando en este momento
let anillos = [];
// Fecha del primer sismo y duración del periodo (en milisegundos)
let t0, duracion;
// Cuántos sismos ya "ocurrieron" en la animación
let indice = 0;
// Fecha simulada del cuadro anterior
let ultimoAhora = 0;
// Magnitud mínima que se dibuja y se escucha
let magMin = 5;
// Botón de sonido, oscilador, envolvente y estado del audio
let botonSonido, osc, env;
let sonidoActivo = false;

// CARGA DE DATOS (se ejecuta antes que setup)
function preload() {
  crudo = loadJSON(URL_SISMOS);
}

// FUNCIÓN DE CONFIGURACIÓN
function setup() {
  let ancho = min(windowWidth, 1000);
  createCanvas(ancho, ancho / 2);

  // Convierte cada elemento del GeoJSON en un objeto sencillo
  sismos = crudo.features
    .map(f => ({
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      prof: f.geometry.coordinates[2],
      mag: f.properties.mag,
      lugar: f.properties.place,
      t: f.properties.time
    }))
    .filter(s => s.mag !== null)  // quita registros sin magnitud
    .sort((a, b) => a.t - b.t);   // del más antiguo al más nuevo

  // Fecha del primer sismo y duración total del periodo
  t0 = sismos[0].t;
  duracion = sismos[sismos.length - 1].t - t0;

  // Botón para activar el sonido
  botonSonido = createButton('Activar sonido');
  botonSonido.mousePressed(alternarSonido);

  // Oscilador de onda seno controlado por una envolvente
  osc = new p5.Oscillator('sine');
  env = new p5.Envelope();
  env.setADSR(0.01, 0.15, 0.1, 0.4);
  env.setRange(0.4, 0);
  osc.amp(env);
}

// FUNCIÓN DONDE SE PROGRAMA LA ANIMACIÓN
function draw() {
  background(10, 12, 30);
  dibujarCuadricula();

  // Reloj simulado: el mes completo dura 60 segundos reales
  let ahora = t0 + (millis() * duracion / 60000) % duracion;
  if (ahora < ultimoAhora) {
    // Empezó otra vuelta: se reinicia la animación
    indice = 0;
    anillos = [];
  }
  ultimoAhora = ahora;

  // Dispara los sismos cuya fecha ya llegó
  while (indice < sismos.length && sismos[indice].t <= ahora) {
    let s = sismos[indice];
    indice++;
    if (s.mag >= magMin) {
      anillos.push({ s: s, nacio: millis() });
      sonar(s);
    }
  }

  // Puntos permanentes: sismos que ya ocurrieron
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

  // Ondas que crecen y se desvanecen en tres segundos
  noFill();
  for (let i = anillos.length - 1; i >= 0; i--) {
    let a = anillos[i];
    let edad = (millis() - a.nacio) / 3000;  // va de 0 a 1
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

  // Texto con la fecha simulada
  noStroke();
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text(new Date(ahora).toLocaleDateString('es-CO'), 10, 10);
}

// FUNCIONES AUXILIARES

// Convierte longitud y latitud en posición dentro del lienzo
function proyectar(lon, lat) {
  return {
    x: map(lon, -180, 180, 0, width),
    y: map(lat, 90, -90, 0, height)
  };
}

// Diámetro del círculo según la magnitud
function tamano(mag) {
  return map(mag, 2.5, 8, 6, 80);
}

// Color según la profundidad: amarillo (cerca) a morado (lejos)
function colorProfundidad(prof) {
  let f = constrain(prof / 300, 0, 1);
  return lerpColor(color('#ffd166'), color('#7b2cbf'), f);
}

// Líneas de referencia cada 30 grados
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

// Activa o silencia el audio con el botón
function alternarSonido() {
  // El navegador exige un clic del usuario para permitir audio
  userStartAudio();
  sonidoActivo = !sonidoActivo;
  if (sonidoActivo) {
    osc.start();
  } else {
    osc.stop();
  }
  botonSonido.html(sonidoActivo ? 'Silenciar' : 'Activar sonido');
}

// Hace sonar un sismo: más magnitud, tono más grave
function sonar(s) {
  if (!sonidoActivo) return;
  osc.freq(map(s.mag, 2.5, 8, 880, 110));
  // Izquierda o derecha según la longitud
  osc.pan(map(s.lon, -180, 180, -1, 1));
  env.play();
}
