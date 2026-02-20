const ENDPOINT = "http://172.17.18.25:3001/api/vuelos-live"; // Asegúrate del puerto!

const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([19.4361, -99.0719], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
}).addTo(map);

let capaMarcadores = L.layerGroup().addTo(map);

// --- ESTADOS DE LA INTERFAZ ---
let hexSeleccionado = null; // Recuerda qué avión estamos viendo en el panel
let mostrarEtiquetas = false; // Estado del botón de etiquetas

// --- CONTROLES DE INTERFAZ ---
// Botón de etiquetas
document.getElementById('toggle-labels').addEventListener('click', (e) => {
    mostrarEtiquetas = !mostrarEtiquetas;
    e.target.classList.toggle('active', mostrarEtiquetas);
    cargarVuelos(); // Forzamos redibujado instantáneo
});

// Barra redimensionable (Resizer)
const resizer = document.getElementById('resizer');
const leftPanel = document.getElementById('map-panel');
const container = document.querySelector('.main-container');
let isResizing = false;

resizer.addEventListener('mousedown', () => { isResizing = true; resizer.classList.add('resizing'); document.body.style.cursor = 'col-resize'; });
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX - container.getBoundingClientRect().left;
    if (newWidth > 300 && newWidth < container.clientWidth - 300) {
        leftPanel.style.flexBasis = `${newWidth}px`;
        map.invalidateSize(); 
    }
});
document.addEventListener('mouseup', () => { isResizing = false; resizer.classList.remove('resizing'); document.body.style.cursor = 'default'; map.invalidateSize(); });

// Reloj
function actualizarFechaHora() {
    document.getElementById('fecha-hora').textContent = new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '');
}
setInterval(actualizarFechaHora, 1000); actualizarFechaHora();

function getIconoAvion() {
    return L.icon({
        iconUrl: 'imgMapaVuelos/avion.png', 
        iconSize: [24, 24], 
        iconAnchor: [12, 12], 
        className: 'icono-avion-filtro' 
    });
}

// Actualiza los textos del recuadro inferior derecho
function actualizarPanelDetalles(v) {
    const panel = document.getElementById('flight-details');
    panel.classList.remove('hidden'); // Mostrar panel
    
    let colorTexto = "#ffffff";
    if (v.status === 'EMERGENCIA' || v.status === 'SECUESTRO') colorTexto = "#ff4444";
    if (v.status === 'EN_TIERRA') colorTexto = "#ffc107";

    const titulo = document.getElementById('det-callsign');
    titulo.textContent = v.callsign ? v.callsign.trim() : 'N/A';
    titulo.style.color = colorTexto;

    document.getElementById('det-hex').textContent = v.id;
    document.getElementById('det-status').textContent = v.status;
    document.getElementById('det-alt').textContent = v.alt !== null ? v.alt : '--';
    document.getElementById('det-spd').textContent = v.speed !== null ? v.speed : '--';
    document.getElementById('det-track').textContent = v.track !== null ? v.track : '--';
    document.getElementById('det-pista').textContent = v.pista || '--';
    document.getElementById('det-squawk').textContent = v.squawk || '--';
}

async function cargarVuelos() {
    try {
        const res = await fetch(ENDPOINT);
        const vuelos = await res.json();

        capaMarcadores.clearLayers();
        const listaOperaciones = document.getElementById('operaciones-list');
        listaOperaciones.innerHTML = '';

        // Variable para verificar si el avión seleccionado sigue existiendo
        let avionSeleccionadoSigueVivo = false;

        vuelos.forEach(v => {
            // --- PINTAR EN MAPA ---
            if (v.lat && v.lng) {
                const rotation = v.track || v.rumbo || 0; 

                const marker = L.marker([v.lat, v.lng], {
                    icon: getIconoAvion(),
                    rotationAngle: rotation, 
                    rotationOrigin: 'center center'
                });

                // --- ETIQUETAS (LABELS) ---
                if (mostrarEtiquetas) {
                    const textoEtiqueta = v.callsign ? v.callsign.trim() : v.id;
                    marker.bindTooltip(textoEtiqueta, {
                        permanent: true, 
                        direction: 'top', 
                        className: 'flight-label', 
                        offset: [0, -15] // Un poco arriba del avión
                    });
                }

                // --- CLIC EN EL AVIÓN ---
                marker.on('click', () => {
                    hexSeleccionado = v.id; // Guardamos cuál clickeó
                    actualizarPanelDetalles(v);
                });

                // Si este avión es el que tenemos seleccionado, actualizamos su info en vivo
                if (hexSeleccionado === v.id) {
                    actualizarPanelDetalles(v);
                    avionSeleccionadoSigueVivo = true;
                }

                marker.addTo(capaMarcadores);
            }

            // --- LLENAR TABLA ---
            const li = document.createElement('li');
            let estadoClass = 'estado-vuelo';
            if (v.status === 'EN_TIERRA') estadoClass = 'estado-tierra';
            if (v.status === 'EMERGENCIA' || v.status === 'SECUESTRO' || v.status === 'FALLA_RADIO') estadoClass = 'estado-emergencia';

            let horaEvento = v.last_seen;
            if(v.status === 'EN_TIERRA' && v.aterrizaje_time) horaEvento = v.aterrizaje_time;
            if(v.status === 'EN_VUELO' && v.despegue_time) horaEvento = v.despegue_time;
            horaEvento = horaEvento ? horaEvento.split(' ')[1] : '--:--:--';

            li.innerHTML = `
                <span class="td ${estadoClass}" style="flex: 1;">${v.status}</span>
                <span class="td" style="flex: 0.8;">${v.id}</span>
                <span class="td" style="font-weight:bold; flex: 1;">${v.callsign || 'N/A'}</span>
                <span class="td" style="flex: 1.2;">${v.pista || '--'}</span>
                <span class="td" style="flex: 0.8;">${horaEvento}</span>
            `;
            
            // Opcional: Hacer click en la tabla también selecciona el avión
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
                hexSeleccionado = v.id;
                actualizarPanelDetalles(v);
                map.panTo([v.lat, v.lng]); // Mueve el mapa hacia el avión
            });

            listaOperaciones.appendChild(li);
        });

        // Si el avión que estábamos viendo desapareció del radar, ocultamos el panel
        if (hexSeleccionado && !avionSeleccionadoSigueVivo) {
            document.getElementById('flight-details').classList.add('hidden');
            hexSeleccionado = null;
        }

    } catch (error) {
        console.error("❌ Error al cargar vuelos:", error);
    }
}

cargarVuelos();
setInterval(cargarVuelos, 1500);